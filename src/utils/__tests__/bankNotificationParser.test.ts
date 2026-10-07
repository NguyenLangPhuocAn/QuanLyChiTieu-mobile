import { parseBankNotification } from '../bankNotificationParser';
import type { BankNotificationEvent } from '../../types/bankNotification';

const makeEvent = (text: string): BankNotificationEvent => ({
  id: 'a'.repeat(64),
  packageName: 'vn.test.bank',
  appName: 'Ngân hàng thử nghiệm',
  title: 'Biến động số dư',
  text,
  postedAt: Date.UTC(2026, 9, 7, 8, 30),
});

describe('parseBankNotification', () => {
  it('reads an expense and does not use the remaining balance', () => {
    const result = parseBankNotification(
      makeEvent('TK ***1234 bị trừ -30.000 VND. Số dư: 1.250.000 VND.'),
    );

    expect(result).toMatchObject({
      status: 'READY',
      type: 'EXPENSE',
      amount: '30000',
      currency: 'VND',
    });
  });

  it('reads an incoming transfer', () => {
    const result = parseBankNotification(
      makeEvent('Tài khoản nhận tiền +10,000,000 VND từ NGUYEN VAN A'),
    );

    expect(result).toMatchObject({
      status: 'READY',
      type: 'INCOME',
      amount: '10000000',
      currency: 'VND',
    });
  });

  it('requires review when two transaction amounts are equally likely', () => {
    const result = parseBankNotification(
      makeEvent('Giao dịch ghi nợ 50.000 VND, phí 5.000 VND'),
    );

    expect(result.status).toBe('REVIEW');
    expect(result.reason).toContain('nhiều số tiền');
  });

  it('ignores an OTP notification', () => {
    const result = parseBankNotification(
      makeEvent('Mã OTP 123456 cho giao dịch 500.000 VND'),
    );

    expect(result.status).toBe('IGNORED');
  });

  it('requires review when direction is unknown', () => {
    const result = parseBankNotification(
      makeEvent('Biến động tài khoản: 250.000 VND'),
    );

    expect(result.status).toBe('REVIEW');
    expect(result.reason).toContain('thu hay chi');
  });
});
