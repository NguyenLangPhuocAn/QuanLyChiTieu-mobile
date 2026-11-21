import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '../src/services/api';
import { offlineCategoryQueue } from '../src/services/offlineCategoryQueue';
import { offlineTransactionQueue } from '../src/services/offlineTransactionQueue';
import { transactionsService } from '../src/services/transactions';
import type { Category } from '../src/types/category';

jest.mock('../src/services/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    apiRequest: jest.fn(),
    ApiError,
    getApiStorageBaseUrl: () => 'http://category-qa',
    captureApiSession: () => () => true,
  };
});
jest.mock('../src/services/transactions', () => ({
  transactionsService: { create: jest.fn(), uploadReceipt: jest.fn() },
}));

const store = new Map<string, string>();
const payload = {
  name: 'Thú cưng QA',
  type: 'EXPENSE' as const,
  cash_flow_group: 'NORMAL' as const,
};
const category = (id: number, name = payload.name): Category => ({
  id,
  name,
  type: 'EXPENSE',
  cash_flow_group: 'NORMAL',
  icon: null,
  is_system: false,
  user_id: 71,
});

beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
  jest
    .mocked(AsyncStorage.getItem)
    .mockImplementation(async key => store.get(key) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
    store.set(key, value);
  });
});

it('keeps a new category through restart and retries with the same request id', async () => {
  const saved = await offlineCategoryQueue.create(71, payload);
  expect(saved.id).toBeLessThan(0);
  expect(
    offlineCategoryQueue.apply([], await offlineCategoryQueue.list(71))[0].name,
  ).toBe(payload.name);
  let calls = 0;
  jest.mocked(apiRequest).mockImplementation(async (_path, options) => {
    if (options?.method !== 'POST') throw Error('Unexpected request');
    calls++;
    expect(
      (options.body as { client_request_id: string }).client_request_id,
    ).toBe(saved.requestId);
    if (calls === 1) throw Error('Network lost after request');
    return category(301) as never;
  });
  const first = await offlineCategoryQueue.sync(
    'token',
    71,
    await offlineCategoryQueue.preview(71),
    () => true,
  );
  expect(first.pending).toBe(1);
  expect((await offlineCategoryQueue.list(71))[0].attempts).toBe(1);
  const second = await offlineCategoryQueue.sync(
    'token',
    71,
    await offlineCategoryQueue.preview(71),
    () => true,
  );
  expect(second.synced).toBe(1);
  expect(await offlineCategoryQueue.resolveId(71, saved.id)).toBe(301);
  expect(await offlineCategoryQueue.list(71)).toHaveLength(0);
});

it('sends a waiting transaction only after its temporary category receives a server id', async () => {
  const saved = await offlineCategoryQueue.create(71, payload);
  await offlineTransactionQueue.enqueue(71, {
    wallet_id: 8,
    category_id: saved.id,
    amount: '2500',
    type: 'EXPENSE',
    note: 'QA temporary category',
  });
  jest
    .mocked(transactionsService.create)
    .mockResolvedValue({ id: 61 } as never);
  const waiting = await offlineTransactionQueue.sync('token', 71);
  expect(waiting.pending).toBe(1);
  expect(transactionsService.create).not.toHaveBeenCalled();
  jest.mocked(apiRequest).mockResolvedValue(category(301) as never);
  await offlineCategoryQueue.sync(
    'token',
    71,
    await offlineCategoryQueue.preview(71),
    () => true,
  );
  const sent = await offlineTransactionQueue.sync('token', 71);
  expect(sent.synced).toBe(1);
  expect(transactionsService.create).toHaveBeenCalledWith(
    'token',
    expect.objectContaining({ category_id: 301, amount: '2500' }),
  );
});

