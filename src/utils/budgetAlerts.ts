import type { TransactionItem } from '../data/mockTransactions';
import type { Wallet } from '../types/wallet';

export type WalletBudgetAlert = {
  walletId: number;
  walletName: string;
  balance: number;
  budgetLimit: number | null;
  monthExpense: number;
  usageRate: number;
  level: 'warning' | 'danger';
  reasons: string[];
};

const isCurrentMonth = (dateText: string) => {
  const date = new Date(dateText);
  const now = new Date();

  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

export const getMonthlyExpenseByWallet = (transactions: TransactionItem[]) => {
  const expenseMap = new Map<number, number>();

  transactions.forEach(transaction => {
    if (transaction.type !== 'expense' || !transaction.walletId || !isCurrentMonth(transaction.date)) {
      return;
    }

    expenseMap.set(
      transaction.walletId,
      (expenseMap.get(transaction.walletId) ?? 0) + transaction.amount,
    );
  });

  return expenseMap;
};

export const buildWalletBudgetAlerts = (
  wallets: Wallet[],
  transactions: TransactionItem[],
): WalletBudgetAlert[] => {
  const expenseMap = getMonthlyExpenseByWallet(transactions);

  return wallets
    .map(wallet => {
      const balance = Number(wallet.balance || 0);
      const budgetLimit = wallet.budget_limit ? Number(wallet.budget_limit) : null;
      const monthExpense = expenseMap.get(wallet.id) ?? 0;
      const usageRate = budgetLimit && budgetLimit > 0 ? monthExpense / budgetLimit : 0;
      const reasons: string[] = [];

      if (balance < 0) {
        reasons.push('Số dư ví đang âm');
      }

      if (budgetLimit && usageRate >= 1) {
        reasons.push('Đã vượt hạn mức chi tiêu tháng này');
      } else if (budgetLimit && usageRate >= 0.8) {
        reasons.push('Đã dùng gần hết hạn mức chi tiêu tháng này');
      }

      if (reasons.length === 0) {
        return null;
      }

      return {
        walletId: wallet.id,
        walletName: wallet.name,
        balance,
        budgetLimit,
        monthExpense,
        usageRate,
        level: balance < 0 || usageRate >= 1 ? 'danger' : 'warning',
        reasons,
      };
    })
    .filter((alert): alert is WalletBudgetAlert => alert !== null);
};
