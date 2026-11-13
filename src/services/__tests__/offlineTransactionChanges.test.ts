import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError } from '../api';
import {
  offlineTransactionChanges as changes,
  type TransactionChangePayload,
} from '../offlineTransactionChanges';
import { transactionsService } from '../transactions';
import type { ApiTransaction } from '../../types/transaction';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('../transactions', () => ({
  transactionsService: {
    getLinkedPayments: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

const storage = new Map<string, string>();
const base = {
  id: 8,
  wallet_id: 3,
  category_id: 2,
  amount: '79000',
  type: 'EXPENSE',
  note: 'Internet',
  currency: 'VND',
  transaction_date: '2026-11-13T00:00:00.000Z',
  receipt_image: null,
  receipt_items: [{ name: 'Cước tháng', amount: 79000 }],
  tags: ['nhà'],
} as ApiTransaction;
const payload: TransactionChangePayload = {
  wallet_id: 3,
  category_id: 2,
  amount: '85000',
  type: 'EXPENSE',
  note: 'Internet tháng mới',
  transaction_date: '2026-11-13',
  receipt_items: [{ name: 'Cước tháng', amount: 85000 }],
  tags: ['nhà'],
};
const response = (row: ApiTransaction | null) => ({
  data: row ? [row] : [],
  requestedIds: [8],
  missingIds: row ? [] : [8],
});
beforeEach(() => {
  storage.clear();
  jest.clearAllMocks();
  jest
    .mocked(AsyncStorage.getItem)
    .mockImplementation(async key => storage.get(key) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
    storage.set(key, value);
  });
});

it('keeps a visible local edit without writing money before sync', async () => {
  await changes.upsert(7, base, 'UPDATE', payload);
  const [item] = await changes.list(7);
  const [visible] = changes.apply([base], [item]);
  expect(visible.note).toBe(payload.note);
  expect(visible.amount).toBe(payload.amount);
  expect(visible.receipt_items).toEqual(payload.receipt_items);
  expect(transactionsService.update).not.toHaveBeenCalled();
  expect(transactionsService.remove).not.toHaveBeenCalled();
});

it('refuses to discard a preview if an offline edit changed meanwhile', async () => {
  await changes.upsert(7, base, 'UPDATE', payload);
  const preview = await changes.preview(7);
  await changes.upsert(7, base, 'UPDATE', { ...payload, amount: '86000' });
  await expect(changes.discard(7, preview)).rejects.toThrow('xem lại');
  expect(await changes.list(7)).toHaveLength(1);
});

it('stops an offline update when the server version differs', async () => {
  await changes.upsert(7, base, 'UPDATE', payload);
  jest
    .mocked(transactionsService.getLinkedPayments)
    .mockResolvedValue(response({ ...base, note: 'Sửa từ máy khác' }));
  const result = await changes.sync(
    'token',
    7,
    await changes.preview(7),
    () => true,
  );
  expect(result).toEqual({ synced: 0, pending: 0, needsReview: 1 });
  expect(transactionsService.update).not.toHaveBeenCalled();
  expect((await changes.list(7))[0].status).toBe('NEEDS_REVIEW');
});

it('requires an explicit reviewed server version before retrying a conflicting edit', async () => {
  await changes.upsert(7, base, 'UPDATE', payload);
  const remote = { ...base, note: 'Sửa từ máy khác' };
  jest
    .mocked(transactionsService.getLinkedPayments)
    .mockResolvedValue(response(remote));
  await changes.sync('token', 7, await changes.preview(7), () => true);
  const [conflict] = await changes.list(7);
  expect(await changes.inspect('token', conflict)).toMatchObject({
    note: remote.note,
  });
  await changes.resolve(
    7,
    8,
    conflict.revision,
    'LOCAL',
    await changes.inspect('token', conflict),
  );
  await expect(
    changes.discard(7, [{ transactionId: 8, revision: conflict.revision }]),
  ).rejects.toThrow('xem lại');
  await changes.sync('token', 7, await changes.preview(7), () => true);
  expect(transactionsService.update).toHaveBeenCalledWith(
    'token',
    8,
    expect.objectContaining({
      offline_expected: expect.objectContaining({ note: remote.note }),
    }),
  );
});

it('keeps the server record and drops only the reviewed local change', async () => {
  await changes.upsert(7, base, 'DELETE');
  jest
    .mocked(transactionsService.getLinkedPayments)
    .mockResolvedValue(response({ ...base, note: 'Sửa từ máy khác' }));
  await changes.sync('token', 7, await changes.preview(7), () => true);
  const [conflict] = await changes.list(7);
  await changes.resolve(7, 8, conflict.revision, 'SERVER');
  expect(await changes.list(7)).toEqual([]);
  expect(transactionsService.remove).not.toHaveBeenCalled();
});

it('updates once with a server-side expected snapshot and keeps an unknown result for retry', async () => {
  await changes.upsert(7, base, 'UPDATE', payload);
  jest
    .mocked(transactionsService.getLinkedPayments)
    .mockResolvedValue(response(base));
  jest
    .mocked(transactionsService.update)
    .mockRejectedValueOnce(new ApiError('Mất phản hồi', 0));
  const preview = await changes.preview(7);
  expect(await changes.sync('token', 7, preview, () => true)).toMatchObject({
    pending: 1,
  });
  expect(transactionsService.update).toHaveBeenCalledWith(
    'token',
    8,
    expect.objectContaining({
      offline_expected: expect.objectContaining({ id: 8, amount: '79000.00' }),
    }),
  );
  jest.mocked(transactionsService.getLinkedPayments).mockResolvedValue(
    response({
      ...base,
      amount: '85000',
      note: payload.note,
      receipt_items: payload.receipt_items,
    }),
  );
  expect(await changes.sync('token', 7, preview, () => true)).toMatchObject({
    synced: 1,
  });
  expect(transactionsService.update).toHaveBeenCalledTimes(1);
  expect(await changes.list(7)).toEqual([]);
});

it('treats an already deleted server row as a completed local deletion', async () => {
  await changes.upsert(7, base, 'DELETE');
  jest
    .mocked(transactionsService.getLinkedPayments)
    .mockResolvedValue(response(null));
  expect(
    await changes.sync('token', 7, await changes.preview(7), () => true),
  ).toMatchObject({ synced: 1, pending: 0 });
  expect(transactionsService.remove).not.toHaveBeenCalled();
  expect(await changes.list(7)).toEqual([]);
});
