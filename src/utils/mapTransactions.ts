import type { TransactionItem } from '../data/mockTransactions';
import type { ApiTransaction } from '../types/transaction';
import type { Wallet } from '../types/wallet';
import { getCashFlowType } from './transactionClassification';

const cleanTransactionNote = (value?: string | null) => {
  const note = value?.trim();

  if (!note) {
    return 'Không có ghi chú';
  }

  return (
    note
      .replace(/\s*[-–—]\s*tài khoản\s+(BASIC|PREMIUM|ADMIN)\s*(thật)?\s*$/i, '')
      .replace(/\s*tài khoản\s+(BASIC|PREMIUM|ADMIN)\s*(thật)?\s*$/i, '')
      .trim() || 'Không có ghi chú'
  );
};

export const mapApiTransactions = (
  apiTransactions: ApiTransaction[],
  currentWallets: Wallet[],
): TransactionItem[] => {
  const walletMap = new Map(currentWallets.map(wallet => [wallet.id, wallet]));

  return apiTransactions.map((transaction): TransactionItem => {
    const wallet = walletMap.get(transaction.wallet_id);

    return {
      id: String(transaction.id),
      walletId: transaction.wallet_id,
      categoryId: transaction.category_id,
      categoryIcon: transaction.category?.icon ?? null,
      receiptImage: transaction.receipt_image ?? null,
      tags: transaction.tags ?? [],
      note: cleanTransactionNote(transaction.note),
      category:
        transaction.category?.name || (transaction.type === 'INCOME' ? 'Thu nhập' : 'Chi tiêu'),
      wallet: wallet?.name || 'Ví',
      currency: transaction.currency || wallet?.currency || 'VND',
      displayAmount: Number(transaction.display_amount ?? transaction.amount),
      displayCurrency: transaction.display_currency || wallet?.display_currency || 'VND',
      type: transaction.type === 'INCOME' ? 'income' : 'expense',
      cashFlowType: getCashFlowType(transaction.category),
      amount: Number(transaction.amount),
      date: transaction.transaction_date,
    };
  }).sort((left, right) => {
    const dateDiff = new Date(right.date).getTime() - new Date(left.date).getTime();

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return Number(right.id) - Number(left.id);
  });
};
