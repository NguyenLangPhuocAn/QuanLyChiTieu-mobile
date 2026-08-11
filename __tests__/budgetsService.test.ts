import { apiRequest } from '../src/services/api';
import { budgetsService } from '../src/services/budgets';

jest.mock('../src/services/api', () => ({
  apiRequest: jest.fn(),
}));

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('budgetsService', () => {
  beforeEach(() => mockedApiRequest.mockReset());

  it('requests a filtered budget page', () => {
    budgetsService.getPage('token-123', {
      page: 2,
      limit: 10,
      period_filter: 'PREVIOUS_MONTH',
      current_date: '2026-06-12',
      q: 'ăn uống',
    });

    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/budgets?page=2&limit=10&period_filter=PREVIOUS_MONTH&current_date=2026-06-12&q=%C4%83n+u%E1%BB%91ng',
      { method: 'GET', token: 'token-123' },
    );
  });

  it('requests paginated transactions counted by a budget', () => {
    budgetsService.getTransactions('token-123', 7, 1, 10);

    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/budgets/7/transactions?page=1&limit=10',
      { method: 'GET', token: 'token-123' },
    );
  });

  it('requests idempotent next-period creation', () => {
    budgetsService.createNextPeriod('token-123', 9);

    expect(mockedApiRequest).toHaveBeenCalledWith('/budgets/9/next-period', {
      method: 'POST',
      token: 'token-123',
    });
  });
});
