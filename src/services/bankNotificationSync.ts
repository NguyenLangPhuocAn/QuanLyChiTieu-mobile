import { bankNotificationReader } from '../native/bankNotificationReader';
import type {
  BankNotificationEvent,
  BankTransactionDraft,
} from '../types/bankNotification';
import { parseBankNotification } from '../utils/bankNotificationParser';
import { bankNotificationSettings } from './bankNotificationSettings';

export type BankNotificationSyncResult = {
  created: number;
  pending: number;
  ignored: number;
};

let activeSync: Promise<BankNotificationSyncResult> | null = null;

export const buildBankTransactionDraft = (
  event: BankNotificationEvent,
): BankTransactionDraft => {
  const parsed = parseBankNotification(event);
  if (
    parsed.status !== 'READY' ||
    !parsed.type ||
    !parsed.amount ||
    !parsed.currency
  ) {
    throw new Error(
      parsed.reason ?? 'Thông báo chưa đủ dữ liệu để tạo giao dịch.',
    );
  }

  return {
    eventId: event.id,
    amount: parsed.amount,
    type: parsed.type,
    currency: parsed.currency,
    note: parsed.note,
    transactionDate: parsed.transactionDate,
  };
};

const runSync = async (userId: number): Promise<BankNotificationSyncResult> => {
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
  const enabledRules = new Map(
    rules.filter(rule => rule.enabled).map(rule => [rule.packageName, rule]),
  );
  const created = 0;
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
    // Thông báo chỉ được chuẩn bị để người dùng xem trước. Kể cả cấu hình AUTO
    // từ phiên bản cũ cũng không được ghi tiền khi chưa có xác nhận trực tiếp.
    pending += 1;
  }

  return { created, pending, ignored };
};

export const syncBankNotifications = (_token: string, userId: number) => {
  if (!activeSync) {
    activeSync = runSync(userId).finally(() => {
      activeSync = null;
    });
  }
  return activeSync;
};
