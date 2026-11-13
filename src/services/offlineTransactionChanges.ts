import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, captureApiSession, getApiStorageBaseUrl } from './api';
import { transactionsService } from './transactions';
import type { ApiTransaction, ReceiptItem } from '../types/transaction';
import type { Category } from '../types/category';

export type TransactionSnapshot = {
  id: number;
  walletId: number;
  categoryId: number | null;
  amount: string;
  type: 'INCOME' | 'EXPENSE';
  note: string;
  date: string;
  receiptImage: string | null;
  receiptItems: ReceiptItem[];
  tags: string[];
};
export type TransactionChangePayload = {
  wallet_id: number;
  category_id?: number;
  amount: string;
  type: 'INCOME' | 'EXPENSE';
  note: string;
  transaction_date: string;
  receipt_items: ReceiptItem[];
  receipt_image?: null;
  tags: string[];
};
export type OfflineTransactionChange = {
  server: string;
  userId: number;
  transactionId: number;
  action: 'UPDATE' | 'DELETE';
  base: TransactionSnapshot;
  payload?: TransactionChangePayload;
  status: 'PENDING' | 'NEEDS_REVIEW';
  revision: number;
  updatedAt: string;
  lastError?: string;
};

const key = (userId: number) =>
  `offline-transaction-changes:v1:${getApiStorageBaseUrl()}:${userId}`;
const locks = new Map<number, Promise<unknown>>();
const listeners = new Set<() => void>();
const withLock = <T>(userId: number, work: () => Promise<T>): Promise<T> => {
  const next = (locks.get(userId) ?? Promise.resolve())
    .catch(() => undefined)
    .then(work);
  const end = next
    .then(
      () => undefined,
      () => undefined,
    )
    .finally(() => {
      if (locks.get(userId) === end) locks.delete(userId);
    });
  locks.set(userId, end);
  return next;
};
const read = async (userId: number): Promise<OfflineTransactionChange[]> => {
  const raw = await AsyncStorage.getItem(key(userId));
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as OfflineTransactionChange[];
    if (
      !Array.isArray(value) ||
      value.some(
        item =>
          !item ||
          item.userId !== userId ||
          item.server !== getApiStorageBaseUrl() ||
          !Number.isSafeInteger(item.transactionId) ||
          item.transactionId <= 0 ||
          !Number.isSafeInteger(item.revision) ||
          item.revision <= 0 ||
          !['UPDATE', 'DELETE'].includes(item.action) ||
          item.base?.id !== item.transactionId ||
          !['PENDING', 'NEEDS_REVIEW'].includes(item.status) ||
          (item.action === 'UPDATE' && !item.payload),
      )
    )
      throw Error();
    return value;
  } catch {
    throw Error(
      'Chưa đọc được thay đổi giao dịch trên máy. Dữ liệu vẫn được giữ nguyên.',
    );
  }
};
const write = async (userId: number, rows: OfflineTransactionChange[]) => {
  await AsyncStorage.setItem(key(userId), JSON.stringify(rows));
  listeners.forEach(listener => listener());
};
const canonicalAmount = (value: string | number) =>
  Number(Math.abs(Number(value))).toFixed(2);
const canonicalItems = (items: ReceiptItem[] | null | undefined) =>
  JSON.stringify(
    (items ?? []).map(item => ({
      name: item.name.trim(),
      amount: Number(item.amount),
    })),
  );
export const snapshotTransaction = (
  row: ApiTransaction,
): TransactionSnapshot => ({
  id: row.id,
  walletId: row.wallet_id,
  categoryId: row.category_id ?? row.category?.id ?? null,
  amount: canonicalAmount(row.amount),
  type: row.type,
  note: row.note?.trim() ?? '',
  date: row.transaction_date.slice(0, 10),
  receiptImage: row.receipt_image ?? null,
  receiptItems: row.receipt_items ?? [],
  tags: [...(row.tags ?? [])].sort(),
});
const same = (a: TransactionSnapshot, b: TransactionSnapshot) =>
  a.id === b.id &&
  a.walletId === b.walletId &&
  a.categoryId === b.categoryId &&
  a.amount === b.amount &&
  a.type === b.type &&
  a.note === b.note &&
  a.date === b.date &&
  a.receiptImage === b.receiptImage &&
  canonicalItems(a.receiptItems) === canonicalItems(b.receiptItems) &&
  JSON.stringify(a.tags) === JSON.stringify(b.tags);
