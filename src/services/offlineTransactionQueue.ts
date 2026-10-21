import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError } from './api';
import {
  transactionsService,
  type CreateTransactionPayload,
} from './transactions';

export type OfflineTransactionDraftStatus =
  | 'PENDING'
  | 'SYNCING'
  | 'NEEDS_REVIEW';

export type OfflineTransactionDraft = {
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
    if (!Array.isArray(value)) return [];
    return value.filter(item => {
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
  } catch {
    return [];
  }
};

const save = (userId: number, drafts: OfflineTransactionDraft[]) =>
  AsyncStorage.setItem(storageKey(userId), JSON.stringify(drafts));

export const isRetryableOfflineTransactionError = (error: unknown) =>
  !(error instanceof ApiError) || error.status === 0 || error.status >= 500;

const activeSyncByUser = new Map<number, Promise<OfflineQueueSyncResult>>();
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
): Promise<OfflineQueueSyncResult> => {
  const drafts = parseDrafts(await AsyncStorage.getItem(storageKey(userId)));
  let synced = 0;

  for (const draft of drafts) {
    if (draft.status === 'NEEDS_REVIEW') continue;
    draft.status = 'SYNCING';
    draft.updatedAt = new Date().toISOString();
    draft.attempts += 1;
    await save(userId, drafts);

    try {
      await transactionsService.create(token, draft.payload);
      const index = drafts.findIndex(item => item.id === draft.id);
      if (index >= 0) drafts.splice(index, 1);
      synced += 1;
    } catch (error) {
      draft.updatedAt = new Date().toISOString();
      draft.lastError = error instanceof Error ? error.message : 'Lỗi đồng bộ';
      draft.status = isRetryableOfflineTransactionError(error)
        ? 'PENDING'
        : 'NEEDS_REVIEW';
    }
    await save(userId, drafts);
  }

  return {
    synced,
    pending: drafts.filter(item => item.status === 'PENDING').length,
    needsReview: drafts.filter(item => item.status === 'NEEDS_REVIEW').length,
  };
};

export const offlineTransactionQueue = {
  async list(userId: number) {
    return parseDrafts(await AsyncStorage.getItem(storageKey(userId)));
  },

  async enqueue(
    userId: number,
    payload: CreateTransactionPayload & { client_request_id?: string },
  ) {
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
      const existing = drafts.find(item => item.id === requestId);
      if (existing) return existing;

      const now = new Date().toISOString();
      const bankPayload = { ...payload };
      delete bankPayload.client_request_id;
      const draft: OfflineTransactionDraft = {
        id: requestId,
        createdAt: now,
        updatedAt: now,
        status: 'PENDING',
        attempts: 0,
        payload: isBankNotification
          ? bankPayload
          : { ...payload, client_request_id: requestId },
      };
      drafts.push(draft);
      await save(userId, drafts);
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
        drafts.filter(item => item.id !== id),
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
      const draft = drafts.find(item => item.id === id);
      if (!draft) return null;
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
      const draft = drafts.find(item => item.id === id);
      if (!draft) return null;
      draft.status = 'PENDING';
      draft.lastError = undefined;
      draft.updatedAt = new Date().toISOString();
      await save(userId, drafts);
      return draft;
    });
  },

  sync(token: string, userId: number) {
    let activeSync = activeSyncByUser.get(userId);
    if (!activeSync) {
      activeSync = withUserLock(userId, () => runSync(token, userId)).finally(
        () => {
          activeSyncByUser.delete(userId);
        },
      );
      activeSyncByUser.set(userId, activeSync);
    }
    return activeSync;
  },
};
