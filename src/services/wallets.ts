import { apiRequest } from './api';
import type { Wallet } from '../types/wallet';
import type { WalletType } from '../constants/walletTypes';

export const walletsService = {
  getAll(token: string) {
    return apiRequest<Wallet[]>('/wallets', {
      method: 'GET',
      token,
    });
  },

  create(
    token: string,
    payload: {
      name: string;
      balance?: string;
      budget_limit?: string;
      currency?: string;
      wallet_type?: WalletType;
    },
  ) {
    return apiRequest<Wallet>('/wallets', {
      method: 'POST',
      token,
      body: payload,
    });
  },

  update(
    token: string,
    id: number,
    payload: {
      name?: string;
      balance?: string;
      budget_limit?: string;
      currency?: string;
      wallet_type?: WalletType;
    },
  ) {
    return apiRequest<Wallet>(`/wallets/${id}`, {
      method: 'PUT',
      token,
      body: payload,
    });
  },
};