it('rejects a stale update while retaining the local change for review', async () => {
  await offlineCategoryQueue.update(71, category(51), {
    ...payload,
    name: 'Thú cưng mới',
  });
  jest
    .mocked(apiRequest)
    .mockResolvedValueOnce([category(51, 'Đổi trên máy khác')] as never);
  const result = await offlineCategoryQueue.sync(
    'token',
    71,
    await offlineCategoryQueue.preview(71),
    () => true,
  );
  expect(result.needsReview).toBe(1);
  expect((await offlineCategoryQueue.list(71))[0].status).toBe('NEEDS_REVIEW');
  expect(jest.mocked(apiRequest)).toHaveBeenCalledTimes(1);
});

it('replays a reviewed local edit only against the server version shown to the user', async () => {
  await offlineCategoryQueue.update(71, category(51), {
    ...payload,
    name: 'Tên trên máy',
  });
  jest
    .mocked(apiRequest)
    .mockResolvedValueOnce([category(51, 'Tên trên server')] as never);
  await offlineCategoryQueue.sync(
    'token',
    71,
    await offlineCategoryQueue.preview(71),
    () => true,
  );
  const reviewed = category(51, 'Tên trên server');
  jest.mocked(apiRequest).mockResolvedValueOnce([reviewed] as never);
  const next = await offlineCategoryQueue.rebaseReviewed(
    'token',
    71,
    await offlineCategoryQueue.preview(71),
    { 51: reviewed },
  );
  expect(next[0].revision).toBe(3);
  jest
    .mocked(apiRequest)
    .mockResolvedValueOnce([reviewed] as never)
    .mockResolvedValueOnce(category(51, 'Tên trên máy') as never);
  const result = await offlineCategoryQueue.sync('token', 71, next, () => true);
  expect(result.synced).toBe(1);
  expect(
    (
      jest.mocked(apiRequest).mock.calls.at(-1)?.[1]?.body as {
        offline_expected: { name: string };
      }
    ).offline_expected.name,
  ).toBe('tên trên server');
});

it('stops rebase if the server changes after preview', async () => {
  await offlineCategoryQueue.update(71, category(51), {
    ...payload,
    name: 'Tên trên máy',
  });
  jest
    .mocked(apiRequest)
    .mockResolvedValueOnce([category(51, 'Tên trên server')] as never);
  await offlineCategoryQueue.sync(
    'token',
    71,
    await offlineCategoryQueue.preview(71),
    () => true,
  );
  jest
    .mocked(apiRequest)
    .mockResolvedValueOnce([category(51, 'Tên khác nữa')] as never);
  await expect(
    offlineCategoryQueue.rebaseReviewed(
      'token',
      71,
      await offlineCategoryQueue.preview(71),
      { 51: category(51) },
    ),
  ).rejects.toThrow('đã đổi sau khi xem trước');
  expect((await offlineCategoryQueue.list(71))[0].status).toBe('NEEDS_REVIEW');
});

it('refuses to delete a category used by an unsent transaction', async () => {
  const saved = await offlineCategoryQueue.create(71, payload);
  await AsyncStorage.setItem(
    'quan_ly_chi_tieu_offline_transactions_v1_71',
    JSON.stringify([
      { server: 'http://category-qa', payload: { category_id: saved.id } },
    ]),
  );
  await expect(
    offlineCategoryQueue.remove(71, category(saved.id)),
  ).rejects.toThrow('giao dịch chờ đồng bộ');
  expect(await offlineCategoryQueue.list(71)).toHaveLength(1);
});

it('requires an unchanged preview before discarding local categories', async () => {
  const saved = await offlineCategoryQueue.create(71, payload);
  const preview = await offlineCategoryQueue.preview(71);
  await offlineCategoryQueue.update(71, category(saved.id), {
    ...payload,
    name: 'Khác',
  });
  await expect(offlineCategoryQueue.discard(71, preview)).rejects.toThrow(
    'đã thay đổi',
  );
  expect(await offlineCategoryQueue.list(71)).toHaveLength(1);
});
