import type { ApiTransaction } from '../../types/transaction';
import {
  buildUpcomingMoneyCalendar,
  buildProjectedCashFlow,
  calculateEmergencyFund,
  calculateEmergencyIncomeShock,
  calculateIrregularIncome,
  calculateSafeToSpendToday,
  detectRecurringMoney,
  findDataQualityIssues,
} from '../financialInsights';

const transaction = (
  id: number,
  type: 'INCOME' | 'EXPENSE',
  amount: number,
  date: string,
  note: string,
  extra: Partial<ApiTransaction> = {},
): ApiTransaction => ({
  id,
  wallet_id: 1,
  category_id: type === 'INCOME' ? 2 : 3,
  amount: type === 'INCOME' ? amount : -amount,
  currency: 'VND',
  type,
  note,
  transaction_date: date,
  ...extra,
});

describe('financialInsights', () => {
  it('uses median and lower quartile for irregular income', () => {
    const result = calculateIrregularIncome(
      [
        transaction(1, 'INCOME', 10_000_000, '2026-01-10', 'Dự án A'),
        transaction(2, 'INCOME', 20_000_000, '2026-02-10', 'Dự án B'),
        transaction(3, 'INCOME', 5_000_000, '2026-03-10', 'Dự án C'),
        transaction(4, 'EXPENSE', 4_000_000, '2026-01-15', 'Chi tiêu'),
        transaction(5, 'EXPENSE', 6_000_000, '2026-02-15', 'Chi tiêu'),
        transaction(6, 'EXPENSE', 5_000_000, '2026-03-15', 'Chi tiêu'),
      ],
      new Date('2026-04-17T00:00:00.000Z'),
      3,
    );

    expect(result.medianIncome).toBe(10_000_000);
    expect(result.conservativeIncome).toBe(5_000_000);
    expect(result.recommendedMonthlySpend).toBe(4_000_000);
  });

  it('calculates emergency runway from liquid balances and recent expenses', () => {
    const result = calculateEmergencyFund(
      [
        {
          id: 1,
          user_id: 7,
          name: 'Tiền mặt',
          currency: 'VND',
          balance: 12_000_000,
          created_at: '2026-01-01',
        },
      ],
      [
        transaction(1, 'EXPENSE', 4_000_000, '2026-01-15', 'Thiết yếu'),
        transaction(2, 'EXPENSE', 4_000_000, '2026-02-15', 'Thiết yếu'),
        transaction(3, 'EXPENSE', 4_000_000, '2026-03-15', 'Thiết yếu'),
      ],
      new Date('2026-04-17T00:00:00.000Z'),
    );

    expect(result.monthsCovered).toBe(3);
    expect(result.gap).toBe(0);
  });

  it('simulates the monthly shortfall after an income reduction', () => {
    const result = calculateEmergencyIncomeShock(
      [
        {
          id: 1,
          user_id: 7,
          name: 'Tiền mặt',
          currency: 'VND',
          balance: 12_000_000,
          created_at: '2026-01-01',
        },
      ],
      [
        transaction(1, 'INCOME', 10_000_000, '2026-01-10', 'Dự án A'),
        transaction(2, 'INCOME', 10_000_000, '2026-02-10', 'Dự án B'),
        transaction(3, 'INCOME', 10_000_000, '2026-03-10', 'Dự án C'),
        transaction(4, 'EXPENSE', 8_000_000, '2026-01-15', 'Thiết yếu'),
        transaction(5, 'EXPENSE', 8_000_000, '2026-02-15', 'Thiết yếu'),
        transaction(6, 'EXPENSE', 8_000_000, '2026-03-15', 'Thiết yếu'),
      ],
      50,
      new Date('2026-04-17T00:00:00.000Z'),
      3,
    );

    expect(result.incomeAfterReduction).toBe(5_000_000);
    expect(result.monthlyShortfall).toBe(3_000_000);
    expect(result.monthsCovered).toBe(4);
  });

  it('detects stable monthly subscriptions and builds the next cash date', () => {
    const data = [
      transaction(1, 'EXPENSE', 79_000, '2026-01-05', 'Netflix'),
      transaction(2, 'EXPENSE', 79_000, '2026-02-05', 'Netflix'),
      transaction(3, 'EXPENSE', 79_000, '2026-03-05', 'Netflix'),
    ];

    const [subscription] = detectRecurringMoney(data);
    const calendar = buildUpcomingMoneyCalendar(
      data,
      new Date('2026-03-20T00:00:00.000Z'),
      30,
    );

    expect(subscription).toMatchObject({
      type: 'EXPENSE',
      averageAmount: 79_000,
      occurrences: 3,
    });
    expect(calendar).toHaveLength(1);
    expect(calendar[0].nextDate.slice(0, 10)).toBe('2026-04-05');
  });

  it('subtracts upcoming recurring expenses from the current budget', () => {
    const result = calculateSafeToSpendToday(
      [],
      [
        {
          id: 1,
          user_id: 7,
          name: 'Chi tháng 3',
          scope: 'WALLET',
          wallet_id: 1,
          wallet_name: 'Tiền mặt',
          wallet_currency: 'VND',
          limit_amount: 3_100_000,
          period: 'MONTH',
          start_date: '2026-03-01',
          end_date: '2026-03-31',
          spent: 0,
          remaining: 3_100_000,
          percent: 0,
          percentage: 0,
          status: 'NORMAL',
        },
      ],
      [
        transaction(1, 'EXPENSE', 100_000, '2026-01-25', 'Internet'),
        transaction(2, 'EXPENSE', 100_000, '2026-02-25', 'Internet'),
      ],
      new Date('2026-03-20T00:00:00.000Z'),
    );

    expect(result.source).toBe('BUDGET');
    expect(result.upcomingExpenses).toBe(100_000);
    expect(result.manualExpenses).toBe(0);
    expect(result.amount).toBe(250_000);
  });

  it('uses only confirmed recurring items and manual plans as commitments', () => {
    const data = [
      transaction(1, 'EXPENSE', 100_000, '2026-01-25', 'Internet'),
      transaction(2, 'EXPENSE', 100_000, '2026-02-25', 'Internet'),
      transaction(3, 'EXPENSE', 80_000, '2026-01-26', 'Streaming'),
      transaction(4, 'EXPENSE', 80_000, '2026-02-26', 'Streaming'),
    ];
    const [internet] = detectRecurringMoney(data).filter(
      item => item.label === 'Internet',
    );
    const result = calculateSafeToSpendToday(
      [],
      [
        {
          id: 1,
          user_id: 7,
          name: 'Chi tháng 3',
          scope: 'WALLET',
          wallet_id: 1,
          wallet_name: 'Tiền mặt',
          wallet_currency: 'VND',
          limit_amount: 3_100_000,
          period: 'MONTH',
          start_date: '2026-03-01',
          end_date: '2026-03-31',
          spent: 0,
          remaining: 3_100_000,
          percent: 0,
          percentage: 0,
          status: 'NORMAL',
        },
      ],
      data,
      new Date('2026-03-20T00:00:00.000Z'),
      {
        confirmedPatternKeys: new Set([internet.key]),
        manualPlans: [
          {
            id: 'rent',
            label: 'Tiền nhà',
            type: 'EXPENSE',
            amount: 500_000,
            currency: 'VND',
            date: '2026-03-24',
            createdAt: '2026-03-01T00:00:00.000Z',
          },
        ],
      },
    );

    expect(result.upcomingExpenses).toBe(100_000);
    expect(result.manualExpenses).toBe(500_000);
    expect(result.amount).toBeCloseTo(208_333.33, 2);
  });

  it('reports duplicate, uncategorized and receipt total issues', () => {
    const data = [
      transaction(1, 'EXPENSE', 90_000, '2026-03-20', 'Cà phê', {
        category_id: null,
        receipt_items: [{ name: 'Cà phê', amount: 80_000 }],
      }),
      transaction(2, 'EXPENSE', 90_000, '2026-03-20', 'Cà phê', {
        category_id: null,
      }),
    ];

    const issues = findDataQualityIssues(data, 'VND');

    expect(issues.some(issue => issue.type === 'DUPLICATE')).toBe(true);
    expect(issues.filter(issue => issue.type === 'UNCATEGORIZED')).toHaveLength(
      2,
    );
    expect(issues.some(issue => issue.type === 'RECEIPT_MISMATCH')).toBe(true);
  });

  it('projects the daily balance and identifies the first shortage date', () => {
    const result = buildProjectedCashFlow(
      [
        {
          id: 1,
          user_id: 7,
          name: 'Tiền mặt',
          currency: 'VND',
          balance: 1_000_000,
          created_at: '2026-01-01',
        },
      ],
      [
        {
          key: 'income',
          label: 'Lương',
          type: 'INCOME',
          averageAmount: 2_000_000,
          intervalDays: 30,
          occurrences: 3,
          lastDate: '2026-02-25T00:00:00.000Z',
          nextDate: '2026-03-25T00:00:00.000Z',
          transactionIds: [1, 2, 3],
        },
      ],
      [
        {
          id: 'rent',
          label: 'Tiền nhà',
          type: 'EXPENSE',
          amount: 3_500_000,
          currency: 'VND',
          date: '2026-03-27',
          createdAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      new Date('2026-03-20T00:00:00.000Z'),
      20,
    );

    expect(result.days).toEqual([
      expect.objectContaining({
        date: '2026-03-25',
        projectedBalance: 3_000_000,
      }),
      expect.objectContaining({
        date: '2026-03-27',
        projectedBalance: -500_000,
      }),
    ]);
    expect(result.firstRiskDate).toBe('2026-03-27');
    expect(result.lowestBalance).toBe(-500_000);
  });
});
