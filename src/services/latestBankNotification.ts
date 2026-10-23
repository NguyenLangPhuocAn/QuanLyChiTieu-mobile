import type {
  BankNotificationEvent,
  BankNotificationItem,
} from '../types/bankNotification';
import { parseNotificationText } from './bankNotificationExtraction';

/** The native snapshot already excludes handled/dismissed notifications. Never reorder oldest first here. */
export function latestBankNotification(
  events: BankNotificationEvent[],
  userId: number,
): BankNotificationItem | null {
  const ordered = events
    .filter(
      event =>
        /^[a-f0-9]{64}$/i.test(event.id) &&
        Number.isFinite(event.postedAt) &&
        event.postedAt > 0 &&
        (!event.ownerUserId || event.ownerUserId === String(userId)),
    )
    .sort((a, b) => b.postedAt - a.postedAt || a.id.localeCompare(b.id));
  for (const event of ordered) {
    const text = `${event.title}\n${event.text}`.trim();
    if (
      /\b(otp|password|verification code|pin code)\b|mã xác thực|ma xac thuc|mật khẩu|mat khau|khuyến mãi|khuyen mai|ưu đãi|uu dai/iu.test(
        text,
      )
    )
      continue;
    const parsed = parseNotificationText(text, event.postedAt);
    // A REVIEW item remains first; do not silently substitute an older easy-to-parse one.
    return {
      event,
      parsed,
      draft:
        parsed.status === 'READY' &&
        parsed.type &&
        parsed.amount &&
        parsed.currency
          ? {
              eventId: event.id,
              sourceApp: event.appName,
              postedAt: event.postedAt,
              type: parsed.type,
              amount: parsed.amount,
              currency: parsed.currency,
              note: parsed.note,
              transactionDate: parsed.transactionDate,
            }
          : null,
    };
  }
  return null;
}
