export type TransactionType = 'income' | 'expense';
export type TransactionCashFlowType =
  | 'normal'
  | 'loan_debt'
  | 'saving_transfer';

export type TransactionItem = {
  id: string;
  walletId?: number;
  categoryId?: number | null;
  categoryIcon?: string | null;
  note: string;
  receiptImage?: string | null;
  receiptItems?: Array<{ name: string; amount: number }> | null;
  tags?: string[];
  category: string;
  wallet: string;
  currency: string;
  displayAmount: number;
  displayCurrency: string;
  type: TransactionType;
  cashFlowType?: TransactionCashFlowType;
  amount: number;
  date: string;
};

// App hiện tại lấy giao dịch từ API, mảng này chỉ giữ lại để tránh và tình render dữ liệu mẫu.
export const mockTransactions: TransactionItem[] = [];
