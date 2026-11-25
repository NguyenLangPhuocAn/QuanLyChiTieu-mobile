import React from 'react';
import { Alert, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import DataManagementScreen from '../src/screens/home/DataManagementScreen';
import OfflineSyncReviewModal from '../src/components/OfflineSyncReviewModal';
import { homeWidget } from '../src/native/homeWidget';
import { offlineTransactionQueue } from '../src/services/offlineTransactionQueue';
import { offlineTransactionChanges } from '../src/services/offlineTransactionChanges';
import { offlineBudgetQueue } from '../src/services/offlineBudgetQueue';
import { offlineSavingsGoalQueue } from '../src/services/offlineSavingsGoalQueue';
import { savingsService } from '../src/services/savings';
import { offlineLoanCreateQueue } from '../src/services/offlineLoanCreateQueue';
import { walletsService } from '../src/services/wallets';

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
jest.mock('../src/services/offlineBudgetQueue', () => ({
  offlineBudgetQueue: {
    list: jest.fn(),
    preview: jest.fn(),
    subscribe: jest.fn(),
    sync: jest.fn(),
    rebaseReviewed: jest.fn(),
    discard: jest.fn(),
  },
}));
jest.mock('../src/services/offlineSavingsGoalQueue', () => ({
  offlineSavingsGoalQueue: {
    list: jest.fn(),
    preview: jest.fn(),
    subscribe: jest.fn(),
    sync: jest.fn(),
    rebaseReviewed: jest.fn(),
    discard: jest.fn(),
  },
}));
jest.mock('../src/services/savings', () => ({
  savingsService: { getAll: jest.fn() },
}));
jest.mock('../src/services/offlineLoanCreateQueue', () => ({
  offlineLoanCreateQueue: {
    list: jest.fn(),
    preview: jest.fn(),
    subscribe: jest.fn(),
    sync: jest.fn(),
    rebaseReviewed: jest.fn(),
    discard: jest.fn(),
  },
}));
jest.mock('../src/services/wallets', () => ({
  walletsService: { getAll: jest.fn() },
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
    note: 'Mua đồ ăn sáng',
    client_request_id: 'txn_manual_1',
  },
};

let renderer: TestRenderer.ReactTestRenderer | undefined;
const review = () => renderer!.root.findByType(OfflineSyncReviewModal);
const openReview = async () => {
  const button = renderer!.root.find(
    node => node.props.accessibilityLabel === 'Đồng bộ dữ liệu ngoại tuyến',
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
  jest.mocked(offlineBudgetQueue.list).mockResolvedValue([]);
  jest.mocked(offlineBudgetQueue.preview).mockResolvedValue([]);
  jest.mocked(offlineBudgetQueue.subscribe).mockReturnValue(jest.fn());
  jest.mocked(offlineSavingsGoalQueue.list).mockResolvedValue([]);
  jest.mocked(offlineSavingsGoalQueue.preview).mockResolvedValue([]);
  jest.mocked(offlineSavingsGoalQueue.subscribe).mockReturnValue(jest.fn());
  jest.mocked(offlineSavingsGoalQueue.rebaseReviewed).mockResolvedValue([]);
  jest
    .mocked(offlineSavingsGoalQueue.sync)
    .mockResolvedValue({ synced: 0, pending: 0, needsReview: 0 });
  jest.mocked(offlineSavingsGoalQueue.discard).mockResolvedValue(undefined);
  jest.mocked(savingsService.getAll).mockResolvedValue([]);
  jest.mocked(offlineLoanCreateQueue.list).mockResolvedValue([]);
  jest.mocked(offlineLoanCreateQueue.preview).mockResolvedValue([]);
  jest.mocked(offlineLoanCreateQueue.subscribe).mockReturnValue(jest.fn());
  jest.mocked(offlineLoanCreateQueue.rebaseReviewed).mockResolvedValue([]);
  jest
    .mocked(offlineLoanCreateQueue.sync)
    .mockResolvedValue({ synced: 0, pending: 0, needsReview: 0 });
  jest.mocked(offlineLoanCreateQueue.discard).mockResolvedValue(undefined);
  jest.mocked(walletsService.getAll).mockResolvedValue([]);
});

it('lets the user review a new local loan before manual sync', async () => {
  const wallet = {
    id: 2,
    name: 'Ví gia đình',
    currency: 'VND',
    balance: 500000,
    wallet_type: 'BANK',
  };
  const pending = {
    id: 'loan_20261124_abcdef123456',
    revision: 1,
    attempts: 0,
    status: 'PENDING' as const,
    updatedAt: '2026-11-24T05:00:00.000Z',
    wallet: {
      id: 2,
      name: wallet.name,
      currency: wallet.currency,
      balance: '500000',
    },
    payload: {
      person_name: 'Anh Minh',
      type: 'BORROWED' as const,
      principal_amount: '200000',
      wallet_id: 2,
      client_request_id: 'loan_20261124_abcdef123456',
    },
  };
  jest.mocked(offlineTransactionQueue.list).mockResolvedValue([]);
  jest.mocked(offlineLoanCreateQueue.list).mockResolvedValue([pending]);
  jest
    .mocked(offlineLoanCreateQueue.preview)
    .mockResolvedValue([{ id: pending.id, revision: 1 }]);
  jest
    .mocked(offlineLoanCreateQueue.rebaseReviewed)
    .mockResolvedValue([{ id: pending.id, revision: 1 }]);
  jest.mocked(walletsService.getAll).mockResolvedValue([wallet] as never);
  await act(async () => {
    renderer = TestRenderer.create(<DataManagementScreen />);
  });
  await openReview();
  expect(review().props.review.loanCreates).toEqual([pending]);
  expect(review().props.review.remoteLoanWallets).toEqual({ 2: wallet });
  expect(offlineLoanCreateQueue.sync).not.toHaveBeenCalled();
  await act(async () => review().props.onChoose('local'));
  expect(offlineLoanCreateQueue.sync).toHaveBeenCalledWith(
    'qa',
    9,
    [{ id: pending.id, revision: 1 }],
    { 2: wallet },
    expect.any(Function),
  );
});

it('lets the user review a budget even when no transaction is waiting', async () => {
  const pending = {
    id: -12,
    action: 'CREATE' as const,
    status: 'PENDING' as const,
    payload: {
      name: 'Ăn uống gia đình',
      scope: 'WALLET' as const,
      wallet_id: 2,
      category_id: null,
      limit_amount: '1500000',
      period: 'CUSTOM' as const,
      start_date: '2026-11-01',
      end_date: '2026-11-30',
    },
    requestId: 'budget_november_2026',
    attempts: 0,
    revision: 1,
    updatedAt: '2026-11-23T08:00:00.000Z',
  };
  jest.mocked(offlineTransactionQueue.list).mockResolvedValue([]);
  jest.mocked(offlineBudgetQueue.list).mockResolvedValue([pending]);
  jest
    .mocked(offlineBudgetQueue.preview)
    .mockResolvedValue([{ id: -12, revision: 1 }]);
  await act(async () => {
    renderer = TestRenderer.create(<DataManagementScreen />);
  });
  await openReview();
  expect(review().props.review.budgets).toEqual([pending]);
  await act(async () => {
    review().props.onChoose('later');
  });
});
it('shows a savings goal edit before manually syncing it', async () => {
  const pending = {
    id: 4,
    revision: 1,
    attempts: 0,
    status: 'PENDING' as const,
    updatedAt: '2026-11-24T05:00:00.000Z',
    base: {
      name: 'Quỹ dự phòng',
      target_amount: '2000000.00',
      target_date: null,
      note: null,
      status: 'ACTIVE' as const,
    },
    payload: {
      name: 'Quỹ gia đình',
      target_amount: '3000000',
      target_date: null,
      note: 'Sinh hoạt',
    },
  };
  jest.mocked(offlineTransactionQueue.list).mockResolvedValue([]);
  jest.mocked(offlineSavingsGoalQueue.list).mockResolvedValue([pending]);
  jest
    .mocked(offlineSavingsGoalQueue.preview)
    .mockResolvedValue([{ id: 4, revision: 1 }]);
  jest
    .mocked(offlineSavingsGoalQueue.rebaseReviewed)
    .mockResolvedValue([{ id: 4, revision: 1 }]);
  await act(async () => {
    renderer = TestRenderer.create(<DataManagementScreen />);
  });
  await openReview();
  expect(review().props.review.savingsGoals).toEqual([pending]);
  expect(offlineSavingsGoalQueue.sync).not.toHaveBeenCalled();
  await act(async () => review().props.onChoose('local'));
  expect(offlineSavingsGoalQueue.sync).toHaveBeenCalledWith(
    'qa',
    9,
    [{ id: 4, revision: 1 }],
    expect.any(Function),
  );
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
          'Máy chủ: Chưa gửi giao dịch',
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
  await openReview();
  expect(
    renderer!.root
      .findAllByType(Text)
      .some(node =>
        String(node.props.children).includes(
          'Máy chủ: Chưa xác định đã nhận khoản này',
        ),
      ),
  ).toBe(true);
  await act(async () => review().props.onChoose('later'));
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
