import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, getApiBaseUrl, captureApiSession } from './api';
import {
  transactionsService,
  type CreateTransactionPayload,
} from './transactions';

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
  payload: CreateTransactionPayload & { client_request_id?: string };
};

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

const save = (userId: number, drafts: OfflineTransactionDraft[]) =>
  AsyncStorage.setItem(storageKey(userId), JSON.stringify(drafts));

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
): Promise<OfflineQueueSyncResult> => {
  const server = getApiBaseUrl();
  const drafts = parseDrafts(await AsyncStorage.getItem(storageKey(userId)));
  let synced = 0;

  for (const draft of drafts) {
    if (!isCurrent() || getApiBaseUrl() !== server) break;
    if (draft.server !== server) continue;
    if (draft.status === 'NEEDS_REVIEW') continue;
    draft.status = 'SYNCING';
    draft.updatedAt = new Date().toISOString();
    draft.attempts += 1;
    await save(userId, drafts);

    try {
      await transactionsService.create(token, draft.payload);
      const index = drafts.indexOf(draft);
      if (index >= 0) drafts.splice(index, 1);
      synced += 1;
    } catch (error) {
      draft.updatedAt = new Date().toISOString();
      draft.lastError = error instanceof Error ? error.message : 'Lỗi đồng bộ';
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
    await save(userId, drafts);
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
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  async list(userId: number) {
    return parseDrafts(await AsyncStorage.getItem(storageKey(userId)))
      .filter(d => !d.server || d.server === getApiBaseUrl())
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
  ) {
    const server = getApiBaseUrl();
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
        return existing;
      }

      const now = new Date().toISOString();
      const draft: OfflineTransactionDraft = {
        server,
        id: requestId,
        createdAt: now,
        updatedAt: now,
        status: 'PENDING',
        attempts: 0,
        payload: nextPayload,
      };
      drafts.push(draft);
      await save(userId, drafts);
      listeners.forEach(listener => listener());
      return draft;
    });
  },

  async remove(userId: number, id: string) {
    return withUserLock(userId, async () => {
      const drafts = parseDrafts(
        await AsyncStorage.getItem(storageKey(userId)),
      );
      await save(
        userId,
        drafts.filter(
          item =>
            item.id !== id || (item.server && item.server !== getApiBaseUrl()),
        ),
      );
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
          item.id === id && (!item.server || item.server === getApiBaseUrl()),
      );
      if (!draft) return null;
      if (draft.server && draft.server !== getApiBaseUrl()) return null;
      draft.server = getApiBaseUrl();
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
      draft.lastError = undefined;
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
          item.id === id && (!item.server || item.server === getApiBaseUrl()),
      );
      if (!draft) return null;
      if (draft.server && draft.server !== getApiBaseUrl()) return null;
      draft.server = getApiBaseUrl();
      draft.status = 'PENDING';
      draft.lastError = undefined;
      draft.updatedAt = new Date().toISOString();
      await save(userId, drafts);
      return draft;
    });
  },

  sync(token: string, userId: number, isCurrent: () => boolean = () => true) {
    const sessionIsCurrent = captureApiSession();
    let activeSync = activeSyncByUser.get(userId);
    if (!activeSync) {
      activeSync = withUserLock(userId, () =>
        runSync(token, userId, () => sessionIsCurrent() && isCurrent()),
      ).finally(() => {
        activeSyncByUser.delete(userId);
      });
      activeSyncByUser.set(userId, activeSync);
    }
    return activeSync;
  },
};
