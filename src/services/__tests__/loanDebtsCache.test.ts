import AsyncStorage from '@react-native-async-storage/async-storage';
import { loanDebtsCache } from '../loanDebtsCache';
import type { LoanDebt } from '../../types/loanDebt';
import { filterLoanDebts } from '../../utils/loanDebtPeriodFilter';

jest.mock('../api', () => ({ getApiStorageBaseUrl: () => 'https://example.invalid' }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const storage = new Map<string, string>();
const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;
const record = (changes: Partial<LoanDebt> = {}): LoanDebt => ({
  id: 11,
  user_id: 7,
  person_name: 'Chị Lan',
  type: 'BORROWED',
  principal_amount: 500000,
  settled_amount: 200000,
  remaining_amount: 300000,
  currency: 'VND',
  opening_wallet_id: 3,
  opening_transaction_id: 25,
  status: 'OPEN',
  payments: [],
  ...changes,
});

describe('loanDebtsCache', () => {
  beforeEach(() => {
    storage.clear();
    jest.clearAllMocks();
    getItem.mockImplementation(async (key: string) => storage.get(key) ?? null);
    setItem.mockImplementation(async (key: string, value: string) => {
      storage.set(key, value);
    });
  });

  it('retains both directions and payment history for local filtering', async () => {
    const paid = record({
      id: 12,
      person_name: 'Anh Bình',
      type: 'LENT',
      status: 'PAID',
      settled_amount: 500000,
      remaining_amount: 0,
      payments: [{ id: 9, loan_debt_id: 12, wallet_id: 3, transaction_id: 27, amount: 500000, payment_date: '2026-11-20' }],
    });
    await loanDebtsCache.save(7, [record(), paid]);
    const saved = await loanDebtsCache.read(7);
    expect(saved?.records.map(item => item.type)).toEqual(['BORROWED', 'LENT']);
    expect(saved?.records[1].payments).toHaveLength(1);
    expect(await loanDebtsCache.read(8)).toBeNull();
  });

  it('rejects another account and incomplete payment history', async () => {
    await loanDebtsCache.save(7, [record({ user_id: 8 })]);
    expect(await loanDebtsCache.read(7)).toBeNull();
    await loanDebtsCache.save(7, [record({ payments: undefined as unknown as LoanDebt['payments'] })]);
    expect(await loanDebtsCache.read(7)).toBeNull();
  });

  it('does not mistake corrupt storage for an empty list', async () => {
    await loanDebtsCache.save(7, [record()]);
    storage.set([...storage.keys()][0], '{invalid');
    expect(await loanDebtsCache.read(7)).toBeNull();
  });

  it('filters a full saved list by direction, status and month', () => {
    const records = [
      record({ created_at: '2026-11-10T08:00:00Z' }),
      record({ id: 12, person_name: 'Anh Bình', type: 'LENT', status: 'PAID', created_at: '2026-10-12T08:00:00Z' }),
    ];
    expect(filterLoanDebts(records, { type: 'BORROWED', period: 'CURRENT' }, new Date('2026-11-23')).map(item => item.id)).toEqual([11]);
    expect(filterLoanDebts(records, { status: 'PAID', period: 'PREVIOUS_MONTH' }, new Date('2026-11-23')).map(item => item.id)).toEqual([12]);
  });
});
