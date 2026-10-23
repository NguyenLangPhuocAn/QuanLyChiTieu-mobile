import { latestBankNotification } from '../src/services/latestBankNotification';
import type { BankNotificationEvent } from '../src/types/bankNotification';
const event = (
  id: string,
  postedAt: number,
  text = 'Nhận +125.000 VND',
): BankNotificationEvent => ({
  id: id.repeat(64),
  postedAt,
  text,
  title: 'Giao dịch',
  packageName: 'bank.test',
  appName: 'Bank',
  ownerUserId: '7',
});

it('selects newest first regardless of the native array order', () => {
  expect(
    latestBankNotification(
      [event('b', 200), event('a', 100), event('c', 300)],
      7,
    )?.event.id,
  ).toBe('c'.repeat(64));
});
it('takes the next newest only when the handled item is absent from the native snapshot', () => {
  const events = [event('a', 100), event('b', 200), event('c', 300)];
  expect(latestBankNotification(events, 7)?.event.id).toBe('c'.repeat(64));
  expect(
    latestBankNotification(
      events.filter(e => e.id !== 'c'.repeat(64)),
      7,
    )?.event.id,
  ).toBe('b'.repeat(64));
});
it('keeps the newest ambiguous transaction for manual review instead of substituting an older one', () => {
  const item = latestBankNotification(
    [event('a', 100), event('b', 200, 'Giao dịch 50.000 VND và 10.000 VND')],
    7,
  );
  expect(item?.event.id).toBe('b'.repeat(64));
  expect(item?.parsed.status).toBe('REVIEW');
  expect(item?.draft).toBeNull();
});
it('ignores OTP, promotions, malformed events and another account', () => {
  expect(
    latestBankNotification(
      [
        event('a', 100),
        event('b', 200, 'OTP 123456 cho giao dịch 50.000 VND'),
        event('c', 300, 'Ưu đãi +125.000 VND'),
        { ...event('d', 400), ownerUserId: '8' },
        { ...event('e', 500), id: 'invalid' },
        event('f', NaN),
      ],
      7,
    )?.event.id,
  ).toBe('a'.repeat(64));
});
it('never fills a bank balance as a transaction amount', () => {
  const item = latestBankNotification(
    [event('a', 100, 'Nhận tiền. Số dư +5.000.000 VND')],
    7,
  );
  expect(item?.parsed.status).toBe('REVIEW');
  expect(item?.parsed.amount).toBeUndefined();
});
it('returns no item when no active unhandled notification is available', () => {
  expect(latestBankNotification([], 7)).toBeNull();
});
