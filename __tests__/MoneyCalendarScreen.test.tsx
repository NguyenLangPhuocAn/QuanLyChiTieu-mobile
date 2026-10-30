import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import MoneyCalendarScreen from '../src/screens/home/MoneyCalendarScreen';
import { dashboardCache } from '../src/services/dashboardCache';
import { recurringBillsService } from '../src/services/recurringBills';
import { offlineTransactionQueue } from '../src/services/offlineTransactionQueue';
import { moneyCalendarPlans } from '../src/services/moneyCalendarPlans';
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 8, currency_default: 'VND' } }),
}));
jest.mock('../src/services/api', () => ({ getApiBaseUrl: () => 'http://qa' }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));
jest.mock('../src/services/dashboardCache', () => ({
  dashboardCache: { read: jest.fn(), subscribe: jest.fn(() => jest.fn()) },
}));
jest.mock('../src/services/recurringBills', () => ({
  recurringBillsService: {
    load: jest.fn(),
    subscribe: jest.fn(() => jest.fn()),
  },
}));
jest.mock('../src/services/offlineTransactionQueue', () => ({
  offlineTransactionQueue: {
    list: jest.fn(),
    subscribe: jest.fn(() => jest.fn()),
  },
  createClientRequestId: () => 'plan-test',
}));
jest.mock('../src/services/moneyCalendarPlans', () => ({
  moneyCalendarPlans: { read: jest.fn(), add: jest.fn(), remove: jest.fn() },
}));
const bill = {
  id: 'rent',
  label: 'Tiền nhà',
  anchorDate: '2026-10-31',
  cycle: 'MONTHLY',
  kind: 'FIXED',
  minAmount: 300000,
  maxAmount: 300000,
  currency: 'VND',
  note: '',
  paused: false,
  archived: false,
} as const;
const book = { version: 1 as const, bills: [bill], periods: [] };
let tree: TestRenderer.ReactTestRenderer;
const navigation = { goBack: jest.fn(), navigate: jest.fn() };
const mount = async () =>
  act(async () => {
    tree = TestRenderer.create(
      <MoneyCalendarScreen
        {...({ navigation } as unknown as React.ComponentProps<
          typeof MoneyCalendarScreen
        >)}
      />,
    );
  });
const control = (label: string) =>
  tree.root.findAll(
    n => n.props.accessibilityLabel === label && typeof n.type !== 'string',
  )[0];
const press = async (label: string) =>
  act(async () => control(label).props.onPress());
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-10-30T05:00:00Z'));
  jest
    .mocked(dashboardCache.read)
    .mockResolvedValue({
      wallets: [{ id: 1, currency: 'VND', balance: 1000000 }],
      updatedAt: '2026-10-30T05:00:00Z',
    } as never);
  jest.mocked(recurringBillsService.load).mockResolvedValue(book);
  jest.mocked(offlineTransactionQueue.list).mockResolvedValue([]);
  jest.mocked(moneyCalendarPlans.read).mockResolvedValue([]);
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.useRealTimers();
});
it('recalculates when a bill is skipped and opens its source screen', async () => {
  await mount();
  expect(JSON.stringify(tree.toJSON())).toContain('23.333');
  await press('Cách tính Chi an toàn');
  expect(JSON.stringify(tree.toJSON())).toContain('300.000');
  jest
    .mocked(recurringBillsService.load)
    .mockResolvedValue({
      ...book,
      periods: [{ billId: 'rent', dueDate: '2026-10-31', status: 'SKIPPED' }],
    });
  await act(async () =>
    jest
      .mocked(recurringBillsService.subscribe)
      .mock.calls[0][0]({ userId: 8, server: 'http://qa' }),
  );
  expect(JSON.stringify(tree.toJSON())).toContain('33.333');
  await press('Hóa đơn định kỳ');
  expect(navigation.navigate).toHaveBeenCalledWith('RecurringBills');
});
it('does not fabricate safe spending when bill storage fails and can retry', async () => {
  jest
    .mocked(recurringBillsService.load)
    .mockRejectedValueOnce(Error('Dữ liệu hóa đơn lỗi'));
  await mount();
  expect(JSON.stringify(tree.toJSON())).toContain('Dữ liệu hóa đơn lỗi');
  expect(control('Cách tính Chi an toàn')).toBeUndefined();
  await press('Thử lại');
  expect(JSON.stringify(tree.toJSON())).toContain('23.333');
});
it('requires a plan confirmation and rejects it after leaving the screen', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await mount();
  await press('Thêm dự kiến');
  await act(async () => {
    control('Tên khoản dự kiến').props.onChangeText('Lương');
    control('Số tiền dự kiến').props.onChangeText('5000000');
  });
  await press('Kiểm tra dự kiến');
  expect(moneyCalendarPlans.add).not.toHaveBeenCalled();
  const buttons = alert.mock.calls.at(-1)![2]!;
  await act(async () => tree.unmount());
  await act(async () =>
    buttons.find(b => b.text === 'Thêm vào lịch')!.onPress!(),
  );
  expect(moneyCalendarPlans.add).not.toHaveBeenCalled();
  alert.mockRestore();
});
