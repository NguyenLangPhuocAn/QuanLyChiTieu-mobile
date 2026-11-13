import React from 'react';
import { Alert, AppState, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import OfflineSessionSync from '../src/components/OfflineSessionSync';
import { homeWidget } from '../src/native/homeWidget';
import {
  offlineTransactionQueue as queue,
  type OfflineTransactionDraft,
} from '../src/services/offlineTransactionQueue';
import { financeRefresh } from '../src/services/financeRefresh';
import { offlineTransactionChanges as changes } from '../src/services/offlineTransactionChanges';

const mockRetry = jest.fn();
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 9 },
    token: 'qa',
    isRestoringSession: false,
    retryRestoreSession: mockRetry,
  }),
}));
jest.mock('../src/services/api', () => ({
  getApiStorageBaseUrl: () => 'https://qa.test',
}));
jest.mock('../src/native/homeWidget', () => ({
  homeWidget: { connected: jest.fn(), subscribe: jest.fn() },
}));
jest.mock('../src/services/offlineTransactionQueue', () => ({
  offlineTransactionQueue: {
    list: jest.fn(),
    sync: jest.fn(),
    discardLocal: jest.fn(),
    subscribe: jest.fn(),
  },
}));
jest.mock('../src/services/financeRefresh', () => ({
  financeRefresh: { emit: jest.fn() },
}));
jest.mock('../src/services/offlineTransactionChanges', () => ({
  offlineTransactionChanges: {
    list: jest.fn(),
    preview: jest.fn(),
    discard: jest.fn(),
    sync: jest.fn(),
  },
}));

const draft = {
  server: 'https://qa.test',
  id: 'txn_qa_1234567890',
  updatedAt: '2026-11-13T08:00:00.000Z',
  createdAt: '2026-11-13T08:00:00.000Z',
  status: 'PENDING',
  attempts: 0,
  payload: {
    wallet_id: 2,
    amount: '5000',
    type: 'EXPENSE',
    client_request_id: 'txn_qa_1234567890',
  },
} as OfflineTransactionDraft;
let renderer: TestRenderer.ReactTestRenderer | undefined;
let online: () => void;
const choice = (label: string) => {
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
  const button = buttons?.find(item => item.text === label);
  expect(button).toBeDefined();
  return button!;
};
const pressReview = (label: string) => {
  const target = renderer!.root
    .findAllByType(Text)
    .find(node => node.props.children === label);
  expect(target).toBeDefined();
  let parent = target!.parent;
  while (parent && typeof parent.props.onPress !== 'function')
    parent = parent.parent;
  expect(parent).toBeDefined();
  parent!.props.onPress();
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
  });
  jest.mocked(homeWidget.connected).mockResolvedValue(true);
  jest.mocked(homeWidget.subscribe).mockImplementation(listener => {
    online = listener;
    return jest.fn();
  });
  jest.mocked(queue.subscribe).mockReturnValue(jest.fn());
  jest.mocked(queue.list).mockResolvedValue([]);
  jest
    .mocked(queue.sync)
    .mockResolvedValue({ synced: 1, pending: 0, needsReview: 0 });
  jest.mocked(queue.discardLocal).mockResolvedValue(1);
  jest.mocked(changes.list).mockResolvedValue([]);
  jest.mocked(changes.preview).mockResolvedValue([]);
  jest.mocked(changes.discard).mockResolvedValue(0);
  jest
    .mocked(changes.sync)
    .mockResolvedValue({ synced: 0, pending: 0, needsReview: 0 });
  mockRetry.mockResolvedValue(true);
});
afterEach(async () => {
  if (renderer) await act(() => renderer!.unmount());
  renderer = undefined;
  jest.restoreAllMocks();
});

it('refreshes server data when no offline writes are pending', async () => {
  const refreshed = jest.fn().mockResolvedValue(undefined);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync onSynced={refreshed} />);
  });
  expect(queue.sync).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(refreshed).toHaveBeenCalledTimes(1);
  expect(refreshed.mock.invocationCallOrder[0]).toBeLessThan(
    jest.mocked(financeRefresh.emit).mock.invocationCallOrder[0],
  );
});

it('waits for an explicit local choice before sending any money to the server', async () => {
  jest.mocked(queue.list).mockResolvedValue([draft]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Giao dịch mới'),
  ).toBe(true);
  expect(queue.sync).not.toHaveBeenCalled();
  await act(async () => {
    online();
    online();
  });
  expect(queue.sync).not.toHaveBeenCalled();
  await act(async () => {
    pressReview('Dùng thay đổi trên máy');
  });
  expect(queue.sync).toHaveBeenCalledTimes(1);
  expect(queue.discardLocal).not.toHaveBeenCalled();
});

it('requires a second confirmation before discarding local writes', async () => {
  jest.mocked(queue.list).mockResolvedValue([draft]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  await act(async () => {
    pressReview('Giữ dữ liệu máy chủ');
  });
  expect(queue.discardLocal).not.toHaveBeenCalled();
  await act(async () => {
    choice('Bỏ thay đổi').onPress?.();
  });
  expect(queue.discardLocal).toHaveBeenCalledWith(9, [
    { id: draft.id, updatedAt: draft.updatedAt },
  ]);
  expect(changes.discard).toHaveBeenCalledWith(9, []);
  expect(queue.sync).not.toHaveBeenCalled();
});

it('prompts again for a later write with the same draft identifier and timestamp', async () => {
  jest.mocked(queue.list).mockResolvedValue([draft]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  await act(async () => {
    pressReview('Giữ dữ liệu máy chủ');
    choice('Bỏ thay đổi').onPress?.();
  });
  await act(async () => {
    online();
  });
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Giao dịch mới'),
  ).toBe(true);
});

it('keeps drafts untouched when the user chooses later or auth cannot revalidate', async () => {
  jest.mocked(queue.list).mockResolvedValue([draft]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  await act(async () => {
    pressReview('Để sau');
  });
  await act(async () => {
    online();
  });
  expect(queue.sync).not.toHaveBeenCalled();
  expect(queue.discardLocal).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
  await act(() => renderer!.unmount());
  renderer = undefined;
  mockRetry.mockResolvedValue(false);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(queue.sync).not.toHaveBeenCalled();
  expect(queue.discardLocal).not.toHaveBeenCalled();
});

it('does not prompt while offline', async () => {
  jest.mocked(homeWidget.connected).mockResolvedValue(false);
  jest.mocked(queue.list).mockResolvedValue([draft]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(mockRetry).not.toHaveBeenCalled();
});
