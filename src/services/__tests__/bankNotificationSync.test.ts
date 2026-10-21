import { bankNotificationReader } from '../../native/bankNotificationReader';
import {
  buildBankNotificationItems,
  buildBankTransactionDraft,
  buildBankTransactionDrafts,
  syncBankNotifications,
} from '../bankNotificationSync';

jest.mock('../../native/bankNotificationReader', () => ({
  bankNotificationReader: {
    isSupported: true,
    setConfiguration: jest.fn(),
    getPendingEvents: jest.fn(),
    dismissEvent: jest.fn(),
    markProcessed: jest.fn(),
  },
}));

const getPendingEvents =
  bankNotificationReader.getPendingEvents as jest.MockedFunction<
    typeof bankNotificationReader.getPendingEvents
  >;

describe('syncBankNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    expect(bankNotificationReader.setConfiguration).toHaveBeenCalledWith(7, []);
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
      sourceApp: 'Ngân hàng',
      postedAt: new Date('2026-10-20T03:00:00.000Z').getTime(),
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
  });

  it('orders valid drafts from the oldest notification to the newest', () => {
    const events = [
      {
        id: 'newer',
        packageName: 'vn.bank.app',
        appName: 'Ngân hàng',
        title: 'Biến động số dư',
        text: 'Tiền vào +200.000 VND',
        postedAt: 200,
      },
      {
        id: 'older',
        packageName: 'vn.bank.app',
        appName: 'Ngân hàng',
        title: 'Biến động số dư',
        text: 'Tiền vào +100.000 VND',
        postedAt: 100,
      },
    ];

    expect(
      buildBankTransactionDrafts(events).map(draft => draft.eventId),
    ).toEqual(['older', 'newer']);
  });

  it('keeps ambiguous transaction notifications visible for manual review in oldest-first order', () => {
    const events = [
      {
        id: 'newer-review',
        packageName: 'vn.bank.app',
        appName: 'Ngân hàng',
        title: 'Biến động số dư',
        text: 'Giao dịch 100.000 VND, số dư 2.000.000 VND',
        postedAt: 200,
      },
      {
        id: 'older-ready',
        packageName: 'vn.bank.app',
        appName: 'Ngân hàng',
        title: 'Biến động số dư',
        text: 'Tiền vào +200.000 VND',
        postedAt: 100,
      },
    ];

    expect(buildBankNotificationItems(events)).toMatchObject([
      {
        event: { id: 'older-ready' },
        parsed: { status: 'READY', type: 'INCOME' },
        draft: { eventId: 'older-ready', amount: '200000' },
      },
      {
        event: { id: 'newer-review' },
        parsed: { status: 'REVIEW' },
        draft: null,
      },
    ]);
  });
});
