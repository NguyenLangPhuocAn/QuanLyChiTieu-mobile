import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, getApiStorageBaseUrl, captureApiSession } from './api';
import {
  transactionsService,
  type CreateTransactionPayload,
} from './transactions';
import {
  offlineReceiptStore,
  type PendingReceipt,
  type ReceiptSource,
} from './offlineReceiptStore';
import { offlineCategoryQueue } from './offlineCategoryQueue';
import { offlineWalletQueue } from './offlineWalletQueue';

export type OfflineTransactionDraftStatus =
  | 'PENDING'
  | 'SYNCING'
  | 'NEEDS_REVIEW';

export type OfflineTransactionDraft = {
  server?: string;
  id: string;
  createdAt: string;
  updatedAt: string;
  status: OfflineTransactionDraftStatus;
  attempts: number;
  lastError?: string;
  rejectedByServer?: boolean;
  confirmedTransactionId?: number;
  receipt?: PendingReceipt;
  payload: CreateTransactionPayload & { client_request_id?: string };
};

export const mayHaveReachedServer = (draft: OfflineTransactionDraft) =>
  Boolean(draft.confirmedTransactionId) ||
  (draft.attempts > 0 && draft.rejectedByServer !== true);

export type OfflineQueueSyncResult = {
  synced: number;
  pending: number;
  needsReview: number;
};

const storageKey = (userId: number) =>
  `quan_ly_chi_tieu_offline_transactions_v1_${userId}`;

const generatePart = () => Math.random().toString(36).slice(2, 12);

export const createClientRequestId = () =>
  `txn_${Date.now().toString(36)}_${generatePart()}${generatePart()}`.slice(
    0,
    64,
  );

const parseDrafts = (raw: string | null): OfflineTransactionDraft[] => {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) throw new Error();
    const valid = value.filter(item => {
      if (!item || typeof item !== 'object') return false;
      const draft = item as Partial<OfflineTransactionDraft>;
      const payload = draft.payload;
      const hasClientId = Boolean(payload?.client_request_id);
      const hasBankKey = Boolean(
        payload?.source === 'BANK_NOTIFICATION' &&
          payload.source_ref &&
          /^[a-f0-9]{64}$/i.test(payload.source_ref),
      );
      return Boolean(
        draft.id &&
          (hasClientId || hasBankKey) &&
          payload?.wallet_id &&
          payload.amount &&
          payload.type,
      );
    }) as OfflineTransactionDraft[];
    if (valid.length !== value.length) throw new Error();
    return valid;
  } catch {
    throw new Error(
      'Chưa đọc được hàng chờ trên máy. Dữ liệu được giữ nguyên; không tạo bản nháp mới đè lên.',
    );
  }
};

const save = async (userId: number, drafts: OfflineTransactionDraft[]) => {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(drafts));
  listeners.forEach(listener => listener());
};

// Compare the complete JSON payload without depending on property order.
const payloadFingerprint = (payload: CreateTransactionPayload) =>
  JSON.stringify(payload, (_key, value: unknown) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
        )
      : value,
  );

export const isRetryableOfflineTransactionError = (error: unknown) =>
  !(error instanceof ApiError) || error.status === 0 || error.status >= 500;

const activeSyncByUser = new Map<number, Promise<OfflineQueueSyncResult>>();
const listeners = new Set<() => void>();
const userOperations = new Map<number, Promise<unknown>>();

