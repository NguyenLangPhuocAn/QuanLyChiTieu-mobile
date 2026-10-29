import {
  widgetEntryPayload,
  saveWidgetEntry,
  refreshWidgetEntryCache,
} from '../src/services/widgetQuickEntry';
import { ApiError } from '../src/services/api';
import { transactionsService } from '../src/services/transactions';
import {
  dashboardCache,
  type DashboardCache,
} from '../src/services/dashboardCache';
import { walletsService } from '../src/services/wallets';
import { categoriesService } from '../src/services/categories';
jest.mock('../src/services/categories', () => ({
  categoriesService: { getAll: jest.fn() },
}));
import { offlineTransactionQueue } from '../src/services/offlineTransactionQueue';
jest.mock('../src/services/transactions', () => ({
  transactionsService: { create: jest.fn(), getPage: jest.fn() },
}));
jest.mock('../src/services/wallets', () => ({
  walletsService: { getAll: jest.fn() },
}));
jest.mock('../src/services/dashboardCache', () => ({
  dashboardCache: { read: jest.fn(), save: jest.fn() },
}));
jest.mock('../src/services/offlineTransactionQueue', () => ({
  ...jest.requireActual('../src/services/offlineTransactionQueue'),
  offlineTransactionQueue: { enqueue: jest.fn() },
}));
const cache = {
  wallets: [{ id: 1, name: 'Ví', currency: 'VND' }],
  categories: [
    { id: 2, name: 'Đi lại', type: 'EXPENSE', cash_flow_group: 'NORMAL' },
    { id: 3, name: 'Lương', type: 'INCOME', cash_flow_group: 'NORMAL' },
  ],
  transactions: [],
} as unknown as DashboardCache;
const form = {
  type: 'EXPENSE' as const,
  walletId: 1,
  categoryId: 2,
  amount: '25000',
  note: 'Grab',
  date: '2026-10-29',
  items: [],
};
const payload = () => widgetEntryPayload(cache, form, 'fixed-request');
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(dashboardCache.read).mockResolvedValue(cache);
  jest.mocked(walletsService.getAll).mockResolvedValue(cache.wallets);
  jest.mocked(categoriesService.getAll).mockResolvedValue(cache.categories);
});
it('requires explicit wallet, correct category, real date and matching OCR currency', () => {
  for (const invalid of [
    { walletId: null },
    { categoryId: 3 },
    { amount: '0' },
    { date: '2026-02-30' },
    { currency: 'USD' },
  ])
    expect(() =>
      widgetEntryPayload(cache, { ...form, ...invalid }, 'id'),
    ).toThrow();
  expect(payload()).toMatchObject({
    wallet_id: 1,
    category_id: 2,
    amount: '25000',
    client_request_id: 'fixed-request',
  });
  expect(payload()).not.toHaveProperty('receipt_image');
});
it('refreshes confirmed data once without replaying a committed payment after cache failure', async () => {
  jest.mocked(transactionsService.create).mockResolvedValue({
    id: 20,
    ...payload(),
    currency: 'VND',
    transaction_date: form.date,
  });
  jest.mocked(dashboardCache.save).mockRejectedValueOnce(Error('disk'));
  await expect(
    saveWidgetEntry('token', 7, payload(), false, () => true),
  ).resolves.toBe('SAVED');
  expect(transactionsService.create).toHaveBeenCalledTimes(1);
  expect(offlineTransactionQueue.enqueue).not.toHaveBeenCalled();
});
it('queues an offline payment with the same idempotency key without calling create', async () => {
  await expect(
    saveWidgetEntry('token', 7, payload(), true, () => true),
  ).resolves.toBe('PENDING');
  expect(transactionsService.create).not.toHaveBeenCalled();
  expect(offlineTransactionQueue.enqueue).toHaveBeenCalledWith(7, payload());
});
it('queues an uncertain network result using the original key', async () => {
  jest
    .mocked(transactionsService.create)
    .mockRejectedValueOnce(new ApiError('timeout', 0));
  await expect(
    saveWidgetEntry('token', 7, payload(), false, () => true),
  ).resolves.toBe('PENDING');
  expect(offlineTransactionQueue.enqueue).toHaveBeenCalledWith(7, payload());
});
it('keeps rejected inputs out of the offline queue', async () => {
  jest
    .mocked(transactionsService.create)
    .mockRejectedValueOnce(new ApiError('invalid', 400));
  await expect(
    saveWidgetEntry('token', 7, payload(), false, () => true),
  ).rejects.toThrow('invalid');
  expect(offlineTransactionQueue.enqueue).not.toHaveBeenCalled();
});
it('does not send or enqueue after account change', async () => {
  await expect(
    saveWidgetEntry('token', 7, payload(), false, () => false),
  ).rejects.toThrow();
  expect(transactionsService.create).not.toHaveBeenCalled();
  let active = true;
  jest.mocked(transactionsService.create).mockImplementationOnce(async () => {
    active = false;
    throw new ApiError('changed', 0, 'SESSION_CHANGED');
  });
  await expect(
    saveWidgetEntry('token', 7, payload(), false, () => active),
  ).rejects.toThrow();
  expect(offlineTransactionQueue.enqueue).not.toHaveBeenCalled();
});
it('refreshes widget totals from confirmed server rows after sync, without losing older cached rows', async () => {
  const old = { id: 1, amount: '10' } as never;
  const updated = { id: 1, amount: '20' } as never;
  const historical = { id: 2, amount: '30' } as never;
  jest
    .mocked(dashboardCache.read)
    .mockResolvedValueOnce({ ...cache, transactions: [old, historical] });
  jest.mocked(transactionsService.getPage).mockResolvedValueOnce({
    data: [updated],
    meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
  });
  await refreshWidgetEntryCache('token', 7, () => true);
  expect(dashboardCache.save).toHaveBeenCalledWith(
    7,
    expect.objectContaining({
      transactions: [updated, historical],
      categories: cache.categories,
    }),
  );
  jest.mocked(dashboardCache.save).mockClear();
  jest.mocked(transactionsService.getPage).mockResolvedValueOnce({
    data: [updated],
    meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
  });
  await refreshWidgetEntryCache('token', 7, () => false);
  expect(dashboardCache.save).not.toHaveBeenCalled();
});
