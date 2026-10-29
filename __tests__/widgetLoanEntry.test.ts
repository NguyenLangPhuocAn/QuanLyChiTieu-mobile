import {
  widgetLoanPayload,
  saveWidgetLoanEntry,
} from '../src/services/widgetLoanEntry';
import { loanDebtsService } from '../src/services/loanDebts';
import { ApiError } from '../src/services/api';
import { refreshWidgetEntryCache } from '../src/services/widgetQuickEntry';
import type { DashboardCache } from '../src/services/dashboardCache';
jest.mock('../src/services/loanDebts', () => ({
  loanDebtsService: { createQuickEntry: jest.fn() },
}));
jest.mock('../src/services/widgetQuickEntry', () => ({
  refreshWidgetEntryCache: jest.fn().mockResolvedValue(undefined),
}));
const data = {
  wallets: [
    { id: 8, currency: 'VND' },
    { id: 9, currency: 'VND', wallet_type: 'SAVINGS' },
  ],
} as DashboardCache;
const form = {
  type: 'BORROWED' as const,
  personName: ' QA ',
  amount: '100000',
  walletId: 8,
  date: '2026-10-30',
  dueDate: '',
  note: '',
  currency: null,
};
const payload = () => widgetLoanPayload(data, form, 'widget_loan_request_1234');
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(loanDebtsService.createQuickEntry)
    .mockResolvedValue({ id: 1 } as never);
});
it('builds a real loan payload without a normal category, receipt or wallet guessing', () => {
  expect(payload()).toMatchObject({
    type: 'BORROWED',
    person_name: 'QA',
    wallet_id: 8,
    principal_amount: '100000',
    due_date: null,
    client_request_id: 'widget_loan_request_1234',
  });
  expect(payload()).not.toHaveProperty('category_id');
  expect(payload()).not.toHaveProperty('receipt_image');
  for (const invalid of [
    { personName: ' ' },
    { walletId: null },
    { walletId: 9 },
    { amount: '0' },
    { date: '2026-02-30' },
    { dueDate: '2026-02-30' },
    { currency: 'USD' },
  ])
    expect(() =>
      widgetLoanPayload(
        data,
        { ...form, ...invalid },
        'widget_loan_request_1234',
      ),
    ).toThrow();
});
it('never sends an offline or stale-session loan, and does not treat it as a normal queued transaction', async () => {
  await expect(
    saveWidgetLoanEntry('token', 8, payload(), true, () => true),
  ).rejects.toThrow('kết nối mạng');
  await expect(
    saveWidgetLoanEntry('token', 8, payload(), false, () => false),
  ).rejects.toThrow('Phiên');
  expect(loanDebtsService.createQuickEntry).not.toHaveBeenCalled();
});
it('uses the protected endpoint, reports old-server incompatibility, and refreshes only after success', async () => {
  jest
    .mocked(loanDebtsService.createQuickEntry)
    .mockRejectedValueOnce(new ApiError('not found', 404));
  await expect(
    saveWidgetLoanEntry('token', 8, payload(), false, () => true),
  ).rejects.toThrow('Máy chủ chưa hỗ trợ');
  expect(refreshWidgetEntryCache).not.toHaveBeenCalled();
  jest
    .mocked(loanDebtsService.createQuickEntry)
    .mockRejectedValueOnce(new ApiError('Không tìm thấy ví', 404));
  await expect(
    saveWidgetLoanEntry('token', 8, payload(), false, () => true),
  ).rejects.toThrow('Không tìm thấy ví');
  await expect(
    saveWidgetLoanEntry('token', 8, payload(), false, () => true),
  ).resolves.toBe('SAVED');
  expect(loanDebtsService.createQuickEntry).toHaveBeenLastCalledWith(
    'token',
    payload(),
  );
  expect(refreshWidgetEntryCache).toHaveBeenCalledTimes(1);
});
