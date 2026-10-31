import React from 'react';
jest.mock('../src/components/PlanningSyncControls', () => () => null);
import { AppState, type AppStateStatus } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RecurringBillsScreen from '../src/screens/home/RecurringBillsScreen';
import { recurringBillsService as service } from '../src/services/recurringBills';
import { transactionsService } from '../src/services/transactions';
import { getTransactionDateKey } from '../src/utils/mapTransactions';
import type { ApiTransaction } from '../src/types/transaction';

jest.setTimeout(30000);
let mockUser = 288;
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: mockUser, currency_default: 'VND' },
    token: 'token',
  }),
}));
jest.mock('../src/services/api', () => ({
  getApiBaseUrl: () => 'https://activity.invalid',
}));
jest.mock('../src/services/transactions', () => ({
  transactionsService: {
    getPage: jest.fn(),
    getLinkedPayments: jest.fn(),
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
const scope = { userId: 288, server: 'https://activity.invalid' };
const key = 'recurring-bills:v1:https://activity.invalid:288';
const today = getTransactionDateKey(new Date().toISOString());
const [year, month] = today.split('-').map(Number);
const anchor = `${year}-${String(month).padStart(2, '0')}-01`;
const dateLabel = anchor.split('-').reverse().join('/');
const history: ApiTransaction[] = [3, 2, 1, 0].map((ago, i) => ({
  id: i + 1,
  wallet_id: 1,
  amount: i === 3 ? -130000 : -100000,
  currency: 'VND',
  type: 'EXPENSE',
  note: 'Internet QA',
  transaction_date: new Date(
    Date.UTC(year, month - 1 - ago, 1, 5),
  ).toISOString(),
}));
history.push(
  ...[3, 2, 1, 0, 0].map((ago, i) => ({
    id: i + 5,
    wallet_id: 1,
    amount: -89000,
    currency: 'VND',
    type: 'EXPENSE' as const,
    note: 'Video QA',
    transaction_date: new Date(
      Date.UTC(year, month - 1 - ago, 1, 5),
    ).toISOString(),
  })),
);
const response = (rows = history) => ({
  data: rows,
  meta: { page: 1, limit: 100, total: rows.length, totalPages: 1 },
});
let renderer: TestRenderer.ReactTestRenderer | undefined;
let appListeners: Array<(state: AppStateStatus) => void>;
const props = {
  navigation: { goBack: jest.fn(), setParams: jest.fn() },
  route: {},
} as unknown as React.ComponentProps<typeof RecurringBillsScreen>;
const screen = () => <RecurringBillsScreen {...props} />;
const mount = async () => {
  await act(async () => {
    renderer = TestRenderer.create(screen());
  });
};
const press = (label: string) =>
  renderer!.root
    .findAllByProps({ accessibilityLabel: label })
    .find(node => typeof node.props.onPress === 'function')!
    .props.onPress();
const text = () => {
  const collect = (
    node:
      | TestRenderer.ReactTestRendererJSON
      | TestRenderer.ReactTestRendererJSON[]
      | string
      | number
      | null,
  ): string => {
    if (node === null) return '';
    if (typeof node === 'string' || typeof node === 'number')
      return String(node);
    if (Array.isArray(node)) return node.map(collect).join('');
    return (node.children ?? []).map(collect).join('') + '\n';
  };
  return collect(renderer!.toJSON());
};
const scan = async () => {
  await act(async () => {
    press('Tìm khoản lặp');
  });
  await act(async () => press('Xem cảnh báo định kỳ'));
};
const acknowledge = `Đã kiểm tra cảnh báo Internet QA, kỳ ${dateLabel}, giao dịch 1`;
const restore = `Hiện lại cảnh báo Internet QA, kỳ ${dateLabel}, giao dịch 1`;
beforeEach(async () => {
  mockUser = 288;
  appListeners = [];
  jest.clearAllMocks();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      appListeners.push(listener);
      return { remove: jest.fn() };
    });
  await AsyncStorage.removeItem(key);
  await AsyncStorage.removeItem(
    key.replace('recurring-bills:v1:', 'planning-local:v1:'),
  );
  await AsyncStorage.removeItem(
    'recurring-bills:v1:https://activity.invalid:289',
  );
  await AsyncStorage.removeItem(
    'recurring-bills:v1:https://activity.invalid:289'.replace(
      'recurring-bills:v1:',
      'planning-local:v1:',
    ),
  );
  for (const [label, amount] of [
    ['Internet QA', 100000],
    ['Video QA', 89000],
  ] as const)
    await service.save(scope, {
      label,
      anchorDate: anchor,
      cycle: 'MONTHLY',
      kind: 'FIXED',
      minAmount: amount,
      maxAmount: amount,
      currency: 'VND',
      note: '',
    });
  jest.mocked(transactionsService.getPage).mockResolvedValue(response());
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
  jest.restoreAllMocks();
});

it('uses one explicit history scan for alerts and suggestions; evidence and method stay collapsed until requested', async () => {
  await mount();
  expect(transactionsService.getPage).not.toHaveBeenCalled();
  await scan();
  expect(transactionsService.getPage).toHaveBeenCalledTimes(1);
  expect(text()).toContain('Cần xem lại (2)');
  expect(text()).toContain('Khoản chi cao hơn trước');
  expect(text()).toContain('Có thể ghi lặp trong một kỳ');
  expect(text()).not.toContain('dao động trong ±10%');
  await act(async () => press('Cách kiểm tra khoản định kỳ'));
  expect(text()).toContain('dao động trong ±10%');
  await act(async () =>
    press(`Xem giao dịch cảnh báo Internet QA, kỳ ${dateLabel}, giao dịch 1`),
  );
  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: `Bằng chứng cảnh báo 1, ${history[0].transaction_date.slice(
        0,
        10,
      )}, 100000 VND, Internet QA`,
    }).length,
  ).toBeGreaterThan(0);
  expect((await service.load(scope)).periods).toEqual([]);
  expect(transactionsService.create).not.toHaveBeenCalled();
  expect(transactionsService.update).not.toHaveBeenCalled();
  expect(transactionsService.remove).not.toHaveBeenCalled();
});
it('persists reviewed choices across reopening, restores them and a double tap creates only one key', async () => {
  await mount();
  await scan();
  await act(async () => {
    press(acknowledge);
    press(acknowledge);
  });
  expect((await service.load(scope)).reviewedAlerts).toHaveLength(1);
  expect(text()).toContain('Cần xem lại (1)');
  await act(async () => renderer!.unmount());
  renderer = undefined;
  await mount();
  await scan();
  expect(text()).toContain('Cần xem lại (1)');
  await act(async () => press('Xem cảnh báo đã kiểm tra'));
  await act(async () => press(restore));
  expect((await service.load(scope)).reviewedAlerts).toEqual([]);
  expect(text()).toContain('Cần xem lại (2)');
});
it('resurfaces changed evidence after a new scan without treating review as payment', async () => {
  await mount();
  await scan();
  await act(async () => press(acknowledge));
  jest
    .mocked(transactionsService.getPage)
    .mockResolvedValue(
      response(
        history.map(row => (row.id === 4 ? { ...row, amount: -140000 } : row)),
      ),
    );
  await act(async () => {
    press('Tìm khoản lặp');
  });
  await act(async () => press('Xem cảnh báo định kỳ'));
  expect(text()).toContain('Cần xem lại (2)');
  expect(text()).toContain('140.000');
  expect((await service.load(scope)).periods).toEqual([]);
  expect(transactionsService.getPage).toHaveBeenCalledTimes(2);
});
it('shows a save error and keeps the alert visible until a successful retry', async () => {
  await mount();
  await scan();
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('QA disk full'));
  await act(async () => press(acknowledge));
  expect(text()).toContain('QA disk full');
  expect(text()).toContain('Cần xem lại (2)');
  await act(async () => press(acknowledge));
  expect(text()).toContain('Cần xem lại (1)');
});
it('drops pending scans on background and never transfers results or choices into another account', async () => {
  await mount();
  let finish!: (value: ReturnType<typeof response>) => void;
  jest.mocked(transactionsService.getPage).mockImplementationOnce(
    () =>
      new Promise(done => {
        finish = done;
      }),
  );
  await act(async () => {
    press('Tìm khoản lặp');
  });
  await act(async () =>
    appListeners.forEach(listener => listener('background')),
  );
  await act(async () => appListeners.forEach(listener => listener('active')));
  await act(async () => finish(response()));
  expect(text()).not.toContain('Cần xem lại');
  await scan();
  mockUser = 289;
  await act(async () => renderer!.update(screen()));
  expect(text()).not.toContain('Cần xem lại');
  expect((await service.load({ ...scope, userId: 289 })).bills).toEqual([]);
});
it('shows the 30-day schedule total offline without requesting history or writing transactions', async () => {
  await mount();
  await act(async () => press('Lịch đã tạo'));
  expect(text()).toContain('Dự kiến 30 ngày tới');
  expect(text()).toContain('189.000');
  expect(text()).toContain('2 kỳ của 2 lịch');
  expect(transactionsService.getPage).not.toHaveBeenCalled();
  expect(transactionsService.create).not.toHaveBeenCalled();
});
