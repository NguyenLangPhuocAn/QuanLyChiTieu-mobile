import type { ApiCategoryCashFlowGroup } from './category';

export type ApiTransactionType = 'INCOME' | 'EXPENSE';

export type ReceiptItem = {
  name: string;
  amount: number;
};

export type ReceiptOcrResult = {
  merchant?: string | null;
  note?: string | null;
  amount?: number | null;
  currency?: string | null;
  transaction_date?: string | null;
  receipt_items: ReceiptItem[];
  suggested_category?: {
    id: number;
    name: string;
    icon?: string | null;
  } | null;
  warnings: string[];
  model?: string | null;
};

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
  receipt_items?: ReceiptItem[] | null;
  tags?: string[];
  transaction_date: string;
  created_at?: string | null;
  type: ApiTransactionType;
  category?: {
    id: number;
    name: string;
    type: ApiTransactionType;
    cash_flow_group?: ApiCategoryCashFlowGroup | null;
    icon?: string | null;
  } | null;
};
