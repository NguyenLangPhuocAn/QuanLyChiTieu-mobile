import React from 'react';
jest.mock('../src/components/PlanningSyncControls', () => () => null);
import { Alert, AppState, type AppStateStatus } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RecurringBillsScreen from '../src/screens/home/RecurringBillsScreen';
import { recurringBillsService as service } from '../src/services/recurringBills';
import { transactionsService } from '../src/services/transactions';
import { getTransactionDateKey } from '../src/utils/mapTransactions';
import type { ApiTransaction } from '../src/types/transaction';

jest.setTimeout(20000);
let mockUser = 28;
let mockToken = 'token';
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: mockUser, currency_default: 'VND' },
    token: mockToken,
  }),
}));
jest.mock('../src/services/api', () => ({
  getApiBaseUrl: () => 'https://checks.invalid',
}));
jest.mock('../src/services/transactions', () => ({
  transactionsService: {
    getLinkedPayments: jest.fn(),
    getPage: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
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
const scope = { userId: 28, server: 'https://checks.invalid' };
const today = getTransactionDateKey(new Date().toISOString());
const transaction: ApiTransaction = {
  id: 12,
  wallet_id: 2,
  amount: -240000,
  currency: 'VND',
  type: 'EXPENSE',
  note: 'Internet',
  transaction_date: today,
};
const response = (data: ApiTransaction[] = [transaction]) => ({
  requestedIds: [12],
  data,
  missingIds: data.length ? [] : [12],
});
let renderer: TestRenderer.ReactTestRenderer | undefined;
let stateListeners: Array<(state: AppStateStatus) => void>;
const props = {
  navigation: { goBack: jest.fn(), setParams: jest.fn() },
  route: {},
} as unknown as React.ComponentProps<typeof RecurringBillsScreen>;
const screen = () => <RecurringBillsScreen {...props} />;
const press = (label: string) =>
  renderer!.root
    .findAllByProps({ accessibilityLabel: label })
    .find(node => typeof node.props.onPress === 'function')!
    .props.onPress();
const output = () => JSON.stringify(renderer!.toJSON());
const button = (name: string) =>
  jest
    .mocked(Alert.alert)
    .mock.calls.at(-1)![2]!
    .find(item => item.text === name)!.onPress!;
const mount = async () => {
  await act(async () => {
    renderer = TestRenderer.create(screen());
  });
  await act(async () => press('Đã xử lý'));
};
beforeEach(async () => {
  stateListeners = [];
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      stateListeners.push(listener);
      return { remove: jest.fn() };
    });
  mockUser = 28;
  mockToken = 'token';
  await AsyncStorage.removeItem('recurring-bills:v1:https://checks.invalid:28');
  await AsyncStorage.removeItem(
    'recurring-bills:v1:https://checks.invalid:28'.replace(
      'recurring-bills:v1:',
      'planning-local:v1:',
    ),
  );
  await AsyncStorage.removeItem('recurring-bills:v1:https://checks.invalid:29');
  await AsyncStorage.removeItem(
    'recurring-bills:v1:https://checks.invalid:29'.replace(
      'recurring-bills:v1:',
      'planning-local:v1:',
    ),
  );
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await service.save(scope, {
    label: 'Internet',
    cycle: 'MONTHLY',
    anchorDate: today,
    kind: 'FIXED',
    minAmount: 240000,
    maxAmount: 240000,
    currency: 'VND',
    note: '',
  });
  const bill = (await service.load(scope)).bills[0];
  await service.linkPayment(scope, bill.id, today, transaction);
  jest
    .mocked(transactionsService.getLinkedPayments)
    .mockResolvedValue(response());
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
  jest.restoreAllMocks();
});

it('does not fetch on opening; explicit review shows a changed source and cancel preserves original payment', async () => {
  await mount();
  expect(transactionsService.getLinkedPayments).not.toHaveBeenCalled();
  expect(output()).toContain('Chưa đối chiếu giao dịch gốc');
  jest
    .mocked(transactionsService.getLinkedPayments)
    .mockResolvedValue(
      response([{ ...transaction, amount: -260000, note: 'Đã sửa' }]),
    );
  await act(async () => {
    press('Kiểm tra liên kết');
    press('Kiểm tra liên kết');
  });
  expect(transactionsService.getLinkedPayments).toHaveBeenCalledTimes(1);
  expect(output()).toContain('giao dịch gốc đã thay đổi');
  await act(async () => press('Cập nhật liên kết'));
  expect(jest.mocked(Alert.alert).mock.calls.at(-1)![1]).toContain('Đã lưu:');
  expect(jest.mocked(Alert.alert).mock.calls.at(-1)![1]).toContain('Hiện tại:');
  await act(async () => button('Hủy')?.());
  expect((await service.load(scope)).periods[0]).toMatchObject({
    payment: { amount: 240000 },
  });
});
it('re-reads before confirmation, updates once, then requires new verification without any money writes', async () => {
  await mount();
  jest
    .mocked(transactionsService.getLinkedPayments)
    .mockResolvedValue(response([{ ...transaction, amount: -260000 }]));
  await act(async () => press('Kiểm tra liên kết'));
  await act(async () => press('Cập nhật liên kết'));
  const confirm = button('Cập nhật');
  await act(async () => {
    confirm();
    confirm();
  });
  expect(transactionsService.getLinkedPayments).toHaveBeenCalledTimes(2);
  expect((await service.load(scope)).periods).toHaveLength(1);
  expect((await service.load(scope)).periods[0]).toMatchObject({
    payment: { amount: 260000 },
  });
  expect(output()).toContain('Chưa đối chiếu giao dịch gốc');
  expect(transactionsService.create).not.toHaveBeenCalled();
  expect(transactionsService.update).not.toHaveBeenCalled();
  expect(transactionsService.remove).not.toHaveBeenCalled();
});
it('missing sources stay reserved and handled until the user confirms reopening the period', async () => {
  await mount();
  jest
    .mocked(transactionsService.getLinkedPayments)
    .mockResolvedValue(response([]));
  await act(async () => press('Kiểm tra liên kết'));
  expect(output()).toContain('không còn truy cập được');
  expect((await service.load(scope)).periods[0].status).toBe('PAID');
  await act(async () => press('Mở lại kỳ'));
  expect((await service.load(scope)).periods).toHaveLength(1);
  await act(async () => button('Xác nhận')());
  expect((await service.load(scope)).periods).toEqual([]);
  expect(transactionsService.remove).not.toHaveBeenCalled();
});
it('network/old-server failure cannot report deletion and retry can verify unchanged data', async () => {
  await mount();
  jest
    .mocked(transactionsService.getLinkedPayments)
    .mockRejectedValueOnce(new Error('404'));
  await act(async () => press('Kiểm tra liên kết'));
  expect(output()).toContain('Không kết luận giao dịch đã xóa');
  expect(output()).toContain('Chưa đối chiếu giao dịch gốc');
  await act(async () => press('Kiểm tra liên kết'));
  expect(output()).toContain('Khớp với giao dịch gốc');
});
it('cancel and account changes discard late results and obsolete confirmation callbacks', async () => {
  await mount();
  let finish!: (value: ReturnType<typeof response>) => void;
  jest.mocked(transactionsService.getLinkedPayments).mockImplementationOnce(
    () =>
      new Promise(done => {
        finish = done;
      }),
  );
  await act(async () => {
    press('Kiểm tra liên kết');
  });
  await act(async () => press('Dừng kiểm tra liên kết'));
  await act(async () => finish(response([])));
  expect(output()).not.toContain('Cần kiểm tra: không còn');
  jest
    .mocked(transactionsService.getLinkedPayments)
    .mockResolvedValue(response([{ ...transaction, amount: -260000 }]));
  await act(async () => press('Kiểm tra liên kết'));
  await act(async () => press('Cập nhật liên kết'));
  const obsolete = button('Cập nhật');
  mockUser = 29;
  await act(async () => renderer!.update(screen()));
  await act(async () => obsolete());
  expect((await service.load(scope)).periods[0]).toMatchObject({
    payment: { amount: 240000 },
  });
  expect((await service.load({ ...scope, userId: 29 })).periods).toEqual([]);
});
it('backgrounding invalidates pending checks and confirmations without applying late results', async () => {
  await mount();
  jest
    .mocked(transactionsService.getLinkedPayments)
    .mockResolvedValue(response([{ ...transaction, amount: -260000 }]));
  await act(async () => press('Kiểm tra liên kết'));
  await act(async () => press('Cập nhật liên kết'));
  const obsolete = button('Cập nhật');
  await act(async () =>
    stateListeners.forEach(listener => listener('background')),
  );
  await act(async () => stateListeners.forEach(listener => listener('active')));
  await act(async () => obsolete());
  expect(output()).toContain('Chưa đối chiếu giao dịch gốc');
  expect((await service.load(scope)).periods[0]).toMatchObject({
    payment: { amount: 240000 },
  });
});
