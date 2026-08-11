import {
  getBudgetDateEditPolicy,
  getBudgetPeriodRange,
  getNextBudgetPeriodRange,
  getBudgetSaveRange,
  toDateKey,
} from '../src/utils/budgetPeriod';

describe('budget period ranges', () => {
  it('uses the current date as the anchor when switching periods', () => {
    const now = new Date(2026, 4, 20);

    expect(getBudgetPeriodRange('YEAR', now)).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    });
    expect(getBudgetPeriodRange('DAY', now)).toEqual({
      start: '2026-05-20',
      end: '2026-05-20',
    });
    expect(getBudgetPeriodRange('WEEK', now)).toEqual({
      start: '2026-05-18',
      end: '2026-05-24',
    });
    expect(getBudgetPeriodRange('MONTH', now)).toEqual({
      start: '2026-05-01',
      end: '2026-05-31',
    });
    expect(getBudgetPeriodRange('QUARTER', now)).toEqual({
      start: '2026-04-01',
      end: '2026-06-30',
    });
    expect(getBudgetPeriodRange('WEEK', new Date(2026, 4, 24))).toEqual({
      start: '2026-05-18',
      end: '2026-05-24',
    });
    expect(getBudgetPeriodRange('CUSTOM', now)).toEqual({
      start: '2026-05-20',
      end: '2026-05-20',
    });
  });

  it('moves daily, weekly, and monthly budgets to their next ranges', () => {
    expect(
      getNextBudgetPeriodRange({
        period: 'DAY',
        end_date: '2026-06-13T23:59:59.999Z',
      }),
    ).toEqual({ start: '2026-06-14', end: '2026-06-14' });
    expect(
      getNextBudgetPeriodRange({
        period: 'WEEK',
        end_date: '2026-06-14T23:59:59.999Z',
      }),
    ).toEqual({ start: '2026-06-15', end: '2026-06-21' });
    expect(
      getNextBudgetPeriodRange({
        period: 'MONTH',
        end_date: '2026-05-31T23:59:59.999Z',
      }),
    ).toEqual({ start: '2026-06-01', end: '2026-06-30' });
  });

  it('only allows manual date input for custom budgets', () => {
    expect(getBudgetDateEditPolicy('WEEK')).toEqual({
      canEditStartDate: false,
      canEditEndDate: false,
    });
    expect(getBudgetDateEditPolicy('MONTH')).toEqual({
      canEditStartDate: false,
      canEditEndDate: false,
    });
    expect(getBudgetDateEditPolicy('YEAR')).toEqual({
      canEditStartDate: false,
      canEditEndDate: false,
    });
    expect(getBudgetDateEditPolicy('QUARTER')).toEqual({
      canEditStartDate: false,
      canEditEndDate: false,
    });
    expect(getBudgetDateEditPolicy('CUSTOM')).toEqual({
      canEditStartDate: true,
      canEditEndDate: true,
    });
  });

  it('preserves the displayed range when saving an existing fixed-period budget', () => {
    expect(getBudgetSaveRange('MONTH', '2026-04-01', '2026-04-30')).toEqual({
      start: '2026-04-01',
      end: '2026-04-30',
    });
  });

  it('keeps the local calendar date instead of converting through UTC', () => {
    expect(toDateKey(new Date(2026, 5, 12, 0, 30))).toBe('2026-06-12');
  });
});
