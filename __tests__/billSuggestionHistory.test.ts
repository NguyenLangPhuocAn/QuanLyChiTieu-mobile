import { loadBillSuggestionHistory } from '../src/services/billSuggestionHistory';
import { transactionsService } from '../src/services/transactions';
jest.mock('../src/services/transactions', () => ({
  transactionsService: { getPage: jest.fn() },
}));
const row = (id: number) => ({
  id,
  wallet_id: 1,
  amount: -100,
  currency: 'VND',
  type: 'EXPENSE' as const,
  transaction_date: '2026-10-01',
});
beforeEach(() => jest.resetAllMocks());
it('reads authenticated expense pages and records complete coverage', async () => {
  jest
    .mocked(transactionsService.getPage)
    .mockResolvedValueOnce({
      data: [row(2)],
      meta: { page: 1, limit: 100, total: 2, totalPages: 2 },
    })
    .mockResolvedValueOnce({
      data: [row(1)],
      meta: { page: 2, limit: 100, total: 2, totalPages: 2 },
    });
  expect(
    await loadBillSuggestionHistory('token', '2026-10-27', () => true),
  ).toMatchObject({ total: 2, complete: true, rows: [row(2), row(1)] });
  expect(transactionsService.getPage).toHaveBeenCalledWith(
    'token',
    expect.objectContaining({
      type: 'EXPENSE',
      cash_flow: 'normal',
      page: 2,
      limit: 100,
      to: '2026-10-27',
    }),
  );
});
it('drops late responses on account change/cancel without starting another page', async () => {
  let current = true;
  jest.mocked(transactionsService.getPage).mockImplementation(async () => {
    current = false;
    return {
      data: [row(1)],
      meta: { page: 1, limit: 100, total: 2, totalPages: 2 },
    };
  });
  expect(
    await loadBillSuggestionHistory('token', '2026-10-27', () => current),
  ).toBeNull();
  expect(transactionsService.getPage).toHaveBeenCalledTimes(1);
});
it('fails on pagination drift/duplicates and propagates failure rather than silently claiming a complete scan', async () => {
  jest
    .mocked(transactionsService.getPage)
    .mockResolvedValueOnce({
      data: [row(1)],
      meta: { page: 1, limit: 100, total: 2, totalPages: 2 },
    })
    .mockResolvedValueOnce({
      data: [row(1)],
      meta: { page: 2, limit: 100, total: 2, totalPages: 2 },
    });
  await expect(
    loadBillSuggestionHistory('token', '2026-10-27', () => true),
  ).rejects.toThrow('trùng');
});
it('caps the scan and explicitly reports incomplete history', async () => {
  jest
    .mocked(transactionsService.getPage)
    .mockImplementation(async (_, query) => ({
      data: [row(query.page!)],
      meta: { page: query.page!, limit: 100, total: 30, totalPages: 30 },
    }));
  expect(
    await loadBillSuggestionHistory('token', '2026-10-27', () => true),
  ).toMatchObject({ complete: false, total: 30 });
  expect(transactionsService.getPage).toHaveBeenCalledTimes(20);
});
