import React from 'react';
import { Alert, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import DataManagementScreen from '../src/screens/home/DataManagementScreen';
import OfflineSyncReviewModal from '../src/components/OfflineSyncReviewModal';
import { homeWidget } from '../src/native/homeWidget';
import { offlineTransactionQueue } from '../src/services/offlineTransactionQueue';
import { offlineTransactionChanges } from '../src/services/offlineTransactionChanges';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: undefined }),
}));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 9 }, token: 'qa' }),
}));
jest.mock('../src/services/api', () => ({
  getApiStorageBaseUrl: () => 'https://qa.test',
}));
jest.mock('../src/services/dashboardCache', () => ({
  dashboardCache: { read: jest.fn() },
}));
jest.mock('../src/native/homeWidget', () => ({
  homeWidget: { connected: jest.fn() },
}));
jest.mock('../src/services/offlineTransactionQueue', () => ({
  mayHaveReachedServer: jest.requireActual(
    '../src/services/offlineTransactionQueue',
  ).mayHaveReachedServer,
  offlineTransactionQueue: {
    list: jest.fn(),
    subscribe: jest.fn(),
    sync: jest.fn(),
    discardLocal: jest.fn(),
  },
}));
jest.mock('../src/services/offlineTransactionChanges', () => ({
  offlineTransactionChanges: {
    list: jest.fn(),
    preview: jest.fn(),
    subscribe: jest.fn(),
    sync: jest.fn(),
    discard: jest.fn(),
  },
}));
jest.mock('../src/services/financeRefresh', () => ({
  financeRefresh: { emit: jest.fn() },
}));

const draft = {
  server: 'https://qa.test',
  id: 'txn_manual_1',
  createdAt: '2026-11-19T01:00:00.000Z',
  updatedAt: '2026-11-19T01:00:00.000Z',
  status: 'PENDING',
  attempts: 0,
  payload: {
    type: 'EXPENSE',
    wallet_id: 2,
    amount: '4157',
    note: 'QA_offline_19_Nov',
    client_request_id: 'txn_manual_1',
  },
};

let renderer: TestRenderer.ReactTestRenderer | undefined;
const review = () => renderer!.root.findByType(OfflineSyncReviewModal);
const openReview = async () => {
  const button = renderer!.root.find(
    node => node.props.accessibilityLabel === 'Đồng bộ giao dịch ngoại tuyến',
  );
  await act(async () => button.props.onPress());
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.mocked(homeWidget.connected).mockResolvedValue(true);
  jest.mocked(offlineTransactionQueue.subscribe).mockReturnValue(jest.fn());
  jest.mocked(offlineTransactionChanges.subscribe).mockReturnValue(jest.fn());
  jest.mocked(offlineTransactionQueue.list).mockResolvedValue([draft as never]);
  jest.mocked(offlineTransactionChanges.list).mockResolvedValue([]);
  jest.mocked(offlineTransactionChanges.preview).mockResolvedValue([]);
  jest.mocked(offlineTransactionQueue.sync).mockResolvedValue({
    synced: 1,
    pending: 0,
    needsReview: 0,
  });
  jest.mocked(offlineTransactionChanges.sync).mockResolvedValue({
    synced: 0,
    pending: 0,
    needsReview: 0,
  });
  jest.mocked(offlineTransactionQueue.discardLocal).mockResolvedValue(1);
  jest.mocked(offlineTransactionChanges.discard).mockResolvedValue(0);
});
afterEach(async () => {
  if (renderer) await act(() => renderer!.unmount());
  renderer = undefined;
  jest.restoreAllMocks();
});

it('shows the actual offline transaction before manual sync and lets the user defer', async () => {
  await act(async () => {
    renderer = TestRenderer.create(<DataManagementScreen />);
  });
  await openReview();
  expect(review().props.review.drafts[0].payload.amount).toBe('4157');
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node =>
        String(node.props.children).includes(
          'Máy chủ: Chưa xác định đã nhận khoản này',
        ),
      ),
  ).toBe(true);
  expect(offlineTransactionQueue.sync).not.toHaveBeenCalled();
  await act(async () => review().props.onChoose('later'));
  expect(review().props.review).toBeNull();
  expect(offlineTransactionQueue.sync).not.toHaveBeenCalled();

  await openReview();
  await act(async () => review().props.onChoose('local'));
  expect(offlineTransactionQueue.sync).toHaveBeenCalledWith(
    'qa',
    9,
    expect.any(Function),
    [{ id: draft.id, updatedAt: draft.updatedAt }],
  );
});

it('requires a second confirmation before discarding the phone copy', async () => {
  await act(async () => {
    renderer = TestRenderer.create(<DataManagementScreen />);
  });
  await openReview();
  await act(async () => review().props.onChoose('server'));
  expect(offlineTransactionQueue.discardLocal).not.toHaveBeenCalled();
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
  expect(buttons?.find(button => button.text === 'Bỏ thay đổi')).toBeDefined();
  await act(async () =>
    buttons?.find(button => button.text === 'Bỏ thay đổi')?.onPress?.(),
  );
  expect(offlineTransactionQueue.discardLocal).toHaveBeenCalledWith(9, [
    { id: draft.id, updatedAt: draft.updatedAt },
  ]);
  expect(offlineTransactionQueue.sync).not.toHaveBeenCalled();
});

it('warns before editing or removing a payment whose server result is unknown', async () => {
  jest
    .mocked(offlineTransactionQueue.list)
    .mockResolvedValue([
      { ...draft, attempts: 1, rejectedByServer: false } as never,
    ]);
  await act(async () => {
    renderer = TestRenderer.create(<DataManagementScreen />);
  });
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node =>
        String(node.props.children).includes(
          'Đã thử gửi · cần đối chiếu máy chủ',
        ),
      ),
  ).toBe(true);
  await act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Sửa bản nháp' })
      .props.onPress(),
  );
  expect(jest.mocked(Alert.alert).mock.calls.at(-1)?.[0]).toBe(
    'Cần đối chiếu trước',
  );
  await act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Xóa bản nháp' })
      .props.onPress(),
  );
  expect(jest.mocked(Alert.alert).mock.calls.at(-1)?.[0]).toBe(
    'Cần đối chiếu trước',
  );
  expect(jest.mocked(Alert.alert).mock.calls.at(-1)?.[2]).toBeUndefined();
});
