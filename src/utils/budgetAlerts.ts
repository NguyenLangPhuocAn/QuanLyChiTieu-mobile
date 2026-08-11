import type { TransactionItem } from '../data/mockTransactions';
import type { Budget } from '../types/budget';
import type { Wallet } from '../types/wallet';

export type WalletBudgetAlert = {
  walletId: number;
  walletName: string;
  balance: number;
  budgetLimit: number | null;
  periodExpense: number;
  periodStart: string | null;
  periodEnd: string | null;
  usageRate: number;
  level: 'warning' | 'danger';
  reasons: string[];
};

const isWithinBudget = (transaction: TransactionItem, budget: Budget) => {
  const date = new Date(transaction.date);
  const start = new Date(budget.start_date);
  const end = new Date(budget.end_date);

  return date >= start && date <= end;
};

const findActiveBudget = (budgets: Budget[], walletId: number) => {
  const now = new Date();

  return budgets
    .filter(budget => {
      const start = new Date(budget.start_date);
      const end = new Date(budget.end_date);

      return budget.scope === 'WALLET' && budget.wallet_id === walletId && start <= now && end >= now;
    })
    .sort(
      (left, right) =>
        new Date(right.start_date).getTime() - new Date(left.start_date).getTime() ||
        right.id - left.id,
    )[0];
};

export const getExpenseByWalletBudget = (
  transactions: TransactionItem[],
  budgets: Budget[],
) => {
  const expenseMap = new Map<number, number>();
  const activeBudgetsByWallet = new Map<number, Budget>();

  budgets.forEach(budget => {
    const activeBudget = findActiveBudget(budgets, budget.wallet_id);

    if (!activeBudget || activeBudget.id !== budget.id || activeBudgetsByWallet.has(budget.wallet_id)) {
      return;
    }

    activeBudgetsByWallet.set(budget.wallet_id, budget);

    const localSpent = transactions
      .filter(transaction => (
        transaction.walletId === budget.wallet_id &&
        transaction.type === 'expense' &&
        transaction.cashFlowType !== 'loan_debt' &&
        isWithinBudget(transaction, budget)
      ))
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const spent = Math.max(Number(budget.spent ?? 0), localSpent);

    expenseMap.set(budget.wallet_id, Math.max(expenseMap.get(budget.wallet_id) ?? 0, spent));
  });

  return expenseMap;
};

export const buildWalletBudgetAlerts = (
  wallets: Wallet[],
  transactions: TransactionItem[],
  budgets: Budget[] = [],
): WalletBudgetAlert[] => {
  const expenseMap = getExpenseByWalletBudget(transactions, budgets);

  return wallets
    .map(wallet => {
      const balance = Number(wallet.balance || 0);
      const budget = findActiveBudget(budgets, wallet.id);
      const budgetLimit = budget ? Number(budget.available_limit_amount ?? budget.limit_amount ?? budget.amount ?? 0) : null;
      const periodExpense = expenseMap.get(wallet.id) ?? 0;
      const usageRate = budgetLimit && budgetLimit > 0 ? periodExpense / budgetLimit : 0;
      const reasons: string[] = [];

      if (balance < 0) {
        reasons.push('Số dư ví đang âm');
      }

      if (budgetLimit && usageRate > 1) {
        reasons.push('Đã vượt ngân sách của ví');
      } else if (budgetLimit && usageRate >= 0.8) {
        reasons.push('Đã dùng gần hết ngân sách của ví');
      }

      if (reasons.length === 0) {
        return null;
      }

      const alert: WalletBudgetAlert = {
        walletId: wallet.id,
        walletName: wallet.name,
        balance,
        budgetLimit,
        periodExpense,
        periodStart: budget?.start_date ?? null,
        periodEnd: budget?.end_date ?? null,
        usageRate,
        level: balance < 0 || usageRate > 1 ? 'danger' : 'warning',
        reasons,
      };

      return alert;
    })
    .filter((alert): alert is WalletBudgetAlert => alert !== null);
};
