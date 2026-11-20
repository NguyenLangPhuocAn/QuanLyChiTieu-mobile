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
let mockUserId = 9;
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: mockUserId },
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
    isSyncing: jest.fn(),
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
    subscribe: jest.fn(),
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
let queueChanged: () => void;
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
  mockUserId = 9;
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
  jest.mocked(queue.subscribe).mockImplementation(listener => {
    queueChanged = listener;
    return jest.fn();
  });
  jest.mocked(queue.list).mockResolvedValue([]);
  jest.mocked(queue.isSyncing).mockReturnValue(false);
  jest
    .mocked(queue.sync)
    .mockResolvedValue({ synced: 1, pending: 0, needsReview: 0 });
  jest.mocked(queue.discardLocal).mockResolvedValue(1);
  jest.mocked(changes.list).mockResolvedValue([]);
  jest.mocked(changes.subscribe).mockReturnValue(jest.fn());
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

it('reviews a persisted syncing marker after an app restart without auto-sending', async () => {
  jest
    .mocked(queue.list)
    .mockResolvedValue([
      { ...draft, status: 'SYNCING', attempts: 1 } as OfflineTransactionDraft,
    ]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Giao dịch mới'),
  ).toBe(true);
  expect(queue.sync).not.toHaveBeenCalled();
});

it('reacts to Android network recovery without writing before confirmation', async () => {
  jest
    .mocked(homeWidget.connected)
    .mockResolvedValueOnce(false)
    .mockResolvedValue(true);
  jest.mocked(queue.list).mockResolvedValue([draft]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(mockRetry).not.toHaveBeenCalled();
  await act(async () => {
    online();
  });
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Giao dịch mới'),
  ).toBe(true);
  expect(queue.sync).not.toHaveBeenCalled();
});

it('offers the choice after the API recovers without a Wi-Fi change or app restart', async () => {
  jest.useFakeTimers();
  try {
    jest.mocked(queue.list).mockResolvedValue([draft]);
    mockRetry.mockResolvedValueOnce(false).mockResolvedValue(true);
    await act(async () => {
      renderer = TestRenderer.create(<OfflineSessionSync />);
    });
    expect(queue.sync).not.toHaveBeenCalled();
    expect(
      renderer!.root
        .findAllByType(Text)
        .some(node => node.props.children === 'Giao dịch mới'),
    ).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    expect(
      renderer!.root
        .findAllByType(Text)
        .some(node => node.props.children === 'Giao dịch mới'),
    ).toBe(true);
    expect(queue.sync).not.toHaveBeenCalled();

    await act(async () => {
      pressReview('Để sau');
      jest.advanceTimersByTime(60_000);
    });
    expect(mockRetry).toHaveBeenCalledTimes(2);
    expect(queue.sync).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

it('asks again after a confirmed sync loses its network response and keeps the draft', async () => {
  jest.useFakeTimers();
  try {
    jest.mocked(queue.list).mockResolvedValue([draft]);
    jest
      .mocked(queue.sync)
      .mockResolvedValue({ synced: 0, pending: 1, needsReview: 0 });
    await act(async () => {
      renderer = TestRenderer.create(<OfflineSessionSync />);
    });
    await act(async () => {
      pressReview('Dùng thay đổi trên máy');
    });
    expect(queue.sync).toHaveBeenCalledTimes(1);
    expect(queue.discardLocal).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    expect(
      renderer!.root
        .findAllByType(Text)
        .some(node => node.props.children === 'Giao dịch mới'),
    ).toBe(true);
    expect(queue.sync).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

it('does not show a stale choice after a manual sync clears the queue', async () => {
  jest
    .mocked(queue.list)
    .mockResolvedValueOnce([draft])
    .mockResolvedValueOnce([]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Giao dịch mới'),
  ).toBe(false);
  expect(queue.sync).not.toHaveBeenCalled();
});

it('closes an already visible choice when another screen discards its draft', async () => {
  jest.mocked(queue.list).mockResolvedValue([draft]);
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Giao dịch mới'),
  ).toBe(true);

  jest.mocked(queue.list).mockResolvedValue([]);
  await act(async () => queueChanged());
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Giao dịch mới'),
  ).toBe(false);
  expect(queue.sync).not.toHaveBeenCalled();
});

it('ignores an old account review after switching accounts', async () => {
  jest
    .mocked(queue.list)
    .mockImplementation(async userId => (userId === 9 ? [draft] : []));
  await act(async () => {
    renderer = TestRenderer.create(<OfflineSessionSync />);
  });
  const target = renderer!.root
    .findAllByType(Text)
    .find(node => node.props.children === 'Dùng thay đổi trên máy');
  expect(target).toBeDefined();
  let parent = target!.parent;
  while (parent && typeof parent.props.onPress !== 'function')
    parent = parent.parent;
  const staleChoice = parent!.props.onPress;

  mockUserId = 10;
  await act(async () => renderer!.update(<OfflineSessionSync />));
  await act(async () => staleChoice());

  expect(queue.list).toHaveBeenCalledWith(10);
  expect(queue.sync).not.toHaveBeenCalled();
  expect(queue.discardLocal).not.toHaveBeenCalled();
});
