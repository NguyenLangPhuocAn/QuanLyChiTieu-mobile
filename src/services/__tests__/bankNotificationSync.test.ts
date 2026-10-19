import { bankNotificationReader } from '../../native/bankNotificationReader';
import { bankNotificationSettings } from '../bankNotificationSettings';
import {
  buildBankTransactionDraft,
  syncBankNotifications,
} from '../bankNotificationSync';
import { transactionsService } from '../transactions';

jest.mock('../../native/bankNotificationReader', () => ({
  bankNotificationReader: {
    isSupported: true,
    setConfiguration: jest.fn(),
    getPendingEvents: jest.fn(),
    dismissEvent: jest.fn(),
    markProcessed: jest.fn(),
  },
}));

jest.mock('../bankNotificationSettings', () => ({
  bankNotificationSettings: {
    getRules: jest.fn(),
  },
}));

jest.mock('../transactions', () => ({
  transactionsService: {
    create: jest.fn(),
  },
}));

const getRules = bankNotificationSettings.getRules as jest.MockedFunction<
  typeof bankNotificationSettings.getRules
>;
const getPendingEvents =
  bankNotificationReader.getPendingEvents as jest.MockedFunction<
    typeof bankNotificationReader.getPendingEvents
  >;
const create = transactionsService.create as jest.MockedFunction<
  typeof transactionsService.create
>;

describe('syncBankNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRules.mockResolvedValue([
      {
        packageName: 'vn.bank.app',
        appName: 'Ngân hàng',
        enabled: true,
        mode: 'AUTO',
        walletId: 1,
        incomeCategoryId: 2,
        expenseCategoryId: 3,
      },
    ]);
  });

  it('keeps a legacy AUTO event pending until the user confirms', async () => {
    getPendingEvents.mockResolvedValue([
      {
        id: 'bank-event-1',
        packageName: 'vn.bank.app',
        appName: 'Ngân hàng',
        title: 'Biến động số dư',
        text: 'Thanh toán -79.000 VND tại THANG 2 CAFE',
        postedAt: new Date('2026-10-18T03:00:00.000Z').getTime(),
      },
    ]);

    await expect(syncBankNotifications('token', 7)).resolves.toEqual({
      created: 0,
      pending: 1,
      ignored: 0,
    });
    expect(create).not.toHaveBeenCalled();
    expect(bankNotificationReader.markProcessed).not.toHaveBeenCalled();
  });

  it('builds a normal transaction draft without choosing a wallet', () => {
    const draft = buildBankTransactionDraft({
      id: 'bank-event-draft',
      packageName: 'vn.bank.app',
      appName: 'Ngân hàng',
      title: 'Biến động số dư',
      text: 'Tài khoản ghi nợ -125.000 VND tại GRAB. Số dư 3.450.000 VND',
      postedAt: new Date('2026-10-20T03:00:00.000Z').getTime(),
    });

    expect(draft).toMatchObject({
      eventId: 'bank-event-draft',
      type: 'EXPENSE',
      amount: '125000',
      currency: 'VND',
    });
    expect(draft).not.toHaveProperty('walletId');
    expect(draft).not.toHaveProperty('categoryId');
  });

  it('dismisses OTP notifications without creating a transaction', async () => {
    getPendingEvents.mockResolvedValue([
      {
        id: 'otp-event-1',
        packageName: 'vn.bank.app',
        appName: 'Ngân hàng',
        title: 'Mã OTP',
        text: 'Mã OTP của bạn là 123456',
        postedAt: new Date('2026-10-18T03:00:00.000Z').getTime(),
      },
    ]);

    await expect(syncBankNotifications('token', 7)).resolves.toEqual({
      created: 0,
      pending: 0,
      ignored: 1,
    });
    expect(bankNotificationReader.dismissEvent).toHaveBeenCalledWith(
      7,
      'otp-event-1',
    );
    expect(create).not.toHaveBeenCalled();
  });
});
