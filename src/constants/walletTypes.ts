import { Banknote, Building2, Smartphone } from 'lucide-react-native';

export type WalletType = 'CASH' | 'BANK' | 'E_WALLET';

export const WALLET_TYPES: Array<{
  value: WalletType;
  label: string;
  description: string;
  Icon: typeof Banknote;
  background: number;
}> = [
  {
    value: 'CASH',
    label: 'Tiền mặt',
    description: 'Tiền cầm tay',
    Icon: Banknote,
    background: require('../assets/images/wallet-backgrounds/wallet_cash_bg.png'),
  },
  {
    value: 'BANK',
    label: 'Ngân hàng',
    description: 'Tài khoản ngân hàng',
    Icon: Building2,
    background: require('../assets/images/wallet-backgrounds/wallet_bank_bg.png'),
  },
  {
    value: 'E_WALLET',
    label: 'Ví điện tử',
    description: 'Momo, ZaloPay...',
    Icon: Smartphone,
    background: require('../assets/images/wallet-backgrounds/wallet_ewallet_bg.png'),
  },
];

export const getWalletTypeMeta = (type?: string | null) =>
  WALLET_TYPES.find(item => item.value === type) ?? WALLET_TYPES[0];
