import { apiRequest, apiUploadRequest } from './api';
import type {
  ApiTransaction,
  ApiTransactionType,
  ReceiptItem,
  ReceiptOcrResult,
} from '../types/transaction';

export type TransactionQuery = {
  wallet_id?: number;
  category_id?: number;
  type?: ApiTransactionType;
  cash_flow?: 'normal' | 'loan_debt';
  tag?: string;
  q?: string;
  note?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export type PaginatedTransactions = {
  data: ApiTransaction[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    income?: number;
    expense?: number;
    net?: number;
  };
};

const buildTransactionQuery = (query?: TransactionQuery) => {
  const params = new URLSearchParams();

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params.set(key, String(value));
    }
  });

  return params.toString() ? `?${params.toString()}` : '';
};

export const transactionsService = {
  getAll(token: string, walletIdOrQuery?: number | TransactionQuery) {
    const query =
      typeof walletIdOrQuery === 'number'
        ? buildTransactionQuery({ wallet_id: walletIdOrQuery })
        : buildTransactionQuery(walletIdOrQuery);

    return apiRequest<ApiTransaction[]>(`/transactions${query}`, {
      method: 'GET',
      token,
    });
  },

  getPage(token: string, query: TransactionQuery) {
    return apiRequest<PaginatedTransactions>(
      `/transactions${buildTransactionQuery(query)}`,
      {
        method: 'GET',
        token,
      },
    );
  },

  create(
    token: string,
    payload: {
      wallet_id: number;
      category_id?: number;
      amount: string;
      type: ApiTransactionType;
      note?: string;
      receipt_image?: string;
      receipt_items?: ReceiptItem[] | null;
      transaction_date?: string;
      tags?: string[];
    },
  ) {
    return apiRequest<ApiTransaction>('/transactions', {
      method: 'POST',
      token,
      body: payload,
    });
  },

  update(
    token: string,
    id: number,
    payload: {
      wallet_id?: number;
      category_id?: number;
      amount?: string;
      type?: ApiTransactionType;
      note?: string;
      receipt_image?: string | null;
      receipt_items?: ReceiptItem[] | null;
      transaction_date?: string;
      tags?: string[];
    },
  ) {
    return apiRequest<ApiTransaction>(`/transactions/${id}`, {
      method: 'PUT',
      token,
      body: payload,
    });
  },

  remove(token: string, id: number) {
    return apiRequest<ApiTransaction>(`/transactions/${id}`, {
      method: 'DELETE',
      token,
    });
  },

  uploadReceipt(
    token: string,
    id: number,
    file: {
      uri: string;
      name: string;
      type: string;
    },
  ) {
    return apiUploadRequest<ApiTransaction>(
      `/transactions/${id}/receipt`,
      token,
      file,
    );
  },

  analyzeReceipt(
    token: string,
    file: {
      uri: string;
      name: string;
      type: string;
    },
  ) {
    return apiUploadRequest<ReceiptOcrResult>(
      '/transactions/receipt-ocr',
      token,
      file,
      'POST',
      45_000,
    );
  },
};
