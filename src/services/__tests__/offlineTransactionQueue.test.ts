import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, configureAuthSession, getApiBaseUrl } from '../api';
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
  it('keeps a corrupt queue intact rather than replacing it with an empty queue', async () => {
    storage.set('quan_ly_chi_tieu_offline_transactions_v1_7', 'broken json');
    await expect(
      offlineTransactionQueue.enqueue(7, {
        wallet_id: 2,
        amount: '1000',
        type: 'EXPENSE',
      }),
    ).rejects.toThrow('giữ nguyên');
    expect(storage.get('quan_ly_chi_tieu_offline_transactions_v1_7')).toBe(
      'broken json',
    );
  });

  it('keeps a bank notification idempotency key without adding a conflicting client key', async () => {
    const sourceRef = 'b'.repeat(64);
    const draft = await offlineTransactionQueue.enqueue(7, {
      wallet_id: 2,
      category_id: 3,
      amount: '79000',
      type: 'EXPENSE',
      source: 'BANK_NOTIFICATION',
      source_ref: sourceRef,
    });
    const repeated = await offlineTransactionQueue.enqueue(7, draft.payload);
    createTransaction.mockResolvedValue({ id: 91 });

    expect(draft.id).toBe(`bank_${sourceRef}`);
    expect(draft.payload.source_ref).toBe(sourceRef);
    expect(draft.payload).not.toHaveProperty('client_request_id');
    expect(repeated.id).toBe(draft.id);

    await expect(offlineTransactionQueue.sync('token', 7)).resolves.toEqual({
      synced: 1,
      pending: 0,
      needsReview: 0,
    });
    expect(createTransaction).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({
        source: 'BANK_NOTIFICATION',
        source_ref: sourceRef,
      }),
    );
    expect(createTransaction.mock.calls[0][1]).not.toHaveProperty(
      'client_request_id',
    );
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

  it('stops at the first network or auth failure and does not mark drafts as invalid', async () => {
    for (const id of ['txn_stop_one_123456', 'txn_stop_two_123456'])
      await offlineTransactionQueue.enqueue(7, {
        wallet_id: 2,
        amount: '1000',
        type: 'EXPENSE',
        client_request_id: id,
      });
    createTransaction.mockRejectedValueOnce(new ApiError('auth expired', 401));
    expect(await offlineTransactionQueue.sync('token', 7)).toMatchObject({
      pending: 2,
      needsReview: 0,
    });
    expect(createTransaction).toHaveBeenCalledTimes(1);
    expect(
      (await offlineTransactionQueue.list(7)).every(
        d => d.status === 'PENDING',
      ),
    ).toBe(true);
  });
  it('stops an old-account run before sending its next draft after the API session changes', async () => {
    for (const id of ['txn_account_one_12345', 'txn_account_two_12345'])
      await offlineTransactionQueue.enqueue(7, {
        wallet_id: 2,
        amount: '1000',
        type: 'EXPENSE',
        client_request_id: id,
      });
    createTransaction.mockImplementationOnce(async () => {
      configureAuthSession(null);
      return { id: 1 };
    });
    await offlineTransactionQueue.sync('token', 7, () => true);
    expect(createTransaction).toHaveBeenCalledTimes(1);
    expect(await offlineTransactionQueue.list(7)).toHaveLength(1);
  });
  it('quarantines legacy or foreign-server drafts without silently deleting or sending them', async () => {
    const draft = await offlineTransactionQueue.enqueue(7, {
      wallet_id: 2,
      amount: '1000',
      type: 'EXPENSE',
      client_request_id: 'txn_legacy_item_12345',
    });
    const legacy = { ...draft };
    delete legacy.server;
    storage.set(
      'quan_ly_chi_tieu_offline_transactions_v1_7',
      JSON.stringify([
        legacy,
        { ...draft, id: 'other', server: 'https://other.invalid' },
      ]),
    );
    expect((await offlineTransactionQueue.list(7))[0].status).toBe(
      'NEEDS_REVIEW',
    );
    await offlineTransactionQueue.sync('token', 7);
    expect(createTransaction).not.toHaveBeenCalled();
    await offlineTransactionQueue.retry(7, legacy.id);
    expect((await offlineTransactionQueue.list(7))[0].server).toBe(
      getApiBaseUrl(),
    );
    createTransaction.mockResolvedValue({ id: 1 });
    await offlineTransactionQueue.sync('token', 7);
    expect(
      JSON.parse(storage.get('quan_ly_chi_tieu_offline_transactions_v1_7')!),
    ).toHaveLength(1);
  });
});
