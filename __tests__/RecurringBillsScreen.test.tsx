import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RecurringBillsScreen from '../src/screens/home/RecurringBillsScreen';
import { recurringBillsService as service } from '../src/services/recurringBills';
import { transactionsService } from '../src/services/transactions';
import { getTransactionDateKey } from '../src/utils/mapTransactions';
import type { BillInput } from '../src/utils/recurringBills';

jest.setTimeout(20000);

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 99, currency_default: 'VND' },
    token: 'token',
  }),
}));
jest.mock('../src/services/api', () => ({
  getApiBaseUrl: () => 'https://test.invalid',
}));
jest.mock('../src/services/transactions', () => ({
  transactionsService: {
    getPage: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));
jest.mock('@react-native-community/datetimepicker', () => 'DatePicker');
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));
const scope = { userId: 99, server: 'https://test.invalid' };
const key = 'recurring-bills:v1:https://test.invalid:99';
const today = getTransactionDateKey(new Date().toISOString());
const bill: BillInput = {
  label: 'Tiền nhà',
  anchorDate: today,
  cycle: 'MONTHLY',
  kind: 'FIXED',
  minAmount: 3000000,
  maxAmount: 3000000,
  currency: 'VND',
  note: '',
};
let renderer: TestRenderer.ReactTestRenderer | undefined;
const mount = async () => {
  await act(async () => {
    renderer = TestRenderer.create(
      <RecurringBillsScreen
        {...({
          navigation: { goBack: jest.fn() },
          route: {},
        } as unknown as React.ComponentProps<typeof RecurringBillsScreen>)}
      />,
    );
  });
};
const press = (label: string) =>
  renderer!.root
    .findAllByProps({ accessibilityLabel: label })
    .find(node => typeof node.props.onPress === 'function')!
    .props.onPress();
const field = (label: string, value: string) =>
  renderer!.root
    .findAllByProps({ accessibilityLabel: label })
    .find(node => typeof node.props.onChangeText === 'function')!
    .props.onChangeText(value);
const confirm = () => {
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  return buttons.find(button => button.text === 'Xác nhận')!.onPress!();
};
beforeEach(async () => {
  await AsyncStorage.removeItem(key);
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.mocked(transactionsService.getPage).mockResolvedValue({
    data: [
      {
        id: 77,
        wallet_id: 1,
        amount: 3100000,
        currency: 'VND',
        type: 'EXPENSE',
        transaction_date: today,
        note: 'Trả tiền nhà',
      },
    ],
    meta: { page: 1, limit: 40, total: 1, totalPages: 1 },
  });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
  jest.restoreAllMocks();
});

it('creates one schedule for a double tap and restores it on reopening the screen', async () => {
  await mount();
  await act(async () => press('Thêm lịch hóa đơn'));
  await act(async () => {
    field('Tên hóa đơn', 'Tiền nhà');
    field('Số tiền hóa đơn', '3000000');
  });
  await act(async () => {
    press('Lưu lịch');
    press('Lưu lịch');
  });
  expect((await service.load(scope)).bills).toHaveLength(1);
  await act(async () => renderer!.unmount());
  await mount();
  await act(async () => press('Lịch đã tạo'));
  expect(JSON.stringify(renderer!.toJSON())).toContain('Tiền nhà');
  expect(transactionsService.create).not.toHaveBeenCalled();
});
it('preserves editor input on storage failure so it can be retried', async () => {
  await mount();
  await act(async () => press('Thêm lịch hóa đơn'));
  await act(async () => {
    field('Tên hóa đơn', 'Internet');
    field('Số tiền hóa đơn', '200000');
  });
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Disk full'));
  await act(async () => press('Lưu lịch'));
  expect(
    renderer!.root.findAllByProps({ accessibilityLabel: 'Tên hóa đơn' })[0]
      .props.value,
  ).toBe('Internet');
  expect((await service.load(scope)).bills).toEqual([]);
  await act(async () => press('Lưu lịch'));
  expect((await service.load(scope)).bills).toHaveLength(1);
});
it('only links after preview and explicit confirmation; differing actual amounts are disclosed', async () => {
  await service.save(scope, bill);
  await mount();
  await act(async () => press('Chọn giao dịch đã trả'));
  await act(async () => press('Liên kết giao dịch 77'));
  expect((await service.load(scope)).periods).toEqual([]);
  expect(jest.mocked(Alert.alert).mock.calls.at(-1)![1]).toContain(
    'Số tiền thực tế khác dự kiến',
  );
  await act(async () => confirm());
  expect((await service.load(scope)).periods).toMatchObject([
    { status: 'PAID', payment: { id: 77, amount: 3100000 } },
  ]);
  expect(transactionsService.create).not.toHaveBeenCalled();
  expect(transactionsService.update).not.toHaveBeenCalled();
});
it('a dismissed picker invalidates an outstanding confirmation', async () => {
  await service.save(scope, bill);
  await mount();
  await act(async () => press('Chọn giao dịch đã trả'));
  await act(async () => press('Liên kết giao dịch 77'));
  const confirmStale = confirm;
  await act(async () => press('Đóng chọn giao dịch'));
  await act(async () => confirmStale());
  expect((await service.load(scope)).periods).toEqual([]);
});
it('cancelled requests do not reopen the picker after their network result arrives', async () => {
  await service.save(scope, bill);
  let resolve!: (
    value: Awaited<ReturnType<typeof transactionsService.getPage>>,
  ) => void;
  jest.mocked(transactionsService.getPage).mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  await mount();
  await act(async () => {
    press('Chọn giao dịch đã trả');
  });
  await act(async () => press('Đóng chọn giao dịch'));
  await act(async () =>
    resolve({
      data: [],
      meta: { page: 1, limit: 40, total: 0, totalPages: 0 },
    }),
  );
  const modal = renderer!.root.findByType(require('react-native').Modal);
  expect(modal.props.visible).toBe(false);
});
it('fails closed when local data cannot be read', async () => {
  await AsyncStorage.setItem(key, 'broken');
  await mount();
  expect(JSON.stringify(renderer!.toJSON())).toContain('Giữ nguyên dữ liệu');
  expect(
    renderer!.root.findAllByProps({ accessibilityLabel: 'Thêm lịch hóa đơn' }),
  ).toHaveLength(0);
  expect(await AsyncStorage.getItem(key)).toBe('broken');
});

it('accepts a decimal comma for a variable bill in a foreign currency', async () => {
  await mount();
  await act(async () => press('Thêm lịch hóa đơn'));
  await act(async () => {
    field('Tên hóa đơn', 'Hosting');
    field('Tiền tệ hóa đơn', 'USD');
    press('Tiền biến thiên');
  });
  await act(async () => {
    field('Số tiền hóa đơn', '12,5');
    field('Số tiền tối đa', '20,75');
  });
  await act(async () => press('Lưu lịch'));
  expect((await service.load(scope)).bills[0]).toMatchObject({
    kind: 'VARIABLE',
    currency: 'USD',
    minAmount: 12.5,
    maxAmount: 20.75,
  });
});
