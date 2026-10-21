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

export type BankTransactionDraft = {
  eventId: string;
  sourceApp: string;
  postedAt: number;
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  currency: string;
  note: string;
  transactionDate: string;
};

export type BankNotificationItem = {
  event: BankNotificationEvent;
  parsed: ParsedBankNotification;
  draft: BankTransactionDraft | null;
};
