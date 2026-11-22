import AsyncStorage from '@react-native-async-storage/async-storage';
import { budgetCache } from '../budgetCache';
import { filterBudgets } from '../../utils/budgetFilters';
import type { Budget } from '../../types/budget';

jest.mock('../api', () => ({ getApiStorageBaseUrl: () => 'https://qa.example' }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const storage = new Map<string, string>();
const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;

const makeBudget = (overrides: Partial<Budget> = {}): Budget => ({
  id: 1,
  user_id: 7,
  name: 'Ăn uống tháng 11',
  scope: 'WALLET',
  wallet_id: 3,
  wallet_name: 'Ví sinh hoạt',
  wallet_currency: 'VND',
  limit_amount: 1000000,
  period: 'MONTH',
  start_date: '2026-11-01',
  end_date: '2026-11-30',
  spent: 100000,
  remaining: 900000,
  percent: 10,
  percentage: 10,
  status: 'NORMAL',
  ...overrides,
});

describe('budgetCache', () => {
  beforeEach(() => {
    storage.clear();
    jest.clearAllMocks();
    getItem.mockImplementation(async (key: string) => storage.get(key) ?? null);
    setItem.mockImplementation(async (key: string, value: string) => {
      storage.set(key, value);
    });
  });

  it('retains the complete list for offline search and period filters', async () => {
    const november = makeBudget();
    const october = makeBudget({ id: 2, name: 'Ăn uống tháng 10', start_date: '2026-10-01', end_date: '2026-10-31' });
    await budgetCache.save(7, [november, october], [], []);
    const snapshot = await budgetCache.read(7);
    expect(snapshot?.budgets).toHaveLength(2);
    expect(filterBudgets(snapshot!.budgets, {
      query: 'an uong',
      period: 'PREVIOUS_MONTH',
      currentDate: '2026-11-22',
    }).map(item => item.id)).toEqual([2]);
    expect(await budgetCache.read(8)).toBeNull();
  });

  it('rejects a cache containing a different user budget', async () => {
    await budgetCache.save(7, [makeBudget({ user_id: 8 })], [], []);
    expect(await budgetCache.read(7)).toBeNull();
  });

  it('does not treat a damaged cache as an empty budget list', async () => {
    await budgetCache.save(7, [makeBudget()], [], []);
    const key = [...storage.keys()][0];
    storage.set(key, '{broken');
    expect(await budgetCache.read(7)).toBeNull();
  });
});
