import React from 'react';
import { RefreshControl, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import HistoryScreen from '../src/screens/home/HistoryScreen';
import { dashboardCache } from '../src/services/dashboardCache';
import { transactionsService } from '../src/services/transactions';
import { ApiError } from '../src/services/api';
import type { ApiTransaction } from '../src/types/transaction';
import type { Wallet } from '../src/types/wallet';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: (callback: () => void) =>
    jest.requireActual<typeof React>('react').useEffect(callback, [callback]),
}));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'saved',
    user: { id: 99, role: 'BASIC' },
    isOfflineSession: false,
  }),
}));
jest.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    preferredCurrency: 'VND',
    tags: [],
    selectedTransactionCategory: null,
    setSelectedTransactionCategory: jest.fn(),
    setTags: jest.fn(),
  }),
}));
jest.mock('../src/services/transactions', () => ({
  transactionsService: {
    getPage: jest.fn(),
    update: jest.fn(),
    uploadReceipt: jest.fn(),
  },
}));
jest.mock('../src/services/dashboardCache', () => ({
  dashboardCache: { read: jest.fn() },
}));

const wallet = {
  id: 3,
  name: 'Ví QA',
  currency: 'VND',
  wallet_type: 'CASH',
} as Wallet;
const cachedTransaction = {
  id: 8,
  wallet_id: 3,
  category_id: 2,
  amount: '79000',
  note: 'Thanh toán hóa đơn QA',
  currency: 'VND',
  transaction_date: '2026-10-31',
  type: 'EXPENSE',
} as ApiTransaction;
const cache = {
  server: 'https://example.invalid',
  wallets: [wallet],
  transactions: [cachedTransaction],
  categories: [],
  tags: [],
  budgets: [],
  savingsGoals: [],
  updatedAt: '2026-11-02T12:00:00.000Z',
};
let renderer: TestRenderer.ReactTestRenderer | undefined;
const open = async () => {
  await act(async () => {
    renderer = TestRenderer.create(<HistoryScreen wallets={[wallet]} />);
  });
};
const visibleCopy = () =>
  renderer!.root
    .findAllByType(Text)
    .flatMap(node => node.props.children)
    .map(String)
    .join(' ');
afterEach(async () => {
  if (renderer) await act(() => renderer!.unmount());
  renderer = undefined;
  jest.clearAllMocks();
});

it('shows only the cached rows when the network drops, then replaces them after reconnect', async () => {
  jest.mocked(dashboardCache.read).mockResolvedValue(cache);
  jest
    .mocked(transactionsService.getPage)
    .mockRejectedValueOnce(new Error('Network unreachable'))
    .mockResolvedValueOnce({
      data: [{ ...cachedTransaction, note: 'Đã tải lại từ máy chủ' }],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
  await open();
  expect(visibleCopy()).toContain('Dữ liệu trên máy');
  expect(visibleCopy()).toContain('Thanh toán hóa đơn QA');
  expect(
    renderer!.root.findByProps({ accessibilityLabel: 'Sửa giao dịch 8' }).props
      .disabled,
  ).not.toBe(true);
  await act(async () =>
    renderer!.root.findByType(RefreshControl).props.onRefresh(),
  );
  expect(visibleCopy()).toContain('Đã tải lại từ máy chủ');
  expect(visibleCopy()).not.toContain('Dữ liệu trên máy');
});

it('never opens the cached history after an authorization rejection', async () => {
  jest.mocked(dashboardCache.read).mockResolvedValue(cache);
  jest
    .mocked(transactionsService.getPage)
    .mockRejectedValue(new ApiError('Phiên đã hết hạn', 401));
  await open();
  expect(visibleCopy()).toContain('Chưa tải được lịch sử');
  expect(dashboardCache.read).not.toHaveBeenCalled();
});

it('keeps a historic category selected when it is absent from the current category list', async () => {
  jest.mocked(dashboardCache.read).mockResolvedValue({
    ...cache,
    transactions: [
      {
        ...cachedTransaction,
        category: { id: 2, name: 'Hóa đơn QA', type: 'EXPENSE' },
      },
    ],
  });
  jest
    .mocked(transactionsService.getPage)
    .mockRejectedValue(new Error('Network unreachable'));
  await open();
  await act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Sửa giao dịch 8' })
      .props.onPress(),
  );
  expect(visibleCopy()).toContain('Hóa đơn QA');
  expect(visibleCopy()).not.toContain('Chọn danh mục Khoản chi');
});

it('does not mask a bad request with cached history', async () => {
  jest.mocked(dashboardCache.read).mockResolvedValue(cache);
  jest
    .mocked(transactionsService.getPage)
    .mockRejectedValue(new ApiError('Bộ lọc không hợp lệ', 400));
  await open();
  expect(visibleCopy()).toContain('Chưa tải được lịch sử');
  expect(dashboardCache.read).not.toHaveBeenCalled();
});