const snapshotWithPayload = (
  base: TransactionSnapshot,
  payload: TransactionChangePayload,
): TransactionSnapshot => ({
  ...base,
  walletId: payload.wallet_id,
  categoryId: payload.category_id ?? base.categoryId,
  amount: canonicalAmount(payload.amount),
  type: payload.type,
  note: payload.note.trim(),
  date: payload.transaction_date.slice(0, 10),
  receiptImage: payload.receipt_image === null ? null : base.receiptImage,
  receiptItems: payload.receipt_items,
  tags: [...payload.tags].sort(),
});
const previewOf = (rows: OfflineTransactionChange[]) =>
  rows
    .map(item => ({
      transactionId: item.transactionId,
      revision: item.revision,
    }))
    .sort((a, b) => a.transactionId - b.transactionId);

export const offlineTransactionChanges = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  list: read,
  async upsert(
    userId: number,
    base: ApiTransaction,
    action: 'UPDATE' | 'DELETE',
    payload?: TransactionChangePayload,
  ) {
    return withLock(userId, async () => {
      const rows = await read(userId);
      const existing = rows.find(item => item.transactionId === base.id);
      const baseline = existing?.base ?? snapshotTransaction(base);
      if (existing?.action === 'DELETE' && action === 'UPDATE')
        throw Error('Giao dịch đang chờ xóa. Hãy bỏ thay đổi đó trước.');
      const next: OfflineTransactionChange = {
        server: getApiStorageBaseUrl(),
        userId,
        transactionId: base.id,
        action,
        base: baseline,
        payload: action === 'UPDATE' ? payload : undefined,
        status: 'PENDING',
        revision: (existing?.revision ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      await write(userId, [
        ...rows.filter(item => item.transactionId !== base.id),
        next,
      ]);
      return next;
    });
  },
  async remove(userId: number, transactionId: number) {
    return withLock(userId, async () => {
      const rows = await read(userId);
      await write(
        userId,
        rows.filter(item => item.transactionId !== transactionId),
      );
    });
  },
  async inspect(token: string, item: OfflineTransactionChange) {
    const response = await transactionsService.getLinkedPayments(token, [
      item.transactionId,
    ]);
    const remote = response.data[0];
    if (
      remote &&
      (remote.receipt_items === undefined ||
        remote.tags === undefined ||
        remote.receipt_image === undefined)
    )
      throw Error('Máy chủ chưa hỗ trợ đối chiếu đầy đủ giao dịch.');
    return remote ? snapshotTransaction(remote) : null;
  },
  async resolve(
    userId: number,
    transactionId: number,
    revision: number,
    decision: 'LOCAL' | 'SERVER',
    remote?: TransactionSnapshot | null,
  ) {
    return withLock(userId, async () => {
      const rows = await read(userId);
      const item = rows.find(row => row.transactionId === transactionId);
      if (!item || item.revision !== revision || item.status !== 'NEEDS_REVIEW')
        throw Error('Thay đổi đã khác. Hãy mở lại trước khi quyết định.');
      if (decision === 'SERVER') {
        await write(
          userId,
          rows.filter(row => row !== item),
        );
        return;
      }
      if (!remote || remote.id !== transactionId)
        throw Error('Giao dịch trên máy chủ không còn. Không thể ghi đè.');
      item.base = remote;
      item.status = 'PENDING';
      item.revision++;
      item.updatedAt = new Date().toISOString();
      delete item.lastError;
      await write(userId, rows);
    });
  },
  preview: async (userId: number) => previewOf(await read(userId)),
  async discard(userId: number, expected: ReturnType<typeof previewOf>) {
    return withLock(userId, async () => {
      const rows = await read(userId);
      if (JSON.stringify(previewOf(rows)) !== JSON.stringify(expected))
        throw Error('Thay đổi trên máy đã đổi. Hãy xem lại trước khi bỏ.');
      await write(userId, []);
      return rows.length;
    });
  },
  async sync(
    token: string,
    userId: number,
    expected: ReturnType<typeof previewOf>,
    current: () => boolean,
  ) {
    const session = captureApiSession();
    return withLock(userId, async () => {
      const rows = await read(userId);
      if (JSON.stringify(previewOf(rows)) !== JSON.stringify(expected))
        throw Error('Thay đổi trên máy đã đổi. Hãy xem lại trước khi đồng bộ.');
      let synced = 0,
        needsReview = 0;
      for (const item of [...rows]) {
        if (!current() || !session()) break;
        if (item.status === 'NEEDS_REVIEW') {
          needsReview++;
          continue;
        }
        try {
          const response = await transactionsService.getLinkedPayments(token, [
            item.transactionId,
          ]);
          if (!current() || !session()) break;
          const remote = response.data[0];
          if (!remote && item.action === 'DELETE') {
            rows.splice(rows.indexOf(item), 1);
            synced++;
          } else if (!remote) {
            item.status = 'NEEDS_REVIEW';
            item.lastError = 'Giao dịch trên máy chủ đã bị xóa.';
            needsReview++;
          } else if (
            remote.receipt_items === undefined ||
            remote.tags === undefined ||
            remote.receipt_image === undefined
          ) {
            item.status = 'NEEDS_REVIEW';
            item.lastError = 'Máy chủ chưa hỗ trợ đối chiếu đầy đủ giao dịch.';
            needsReview++;
          } else {
            const actual = snapshotTransaction(remote);
            if (
              item.action === 'UPDATE' &&
              item.payload &&
              same(actual, snapshotWithPayload(item.base, item.payload))
            ) {
              rows.splice(rows.indexOf(item), 1);
              synced++;
            } else if (!same(actual, item.base)) {
              item.status = 'NEEDS_REVIEW';
              item.lastError =
                'Giao dịch trên máy chủ đã thay đổi. Chọn bản cần giữ sau khi xem lại.';
              needsReview++;
            } else {
              if (item.action === 'DELETE')
                await transactionsService.remove(
                  token,
                  item.transactionId,
                  item.base,
                );
              else
                await transactionsService.update(token, item.transactionId, {
                  ...item.payload!,
                  offline_expected: item.base,
                });
              rows.splice(rows.indexOf(item), 1);
              synced++;
            }
          }
        } catch (error) {
          if (
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            ![401, 403].includes(error.status)
          ) {
            item.status = 'NEEDS_REVIEW';
            item.lastError = error.message;
            needsReview++;
          } else break;
        }
        await write(userId, rows);
      }
      return {
        synced,
        pending: rows.filter(item => item.status === 'PENDING').length,
        needsReview,
      };
    });
  },
  apply(
    rows: ApiTransaction[],
    changes: OfflineTransactionChange[],
    categories: Category[] = [],
  ): ApiTransaction[] {
    const byId = new Map(changes.map(item => [item.transactionId, item]));
    return rows.flatMap(row => {
      const change = byId.get(row.id);
      if (!change) return [row];
      if (change.action === 'DELETE') return [];
      const payload = change.payload!;
      return [
        {
          ...row,
          wallet_id: payload.wallet_id,
          category_id: payload.category_id ?? row.category_id,
          category:
            categories.find(item => item.id === payload.category_id) ??
            row.category,
          amount: payload.amount,
          type: payload.type,
          note: payload.note,
          transaction_date: payload.transaction_date,
          receipt_image:
            payload.receipt_image === null ? null : row.receipt_image,
          receipt_items: payload.receipt_items,
          tags: payload.tags,
        },
      ];
    });
  },
};
