import { apiRequest } from './api';
import type { WalletTransfer } from '../types/walletTransfer';

export const walletTransfersService = {
  getAll(token: string) {
    return apiRequest<WalletTransfer[]>('/wallet-transfers', {
      method: 'GET',
      token,
    });
  },

  create(
    token: string,
    payload: {
      source_wallet_id: number;
      destination_wallet_id: number;
      amount: string;
      note?: string;
    },
  ) {
    return apiRequest<WalletTransfer>('/wallet-transfers', {
      method: 'POST',
      token,
      body: payload,
    });
  },
};
