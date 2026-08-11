import { buildOverviewBudgetRows } from '../src/screens/home/OverviewScreen';
import type { TransactionItem } from '../src/data/mockTransactions';
import type { Budget } from '../src/types/budget';
import type { Wallet } from '../src/types/wallet';
import { getPeriodBounds } from '../src/utils/transactionPeriods';

describe('overview budget rows', () => {
  it('excludes budgets that ended before the selected period', () => {
    const wallets = [
      { id: 10, name: 'Ví chính', currency: 'VND', balance: 0 },
    ] as Wallet[];
    const budgets = [
      {
        id: 1,
        name: 'Ngân sách cũ',
        scope: 'WALLET',
        wallet_id: 10,
        wallet_name: 'Ví chính',
        wallet_currency: 'VND',
        limit_amount: 1000000,
        spent: 900000,
        status: 'WARNING',
        start_date: '2026-06-01T00:00:00.000Z',
        end_date: '2026-06-30T23:59:59.000Z',
      },
      {
        id: 2,
        name: 'Ngân sách hiện tại',
        scope: 'WALLET',
        wallet_id: 10,
        wallet_name: 'Ví chính',
        wallet_currency: 'VND',
        limit_amount: 2000000,
        spent: 500000,
        status: 'NORMAL',
        start_date: '2026-08-01T00:00:00.000Z',
        end_date: '2026-08-31T23:59:59.000Z',
      },
    ] as Budget[];

    const rows = buildOverviewBudgetRows(
      budgets,
      wallets,
      [],
      getPeriodBounds('month', { selectedMonth: 7, selectedYear: 2026 }),
    );

    expect(rows.map(row => row.key)).toEqual(['budget-2']);
  });

  it('uses stable unique keys when multiple wallet budgets share a wallet name', () => {
    const wallets = [
      { id: 10, name: 'Vietnamcheck', currency: 'VND', balance: 0 },
    ] as Wallet[];
    const budgets = [
      {
        id: 1,
        scope: 'WALLET',
        wallet_id: 10,
        wallet_name: 'Vietnamcheck',
        wallet_currency: 'VND',
        limit_amount: 1000000,
        spent: 100000,
        status: 'NORMAL',
      },
      {
        id: 2,
        scope: 'WALLET',
        wallet_id: 10,
        wallet_name: 'Vietnamcheck',
        wallet_currency: 'VND',
        limit_amount: 2000000,
        spent: 300000,
        status: 'WARNING',
      },
    ] as Budget[];

    const rows = buildOverviewBudgetRows(budgets, wallets, []);

    expect(rows.map(row => row.key).sort()).toEqual(['budget-1', 'budget-2']);
    expect(new Set(rows.map(row => row.key)).size).toBe(rows.length);
  });

  it('summarizes the three most important wallet and category budgets', () => {
    const wallets = [
      { id: 10, name: 'Ví chính', currency: 'VND', balance: 0 },
      { id: 11, name: 'Ví phụ', currency: 'VND', balance: 0 },
    ] as Wallet[];
    const budgets = [
      {
        id: 1,
        name: 'Ví ổn',
        scope: 'WALLET',
        wallet_id: 10,
        wallet_name: 'Ví chính',
        wallet_currency: 'VND',
        limit_amount: 1000000,
        spent: 100000,
        percent: 0.1,
        status: 'NORMAL',
      },
      {
        id: 2,
        name: 'Ăn uống',
        scope: 'CATEGORY',
        wallet_id: 10,
        wallet_name: 'Ví chính',
        wallet_currency: 'VND',
        category_id: 5,
        category_name: 'Ăn uống',
        limit_amount: 1000000,
        spent: 1200000,
        percent: 1.2,
        status: 'EXCEEDED',
      },
      {
        id: 3,
        name: 'Mua sắm',
        scope: 'CATEGORY',
        wallet_id: 11,
        wallet_name: 'Ví phụ',
        wallet_currency: 'VND',
        category_id: 6,
        category_name: 'Mua sắm',
        limit_amount: 1000000,
        spent: 820000,
        percent: 0.82,
        status: 'WARNING',
      },
      {
        id: 4,
        name: 'Ví gần hạn',
        scope: 'WALLET',
        wallet_id: 11,
        wallet_name: 'Ví phụ',
        wallet_currency: 'VND',
        limit_amount: 1000000,
        spent: 790000,
        percent: 0.79,
        status: 'NORMAL',
      },
    ] as Budget[];

    const rows = buildOverviewBudgetRows(budgets, wallets, []);

    expect(rows).toHaveLength(3);
    expect(rows.map(row => row.key)).toEqual(['budget-2', 'budget-3', 'budget-4']);
    expect(rows.map(row => row.scopeLabel)).toEqual(['Danh mục', 'Danh mục', 'Ví']);
    expect(rows.map(row => row.name)).toEqual(['Ăn uống', 'Mua sắm', 'Ví phụ']);
  });

  it('uses the selected period when budget spent is not provided', () => {
    const wallets = [
      { id: 10, name: 'Ví chính', currency: 'VND', balance: 0 },
    ] as Wallet[];
    const budgets = [
      {
        id: 1,
        name: 'Ăn uống',
        scope: 'CATEGORY',
        wallet_id: 10,
        wallet_name: 'Ví chính',
        wallet_currency: 'VND',
        category_id: 5,
        category_name: 'Ăn uống',
        limit_amount: 1000000,
        status: 'NORMAL',
      },
    ] as Budget[];
    const transactions = [
      {
        id: 'may-food',
        walletId: 10,
        categoryId: 5,
        wallet: 'Ví chính',
        category: 'Ăn uống',
        currency: 'VND',
        displayCurrency: 'VND',
        displayAmount: 200000,
        amount: 200000,
        note: 'Tháng 5',
        type: 'expense',
        cashFlowType: 'normal',
        date: '2026-05-10T00:00:00.000Z',
      },
      {
        id: 'jun-food',
        walletId: 10,
        categoryId: 5,
        wallet: 'Ví chính',
        category: 'Ăn uống',
        currency: 'VND',
        displayCurrency: 'VND',
        displayAmount: 900000,
        amount: 900000,
        note: 'Tháng 6',
        type: 'expense',
        cashFlowType: 'normal',
        date: '2026-06-10T00:00:00.000Z',
      },
    ] as TransactionItem[];

    const rows = buildOverviewBudgetRows(
      budgets,
      wallets,
      transactions,
      getPeriodBounds('month', { selectedMonth: 4, selectedYear: 2026 }),
    );

    expect(rows[0].spent).toBe(200000);
    expect(rows[0].percent).toBe(0.2);
  });

  it('excludes loan and debt flows from wallet budget fallback spending', () => {
    const wallets = [
      { id: 10, name: 'Ví chính', currency: 'VND', balance: 0 },
    ] as Wallet[];
    const budgets = [
      {
        id: 1,
        name: 'Ví chính',
        scope: 'WALLET',
        wallet_id: 10,
        wallet_name: 'Ví chính',
        wallet_currency: 'VND',
        limit_amount: 1000000,
        status: 'NORMAL',
      },
    ] as Budget[];
    const transactions = [
      {
        id: 'normal',
        walletId: 10,
        wallet: 'Ví chính',
        category: 'Ăn uống',
        currency: 'VND',
        displayCurrency: 'VND',
        displayAmount: 200000,
        amount: 200000,
        note: 'Chi thường',
        type: 'expense',
        cashFlowType: 'normal',
        date: '2026-05-10T00:00:00.000Z',
      },
      {
        id: 'loan',
        walletId: 10,
        wallet: 'Ví chính',
        category: 'Trả nợ',
        currency: 'VND',
        displayCurrency: 'VND',
        displayAmount: 900000,
        amount: 900000,
        note: 'Dòng tiền vay nợ',
        type: 'expense',
        cashFlowType: 'loan_debt',
        date: '2026-05-12T00:00:00.000Z',
      },
    ] as TransactionItem[];

    const rows = buildOverviewBudgetRows(
      budgets,
      wallets,
      transactions,
      getPeriodBounds('month', { selectedMonth: 4, selectedYear: 2026 }),
    );

    expect(rows[0].spent).toBe(200000);
    expect(rows[0].percent).toBe(0.2);
  });
});
