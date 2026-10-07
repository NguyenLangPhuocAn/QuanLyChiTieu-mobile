import { bankNotificationReader } from '../native/bankNotificationReader';
import type { BankAppRule, BankNotificationEvent } from '../types/bankNotification';
import type { Category } from '../types/category';
import type { Wallet } from '../types/wallet';
import { parseBankNotification } from '../utils/bankNotificationParser';
import { bankNotificationSettings } from './bankNotificationSettings';
import { categoriesService } from './categories';
import { transactionsService } from './transactions';
import { walletsService } from './wallets';

export type BankNotificationSyncResult = {
  created: number;
  pending: number;
  ignored: number;
};

let activeSync: Promise<BankNotificationSyncResult> | null = null;

const resolveMapping = (
  event: BankNotificationEvent,
  rule: BankAppRule,
  wallets: Wallet[],
  categories: Category[],
) => {
  const parsed = parseBankNotification(event);
  const wallet = wallets.find(item => item.id === rule.walletId);
  const categoryId =
    parsed.type === 'INCOME'
      ? rule.incomeCategoryId
      : rule.expenseCategoryId;
  const category = categories.find(item => item.id === categoryId);
  const isValid =
    parsed.status === 'READY' &&
    wallet &&
    category &&
    category.type === parsed.type &&
    (category.cash_flow_group ?? 'NORMAL') === 'NORMAL' &&
    wallet.currency.toUpperCase() === parsed.currency;

  return { parsed, wallet, category, isValid: Boolean(isValid) };
};

export const createTransactionFromBankEvent = async (options: {
  token: string;
  userId: number;
  event: BankNotificationEvent;
  rule: BankAppRule;
  wallets: Wallet[];
  categories: Category[];
}) => {
  const { parsed, wallet, category, isValid } = resolveMapping(
    options.event,
    options.rule,
    options.wallets,
    options.categories,
  );
  if (!isValid || !wallet || !category || !parsed.type || !parsed.amount) {
    throw new Error(
      parsed.reason ?? 'Hãy chọn đúng ví và danh mục trước khi lưu.',
    );
  }

  const transaction = await transactionsService.create(options.token, {
    wallet_id: wallet.id,
    category_id: category.id,
    amount: parsed.amount,
    type: parsed.type,
    note: parsed.note,
    transaction_date: parsed.transactionDate,
    source: 'BANK_NOTIFICATION',
    source_ref: options.event.id,
  });
  await bankNotificationReader.markProcessed(options.userId, options.event.id);
  return transaction;
};

const runSync = async (
  token: string,
  userId: number,
): Promise<BankNotificationSyncResult> => {
  if (!bankNotificationReader.isSupported) {
    return { created: 0, pending: 0, ignored: 0 };
  }

  const rules = await bankNotificationSettings.getRules(userId);
  await bankNotificationReader.setConfiguration(
    userId,
    rules.filter(rule => rule.enabled).map(rule => rule.packageName),
  );
  const events = await bankNotificationReader.getPendingEvents(userId);
  if (!events.length) return { created: 0, pending: 0, ignored: 0 };
  const [wallets, categories] = await Promise.all([
    walletsService.getAll(token),
    categoriesService.getAll(token),
  ]);
  const enabledRules = new Map(
    rules.filter(rule => rule.enabled).map(rule => [rule.packageName, rule]),
  );
  let created = 0;
  let ignored = 0;
  let pending = 0;

  for (const event of events) {
    const rule = enabledRules.get(event.packageName);
    if (!rule) {
      pending += 1;
      continue;
    }
    const parsed = parseBankNotification(event);
    if (parsed.status === 'IGNORED') {
      await bankNotificationReader.dismissEvent(userId, event.id);
      ignored += 1;
      continue;
    }
    if (rule.mode !== 'AUTO') {
      pending += 1;
      continue;
    }

    try {
      await createTransactionFromBankEvent({
        token,
        userId,
        event,
        rule,
        wallets,
        categories,
      });
      created += 1;
    } catch {
      pending += 1;
    }
  }

  return { created, pending, ignored };
};

export const syncBankNotifications = (token: string, userId: number) => {
  if (!activeSync) {
    activeSync = runSync(token, userId).finally(() => {
      activeSync = null;
    });
  }
  return activeSync;
};
