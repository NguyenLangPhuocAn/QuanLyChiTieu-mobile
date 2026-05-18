import type { WalletType } from '../constants/walletTypes';

export type Wallet = {
  id: number;
  user_id: number | null;
  name: string;
  wallet_type?: WalletType;
  currency: string;
  balance: string | number;
  budget_limit?: string | number | null;
  display_currency?: string;
  display_balance?: number;
  display_budget_limit?: number | null;
  created_at: string;
};
