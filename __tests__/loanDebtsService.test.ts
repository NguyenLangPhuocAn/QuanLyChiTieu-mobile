jest.mock('../src/services/api', () => ({ apiRequest: jest.fn() }));

import { apiRequest } from '../src/services/api';
import { loanDebtsService } from '../src/services/loanDebts';

describe('loanDebtsService', () => {
  it('creates a ledger record through the dedicated endpoint', async () => {
    (apiRequest as jest.Mock).mockResolvedValue({ id: 1 });
    const payload = {
      person_name: 'An',
      type: 'BORROWED' as const,
      principal_amount: '100000',
      wallet_id: 2,
    };
    await loanDebtsService.create('token', payload);
    expect(apiRequest).toHaveBeenCalledWith('/loan-debts', {
      method: 'POST',
      token: 'token',
      body: payload,
    });
  });
});
