jest.mock('../src/services/api', () => ({ apiRequest: jest.fn() }));

import { apiRequest } from '../src/services/api';
import { financialPlansService } from '../src/services/financialPlans';

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('financialPlansService', () => {
  it('loads the combined cashflow and savings plan', () => {
    financialPlansService.getOverview('token-123');

    expect(mockedApiRequest).toHaveBeenCalledWith('/financial-plans/overview', {
      method: 'GET',
      token: 'token-123',
    });
  });
});
