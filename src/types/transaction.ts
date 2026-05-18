export type ApiTransactionType = 'INCOME' | 'EXPENSE';

export type ApiTransaction = {
  id: number;
  wallet_id: number;
  category_id?: number | null;
  amount: string | number;
  currency: string;
  display_amount?: number;
  display_currency?: string;
  note?: string | null;
  receipt_image?: string | null;
  tags?: string[];
  transaction_date: string;
  created_at?: string | null;
  type: ApiTransactionType;
  category?: {
    id: number;
    name: string;
    type: ApiTransactionType;
    icon?: string | null;
  } | null;
};
