jest.mock('../src/services/api', () => ({ apiRequest: jest.fn() }));

import { apiRequest } from '../src/services/api';
import { walletTransfersService } from '../src/services/walletTransfers';

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('walletTransfersService', () => {
  beforeEach(() => mockedApiRequest.mockReset());

  it('loads the wallet transfer history', () => {
    walletTransfersService.getAll('token-123');

    expect(mockedApiRequest).toHaveBeenCalledWith('/wallet-transfers', {
      method: 'GET',
      token: 'token-123',
    });
  });

  it('creates a transfer with source and destination wallets', () => {
    const payload = {
      source_wallet_id: 1,
      destination_wallet_id: 2,
      amount: '250000',
      note: 'Chuyển tiền sinh hoạt',
    };

    walletTransfersService.create('token-123', payload);

    expect(mockedApiRequest).toHaveBeenCalledWith('/wallet-transfers', {
      method: 'POST',
      token: 'token-123',
      body: payload,
    });
  });
});
