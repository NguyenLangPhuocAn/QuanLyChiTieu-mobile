import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, configureAuthSession, getApiStorageBaseUrl } from '../api';
import { offlineTransactionQueue } from '../offlineTransactionQueue';
import { transactionsService } from '../transactions';
import { offlineReceiptStore } from '../offlineReceiptStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('../transactions', () => ({
  transactionsService: { create: jest.fn(), uploadReceipt: jest.fn() },
}));
jest.mock('../offlineReceiptStore', () => ({
  offlineReceiptStore: {
    stage: jest.fn(),
    verify: jest.fn(),
    uploadFile: jest.fn(),
    remove: jest.fn(),
  },
}));

const storage = new Map<string, string>();
const getItem = AsyncStorage.getItem as jest.MockedFunction<
  typeof AsyncStorage.getItem
>;
const setItem = AsyncStorage.setItem as jest.MockedFunction<
  typeof AsyncStorage.setItem
>;
const createTransaction = transactionsService.create as jest.Mock;
const uploadReceipt = transactionsService.uploadReceipt as jest.Mock;
const receiptStore = offlineReceiptStore as jest.Mocked<
  typeof offlineReceiptStore
>;
const receiptFile = {
  uri: 'file:///cache/receipt.jpg',
  name: 'receipt.jpg',
  type: 'image/jpeg',
};
const storedReceipt = {
  path: '/private/7/receipt.jpg',
  name: 'receipt.jpg',
  type: 'image/jpeg',
  size: 120,
  sha256: 'abc',
};

