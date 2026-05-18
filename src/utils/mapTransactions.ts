import type { TransactionItem } from '../data/mockTransactions';
import type { ApiTransaction } from '../types/transaction';
import type { Wallet } from '../types/wallet';

export const mapApiTransactions = (
  apiTransactions: ApiTransaction[],
  currentWallets: Wallet[],
): TransactionItem[] => {
  const walletMap = new Map(currentWallets.map(wallet => [wallet.id, wallet]));

  return apiTransactions.map(transaction => {
    const wallet = walletMap.get(transaction.wallet_id);

    return {
      id: String(transaction.id),
      walletId: transaction.wallet_id,
      categoryId: transaction.category_id,
      categoryIcon: transaction.category?.icon ?? null,
      receiptImage: transaction.receipt_image ?? null,
      tags: transaction.tags ?? [],
      note: transaction.note || 'Không có ghi chú',
      category:
        transaction.category?.name || (transaction.type === 'INCOME' ? 'Thu nhập' : 'Chi tiêu'),
      wallet: wallet?.name || 'Ví',
      currency: transaction.currency || wallet?.currency || 'VND',
      displayAmount: Number(transaction.display_amount ?? transaction.amount),
      displayCurrency: transaction.display_currency || wallet?.display_currency || 'VND',
      type: transaction.type === 'INCOME' ? 'income' : 'expense',
      amount: Number(transaction.amount),
      date: transaction.transaction_date,
    };
  });
};
