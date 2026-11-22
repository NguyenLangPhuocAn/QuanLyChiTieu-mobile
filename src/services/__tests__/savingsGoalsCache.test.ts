import AsyncStorage from '@react-native-async-storage/async-storage';
import { savingsGoalsCache } from '../savingsGoalsCache';
import type { SavingsGoal } from '../../types/savings';

jest.mock('../api', () => ({ getApiStorageBaseUrl: () => 'https://example.invalid' }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const storage = new Map<string, string>();
const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;
const goal = (changes: Partial<SavingsGoal> = {}): SavingsGoal => ({
  id: 4,
  user_id: 7,
  wallet_id: 9,
  wallet_name: 'Ví tiết kiệm',
  wallet_currency: 'VND',
  wallet_balance: 500000,
  name: 'Tiền học kỳ tới',
  target_amount: 2000000,
  current_amount: 500000,
  remaining_amount: 1500000,
  progress_percent: 25,
  suggested_monthly: 250000,
  status: 'ACTIVE',
  entries: [],
  ...changes,
});

describe('savingsGoalsCache', () => {
  beforeEach(() => {
    storage.clear();
    jest.clearAllMocks();
    getItem.mockImplementation(async (key: string) => storage.get(key) ?? null);
    setItem.mockImplementation(async (key: string, value: string) => {
      storage.set(key, value);
    });
  });

  it('keeps active and completed goals in the same user-scoped snapshot', async () => {
    await savingsGoalsCache.save(7, [goal(), goal({ id: 5, status: 'COMPLETED' })], []);
    const snapshot = await savingsGoalsCache.read(7);
    expect(snapshot?.goals.map(item => item.status)).toEqual(['ACTIVE', 'COMPLETED']);
    expect(snapshot?.updatedAt).toEqual(expect.any(String));
    expect(await savingsGoalsCache.read(8)).toBeNull();
  });

  it('rejects another account and damaged entry history', async () => {
    await savingsGoalsCache.save(7, [goal({ user_id: 8 })], []);
    expect(await savingsGoalsCache.read(7)).toBeNull();
    await savingsGoalsCache.save(7, [goal({ entries: undefined as unknown as SavingsGoal['entries'] })], []);
    expect(await savingsGoalsCache.read(7)).toBeNull();
  });

  it('does not mistake unreadable storage for an empty goals list', async () => {
    await savingsGoalsCache.save(7, [goal()], []);
    storage.set([...storage.keys()][0], '{invalid');
    expect(await savingsGoalsCache.read(7)).toBeNull();
  });
});
