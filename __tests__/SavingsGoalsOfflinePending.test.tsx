import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { Trash2 } from 'lucide-react-native';
import SavingsGoalsScreen from '../src/screens/home/SavingsGoalsScreen';
import { savingsService } from '../src/services/savings';
import { walletsService } from '../src/services/wallets';
import { savingsGoalsCache } from '../src/services/savingsGoalsCache';
import { offlineSavingsGoalQueue } from '../src/services/offlineSavingsGoalQueue';
import { financeRefresh } from '../src/services/financeRefresh';
import type { SavingsGoal } from '../src/types/savings';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    jest.requireActual<typeof React>('react').useEffect(callback, [callback]);
  },
}));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: 'session-token', user: { id: 7 } }),
}));
jest.mock('../src/services/savings', () => ({
  savingsService: {
    getAll: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    contribute: jest.fn(),
    withdraw: jest.fn(),
  },
}));
jest.mock('../src/services/wallets', () => ({
  walletsService: { getAll: jest.fn() },
}));
jest.mock('../src/services/savingsGoalsCache', () => ({
  savingsGoalsCache: { read: jest.fn(), save: jest.fn() },
}));
jest.mock('../src/services/offlineSavingsGoalQueue', () => ({
  offlineSavingsGoalQueue: {
    list: jest.fn(),
    subscribe: jest.fn(),
    apply: (
      goals: SavingsGoal[],
      changes: Array<{ id: number; payload: { name: string } }>,
    ) =>
      goals.map(goal => ({
        ...goal,
        name:
          changes.find(change => change.id === goal.id)?.payload.name ??
          goal.name,
      })),
  },
}));

const goal: SavingsGoal = {
  id: 4,
  user_id: 7,
  wallet_id: 9,
  wallet_name: 'Ví tiết kiệm',
  wallet_currency: 'VND',
  wallet_balance: 500000,
  name: 'Quỹ dự phòng',
  target_amount: 2000000,
  current_amount: 500000,
  remaining_amount: 1500000,
  progress_percent: 25,
  suggested_monthly: 250000,
  status: 'ACTIVE',
  entries: [],
};
const pending = {
  id: 4,
  revision: 1,
  attempts: 0,
  status: 'PENDING' as const,
  updatedAt: '2026-11-24T06:00:00.000Z',
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
    note: '',
  },
};
let changed: () => void;
let renderer: TestRenderer.ReactTestRenderer | undefined;
const contains = (value: string) =>
  renderer!.root
    .findAllByType(Text)
    .some(node => node.props.children === value);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(savingsGoalsCache.read).mockResolvedValue(null);
  jest.mocked(savingsGoalsCache.save).mockResolvedValue({
    server: 'https://example.invalid',
    userId: 7,
    updatedAt: '2026-11-24T06:00:00.000Z',
    goals: [goal],
    wallets: [],
  });
  jest.mocked(savingsService.getAll).mockResolvedValue([goal]);
  jest.mocked(walletsService.getAll).mockResolvedValue([]);
  jest.mocked(offlineSavingsGoalQueue.list).mockResolvedValue([pending]);
  jest
    .mocked(offlineSavingsGoalQueue.subscribe)
    .mockImplementation(listener => {
      changed = listener;
      return () => undefined;
    });
});
afterEach(async () => {
  if (renderer) await act(() => renderer!.unmount());
  renderer = undefined;
});

it('shows the pending edit but blocks transfer and deletion for that goal', async () => {
  await act(async () => {
    renderer = TestRenderer.create(
      <SavingsGoalsScreen
        navigation={{ goBack: jest.fn() } as never}
        route={{} as never}
      />,
    );
  });
  expect(contains('Quỹ gia đình')).toBe(true);
  expect(contains('Chờ đồng bộ')).toBe(true);
  expect(contains('Đóng góp')).toBe(false);
  expect(contains('Rút tiền')).toBe(false);
  expect(renderer!.root.findAllByType(Trash2)).toHaveLength(0);
  expect(savingsService.contribute).not.toHaveBeenCalled();
});

it('reloads the server copy after the reviewed change leaves the queue', async () => {
  await act(async () => {
    renderer = TestRenderer.create(
      <SavingsGoalsScreen
        navigation={{ goBack: jest.fn() } as never}
        route={{} as never}
      />,
    );
  });
  jest.mocked(offlineSavingsGoalQueue.list).mockResolvedValue([]);
  jest
    .mocked(savingsService.getAll)
    .mockResolvedValue([
      { ...goal, name: 'Quỹ gia đình', target_amount: 3000000 },
    ]);
  await act(async () => {
    changed();
    financeRefresh.emit();
  });
  expect(contains('Chờ đồng bộ')).toBe(false);
  expect(contains('Quỹ gia đình')).toBe(true);
  expect(contains('Đóng góp')).toBe(true);
});
