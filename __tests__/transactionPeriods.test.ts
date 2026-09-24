import type { TransactionItem } from '../src/data/mockTransactions';
import {
  buildExpenseTrendBuckets,
  estimateWalletBalanceAtDate,
  selectRecentOverviewTransactions,
  selectWalletsForPeriodPreview,
  filterTransactionsByPeriod,
  getPeriodBounds,
  getPeriodLabel,
  getPeriodRangeForOffset,
  getOverviewMonthBounds,
  getPreviousPeriodBounds,
  sumNormalByType,
} from '../src/utils/transactionPeriods';

const transaction = (overrides: Partial<TransactionItem>): TransactionItem => ({
  id: overrides.id ?? '1',
  walletId: overrides.walletId,
  categoryId: overrides.categoryId,
  categoryIcon: overrides.categoryIcon,
  wallet: 'Cash',
  category: 'Food',
  currency: 'VND',
  displayAmount: overrides.displayAmount ?? 0,
  displayCurrency: 'VND',
  note: 'Test',
  type: overrides.type ?? 'expense',
  cashFlowType: overrides.cashFlowType ?? 'normal',
  amount: overrides.amount ?? overrides.displayAmount ?? 0,
  date: overrides.date ?? '2026-05-01T00:00:00.000Z',
});

