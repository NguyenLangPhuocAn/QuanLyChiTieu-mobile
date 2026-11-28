import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, getApiStorageBaseUrl } from './api';
import { walletsService } from './wallets';
import type { Wallet } from '../types/wallet';
import type { WalletType } from '../constants/walletTypes';

export type WalletSnapshot = {
  name: string;
  wallet_type: WalletType;
  currency: string;
  balance: string;
};
type WalletPayload = Omit<WalletSnapshot, 'balance'> & { balance?: string };
export type OfflineWalletChange = {
  id: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  base?: WalletSnapshot;
  payload?: WalletPayload;
  requestId?: string;
  attempts: number;
  revision: number;
  status: 'PENDING' | 'NEEDS_REVIEW';
  updatedAt: string;
  lastError?: string;
};
type State = {
  server: string;
  userId: number;
  changes: OfflineWalletChange[];
  idMap: Record<string, number>;
};
const storageKey = (userId: number) =>
  `offline-wallets:v1:${getApiStorageBaseUrl()}:${userId}`;
const blank = (userId: number): State => ({
  server: getApiStorageBaseUrl(),
  userId,
  changes: [],
  idMap: {},
});
const listeners = new Set<() => void>();
const locks = new Map<number, Promise<unknown>>();
const lock = <T>(userId: number, action: () => Promise<T>) => {
  const next = (locks.get(userId) ?? Promise.resolve())
    .catch(() => undefined)
    .then(action);
  const tail = next
    .then(
      () => undefined,
      () => undefined,
    )
    .finally(() => {
      if (locks.get(userId) === tail) locks.delete(userId);
    });
  locks.set(userId, tail);
  return next;
};
const read = async (userId: number): Promise<State> => {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  if (!raw) return blank(userId);
  try {
    const state = JSON.parse(raw) as State;
    if (
      state.server !== getApiStorageBaseUrl() ||
      state.userId !== userId ||
      !Array.isArray(state.changes) ||
      !state.idMap ||
      state.changes.some(
        item =>
          !Number.isSafeInteger(item.id) ||
          !Number.isSafeInteger(item.revision) ||
          item.revision < 1 ||
          !['CREATE', 'UPDATE', 'DELETE'].includes(item.action) ||
          !['PENDING', 'NEEDS_REVIEW'].includes(item.status) ||
          (item.action === 'CREATE' &&
            (item.id >= 0 || !item.requestId || !item.payload)) ||
          (item.action === 'UPDATE' && (!item.base || !item.payload)) ||
          (item.action === 'DELETE' && !item.base),
      )
    )
      throw Error();
    return state;
  } catch {
    throw Error(
      'Chưa đọc được thay đổi Ví trên máy. Dữ liệu vẫn được giữ nguyên.',
    );
  }
};
const write = async (userId: number, state: State) => {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(state));
  listeners.forEach(listener => listener());
};
export const snapshotWallet = (wallet: Wallet): WalletSnapshot => ({
  name: wallet.name.trim(),
  wallet_type: wallet.wallet_type ?? 'CASH',
  currency: wallet.currency,
  balance: Number(wallet.balance ?? 0).toFixed(2),
});
const same = (a: WalletSnapshot, b: WalletSnapshot) =>
  a.name === b.name &&
  a.wallet_type === b.wallet_type &&
  a.currency === b.currency &&
  Number(a.balance) === Number(b.balance);
const withPayload = (
  base: WalletSnapshot,
  payload: WalletPayload,
): WalletSnapshot => ({
  ...base,
  ...payload,
  balance: payload.balance ?? base.balance,
});
const previewOf = (state: State) =>
  state.changes
    .map(item => ({
      id: item.id,
      revision: item.revision,
    }))
    .sort((a, b) => a.id - b.id);
const requestId = () =>
  `wallet_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 16)}`;
const ensureNoPendingTransaction = async (userId: number, walletId: number) => {
  const editsRaw = await AsyncStorage.getItem(
    `offline-transaction-changes:v1:${getApiStorageBaseUrl()}:${userId}`,
  );
  if (editsRaw) {
    try {
      const edits = JSON.parse(editsRaw) as Array<{
        base?: { walletId?: number };
        payload?: { wallet_id?: number };
      }>;
      if (!Array.isArray(edits)) throw Error();
      if (
        edits.some(
          item =>
            item.base?.walletId === walletId ||
            item.payload?.wallet_id === walletId,
        )
      )
        throw Error(
          'Ví đang được dùng bởi giao dịch sửa/xóa chờ đồng bộ. Hãy xử lý giao dịch trước.',
        );
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Ví đang'))
        throw error;
      throw Error(
        'Chưa đọc được giao dịch sửa/xóa trên máy. Không thể xóa ví an toàn.',
      );
    }
  }
  const raw = await AsyncStorage.getItem(
    `quan_ly_chi_tieu_offline_transactions_v1_${userId}`,
  );
  if (!raw) return;
  try {
    const drafts = JSON.parse(raw) as Array<{
      server?: string;
      payload?: { wallet_id?: number };
    }>;
    if (!Array.isArray(drafts)) throw Error();
    if (
      drafts.some(
        item =>
          item.server === getApiStorageBaseUrl() &&
          item.payload?.wallet_id === walletId,
      )
    )
      throw Error(
        'Ví đang được dùng bởi giao dịch chờ đồng bộ. Hãy xử lý giao dịch trước.',
      );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Ví đang'))
      throw error;
    throw Error('Chưa đọc được giao dịch trên máy. Không thể xóa ví an toàn.');
  }
};

