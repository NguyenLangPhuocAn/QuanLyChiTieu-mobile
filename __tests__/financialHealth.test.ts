import {
  buildFinancialHealthActions,
  calculateFinancialHealthBreakdown,
  calculateFinancialHealthScore,
} from '../src/screens/home/OverviewScreen';

describe('calculateFinancialHealthScore', () => {
  it('rewards positive cash flow, reserves and controlled budgets', () => {
    expect(
      calculateFinancialHealthScore({
        income: 10_000_000,
        expense: 7_000_000,
        totalBalance: 30_000_000,
        budgetPercents: [0.6, 0.75],
      }),
    ).toEqual({ score: 100, label: 'Tốt' });
  });

  it('marks negative cash flow and exhausted budgets as needing attention', () => {
    const result = calculateFinancialHealthScore({
      income: 5_000_000,
      expense: 7_000_000,
      totalBalance: 500_000,
      budgetPercents: [1.3],
    });

    expect(result.score).toBeLessThan(40);
    expect(result.label).toBe('Cần chú ý');
  });

  it('returns the three components shown in the score details', () => {
    const result = calculateFinancialHealthBreakdown({
      income: 10_000_000,
      expense: 8_000_000,
      totalBalance: 16_000_000,
      budgetPercents: [1],
    });

    expect(result.savingRate).toBeCloseTo(0.2);
    expect(result.reserveMonths).toBeCloseTo(2);
    expect(result.averageBudgetPercent).toBeCloseTo(1);
    expect(result.cashFlowPoints).toBeCloseTo(40);
    expect(result.reservePoints).toBeCloseTo(20);
    expect(result.budgetPoints).toBeCloseTo(15);
    expect(result.score).toBe(75);
  });

  it('uses a stable recent expense baseline for emergency reserves', () => {
    const result = calculateFinancialHealthBreakdown({
      income: 10_000_000,
      expense: 2_000_000,
      totalBalance: 6_000_000,
      budgetPercents: [0.5],
      monthlyExpenseBaseline: 4_000_000,
    });

    expect(result.reserveMonths).toBeCloseTo(1.5);
    expect(result.reserveTarget).toBe(12_000_000);
    expect(result.reserveGap).toBe(6_000_000);
  });

  it('does not claim the emergency reserve is complete before expense history exists', () => {
    const result = calculateFinancialHealthBreakdown({
      income: 0,
      expense: 0,
      totalBalance: 0,
      budgetPercents: [],
    });

    expect(buildFinancialHealthActions(result, 0, 'VND')[1]).toContain(
      'Ghi nhận chi tiêu',
    );
  });
});