describe('transaction period helpers', () => {
  const anchor = new Date(2026, 4, 20);
  const transactions = [
    transaction({
      id: 'may-income',
      type: 'income',
      displayAmount: 5000000,
      date: '2026-05-02T00:00:00.000Z',
    }),
    transaction({
      id: 'may-food',
      type: 'expense',
      displayAmount: 1000000,
      date: '2026-05-05T00:00:00.000Z',
    }),
    transaction({
      id: 'may-loan',
      type: 'income',
      cashFlowType: 'loan_debt',
      displayAmount: 2000000,
      date: '2026-05-06T00:00:00.000Z',
    }),
    transaction({
      id: 'apr-food',
      type: 'expense',
      displayAmount: 700000,
      date: '2026-04-20T00:00:00.000Z',
    }),
    transaction({
      id: 'feb-food',
      type: 'expense',
      displayAmount: 300000,
      date: '2026-02-10T00:00:00.000Z',
    }),
  ];

  it('filters current month transactions by default anchor', () => {
    expect(
      filterTransactionsByPeriod(transactions, 'month', {}, anchor).map(
        item => item.id,
      ),
    ).toEqual(['may-income', 'may-food', 'may-loan']);
  });

  it('filters quarter and custom date ranges', () => {
    expect(
      filterTransactionsByPeriod(transactions, 'quarter', {}, anchor).map(
        item => item.id,
      ),
    ).toEqual(['may-income', 'may-food', 'may-loan', 'apr-food']);
    expect(
      filterTransactionsByPeriod(
        transactions,
        'custom',
        { dateFrom: '2026-04-15', dateTo: '2026-05-05' },
        anchor,
      ).map(item => item.id),
    ).toEqual(['may-income', 'may-food', 'apr-food']);
  });

  it('sums normal income and expense while excluding loan and debt flows', () => {
    const may = filterTransactionsByPeriod(transactions, 'month', {}, anchor);

    expect(sumNormalByType(may, 'income')).toBe(5000000);
    expect(sumNormalByType(may, 'expense')).toBe(1000000);
  });

  it('builds compact period labels', () => {
    expect(getPeriodLabel('month', {}, anchor)).toBe('Tháng 5/2026');
    expect(getPeriodLabel('quarter', {}, anchor)).toBe('Quý 2/2026');
    expect(
      getPeriodLabel(
        'custom',
        { dateFrom: '2026-04-15', dateTo: '2026-05-05' },
        anchor,
      ),
    ).toBe('15/04/2026 - 05/05/2026');
  });

  it('returns the previous matching period bounds', () => {
    const current = getPeriodBounds(
      'month',
      { selectedMonth: 4, selectedYear: 2026 },
      anchor,
    );
    const previous = getPreviousPeriodBounds(
      'month',
      { selectedMonth: 4, selectedYear: 2026 },
      anchor,
    );

    expect(current.start).toEqual(new Date(2026, 4, 1));
    expect(current.end).toEqual(new Date(2026, 4, 31, 23, 59, 59, 999));
    expect(previous.start).toEqual(new Date(2026, 3, 1));
    expect(previous.end).toEqual(new Date(2026, 3, 30, 23, 59, 59, 999));
  });

  it('caps the current overview month at today', () => {
    const bounds = getOverviewMonthBounds(
      new Date(2026, 5, 1),
      new Date(2026, 5, 13, 14, 30),
    );

    expect(bounds.start).toEqual(new Date(2026, 5, 1));
    expect(bounds.end).toEqual(new Date(2026, 5, 13, 23, 59, 59, 999));
  });

  it('uses the full month for a past overview month', () => {
    const bounds = getOverviewMonthBounds(
      new Date(2026, 4, 1),
      new Date(2026, 5, 13),
    );

    expect(bounds.start).toEqual(new Date(2026, 4, 1));
    expect(bounds.end).toEqual(new Date(2026, 4, 31, 23, 59, 59, 999));
  });

  it('builds selected period ranges from an offset', () => {
    expect(getPeriodRangeForOffset('month', -1, anchor)).toEqual({
      selectedMonth: 3,
      selectedYear: 2026,
    });
    expect(getPeriodRangeForOffset('week', -1, anchor)).toEqual({
      selectedWeekStart: '2026-05-11',
    });
    expect(getPeriodRangeForOffset('year', -1, anchor)).toEqual({
      selectedYear: 2025,
    });
  });

  it('handles month and quarter offsets across years', () => {
    const januaryAnchor = new Date(2026, 0, 15);

    expect(getPeriodRangeForOffset('month', -1, januaryAnchor)).toEqual({
      selectedMonth: 11,
      selectedYear: 2025,
    });
    expect(getPeriodRangeForOffset('quarter', -1, januaryAnchor)).toEqual({
      selectedQuarter: 3,
      selectedYear: 2025,
    });
    expect(
      getPreviousPeriodBounds(
        'quarter',
        { selectedQuarter: 0, selectedYear: 2026 },
        januaryAnchor,
      ),
    ).toEqual({
      start: new Date(2025, 9, 1),
      end: new Date(2025, 11, 31, 23, 59, 59, 999),
    });
  });

  it('keeps previous custom ranges the same inclusive length', () => {
    const previous = getPreviousPeriodBounds(
      'custom',
      { dateFrom: '2026-04-15', dateTo: '2026-05-05' },
      anchor,
    );

    expect(previous.start).toEqual(new Date(2026, 2, 25));
    expect(previous.end).toEqual(new Date(2026, 3, 14, 23, 59, 59, 999));
  });

  it('builds weekly trend buckets for the selected month instead of recent days', () => {
    const buckets = buildExpenseTrendBuckets(
      [
        transaction({
          id: 'week-1',
          type: 'expense',
          displayAmount: 100,
          date: '2026-05-03T00:00:00.000Z',
        }),
        transaction({
          id: 'week-2',
          type: 'expense',
          displayAmount: 200,
          date: '2026-05-10T00:00:00.000Z',
        }),
        transaction({
          id: 'outside',
          type: 'expense',
          displayAmount: 900,
          date: '2026-06-01T00:00:00.000Z',
        }),
      ],
      'month',
      { selectedMonth: 4, selectedYear: 2026 },
      anchor,
    );

    expect(buckets.map(item => item.label)).toEqual([
      '01/05-07/05',
      '08/05-14/05',
      '15/05-21/05',
      '22/05-28/05',
      '29/05-31/05',
    ]);
    expect(buckets.map(item => item.expense)).toEqual([100, 200, 0, 0, 0]);
  });

  it('builds seven daily trend buckets for the selected week', () => {
    const buckets = buildExpenseTrendBuckets(
      [
        transaction({
          id: 'mon',
          type: 'expense',
          displayAmount: 100,
          date: '2026-05-18T00:00:00.000Z',
        }),
        transaction({
          id: 'sun',
          type: 'expense',
          displayAmount: 300,
          date: '2026-05-24T00:00:00.000Z',
        }),
      ],
      'week',
      { selectedWeekStart: '2026-05-18' },
      anchor,
    );

    expect(buckets.map(item => item.label)).toEqual([
      '18/05',
      '19/05',
      '20/05',
      '21/05',
      '22/05',
      '23/05',
      '24/05',
    ]);
    expect(buckets.map(item => item.expense)).toEqual([
      100, 0, 0, 0, 0, 0, 300,
    ]);
  });

  it('estimates wallet balance at the selected period end from later transactions', () => {
    const balance = estimateWalletBalanceAtDate(
      { id: 10, balance: 1000, display_balance: 1000 },
      [
        transaction({
          walletId: 10,
          type: 'income',
          displayAmount: 300,
          amount: 300,
          date: '2026-06-02T00:00:00.000Z',
        }),
        transaction({
          walletId: 10,
          type: 'expense',
          displayAmount: 150,
          amount: 150,
          date: '2026-06-03T00:00:00.000Z',
        }),
        transaction({
          walletId: 99,
          type: 'income',
          displayAmount: 999,
          amount: 999,
          date: '2026-06-03T00:00:00.000Z',
        }),
        transaction({
          walletId: 10,
          type: 'expense',
          displayAmount: 500,
          amount: 500,
          date: '2026-05-20T00:00:00.000Z',
        }),
      ],
      new Date(2026, 4, 31, 23, 59, 59, 999),
    );

    expect(balance).toBe(850);
  });

  it('can estimate native wallet balance without mixing display currency amounts', () => {
    const balance = estimateWalletBalanceAtDate(
      { id: 10, balance: 100, display_balance: 2500000 },
      [
        transaction({
          walletId: 10,
          type: 'expense',
          amount: 20,
          displayAmount: 500000,
          date: '2026-05-20T00:00:00.000Z',
        }),
        transaction({
          walletId: 10,
          type: 'income',
          amount: 10,
          displayAmount: 250000,
          date: '2026-06-02T00:00:00.000Z',
        }),
      ],
      new Date(2026, 4, 31, 23, 59, 59, 999),
      'native',
    );

    expect(balance).toBe(90);
  });

  it('returns zero balance before a wallet existed', () => {
    const balance = estimateWalletBalanceAtDate(
      {
        id: 10,
        balance: 20375000,
        display_balance: 20375000,
        created_at: '2026-05-24T00:00:00.000Z',
      },
      [],
      new Date(2025, 7, 31, 23, 59, 59, 999),
    );

    expect(balance).toBe(0);
  });

  it('uses the current balance for a wallet that exists without transactions', () => {
    const balance = estimateWalletBalanceAtDate(
      {
        id: 10,
        balance: 12000000,
        display_balance: 12000000,
        created_at: '2026-09-03T00:00:00.000Z',
      },
      [],
      new Date(2026, 8, 3, 23, 59, 59, 999),
    );

    expect(balance).toBe(12000000);
  });

  it('calculates a historical balance when a wallet has transactions dated before its creation date', () => {
    const balance = estimateWalletBalanceAtDate(
      {
        id: 10,
        balance: 1000,
        display_balance: 1000,
        created_at: '2026-05-24T00:00:00.000Z',
      },
      [
        transaction({
          walletId: 10,
          type: 'income',
          displayAmount: 100,
          amount: 100,
          date: '2026-03-05T00:00:00.000Z',
        }),
        transaction({
          walletId: 10,
          type: 'expense',
          displayAmount: 50,
          amount: 50,
          date: '2026-06-03T00:00:00.000Z',
        }),
      ],
      new Date(2026, 2, 31, 23, 59, 59, 999),
    );

    expect(balance).toBe(1050);
  });

  it('returns zero balance before the first wallet transaction', () => {
    const balance = estimateWalletBalanceAtDate(
      { id: 10, balance: 20375000, display_balance: 20375000 },
      [
        transaction({
          walletId: 10,
          type: 'income',
          displayAmount: 5000000,
          amount: 5000000,
          date: '2026-05-02T00:00:00.000Z',
        }),
      ],
      new Date(2026, 3, 30, 23, 59, 59, 999),
    );

    expect(balance).toBe(0);
  });

  it('shows wallets that actually contribute to a historical ending balance', () => {
    const wallets = [
      { id: 1, name: 'New A', balance: 0 },
      { id: 2, name: 'New B', balance: 0 },
      { id: 3, name: 'New C', balance: 0 },
      { id: 4, name: 'Old A', balance: 0 },
      { id: 5, name: 'Old B', balance: 0 },
    ];
    const balances = new Map([
      [1, { native: 0, display: 0 }],
      [2, { native: 0, display: 0 }],
      [3, { native: 0, display: 0 }],
      [4, { native: 20000000, display: 20000000 }],
      [5, { native: 11120000, display: 11120000 }],
    ]);

    expect(
      selectWalletsForPeriodPreview(wallets, balances, false, 3).map(
        wallet => wallet.id,
      ),
    ).toEqual([4, 5]);
  });

  it('keeps overview recent transactions focused on normal cash flow items', () => {
    const recent = selectRecentOverviewTransactions(
      [
        transaction({
          id: 'loan-recovery',
          type: 'income',
          cashFlowType: 'loan_debt',
          displayAmount: 500000,
          date: '2026-05-10T00:00:00.000Z',
        }),
        transaction({
          id: 'latest-expense',
          type: 'expense',
          displayAmount: 100000,
          date: '2026-05-09T00:00:00.000Z',
        }),
        transaction({
          id: 'latest-income',
          type: 'income',
          displayAmount: 900000,
          date: '2026-05-08T00:00:00.000Z',
        }),
      ],
      4,
    );

    expect(recent.map(item => item.id)).toEqual([
      'latest-expense',
      'latest-income',
    ]);
  });
});
