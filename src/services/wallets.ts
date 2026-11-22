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
      currency?: string;
      wallet_type?: WalletType;
      client_request_id?: string;
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
      currency?: string;
      wallet_type?: WalletType;
      offline_expected?: {
        name: string;
        wallet_type: WalletType;
        currency: string;
        balance: string;
      };
    },
  ) {
    return apiRequest<Wallet>(`/wallets/${id}`, {
      method: 'PUT',
      token,
      body: payload,
    });
  },

  remove(
    token: string,
    id: number,
    offline_expected?: {
      name: string;
      wallet_type: WalletType;
      currency: string;
      balance: string;
    },
  ) {
    return apiRequest<Wallet>(`/wallets/${id}`, {
      method: 'DELETE',
      token,
      ...(offline_expected ? { body: { offline_expected } } : {}),
    });
  },
};
