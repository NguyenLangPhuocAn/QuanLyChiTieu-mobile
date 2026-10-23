import {
  parseScreenText,
  bankScreenExtraction,
} from '../src/services/bankScreenExtraction';
import { prepareBankNotificationText } from '../src/utils/bankScreenText';
import { apiRequest } from '../src/services/api';
jest.mock('../src/services/api', () => ({ apiRequest: jest.fn() }));
const at = new Date('2026-10-23T10:00:00+07:00').getTime();
const api = apiRequest as jest.Mock;
beforeEach(() => api.mockReset());

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
    expect(parseScreenText(text, at)).toMatchObject({
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
  const parsed = parseScreenText(text, at);
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
    bankScreenExtraction.analyze('token', 'Nhận +125.000 VND', at),
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
  const result = await bankScreenExtraction.analyze(
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

it('validates model direction against the screenshot text', async () => {
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
    (await bankScreenExtraction.analyze('token', 'Nhận +125.000 VND', at))
      .status,
  ).toBe('REVIEW');
});
