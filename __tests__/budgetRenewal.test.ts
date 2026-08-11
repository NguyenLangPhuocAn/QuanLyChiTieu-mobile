import type { Budget } from '../src/types/budget';
import {
  getBudgetRenewalButtonState,
  hasMatchingNextPeriodBudget,
  shouldShowBudgetRenewal,
} from '../src/utils/budgetRenewal';

const budget = (overrides: Partial<Budget>): Budget => ({
  id: overrides.id ?? 1,
  user_id: 1,
  name: 'Test',
  scope: 'WALLET',
  wallet_id: 10,
  wallet_name: 'Cash',
  wallet_currency: 'VND',
  category_id: null,
  limit_amount: 100000,
  period: 'MONTH',
  start_date: '2026-05-01T00:00:00.000Z',
  end_date: '2026-05-31T23:59:59.999Z',
  spent: 0,
  remaining: 100000,
  percent: 0,
  percentage: 0,
  status: 'NORMAL',
  ...overrides,
});

describe('budget renewal state', () => {
  it('finds a next period outside the currently displayed page', () => {
    const source = budget({ id: 1 });
    const next = budget({
      id: 2,
      start_date: '2026-06-01T00:00:00.000Z',
      end_date: '2026-06-30T23:59:59.999Z',
    });

    expect(hasMatchingNextPeriodBudget(source, [source, next])).toBe(true);
  });

  it('finds an adjacent next day across a local-time UTC boundary', () => {
    const source = budget({
      id: 3,
      period: 'DAY',
      start_date: '2026-06-11T17:00:00.000Z',
      end_date: '2026-06-12T16:59:59.000Z',
    });
    const next = budget({
      id: 4,
      period: 'DAY',
      start_date: '2026-06-12T17:00:00.000Z',
      end_date: '2026-06-13T16:59:59.000Z',
    });

    expect(hasMatchingNextPeriodBudget(source, [source, next])).toBe(true);
  });

  it('renders stable labels for available, loading, and created states', () => {
    expect(getBudgetRenewalButtonState(false, false)).toEqual({
      label: 'Tạo kỳ mới',
      disabled: false,
    });
    expect(getBudgetRenewalButtonState(false, true)).toEqual({
      label: 'Đang tạo kỳ...',
      disabled: true,
    });
    expect(getBudgetRenewalButtonState(true, false)).toEqual({
      label: 'Đã tạo kỳ mới',
      disabled: true,
    });
  });

  it('never offers renewal inside the current-period filter', () => {
    expect(shouldShowBudgetRenewal('CURRENT', true)).toBe(false);
    expect(shouldShowBudgetRenewal('ALL', true)).toBe(true);
  });
});
