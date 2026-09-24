import React from 'react';
import { Alert, RefreshControl } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import HistoryScreen from '../src/screens/home/HistoryScreen';
import { transactionsService } from '../src/services/transactions';
import type { ApiTransaction } from '../src/types/transaction';
import type { Wallet } from '../src/types/wallet';
import type { Category } from '../src/types/category';
import { launchImageLibrary } from 'react-native-image-picker';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: (callback: () => void) => {
    jest.requireActual<typeof React>('react').useEffect(callback, [callback]);
  },
}));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: 'test', user: { role: 'BASIC' } }),
}));
jest.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    preferredCurrency: 'USD',
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
const service = jest.mocked(transactionsService);
const transaction: ApiTransaction = {
  id: 8,
  wallet_id: 3,
  category_id: 2,
  amount: '12.50',
  note: 'Ghi chú trước khi sửa',
  currency: 'USD',
  transaction_date: '2026-09-21',
  type: 'EXPENSE',
  category: {
    id: 2,
    name: 'Ăn uống',
    type: 'EXPENSE',
    cash_flow_group: 'NORMAL',
  },
};
const wallets = [
  { id: 3, name: 'Ví USD', currency: 'USD', wallet_type: 'CASH' },
] as Wallet[];
const categories = [{ id: 2, name: 'Ăn uống', type: 'EXPENSE' }] as Category[];
let renderer: TestRenderer.ReactTestRenderer;
beforeEach(async () => {
  jest.clearAllMocks();
  service.getPage.mockResolvedValue({
    data: [transaction],
    meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
  });
  service.update.mockResolvedValue(transaction);
  await act(async () => {
    renderer = TestRenderer.create(
      <HistoryScreen wallets={wallets} categories={categories} />,
    );
  });
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Sửa giao dịch 8' })
      .props.onPress();
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});

it('preserves cents on edit and submits only once for consecutive Save taps', async () => {
  expect(
    renderer.root.findByProps({
      accessibilityLabel: 'Số tiền giao dịch đang sửa',
    }).props.value,
  ).toBe('12.5');
  await act(async () => {
    const save = renderer.root.findByProps({
      accessibilityLabel: 'Lưu giao dịch đang sửa',
    }).props.onPress;
    await Promise.all([save(), save()]);
  });
  expect(service.update).toHaveBeenCalledTimes(1);
  expect(service.update).toHaveBeenCalledWith(
    'test',
    8,
    expect.objectContaining({ amount: '12.5' }),
  );
});

it('rejects ambiguous thousands separators instead of silently changing the amount', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Số tiền giao dịch đang sửa' })
      .props.onChangeText('1,250.50');
  });
  await act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: 'Lưu giao dịch đang sửa' })
      .props.onPress();
  });
  expect(service.update).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledWith('Số tiền chưa hợp lệ', expect.any(String));
});

it('sends an empty note explicitly when the user clears the old note', async () => {
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Ghi chú giao dịch đang sửa' })
      .props.onChangeText('');
  });
  await act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: 'Lưu giao dịch đang sửa' })
      .props.onPress();
  });
  expect(service.update).toHaveBeenCalledWith(
    'test',
    8,
    expect.objectContaining({ note: '' }),
  );
});

it('shows a retry after a refresh failure and restores the current page', async () => {
  service.getPage.mockRejectedValueOnce(new Error('Mất kết nối mạng'));
  await act(async () => {
    await renderer.root.findByType(RefreshControl).props.onRefresh();
  });
  expect(
    renderer.root.findAllByProps({ children: 'Chưa tải được lịch sử' }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer.root.findAllByProps({ children: 'Chưa có giao dịch phù hợp' }),
  ).toHaveLength(0);
  await act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: 'Thử tải lại lịch sử' })
      .props.onPress();
  });
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: 'Thử tải lại lịch sử' }),
  ).toHaveLength(0);
  expect(service.getPage).toHaveBeenCalledTimes(3);
});

it('ignores a slower refresh that finishes after a newer refresh', async () => {
  let finishOld!: (
    value: Awaited<ReturnType<typeof transactionsService.getPage>>,
  ) => void;
  service.getPage.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finishOld = resolve;
      }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = renderer.root.findByType(RefreshControl).props.onRefresh();
  });
  service.getPage.mockResolvedValueOnce({
    data: [{ ...transaction, note: 'Dữ liệu mới nhất' }],
    meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
  });
  await act(async () => {
    await renderer.root.findByType(RefreshControl).props.onRefresh();
  });
  await act(async () => {
    finishOld({
      data: [{ ...transaction, note: 'Dữ liệu đã cũ' }],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    await pending;
  });
  expect(
    renderer.root.findAllByProps({ children: 'Dữ liệu mới nhất' }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer.root.findAllByProps({ children: 'Dữ liệu đã cũ' }),
  ).toHaveLength(0);
});

it('does not repeatedly fetch when wallet and category props are omitted', async () => {
  await act(async () => renderer.unmount());
  service.getPage.mockClear();
  await act(async () => {
    renderer = TestRenderer.create(<HistoryScreen />);
  });
  expect(service.getPage).toHaveBeenCalledTimes(1);
});

it('explains that transaction details were saved when the receipt upload fails', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({
    assets: [
      {
        uri: 'file:///test/bill.jpg',
        fileName: 'bill.jpg',
        type: 'image/jpeg',
      },
    ],
  });
  service.uploadReceipt.mockRejectedValueOnce(new Error('Mất kết nối mạng'));
  await act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: 'Chọn ảnh hóa đơn đang sửa' })
      .props.onPress();
  });
  await act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: 'Lưu giao dịch đang sửa' })
      .props.onPress();
  });
  expect(service.update).toHaveBeenCalledTimes(1);
  expect(service.uploadReceipt).toHaveBeenCalledTimes(1);
  expect(alert).toHaveBeenCalledWith(
    'Giao dịch đã được lưu',
    expect.stringContaining('ảnh hóa đơn chưa được xác nhận'),
  );
});
