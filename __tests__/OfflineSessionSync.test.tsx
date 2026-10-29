import React from 'react';
import { AppState } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import OfflineSessionSync from '../src/components/OfflineSessionSync';
import { homeWidget } from '../src/native/homeWidget';
import { offlineTransactionQueue as queue } from '../src/services/offlineTransactionQueue';
import { financeRefresh } from '../src/services/financeRefresh';
const mockRetry = jest.fn();
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 9 },
    token: 'qa',
    isRestoringSession: false,
    retryRestoreSession: mockRetry,
  }),
}));
jest.mock('../src/native/homeWidget', () => ({
  homeWidget: { connected: jest.fn(), subscribe: jest.fn() },
}));
jest.mock('../src/services/offlineTransactionQueue', () => ({
  offlineTransactionQueue: { sync: jest.fn(), subscribe: jest.fn() },
}));
jest.mock('../src/services/financeRefresh', () => ({
  financeRefresh: { emit: jest.fn() },
}));
let r: TestRenderer.ReactTestRenderer, online: () => void;
beforeEach(() => {
  jest.clearAllMocks();
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
  jest
    .mocked(queue.sync)
    .mockResolvedValue({ synced: 1, pending: 0, needsReview: 0 });
  mockRetry.mockResolvedValue(true);
});
afterEach(async () => {
  if (r) await act(() => r.unmount());
});
it('validates auth before syncing, refreshes confirmed data, and deduplicates concurrent network callbacks', async () => {
  await act(async () => {
    r = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(queue.sync).toHaveBeenCalledTimes(1);
  expect(financeRefresh.emit).toHaveBeenCalledTimes(1);
  let resolve!: (value: boolean) => void;
  mockRetry.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  await act(async () => {
    online();
    online();
  });
  expect(queue.sync).toHaveBeenCalledTimes(1);
  await act(async () => resolve(true));
  expect(queue.sync).toHaveBeenCalledTimes(2);
});
it('preserves the queue without attempting DB writes when offline, auth cannot revalidate, or component unmounts', async () => {
  jest.mocked(homeWidget.connected).mockResolvedValueOnce(false);
  await act(async () => {
    r = TestRenderer.create(<OfflineSessionSync />);
  });
  expect(mockRetry).not.toHaveBeenCalled();
  expect(queue.sync).not.toHaveBeenCalled();
  mockRetry.mockResolvedValueOnce(false);
  await act(async () => online());
  expect(queue.sync).not.toHaveBeenCalled();
  let resolve!: (value: boolean) => void;
  mockRetry.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  await act(async () => online());
  await act(() => r.unmount());
  await act(async () => resolve(true));
  expect(queue.sync).not.toHaveBeenCalled();
});
