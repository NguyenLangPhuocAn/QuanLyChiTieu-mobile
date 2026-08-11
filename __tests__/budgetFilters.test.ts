import {
  filterBudgets,
  getBudgetPeriodFilterRange,
  getBudgetExpenseCategories,
} from '../src/utils/budgetFilters';
import type { Budget } from '../src/types/budget';

const makeBudget = (overrides: Partial<Budget>): Budget =>
  ({
    id: 1,
    user_id: 1,
    name: 'Ngân sách',
    scope: 'WALLET',
    wallet_id: 1,
    wallet_name: 'Ví chính',
    wallet_currency: 'VND',
    limit_amount: 1000000,
    period: 'MONTH',
    start_date: '2026-05-01',
    end_date: '2026-05-31',
    spent: 0,
    remaining: 1000000,
    percent: 0,
    percentage: 0,
    status: 'NORMAL',
    ...overrides,
  }) as Budget;

describe('budget filters', () => {
  it('builds budget filter ranges for current and previous periods', () => {
    const currentDate = '2026-06-12';

    expect(getBudgetPeriodFilterRange('CURRENT', currentDate)).toEqual({
      mode: 'containsDate',
      date: '2026-06-12',
    });
    expect(getBudgetPeriodFilterRange('PREVIOUS_MONTH', currentDate)).toEqual({
      mode: 'overlapRange',
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    });
    expect(getBudgetPeriodFilterRange('PREVIOUS_QUARTER', currentDate)).toEqual({
      mode: 'overlapRange',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
    });
    expect(getBudgetPeriodFilterRange('PREVIOUS_YEAR', currentDate)).toEqual({
      mode: 'overlapRange',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    });
  });

  it('excludes loan and debt categories from budget category choices', () => {
    expect(
      getBudgetExpenseCategories([
        { id: 1, name: 'Ăn uống', type: 'EXPENSE', cash_flow_group: 'NORMAL' },
        { id: 2, name: 'Trả nợ', type: 'EXPENSE', cash_flow_group: 'LOAN_DEBT' },
        { id: 3, name: 'Lương', type: 'INCOME', cash_flow_group: 'NORMAL' },
      ]).map(category => category.id),
    ).toEqual([1]);
  });

  it('searches budget name, wallet name, and category name', () => {
    const budgets = [
      makeBudget({ id: 1, name: 'Ăn uống tháng này', scope: 'CATEGORY', category_name: 'Ăn uống' }),
      makeBudget({ id: 2, name: 'Tiền nhà', wallet_name: 'Ví tiền mặt' }),
    ];

    expect(filterBudgets(budgets, { query: 'ăn uống', period: 'ALL' }).map(item => item.id)).toEqual([1]);
    expect(filterBudgets(budgets, { query: 'tiền mặt', period: 'ALL' }).map(item => item.id)).toEqual([2]);
  });

  it('keeps all budgets when the all filter is selected', () => {
    const budgets = [
      makeBudget({ id: 1, period: 'WEEK' }),
      makeBudget({ id: 2, period: 'MONTH' }),
      makeBudget({ id: 3, period: 'QUARTER', start_date: '2026-04-01', end_date: '2026-06-30' }),
      makeBudget({ id: 4, period: 'CUSTOM', start_date: '2026-05-10', end_date: '2026-05-20' }),
    ];

    expect(filterBudgets(budgets, { query: '', period: 'ALL' }).map(item => item.id)).toEqual([1, 2, 3, 4]);
  });

  it('filters current budgets by the selected current date', () => {
    const budgets = [
      makeBudget({ id: 1, start_date: '2026-05-01', end_date: '2026-05-31' }),
      makeBudget({ id: 2, start_date: '2026-04-01', end_date: '2026-04-30' }),
      makeBudget({ id: 3, start_date: '2026-06-01', end_date: '2026-06-30' }),
    ];

    expect(
      filterBudgets(budgets, {
        query: '',
        period: 'CURRENT',
        currentDate: '2026-05-20',
      }).map(item => item.id),
    ).toEqual([1]);
  });

  it('filters custom search ranges by overlapping budget dates', () => {
    const budgets = [
      makeBudget({ id: 1, start_date: '2026-05-01', end_date: '2026-05-31' }),
      makeBudget({ id: 2, start_date: '2026-06-01', end_date: '2026-06-30' }),
      makeBudget({ id: 3, start_date: '2026-07-01', end_date: '2026-07-31' }),
    ];

    expect(
      filterBudgets(budgets, {
        query: '',
        period: 'CUSTOM_RANGE',
        customStartDate: '2026-05-20',
        customEndDate: '2026-06-10',
      }).map(item => item.id),
    ).toEqual([1, 2]);
  });

  it('filters previous month budgets by date overlap, not by period type', () => {
    const budgets = [
      makeBudget({ id: 1, period: 'MONTH', start_date: '2026-05-01', end_date: '2026-05-31' }),
      makeBudget({ id: 2, period: 'CUSTOM', start_date: '2026-05-15', end_date: '2026-06-15' }),
      makeBudget({ id: 3, period: 'MONTH', start_date: '2026-06-01', end_date: '2026-06-30' }),
    ];

    expect(
      filterBudgets(budgets, {
        query: '',
        period: 'PREVIOUS_MONTH',
        currentDate: '2026-06-12',
      }).map(item => item.id),
    ).toEqual([1, 2]);
  });

});
