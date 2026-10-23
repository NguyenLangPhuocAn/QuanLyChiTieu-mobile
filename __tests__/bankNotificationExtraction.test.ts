import {
  parseNotificationText,
  bankNotificationExtraction,
} from '../src/services/bankNotificationExtraction';
import { prepareBankNotificationText } from '../src/utils/bankNotificationText';
import { apiRequest } from '../src/services/api';
jest.mock('../src/services/api', () => ({ apiRequest: jest.fn() }));
const at = new Date('2026-10-23T10:00:00+07:00').getTime();
const api = apiRequest as jest.Mock;
beforeEach(() => {
  api.mockReset();
  bankNotificationExtraction.clearAvailabilityCache();
});

it.each([
  [
    'ACB: TK 87654321(VND) +752,790 lúc 07:22. Số dư 14,533,072. GD: REF123456',
    '752790',
    'INCOME',
  ],
  [
    'Thông báo thay đổi số dư\nNhận +752,790 VND\nSố dư\n14,533,072 VND',
    '752790',
    'INCOME',
  ],
  [
    'Thanh toán -79.000 VND tại THANG 2 CAFE\nSDTK: 15.000.000 VND',
    '79000',
    'EXPENSE',
  ],
  ['Ghi nợ 120.000 VND; khả dụng 99.000.000 VND', '120000', 'EXPENSE'],
  ['Nhận +12.50 USD; available balance 150.99 USD', '12.5', 'INCOME'],
])(
  'extracts transaction money and excludes balances: %s',
  (text, amount, type) => {
    expect(parseNotificationText(text, at)).toMatchObject({
      status: 'READY',
      amount,
      type,
    });
  },
);

it.each([
  'Số dư +15.000.000 VND',
  'Nhận tiền\nSố dư\n+15.000.000 VND',
  'Nhận +125.000 VND và thanh toán -79.000 VND',
  'Nhận +125.000 VND và +79.000 VND',
  'Giao dịch 50.000 VND',
  'OTP 123456 Nhận +125.000 VND',
  'Nhận +125,00 VND',
  '',
])('requires manual review rather than guessing: %s', text => {
  const parsed = parseNotificationText(text, at);
  expect(parsed.status).toBe('REVIEW');
  expect(parsed.amount).toBeUndefined();
});

it('masks accounts and references before any optional network call', () => {
  const result = prepareBankNotificationText(
    'TK 87654321 nhận +752,790 VND. Số dư 14,533,072. GD: ABC123456789',
  );
  expect(result.text).not.toMatch(/87654321|14,533,072|ABC123456789/);
  expect(result.money[0].amount).toBe(752790);
  expect(api).not.toHaveBeenCalled();
});

it('does not send text when the server flag is off', async () => {
  api.mockResolvedValueOnce({ bank_notification_ai: false });
  await expect(
    bankNotificationExtraction.analyze('token', 'Nhận +125.000 VND', at),
  ).rejects.toThrow('chưa bật');
  expect(api).toHaveBeenCalledTimes(1);
  expect(api.mock.calls[0][0]).toBe('/features');
});

it('sends sanitized text only and refuses a hallucinated amount', async () => {
  api
    .mockResolvedValueOnce({ bank_notification_ai: true })
    .mockResolvedValueOnce({
      status: 'READY',
      type: 'INCOME',
      amount: 15000000,
      currency: 'VND',
      note: 'Nhận tiền',
    });
  const result = await bankNotificationExtraction.analyze(
    'token',
    'TK 87654321 nhận +125.000 VND. Số dư 15.000.000 VND',
    at,
  );
  expect(result.status).toBe('REVIEW');
  expect(result.amount).toBeUndefined();
  const options = api.mock.calls[1][1];
  expect(options.body.consent).toBe(true);
  expect(options.body.text).not.toMatch(/87654321|15.000.000/);
  expect(options.body).not.toHaveProperty('image');
});

it('validates model direction against the notification text', async () => {
  api
    .mockResolvedValueOnce({ bank_notification_ai: true })
    .mockResolvedValueOnce({
      status: 'READY',
      type: 'EXPENSE',
      amount: 125000,
      currency: 'VND',
      note: 'Chi tiền',
    });
  expect(
    (await bankNotificationExtraction.analyze('token', 'Nhận +125.000 VND', at))
      .status,
  ).toBe('REVIEW');
});

it('validates an AI-selected principal among multiple monetary values without a unique-amount gate', async () => {
  api
    .mockResolvedValueOnce({ bank_notification_ai: true })
    .mockResolvedValueOnce({
      status: 'READY',
      type: 'EXPENSE',
      amount: 100000,
      currency: 'VND',
      note: 'CF',
      confidence: 0.99,
      requires_confirmation: true,
    });
  expect(
    await bankNotificationExtraction.analyze(
      'token',
      'Ghi nợ -100.000 VND. Phí -5.000 VND',
      at,
    ),
  ).toMatchObject({ status: 'READY', amount: '100000', note: 'CF' });
});
it('accepts an unfamiliar direction label when the validated API assigns its meaning', async () => {
  api
    .mockResolvedValueOnce({ bank_notification_ai: true })
    .mockResolvedValueOnce({
      status: 'READY',
      type: 'INCOME',
      amount: 125000,
      currency: 'VND',
      note: 'Nhận tiền',
      confidence: 0.99,
      requires_confirmation: true,
    });
  expect(
    await bankNotificationExtraction.analyze('token', 'CR 125.000 VND', at),
  ).toMatchObject({ status: 'READY', type: 'INCOME', amount: '125000' });
});
it('does not reuse capability flags across sessions', async () => {
  api
    .mockResolvedValueOnce({ bank_notification_ai: true })
    .mockResolvedValueOnce({ bank_notification_ai: false });
  expect(await bankNotificationExtraction.isAvailable('token-a')).toBe(true);
  expect(await bankNotificationExtraction.isAvailable('token-a')).toBe(true);
  expect(await bankNotificationExtraction.isAvailable('token-b')).toBe(false);
  expect(api).toHaveBeenCalledTimes(2);
});
it('keeps uncertain AI answers empty instead of falling back to local field guesses', async () => {
  api
    .mockResolvedValueOnce({ bank_notification_ai: true })
    .mockResolvedValueOnce({
      status: 'REVIEW',
      type: null,
      amount: null,
      reason: 'Chưa rõ',
    });
  const result = await bankNotificationExtraction.analyze(
    'token',
    'Nhận +125.000 VND',
    at,
  );
  expect(result.status).toBe('REVIEW');
  expect(result.amount).toBeUndefined();
  expect(result.type).toBeUndefined();
});

it('treats a legacy server without the feature endpoint as AI unavailable', async () => {
  api.mockRejectedValueOnce({ status: 404 });
  expect(await bankNotificationExtraction.isAvailable('token')).toBe(false);
  expect(api).toHaveBeenCalledTimes(1);
});
