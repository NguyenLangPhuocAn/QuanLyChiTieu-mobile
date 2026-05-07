import { apiRequest, apiUploadRequest } from './api';
import type { ApiTransaction, ApiTransactionType } from '../types/transaction';

export const transactionsService = {
  getAll(token: string, walletId?: number) {
    const query = walletId ? `?wallet_id=${walletId}` : '';

    return apiRequest<ApiTransaction[]>(`/transactions${query}`, {
      method: 'GET',
      token,
    });
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
      transaction_date?: string;
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
      receipt_image?: string;
      transaction_date?: string;
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
    return apiUploadRequest<ApiTransaction>(`/transactions/${id}/receipt`, token, file);
  },
};
