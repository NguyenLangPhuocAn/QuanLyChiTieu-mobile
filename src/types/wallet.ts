import type { WalletType } from '../constants/walletTypes';

export type Wallet = {
  id: number;
  user_id: number | null;
  name: string;
  wallet_type?: WalletType;
  currency: string;
  balance: string | number;
  // Các bản API cũ có thể còn trả về field này; UI mới dùng Budget riêng.
  budget_limit?: string | number | null;
  display_currency?: string;
  display_balance?: number;
  created_at: string;
};
