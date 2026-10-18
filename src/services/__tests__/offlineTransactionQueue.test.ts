import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError } from '../api';
import { offlineTransactionQueue } from '../offlineTransactionQueue';
import { transactionsService } from '../transactions';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('../transactions', () => ({
  transactionsService: { create: jest.fn() },
}));

const storage = new Map<string, string>();
const getItem = AsyncStorage.getItem as jest.MockedFunction<
  typeof AsyncStorage.getItem
>;
const setItem = AsyncStorage.setItem as jest.MockedFunction<
  typeof AsyncStorage.setItem
>;
const createTransaction = transactionsService.create as jest.Mock;

describe('offlineTransactionQueue', () => {
  beforeEach(() => {
    storage.clear();
    jest.clearAllMocks();
    getItem.mockImplementation(async key => storage.get(key) ?? null);
    setItem.mockImplementation(async (key, value) => {
      storage.set(key, value);
    });
  });

  it('stores a draft with one stable client request id', async () => {
    const draft = await offlineTransactionQueue.enqueue(7, {
      wallet_id: 2,
      category_id: 3,
      amount: '45000',
      type: 'EXPENSE',
      note: 'Cà phê',
    });
    const repeated = await offlineTransactionQueue.enqueue(7, draft.payload);
    const drafts = await offlineTransactionQueue.list(7);

    expect(draft.payload.client_request_id).toMatch(/^[a-zA-Z0-9_-]{16,64}$/);
    expect(repeated.id).toBe(draft.id);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].status).toBe('PENDING');
  });

  it('removes a draft after the idempotent request is confirmed', async () => {
    await offlineTransactionQueue.enqueue(7, {
      wallet_id: 2,
      amount: '100000',
      type: 'INCOME',
      client_request_id: 'txn_offline_success_123456',
    });
    createTransaction.mockResolvedValue({ id: 90 });

    const result = await offlineTransactionQueue.sync('token', 7);

    expect(result).toEqual({ synced: 1, pending: 0, needsReview: 0 });
    expect(createTransaction).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({
        client_request_id: 'txn_offline_success_123456',
      }),
    );
    await expect(offlineTransactionQueue.list(7)).resolves.toEqual([]);
  });

  it('keeps an unknown write outcome pending for a safe retry', async () => {
    await offlineTransactionQueue.enqueue(7, {
      wallet_id: 2,
      amount: '75000',
      type: 'EXPENSE',
      client_request_id: 'txn_offline_retry_1234567',
    });
    createTransaction.mockRejectedValue(
      new ApiError('Chưa xác nhận được kết quả', 0, 'REQUEST_OUTCOME_UNKNOWN'),
    );

    const result = await offlineTransactionQueue.sync('token', 7);
    const [draft] = await offlineTransactionQueue.list(7);

    expect(result).toEqual({ synced: 0, pending: 1, needsReview: 0 });
    expect(draft.status).toBe('PENDING');
    expect(draft.attempts).toBe(1);
  });

  it('requires review when the server rejects the draft data', async () => {
    await offlineTransactionQueue.enqueue(7, {
      wallet_id: 2,
      amount: '75000',
      type: 'EXPENSE',
      client_request_id: 'txn_offline_invalid_123456',
    });
    createTransaction.mockRejectedValue(
      new ApiError('Dữ liệu chưa hợp lệ', 400, 'VALIDATION_ERROR'),
    );

    const result = await offlineTransactionQueue.sync('token', 7);
    const [draft] = await offlineTransactionQueue.list(7);

    expect(result).toEqual({ synced: 0, pending: 0, needsReview: 1 });
    expect(draft.status).toBe('NEEDS_REVIEW');
  });

  it('keeps a new draft created while another draft is syncing', async () => {
    await offlineTransactionQueue.enqueue(7, {
      wallet_id: 2,
      amount: '75000',
      type: 'EXPENSE',
      client_request_id: 'txn_syncing_existing_12345',
    });
    let confirmCreate: ((value: { id: number }) => void) | undefined;
    createTransaction.mockImplementation(
      () =>
        new Promise(resolve => {
          confirmCreate = resolve;
        }),
    );

    const syncing = offlineTransactionQueue.sync('token', 7);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    const adding = offlineTransactionQueue.enqueue(7, {
      wallet_id: 2,
      amount: '99000',
      type: 'EXPENSE',
      client_request_id: 'txn_added_during_sync_12345',
    });
    await Promise.resolve();
    expect(confirmCreate).toBeDefined();
    confirmCreate?.({ id: 91 });

    await syncing;
    await adding;
    await expect(offlineTransactionQueue.list(7)).resolves.toEqual([
      expect.objectContaining({
        id: 'txn_added_during_sync_12345',
        payload: expect.objectContaining({ amount: '99000' }),
      }),
    ]);
  });

  it('lets a rejected draft be corrected without changing its idempotency key', async () => {
    await offlineTransactionQueue.enqueue(7, {
      wallet_id: 2,
      amount: '0',
      type: 'EXPENSE',
      client_request_id: 'txn_review_then_edit_12345',
    });
    createTransaction.mockRejectedValueOnce(
      new ApiError('Số tiền chưa hợp lệ', 400, 'VALIDATION_ERROR'),
    );
    await offlineTransactionQueue.sync('token', 7);

    const updated = await offlineTransactionQueue.update(
      7,
      'txn_review_then_edit_12345',
      {
        amount: '125000',
        note: 'Sửa sau khi kiểm tra',
        client_request_id: 'must_not_replace_the_original',
      },
    );

    expect(updated).toMatchObject({
      status: 'PENDING',
      lastError: undefined,
      payload: {
        amount: '125000',
        note: 'Sửa sau khi kiểm tra',
        client_request_id: 'txn_review_then_edit_12345',
      },
    });
  });
});