const withUserLock = <T>(userId: number, operation: () => Promise<T>) => {
  const previous = userOperations.get(userId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  const queued = current
    .then(
      () => undefined,
      () => undefined,
    )
    .finally(() => {
      if (userOperations.get(userId) === queued) userOperations.delete(userId);
    });
  userOperations.set(userId, queued);
  return current;
};

const runSync = async (
  token: string,
  userId: number,
  isCurrent: () => boolean,
  expected?: Array<{ id: string; updatedAt: string }>,
): Promise<OfflineQueueSyncResult> => {
  const server = getApiStorageBaseUrl();
  const drafts = parseDrafts(await AsyncStorage.getItem(storageKey(userId)));
  if (expected) {
    const current = drafts
      .filter(item => item.server === server)
      .map(item => ({ id: item.id, updatedAt: item.updatedAt }))
      .sort((a, b) => a.id.localeCompare(b.id));
    if (
      JSON.stringify(current) !==
      JSON.stringify([...expected].sort((a, b) => a.id.localeCompare(b.id)))
    )
      throw Error('Bản trên máy đã thay đổi. Hãy xem lại trước khi đồng bộ.');
  }
  let synced = 0;

  for (const draft of drafts) {
    if (!isCurrent() || getApiStorageBaseUrl() !== server) break;
    if (draft.server !== server) continue;
    if (draft.status === 'NEEDS_REVIEW') continue;
    let payload = draft.payload;
    if (payload.category_id && payload.category_id < 0) {
      const categoryId = await offlineCategoryQueue.resolveId(
        userId,
        payload.category_id,
      );
      if (!categoryId) break;
      payload = { ...payload, category_id: categoryId };
    }
    if (draft.receipt) {
      try {
        await offlineReceiptStore.verify(userId, draft.receipt);
      } catch (error) {
        draft.status = 'NEEDS_REVIEW';
        draft.lastError =
          error instanceof Error
            ? error.message
            : 'Không đọc được ảnh hóa đơn trên máy.';
        draft.updatedAt = new Date().toISOString();
        await save(userId, drafts);
        continue;
      }
    }
    draft.status = 'SYNCING';
    draft.updatedAt = new Date().toISOString();
    draft.attempts += 1;
    draft.rejectedByServer = false;
    await save(userId, drafts);

    let completed = false;
    try {
      const transactionId =
        draft.confirmedTransactionId ??
        (await transactionsService.create(token, payload)).id;
      if (draft.receipt) {
        draft.confirmedTransactionId = transactionId;
        await save(userId, drafts);
        if (!isCurrent() || getApiStorageBaseUrl() !== server) {
          draft.status = 'PENDING';
          await save(userId, drafts);
          break;
        }
        const uploaded = await transactionsService.uploadReceipt(
          token,
          transactionId,
          offlineReceiptStore.uploadFile(draft.receipt),
        );
        if (uploaded.id !== transactionId || !uploaded.receipt_image)
          throw Error(
            'Máy chủ chưa xác nhận đã lưu ảnh hóa đơn. Ảnh vẫn giữ trên máy.',
          );
      }
      completed = true;
    } catch (error) {
      draft.updatedAt = new Date().toISOString();
      draft.lastError = error instanceof Error ? error.message : 'Lỗi đồng bộ';
      draft.rejectedByServer =
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        ![401, 403, 409].includes(error.status);
      const sessionError =
        error instanceof ApiError &&
        ([401, 403].includes(error.status) || error.code === 'SESSION_CHANGED');
      draft.status =
        isRetryableOfflineTransactionError(error) || sessionError
          ? 'PENDING'
          : 'NEEDS_REVIEW';
      if (draft.status === 'PENDING') {
        await save(userId, drafts);
        break;
      }
    }
    if (completed) {
      const index = drafts.indexOf(draft);
      if (index >= 0) drafts.splice(index, 1);
      await save(userId, drafts);
      if (draft.receipt)
        await offlineReceiptStore
          .remove(userId, draft.receipt)
          .catch(() => undefined);
      synced += 1;
    } else {
      await save(userId, drafts);
    }
  }

  return {
    synced,
    pending: drafts.filter(
      item =>
        item.server === server && ['PENDING', 'SYNCING'].includes(item.status),
    ).length,
    needsReview: drafts.filter(
      item =>
        !item.server ||
        (item.server === server && item.status === 'NEEDS_REVIEW'),
    ).length,
  };
};

export const offlineTransactionQueue = {
  isSyncing(userId: number) {
    return activeSyncByUser.has(userId);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  async list(userId: number) {
    return parseDrafts(await AsyncStorage.getItem(storageKey(userId)))
      .filter(d => !d.server || d.server === getApiStorageBaseUrl())
      .map(d =>
        d.server
          ? d
          : {
              ...d,
              status: 'NEEDS_REVIEW' as const,
              lastError:
                'Bản nháp cũ chưa xác định máy chủ. Kiểm tra rồi xác nhận thử lại.',
            },
      );
  },

  async enqueue(
    userId: number,
    payload: CreateTransactionPayload & { client_request_id?: string },
    receiptFile?: ReceiptSource | null,
    confirmedTransactionId?: number,
  ) {
    const server = getApiStorageBaseUrl();
    return withUserLock(userId, async () => {
      const drafts = parseDrafts(
        await AsyncStorage.getItem(storageKey(userId)),
      );
      const isBankNotification = Boolean(
        payload.source === 'BANK_NOTIFICATION' && payload.source_ref,
      );
      const requestId = isBankNotification
        ? `bank_${payload.source_ref}`
        : payload.client_request_id ?? createClientRequestId();
      const bankPayload = { ...payload };
      delete bankPayload.client_request_id;
      const nextPayload = isBankNotification
        ? bankPayload
        : { ...payload, client_request_id: requestId };
      const existing = drafts.find(
        item => item.id === requestId && item.server === server,
      );
      if (existing) {
        if (
          payloadFingerprint(existing.payload) !==
          payloadFingerprint(nextPayload)
        )
          throw new ApiError(
            'Bản nháp này đã có trong hàng chờ với nội dung khác. Kiểm tra hàng chờ trước khi nhập lại.',
            409,
            'OFFLINE_DRAFT_CONFLICT',
          );
        if (Boolean(existing.receipt) !== Boolean(receiptFile))
          throw Error(
            'Bản nháp này đã có trạng thái ảnh khác. Hãy kiểm tra hàng chờ.',
          );
        return existing;
      }
      if (
        (await offlineWalletQueue.list(userId)).some(
          change =>
            change.id === payload.wallet_id && change.action === 'DELETE',
        )
      )
        throw Error(
          'Ví này đang chờ xóa. Chọn ví khác hoặc đối chiếu dữ liệu trước.',
        );

      const now = new Date().toISOString();
      const receipt = receiptFile
        ? await offlineReceiptStore.stage(userId, requestId, receiptFile)
        : undefined;
      const draft: OfflineTransactionDraft = {
        server,
        id: requestId,
        createdAt: now,
        updatedAt: now,
        status: 'PENDING',
        attempts: 0,
        ...(receipt ? { receipt } : {}),
        ...(confirmedTransactionId ? { confirmedTransactionId } : {}),
        payload: nextPayload,
      };
      drafts.push(draft);
      try {
        await save(userId, drafts);
      } catch (error) {
        if (receipt)
          await offlineReceiptStore
            .remove(userId, receipt)
            .catch(() => undefined);
        throw error;
      }
      return draft;
    });
  },

  async remove(userId: number, id: string) {
    return withUserLock(userId, async () => {
      const drafts = parseDrafts(
        await AsyncStorage.getItem(storageKey(userId)),
      );
      const target = drafts.find(
        item =>
          item.id === id &&
          (!item.server || item.server === getApiStorageBaseUrl()),
      );
      if (target && mayHaveReachedServer(target))
        throw Error(
          'Giao dịch có thể đã được máy chủ ghi. Hãy kết nối và đối chiếu trước khi xóa bản nháp.',
        );
      await save(
        userId,
        drafts.filter(
          item =>
            item.id !== id ||
            (item.server && item.server !== getApiStorageBaseUrl()),
        ),
      );
      if (target?.receipt)
        await offlineReceiptStore
          .remove(userId, target.receipt)
          .catch(() => undefined);
    });
  },

  async discardLocal(
    userId: number,
    expected: Array<{ id: string; updatedAt: string }>,
  ) {
    return withUserLock(userId, async () => {
      const server = getApiStorageBaseUrl();
      const drafts = parseDrafts(
        await AsyncStorage.getItem(storageKey(userId)),
      );
      const current = drafts
        .filter(item => item.server === server)
        .map(item => ({ id: item.id, updatedAt: item.updatedAt }))
        .sort((a, b) => a.id.localeCompare(b.id));
      if (
        JSON.stringify(current) !==
        JSON.stringify([...expected].sort((a, b) => a.id.localeCompare(b.id)))
      )
        throw Error('Dữ liệu trên máy đã thay đổi. Hãy xem lại trước khi bỏ.');
      await save(
        userId,
        drafts.filter(item => item.server !== server),
      );
      for (const draft of drafts.filter(
        item => item.server === server && item.receipt,
      ))
        await offlineReceiptStore
          .remove(userId, draft.receipt!)
          .catch(() => undefined);
      return current.length;
    });
  },
  // Keep only the selected drafts for this server; the other drafts (and
  // their stored receipt images) are removed from the device.
  async discardLocalExcept(
    userId: number,
    expected: Array<{ id: string; updatedAt: string }>,
    keep: string[],
  ) {
    return withUserLock(userId, async () => {
      const server = getApiStorageBaseUrl();
      const drafts = parseDrafts(
        await AsyncStorage.getItem(storageKey(userId)),
      );
      const current = drafts
        .filter(item => item.server === server)
        .map(item => ({ id: item.id, updatedAt: item.updatedAt }))
        .sort((a, b) => a.id.localeCompare(b.id));
      if (
        JSON.stringify(current) !==
        JSON.stringify([...expected].sort((a, b) => a.id.localeCompare(b.id)))
      )
        throw Error('Dữ liệu trên máy đã thay đổi. Hãy xem lại trước khi bỏ.');
      const keepIds = new Set(keep);
      const removed = drafts.filter(
        item => item.server === server && !keepIds.has(item.id),
      );
      await save(
        userId,
        drafts.filter(item => item.server !== server || keepIds.has(item.id)),
      );
      for (const draft of removed.filter(item => item.receipt))
        await offlineReceiptStore
          .remove(userId, draft.receipt!)
          .catch(() => undefined);
      return expected.filter(item => keepIds.has(item.id));
    });
  },

  async update(
    userId: number,
    id: string,
    payload: Partial<CreateTransactionPayload>,
  ) {
    return withUserLock(userId, async () => {
      const drafts = parseDrafts(
        await AsyncStorage.getItem(storageKey(userId)),
      );
      const draft = drafts.find(
        item =>
          item.id === id &&
          (!item.server || item.server === getApiStorageBaseUrl()),
      );
      if (!draft) return null;
      if (draft.server && draft.server !== getApiStorageBaseUrl()) return null;
      if (mayHaveReachedServer(draft))
        throw Error(
          'Giao dịch có thể đã được máy chủ ghi. Hãy kết nối và đối chiếu trước khi sửa bản nháp.',
        );
      draft.server = getApiStorageBaseUrl();
      const clientRequestId = draft.payload.client_request_id;
      const updatedPayload = {
        ...draft.payload,
        ...payload,
      };
      if (
        draft.payload.source === 'BANK_NOTIFICATION' &&
        draft.payload.source_ref
      ) {
        updatedPayload.source = 'BANK_NOTIFICATION';
        updatedPayload.source_ref = draft.payload.source_ref;
        delete updatedPayload.client_request_id;
      } else {
        updatedPayload.client_request_id = clientRequestId;
      }
      draft.payload = updatedPayload;
      draft.status = 'PENDING';
      draft.attempts = 0;
      draft.lastError = undefined;
      draft.rejectedByServer = false;
      draft.updatedAt = new Date().toISOString();
      await save(userId, drafts);
      return draft;
    });
  },

  async retry(userId: number, id: string) {
    return withUserLock(userId, async () => {
      const drafts = parseDrafts(
        await AsyncStorage.getItem(storageKey(userId)),
      );
      const draft = drafts.find(
        item =>
          item.id === id &&
          (!item.server || item.server === getApiStorageBaseUrl()),
      );
      if (!draft) return null;
      if (draft.server && draft.server !== getApiStorageBaseUrl()) return null;
      draft.server = getApiStorageBaseUrl();
      draft.status = 'PENDING';
      draft.lastError = undefined;
      draft.updatedAt = new Date().toISOString();
      await save(userId, drafts);
      return draft;
    });
  },

  sync(
    token: string,
    userId: number,
    isCurrent: () => boolean = () => true,
    expected?: Array<{ id: string; updatedAt: string }>,
  ) {
    const sessionIsCurrent = captureApiSession();
    let activeSync = activeSyncByUser.get(userId);
    if (!activeSync) {
      activeSync = withUserLock(userId, () =>
        runSync(
          token,
          userId,
          () => sessionIsCurrent() && isCurrent(),
          expected,
        ),
      ).finally(() => {
        activeSyncByUser.delete(userId);
      });
      activeSyncByUser.set(userId, activeSync);
    }
    return activeSync;
  },
};
