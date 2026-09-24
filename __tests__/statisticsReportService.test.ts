import { statisticsService } from '../src/services/statistics';
import { apiRequest } from '../src/services/api';
jest.mock('../src/services/api', () => ({
  apiRequest: jest.fn().mockResolvedValue({}),
}));
it('keeps wallet and date filters when emailing or downloading a report', async () => {
  const range = { dateFrom: '2026-09-01', dateTo: '2026-09-22', walletId: 7 };
  await statisticsService.sendExcelReport(
    'test',
    'custom',
    'me@example.com',
    range,
  );
  expect(apiRequest).toHaveBeenCalledWith(
    '/statistics/report/email',
    expect.objectContaining({
      method: 'POST',
      body: { period: 'custom', email: 'me@example.com', ...range },
    }),
  );
  await statisticsService.exportReport('test', 'custom', 'excel', range);
  expect(apiRequest).toHaveBeenCalledWith(
    expect.stringContaining('&walletId=7'),
    expect.objectContaining({ method: 'GET' }),
  );
});
