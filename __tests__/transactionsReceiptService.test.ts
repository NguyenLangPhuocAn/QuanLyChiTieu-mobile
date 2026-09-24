jest.mock('../src/services/api', () => ({
  apiRequest: jest.fn(),
  apiUploadRequest: jest.fn(),
}));

import { apiRequest, apiUploadRequest } from '../src/services/api';
import { transactionsService } from '../src/services/transactions';

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
const mockedUpload = apiUploadRequest as jest.MockedFunction<
  typeof apiUploadRequest
>;

describe('receipt transaction service', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
    mockedUpload.mockReset();
  });

  it('stores receipt items inside the parent transaction', () => {
    const payload = {
      wallet_id: 1,
      category_id: 2,
      amount: '88000',
      type: 'EXPENSE' as const,
      note: 'WinMart',
      receipt_items: [
        { name: 'Cua 0,5 kg', amount: 50000 },
        { name: 'Thuế/phí', amount: 8000 },
      ],
    };

    transactionsService.create('token-123', payload);

    expect(mockedApiRequest).toHaveBeenCalledWith('/transactions', {
      method: 'POST',
      token: 'token-123',
      body: payload,
    });
  });

  it('uses the OCR upload endpoint with a longer AI timeout', () => {
    const file = {
      uri: 'file:///receipt.jpg',
      name: 'receipt.jpg',
      type: 'image/jpeg',
    };

    transactionsService.analyzeReceipt('token-123', file);

    expect(mockedUpload).toHaveBeenCalledWith(
      '/transactions/receipt-ocr',
      'token-123',
      file,
      'POST',
      45_000,
    );
  });
});
