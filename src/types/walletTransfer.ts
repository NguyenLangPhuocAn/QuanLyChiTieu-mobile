import type { WalletType } from '../constants/walletTypes';

export type WalletTransferKind = 'TRANSFER' | 'SAVINGS';

export type WalletTransferWallet = {
  id: number;
  name: string;
  wallet_type: WalletType;
};

export type WalletTransfer = {
  id: number;
  user_id: number;
  source_wallet_id: number;
  destination_wallet_id: number;
  amount: number;
  currency: string;
  transfer_date: string;
  note?: string | null;
  created_at?: string | null;
  kind: WalletTransferKind;
  source_wallet: WalletTransferWallet;
  destination_wallet: WalletTransferWallet;
  goal_entry?: {
    goal_id: number;
    type: 'CONTRIBUTION' | 'WITHDRAWAL' | 'ADJUSTMENT';
  } | null;
};