export const offlineWalletQueue = {
  createRequestId: requestId,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  async list(userId: number) {
    return (await read(userId)).changes;
  },
  async preview(userId: number) {
    return previewOf(await read(userId));
  },
  async resolveId(userId: number, walletId: number) {
    if (walletId > 0) return walletId;
    return (await read(userId)).idMap[String(walletId)] ?? null;
  },
  apply(wallets: Wallet[], changes: OfflineWalletChange[]): Wallet[] {
    const result = [...wallets];
    for (const item of changes) {
      if (item.action === 'DELETE') {
        const index = result.findIndex(row => row.id === item.id);
        if (index >= 0) result.splice(index, 1);
      } else if (item.action === 'UPDATE' && item.payload) {
        const index = result.findIndex(row => row.id === item.id);
        if (index >= 0) result[index] = { ...result[index], ...item.payload };
      } else if (item.action === 'CREATE' && item.payload) {
        result.unshift({
          id: item.id,
          user_id: null,
          created_at: item.updatedAt,
          name: item.payload.name,
          wallet_type: item.payload.wallet_type,
          currency: item.payload.currency,
          balance: item.payload.balance ?? '0',
          display_balance: Number(item.payload.balance ?? 0),
          display_currency: item.payload.currency,
        });
      }
    }
    return result;
  },
  async create(
    userId: number,
    payload: WalletPayload,
    idempotencyKey = requestId(),
  ) {
    return lock(userId, async () => {
      const state = await read(userId);
      const change: OfflineWalletChange = {
        id: -Date.now() * 1000 - Math.floor(Math.random() * 1000),
        action: 'CREATE',
        payload,
        requestId: idempotencyKey,
        attempts: 0,
        revision: 1,
        status: 'PENDING',
        updatedAt: new Date().toISOString(),
      };
      state.changes.push(change);
      await write(userId, state);
      return change;
    });
  },
  async update(userId: number, wallet: Wallet, payload: WalletPayload) {
    return lock(userId, async () => {
      const state = await read(userId);
      const previous = state.changes.find(item => item.id === wallet.id);
      if (previous?.action === 'DELETE') throw Error('Ví đang chờ xóa.');
      if (previous?.attempts)
        throw Error('Ví có thể đã tới máy chủ. Hãy đối chiếu trước khi sửa.');
      if (wallet.id < 0 && !previous)
        throw Error('Không tìm thấy ví mới trên máy.');
      if (wallet.id < 0 && payload.balance === undefined)
        payload = { ...payload, balance: previous?.payload?.balance ?? '0' };
      const change: OfflineWalletChange = {
        id: wallet.id,
        action: wallet.id < 0 ? 'CREATE' : 'UPDATE',
        base:
          wallet.id < 0 ? undefined : previous?.base ?? snapshotWallet(wallet),
        payload,
        requestId: previous?.requestId,
        attempts: 0,
        revision: (previous?.revision ?? 0) + 1,
        status: 'PENDING',
        updatedAt: new Date().toISOString(),
      };
      state.changes = [
        ...state.changes.filter(item => item.id !== wallet.id),
        change,
      ];
      await write(userId, state);
      return change;
    });
  },
  async remove(userId: number, wallet: Wallet) {
    return lock(userId, async () => {
      await ensureNoPendingTransaction(userId, wallet.id);
      const state = await read(userId);
      const previous = state.changes.find(item => item.id === wallet.id);
      if (previous?.attempts)
        throw Error('Ví có thể đã tới máy chủ. Hãy đối chiếu trước khi xóa.');
      if (wallet.id < 0) {
        if (!previous) throw Error('Không tìm thấy ví mới trên máy.');
        state.changes = state.changes.filter(item => item.id !== wallet.id);
      } else
        state.changes = [
          ...state.changes.filter(item => item.id !== wallet.id),
          {
            id: wallet.id,
            action: 'DELETE' as const,
            base: previous?.base ?? snapshotWallet(wallet),
            attempts: 0,
            revision: (previous?.revision ?? 0) + 1,
            status: 'PENDING' as const,
            updatedAt: new Date().toISOString(),
          },
        ];
      await write(userId, state);
    });
  },
  async discard(userId: number, expected: ReturnType<typeof previewOf>) {
    return lock(userId, async () => {
      const state = await read(userId);
      if (JSON.stringify(previewOf(state)) !== JSON.stringify(expected))
        throw Error('Ví trên máy đã thay đổi. Hãy xem lại.');
      state.changes = [];
      await write(userId, state);
    });
  },
  // Keep only the reviewed items the user selected; every other pending
  // change in this queue is removed from the device.
  async discardExcept(
    userId: number,
    expected: ReturnType<typeof previewOf>,
    keep: number[],
  ) {
    return lock(userId, async () => {
      const state = await read(userId);
      if (JSON.stringify(previewOf(state)) !== JSON.stringify(expected))
        throw Error('Ví trên máy đã thay đổi. Hãy xem lại.');
      const keepIds = new Set(keep);
      state.changes = state.changes.filter(item => keepIds.has(item.id));
      await write(userId, state);
      return previewOf(state);
    });
  },
  async rebaseReviewed(
    token: string,
    userId: number,
    expected: ReturnType<typeof previewOf>,
    reviewed: Record<number, Wallet | null>,
  ) {
    return lock(userId, async () => {
      const state = await read(userId);
      if (JSON.stringify(previewOf(state)) !== JSON.stringify(expected))
        throw Error('Ví trên máy đã thay đổi. Hãy xem lại.');
      if (
        !state.changes.some(
          item => item.status === 'NEEDS_REVIEW' && item.action !== 'CREATE',
        )
      )
        return expected;
      const remote = await walletsService.getAll(token);
      for (const change of [...state.changes]) {
        if (change.status !== 'NEEDS_REVIEW' || change.action === 'CREATE')
          continue;
        if (!Object.prototype.hasOwnProperty.call(reviewed, change.id))
          throw Error('Chưa xem bản ví trên máy chủ.');
        const before = reviewed[change.id];
        const current = remote.find(item => item.id === change.id) ?? null;
        if (
          (before === null) !== (current === null) ||
          (before &&
            current &&
            !same(snapshotWallet(before), snapshotWallet(current)))
        )
          throw Error('Ví trên máy chủ đã đổi sau khi xem trước. Hãy xem lại.');
        if (!current) {
          if (change.action === 'DELETE')
            state.changes.splice(state.changes.indexOf(change), 1);
          continue;
        }
        change.base = snapshotWallet(current);
        change.status = 'PENDING';
        change.attempts = 0;
        change.lastError = undefined;
        change.revision++;
      }
      await write(userId, state);
      return previewOf(state);
    });
  },
  async sync(
    token: string,
    userId: number,
    expected: ReturnType<typeof previewOf>,
    current: () => boolean,
  ) {
    return lock(userId, async () => {
      const state = await read(userId);
      if (JSON.stringify(previewOf(state)) !== JSON.stringify(expected))
        throw Error('Ví trên máy đã thay đổi. Hãy xem lại trước khi lưu.');
      let synced = 0;
      for (const change of [...state.changes]) {
        if (!current()) break;
        if (change.status === 'NEEDS_REVIEW') continue;
        try {
          if (change.action === 'CREATE') {
            change.attempts++;
            await write(userId, state);
            const saved = await walletsService.create(token, {
              ...change.payload!,
              balance: change.payload?.balance ?? '0',
              client_request_id: change.requestId,
            });
            state.idMap[String(change.id)] = saved.id;
            await write(userId, state);
          } else {
            const remote = (await walletsService.getAll(token)).find(
              item => item.id === change.id,
            );
            if (!remote && change.action === 'DELETE') {
              state.changes.splice(state.changes.indexOf(change), 1);
              synced++;
              await write(userId, state);
              continue;
            }
            if (!remote) throw Error('Ví trên máy chủ không còn.');
            const actual = snapshotWallet(remote);
            if (
              change.action === 'UPDATE' &&
              same(actual, withPayload(change.base!, change.payload!))
            ) {
              state.changes.splice(state.changes.indexOf(change), 1);
              synced++;
              await write(userId, state);
              continue;
            }
            if (!same(actual, change.base!))
              throw new ApiError('Ví trên máy chủ đã thay đổi.', 409);
            change.attempts++;
            await write(userId, state);
            if (change.action === 'UPDATE')
              await walletsService.update(token, change.id, {
                ...change.payload!,
                offline_expected: change.base,
              });
            else await walletsService.remove(token, change.id, change.base);
          }
          state.changes.splice(state.changes.indexOf(change), 1);
          synced++;
          await write(userId, state);
        } catch (error) {
          if (
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            ![401, 403].includes(error.status)
          ) {
            change.status = 'NEEDS_REVIEW';
            change.lastError = error.message;
            change.revision++;
            await write(userId, state);
          }
          break;
        }
      }
      return {
        synced,
        pending: state.changes.filter(item => item.status === 'PENDING').length,
        needsReview: state.changes.filter(
          item => item.status === 'NEEDS_REVIEW',
        ).length,
      };
    });
  },
};
