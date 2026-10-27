import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RecurringBillsScreen from '../src/screens/home/RecurringBillsScreen';
import { transactionsService } from '../src/services/transactions';
import { recurringBillsService } from '../src/services/recurringBills';
import { getTransactionDateKey } from '../src/utils/mapTransactions';
import { billDateOffset } from '../src/utils/recurringBills';

jest.setTimeout(30000);
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 87, currency_default: 'VND' },
    token: 'token',
  }),
}));
jest.mock('../src/services/api', () => ({
  getApiBaseUrl: () => 'https://suggestions.invalid',
}));
jest.mock('../src/services/transactions', () => ({
  transactionsService: {
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
const scope = { userId: 87, server: 'https://suggestions.invalid' };
const today = getTransactionDateKey(new Date().toISOString());
const [year, month] = today.split('-').map(Number);
const rows = [3, 2, 1].map((ago, i) => ({
  id: i + 1,
  wallet_id: 1,
  amount: -210000,
  currency: 'VND',
  type: 'EXPENSE' as const,
  note: 'Internet QA',
  transaction_date: new Date(
    Date.UTC(year, month - 1 - ago, 5, 5),
  ).toISOString(),
}));
const response = {
  data: rows,
  meta: { page: 1, limit: 100, total: 3, totalPages: 1 },
};
let renderer: TestRenderer.ReactTestRenderer;
const mount = async () => {
  await act(async () => {
    renderer = TestRenderer.create(
      <RecurringBillsScreen
        {...({
          navigation: { goBack: jest.fn(), setParams: jest.fn() },
          route: {},
        } as unknown as React.ComponentProps<typeof RecurringBillsScreen>)}
      />,
    );
  });
};
const press = (label: string) =>
  renderer.root
    .findAllByProps({ accessibilityLabel: label })
    .find(node => typeof node.props.onPress === 'function')!
    .props.onPress();
const text = () => JSON.stringify(renderer.toJSON());
const confirm = () =>
  jest
    .mocked(Alert.alert)
    .mock.calls.at(-1)![2]!
    .find(button => button.text === 'Tạo lịch')!.onPress!();
beforeEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await AsyncStorage.removeItem(
    'recurring-bills:v1:https://suggestions.invalid:87',
  );
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.mocked(transactionsService.getPage).mockResolvedValue(response);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});

it('only scans on request, reveals evidence and requires explicit schedule confirmation without writing money', async () => {
  await mount();
  expect(transactionsService.getPage).not.toHaveBeenCalled();
  await act(async () => {
    press('Tìm khoản lặp');
    press('Tìm khoản lặp');
  });
  expect(transactionsService.getPage).toHaveBeenCalledTimes(1);
  await act(async () => press('Xem bằng chứng Internet QA'));
  expect(
    renderer.root.findAll(
      node =>
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith('Giao dịch 1,'),
    ).length,
  ).toBeGreaterThan(0);
  await act(async () => press('Theo dõi Internet QA'));
  expect(text()).toContain('Theo dõi từ');
  expect((await recurringBillsService.load(scope)).bills).toHaveLength(0);
  await act(async () => press('Lưu lịch'));
  expect(Alert.alert).toHaveBeenLastCalledWith(
    'Tạo lịch theo dõi?',
    expect.stringContaining('không tạo giao dịch'),
    expect.any(Array),
  );
  expect((await recurringBillsService.load(scope)).bills).toHaveLength(0);
  await act(async () => {
    confirm();
    confirm();
  });
  const book = await recurringBillsService.load(scope);
  expect(book.bills).toHaveLength(1);
  expect(book.bills[0].startDate! >= today).toBe(true);
  expect(book.periods).toEqual([]);
  expect(book.suggestions?.[0].status).toBe('TRACKED');
  expect(text()).toContain('Xem kết quả đã kiểm tra');
  await act(async () => press('Xem kết quả đã kiểm tra'));
  expect(transactionsService.getPage).toHaveBeenCalledTimes(1);
  expect(transactionsService.create).not.toHaveBeenCalled();
  expect(transactionsService.update).not.toHaveBeenCalled();
  expect(transactionsService.remove).not.toHaveBeenCalled();
});
it('closing preview leaves no schedule and discards an old confirmation callback', async () => {
  await mount();
  await act(async () => press('Tìm khoản lặp'));
  await act(async () => press('Theo dõi Internet QA'));
  await act(async () => press('Lưu lịch'));
  const staleConfirm = confirm;
  await act(async () => press('Đóng form lịch hóa đơn'));
  await act(async () => staleConfirm());
  expect((await recurringBillsService.load(scope)).bills).toEqual([]);
  expect(text()).toContain('Internet QA');
});
it('remembers ignored suggestions across remount and restores them explicitly', async () => {
  await mount();
  await act(async () => press('Tìm khoản lặp'));
  await act(async () => press('Không phải định kỳ Internet QA'));
  await act(async () => renderer.unmount());
  await mount();
  await act(async () => press('Tìm khoản lặp'));
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: 'Theo dõi Internet QA',
    }),
  ).toHaveLength(0);
  await act(async () => press('Xem gợi ý đã ẩn'));
  await act(async () => press('Hiện lại Internet QA'));
  expect(text()).toContain('Theo dõi Internet QA');
});
it('defers seven days and preserves the candidate when persisting the choice fails', async () => {
  await mount();
  await act(async () => press('Tìm khoản lặp'));
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Disk full'));
  await act(async () => press('Để sau Internet QA'));
  expect(text()).toContain('Disk full');
  expect((await recurringBillsService.load(scope)).suggestions).toBeUndefined();
  await act(async () => press('Để sau Internet QA'));
  expect(
    (await recurringBillsService.load(scope)).suggestions?.[0],
  ).toMatchObject({ status: 'LATER', until: billDateOffset(today, 7) });
});
it('ignores late history after cancel without creating a schedule', async () => {
  let resolve!: (result: typeof response) => void;
  jest.mocked(transactionsService.getPage).mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  await mount();
  await act(async () => press('Tìm khoản lặp'));
  await act(async () => press('Dừng tìm khoản lặp'));
  await act(async () => resolve(response));
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: 'Theo dõi Internet QA',
    }),
  ).toHaveLength(0);
  expect((await recurringBillsService.load(scope)).bills).toEqual([]);
});