describe('offlineTransactionQueue', () => {
  beforeEach(() => {
    storage.clear();
    jest.clearAllMocks();
    receiptStore.stage.mockResolvedValue(storedReceipt);
    receiptStore.verify.mockResolvedValue(undefined);
    receiptStore.uploadFile.mockReturnValue(receiptFile);
    receiptStore.remove.mockResolvedValue(undefined);
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
  it('does not upload or discard if the offline preview changed after the user saw it', async () => {
    const first = await offlineTransactionQueue.enqueue(7, {
      wallet_id: 2,
      amount: '5000',
      type: 'EXPENSE',
      client_request_id: 'txn_first_preview_123456',
    });
    const expected = [{ id: first.id, updatedAt: first.updatedAt }];
    await offlineTransactionQueue.enqueue(7, {
      wallet_id: 2,
      amount: '7000',
      type: 'EXPENSE',
      client_request_id: 'txn_second_preview_12345',
    });
    await expect(
      offlineTransactionQueue.sync('token', 7, () => true, expected),
    ).rejects.toThrow('xem lại');
    await expect(
      offlineTransactionQueue.discardLocal(7, expected),
    ).rejects.toThrow('xem lại');
    expect(createTransaction).not.toHaveBeenCalled();
    expect(await offlineTransactionQueue.list(7)).toHaveLength(2);
  });
  it('discards only the confirmed current-server drafts and never sends money', async () => {
    const draft = await offlineTransactionQueue.enqueue(7, {
      wallet_id: 2,
      amount: '5000',
      type: 'EXPENSE',
      client_request_id: 'txn_discard_preview_12345',
    });
    const expected = [{ id: draft.id, updatedAt: draft.updatedAt }];
    expect(await offlineTransactionQueue.discardLocal(7, expected)).toBe(1);
    expect(await offlineTransactionQueue.list(7)).toEqual([]);
    expect(createTransaction).not.toHaveBeenCalled();
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

  it.each(['manual', 'bank'] as const)(
    'rejects changed %s payloads for an existing key without overwriting the draft',
    async kind => {
      const draft = await offlineTransactionQueue.enqueue(7, {
        wallet_id: 2,
        category_id: 3,
        amount: '1000',
        type: 'EXPENSE',
        receipt_items: [{ name: 'Ca phe', amount: 1000 }],
        ...(kind === 'bank'
          ? { source: 'BANK_NOTIFICATION' as const, source_ref: 'c'.repeat(64) }
          : { client_request_id: 'txn_queue_conflict_12345678' }),
      });
      // Equivalent JSON with keys in a different order is still the same request.
      const reordered = Object.fromEntries(
        Object.entries(draft.payload).reverse(),
      );
      await expect(
        offlineTransactionQueue.enqueue(7, reordered as typeof draft.payload),
      ).resolves.toEqual(draft);
      for (const changed of [
        { ...draft.payload, amount: '2000' },
        { ...draft.payload, receipt_items: [{ name: 'Tra', amount: 1000 }] },
      ])
        await expect(
          offlineTransactionQueue.enqueue(7, changed),
        ).rejects.toMatchObject({
          status: 409,
          code: 'OFFLINE_DRAFT_CONFLICT',
        });
      expect(await offlineTransactionQueue.list(7)).toEqual([draft]);
      expect(setItem).toHaveBeenCalledTimes(1);
      expect(createTransaction).not.toHaveBeenCalled();
    },
  );

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
    const listener = jest.fn();
    const unsubscribe = offlineTransactionQueue.subscribe(listener);
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
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
  });

  it('sends every queued draft in one pass without skipping the next one', async () => {
    for (const [note, id] of [
      ['Bữa trưa', 'txn_offline_lunch_1234567'],
      ['Thiệp sinh nhật', 'txn_offline_card_12345678'],
      ['Nước suối', 'txn_offline_water_1234567'],
    ])
      await offlineTransactionQueue.enqueue(7, {
        wallet_id: 2,
        amount: '15000',
        type: 'EXPENSE',
        note,
        client_request_id: id,
      });
    createTransaction
      .mockResolvedValueOnce({ id: 91 })
      .mockResolvedValueOnce({ id: 92 })
      .mockResolvedValueOnce({ id: 93 });

    const result = await offlineTransactionQueue.sync('token', 7);

    expect(result).toEqual({ synced: 3, pending: 0, needsReview: 0 });
    expect(createTransaction).toHaveBeenCalledTimes(3);
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

  it('keeps a copied receipt after upload failure and retries without creating money twice', async () => {
    const draft = await offlineTransactionQueue.enqueue(
      7,
      {
        wallet_id: 2,
        amount: '12500',
        type: 'EXPENSE',
        client_request_id: 'txn_photo_retry_1234567',
      },
      receiptFile,
    );
    expect(draft.receipt).toEqual(storedReceipt);
    createTransaction.mockResolvedValue({ id: 91 });
    uploadReceipt.mockRejectedValueOnce(new ApiError('offline', 0));
    await offlineTransactionQueue.sync('token', 7);
    expect(await offlineTransactionQueue.list(7)).toEqual([
      expect.objectContaining({
        confirmedTransactionId: 91,
        receipt: storedReceipt,
        status: 'PENDING',
      }),
    ]);
    expect(receiptStore.remove).not.toHaveBeenCalled();

    uploadReceipt.mockResolvedValueOnce({ id: 91, receipt_image: 'saved.jpg' });
    await offlineTransactionQueue.sync('token', 7);
    expect(createTransaction).toHaveBeenCalledTimes(1);
    expect(uploadReceipt).toHaveBeenCalledTimes(2);
    expect(await offlineTransactionQueue.list(7)).toEqual([]);
    expect(receiptStore.remove).toHaveBeenCalledWith(7, storedReceipt);
  });

  it('does not send money when the staged receipt has vanished', async () => {
    await offlineTransactionQueue.enqueue(
      7,
      {
        wallet_id: 2,
        amount: '20000',
        type: 'EXPENSE',
        client_request_id: 'txn_photo_missing_123456',
      },
      receiptFile,
    );
    receiptStore.verify.mockRejectedValueOnce(new Error('Ảnh đã mất'));
    expect(await offlineTransactionQueue.sync('token', 7)).toMatchObject({
      synced: 0,
      needsReview: 1,
    });
    expect(createTransaction).not.toHaveBeenCalled();
    expect((await offlineTransactionQueue.list(7))[0].lastError).toBe(
      'Ảnh đã mất',
    );
  });

  it('queues only the photo when the transaction was already saved', async () => {
    await offlineTransactionQueue.enqueue(
      7,
      {
        wallet_id: 2,
        amount: '20000',
        type: 'EXPENSE',
        client_request_id: 'txn_photo_after_money_123',
      },
      receiptFile,
      88,
    );
    uploadReceipt.mockResolvedValueOnce({ id: 88, receipt_image: 'saved.jpg' });
    await offlineTransactionQueue.sync('token', 7);
    expect(createTransaction).not.toHaveBeenCalled();
    expect(uploadReceipt).toHaveBeenCalledWith('token', 88, receiptFile);
    expect(await offlineTransactionQueue.list(7)).toEqual([]);
  });

  it('keeps the photo pending when upload response does not confirm the attachment', async () => {
    await offlineTransactionQueue.enqueue(
      7,
      {
        wallet_id: 2,
        amount: '20000',
        type: 'EXPENSE',
        client_request_id: 'txn_photo_unconfirmed_123',
      },
      receiptFile,
      88,
    );
    uploadReceipt.mockResolvedValueOnce({ id: 88, receipt_image: null });
    await offlineTransactionQueue.sync('token', 7);
    expect(await offlineTransactionQueue.list(7)).toEqual([
      expect.objectContaining({
        confirmedTransactionId: 88,
        receipt: storedReceipt,
        status: 'PENDING',
      }),
    ]);
    expect(receiptStore.remove).not.toHaveBeenCalled();
  });

  it('keeps an uncertain payment immutable until the server result is reconciled', async () => {
    const original = await offlineTransactionQueue.enqueue(7, {
      wallet_id: 2,
      amount: '2863',
      type: 'EXPENSE',
      client_request_id: 'txn_unknown_then_edit_12345',
    });
    createTransaction.mockRejectedValueOnce(
      new ApiError('Mất phản hồi', 0, 'REQUEST_OUTCOME_UNKNOWN'),
    );
    await offlineTransactionQueue.sync('token', 7);

    await expect(
      offlineTransactionQueue.update(7, original.id, { amount: '1247' }),
    ).rejects.toThrow('đối chiếu trước khi sửa');
    await expect(
      offlineTransactionQueue.remove(7, original.id),
    ).rejects.toThrow('đối chiếu trước khi xóa');
    const [pending] = await offlineTransactionQueue.list(7);
    expect(pending.payload).toEqual(original.payload);
    expect(pending.rejectedByServer).toBe(false);

    createTransaction.mockResolvedValueOnce({ id: 60 });
    await offlineTransactionQueue.sync('token', 7);
    expect(createTransaction).toHaveBeenCalledTimes(2);
    expect(createTransaction.mock.calls[1][1]).toEqual(original.payload);
    expect(await offlineTransactionQueue.list(7)).toEqual([]);
  });

  it('retries an ambiguous write with the original request id after recovery', async () => {
    await offlineTransactionQueue.enqueue(7, {
      wallet_id: 2,
      amount: '3471',
      type: 'EXPENSE',
      client_request_id: 'txn_reconnect_same_request_123',
    });
    createTransaction
      .mockRejectedValueOnce(
        new ApiError('Mất phản hồi', 0, 'REQUEST_OUTCOME_UNKNOWN'),
      )
      .mockResolvedValueOnce({ id: 91 });

    expect(await offlineTransactionQueue.sync('token', 7)).toEqual({
      synced: 0,
      pending: 1,
      needsReview: 0,
    });
    expect(await offlineTransactionQueue.sync('token', 7)).toEqual({
      synced: 1,
      pending: 0,
      needsReview: 0,
    });
    expect(createTransaction).toHaveBeenCalledTimes(2);
    for (const [, payload] of createTransaction.mock.calls)
      expect(payload.client_request_id).toBe('txn_reconnect_same_request_123');
    await expect(offlineTransactionQueue.list(7)).resolves.toEqual([]);
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
      attempts: 0,
      lastError: undefined,
      rejectedByServer: false,
      payload: {
        amount: '125000',
        note: 'Sửa sau khi kiểm tra',
        client_request_id: 'txn_review_then_edit_12345',
      },
    });
    await expect(
      offlineTransactionQueue.update(7, 'txn_review_then_edit_12345', {
        amount: '126000',
      }),
    ).resolves.toMatchObject({ attempts: 0 });
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
      getApiStorageBaseUrl(),
    );
    createTransaction.mockResolvedValue({ id: 1 });
    await offlineTransactionQueue.sync('token', 7);
    expect(
      JSON.parse(storage.get('quan_ly_chi_tieu_offline_transactions_v1_7')!),
    ).toHaveLength(1);
  });
});
