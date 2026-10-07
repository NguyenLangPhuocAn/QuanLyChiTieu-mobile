export type BankNotificationEvent = {
  id: string;
  packageName: string;
  appName: string;
  title: string;
  text: string;
  postedAt: number;
  ownerUserId?: string;
};

export type LaunchableAndroidApp = {
  packageName: string;
  appName: string;
};

export type BankNotificationMode = 'REVIEW' | 'AUTO';

export type BankAppRule = {
  packageName: string;
  appName: string;
  enabled: boolean;
  mode: BankNotificationMode;
  walletId?: number;
  incomeCategoryId?: number;
  expenseCategoryId?: number;
};

export type ParsedBankNotification = {
  status: 'READY' | 'REVIEW' | 'IGNORED';
  type?: 'INCOME' | 'EXPENSE';
  amount?: string;
  currency?: string;
  transactionDate: string;
  note: string;
  reason?: string;
};
