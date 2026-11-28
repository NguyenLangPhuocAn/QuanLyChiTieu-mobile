import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, getApiStorageBaseUrl } from './api';
import { loanDebtsService } from './loanDebts';
import { walletsService } from './wallets';
import { offlineWalletQueue } from './offlineWalletQueue';
import type { CreateLoanDebtPayload } from '../types/loanDebt';
import type { Wallet } from '../types/wallet';

type LoanCreatePayload = CreateLoanDebtPayload & { client_request_id: string };
export type OfflineLoanCreate = {
  id: string;
  payload: LoanCreatePayload;
  wallet: { id: number; name: string; currency: string; balance: string };
  attempts: number;
  revision: number;
  status: 'PENDING' | 'NEEDS_REVIEW';
  updatedAt: string;
  lastError?: string;
};
type State = { server: string; userId: number; items: OfflineLoanCreate[] };
const key = (userId: number) =>
  `offline-loan-create:v1:${getApiStorageBaseUrl()}:${userId}`;
const empty = (userId: number): State => ({
  server: getApiStorageBaseUrl(),
  userId,
  items: [],
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
  const raw = await AsyncStorage.getItem(key(userId));
  if (!raw) return empty(userId);
  try {
    const state = JSON.parse(raw) as State;
    if (
      state.server !== getApiStorageBaseUrl() ||
      state.userId !== userId ||
      !Array.isArray(state.items) ||
      state.items.some(
        item =>
          item.id !== item.payload?.client_request_id ||
          !/^[a-zA-Z0-9_-]{16,64}$/.test(item.id) ||
          !Number.isSafeInteger(item.revision) ||
          item.revision < 1 ||
          !Number.isSafeInteger(item.attempts) ||
          item.attempts < 0 ||
          !['PENDING', 'NEEDS_REVIEW'].includes(item.status) ||
          !Number.isSafeInteger(item.wallet?.id) ||
          item.wallet.id <= 0 ||
          item.wallet.id !== item.payload.wallet_id ||
          !['BORROWED', 'LENT'].includes(item.payload.type) ||
          !Number.isFinite(Number(item.payload.principal_amount)) ||
          Number(item.payload.principal_amount) <= 0 ||
          !item.payload.person_name?.trim(),
      )
    )
      throw Error();
    return state;
  } catch {
    throw Error(
      'Chưa đọc được khoản Vay/Nợ chờ trên máy. Dữ liệu vẫn được giữ nguyên.',
    );
  }
};
const write = async (userId: number, state: State) => {
  await AsyncStorage.setItem(key(userId), JSON.stringify(state));
  listeners.forEach(listener => listener());
};
const previewOf = (state: State) =>
  state.items.map(item => ({ id: item.id, revision: item.revision }));
const fingerprint = (payload: LoanCreatePayload) =>
  JSON.stringify({
    ...payload,
    person_name: payload.person_name.trim(),
    principal_amount: Number(payload.principal_amount).toFixed(2),
    note: payload.note?.trim() || null,
  });
export const offlineLoanCreateQueue = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  async list(userId: number) {
    return (await read(userId)).items;
  },
  async preview(userId: number) {
    return previewOf(await read(userId));
  },
  async enqueue(
    userId: number,
    payload: LoanCreatePayload,
    wallet: Wallet,
    attempted = false,
  ) {
    return lock(userId, async () => {
      const state = await read(userId);
      if (
        !Number.isSafeInteger(wallet.id) ||
        wallet.id <= 0 ||
        wallet.wallet_type === 'SAVINGS' ||
        wallet.id !== payload.wallet_id
      )
        throw Error('Chọn ví thường đã đồng bộ trước khi lưu Vay/Nợ trên máy.');
      if (
        !Number.isFinite(Number(payload.principal_amount)) ||
        !(Number(payload.principal_amount) > 0) ||
        !payload.person_name.trim() ||
        !['BORROWED', 'LENT'].includes(payload.type) ||
        !/^[a-zA-Z0-9_-]{16,64}$/.test(payload.client_request_id)
      )
        throw Error('Thông tin Vay/Nợ chưa hợp lệ.');
      if (
        (await offlineWalletQueue.list(userId)).some(
          item => item.id === wallet.id && item.action === 'DELETE',
        )
      )
        throw Error('Ví này đang chờ xóa. Chọn ví khác trước khi lưu.');
      const existing = state.items.find(
        item => item.id === payload.client_request_id,
      );
      if (existing) {
        if (fingerprint(existing.payload) !== fingerprint(payload))
          throw new ApiError(
            'Khoản Vay/Nợ chờ có nội dung khác. Hãy kiểm tra lại.',
            409,
          );
        return existing;
      }
      const item: OfflineLoanCreate = {
        id: payload.client_request_id,
        payload,
        wallet: {
          id: wallet.id,
          name: wallet.name,
          currency: wallet.currency,
          balance: String(wallet.balance ?? 0),
        },
        attempts: attempted ? 1 : 0,
        revision: 1,
        status: 'PENDING',
        updatedAt: new Date().toISOString(),
      };
      state.items.push(item);
      await write(userId, state);
      return item;
    });
  },
  async discard(userId: number, expected: ReturnType<typeof previewOf>) {
    return lock(userId, async () => {
      const state = await read(userId);
      if (JSON.stringify(previewOf(state)) !== JSON.stringify(expected))
        throw Error('Khoản Vay/Nợ chờ đã thay đổi. Hãy xem lại.');
      state.items = [];
      await write(userId, state);
    });
  },
  // Keep only the reviewed items the user selected; every other pending
  // change in this queue is removed from the device.
  async discardExcept(
    userId: number,
    expected: ReturnType<typeof previewOf>,
    keep: string[],
  ) {
    return lock(userId, async () => {
      const state = await read(userId);
      if (JSON.stringify(previewOf(state)) !== JSON.stringify(expected))
        throw Error('Khoản Vay/Nợ chờ đã thay đổi. Hãy xem lại.');
      const keepIds = new Set(keep);
      state.items = state.items.filter(item => keepIds.has(item.id));
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
        throw Error('Khoản Vay/Nợ chờ đã đổi. Hãy xem lại.');
      if (!state.items.some(item => item.status === 'NEEDS_REVIEW'))
        return expected;
      const current = await walletsService.getAll(token);
      for (const item of state.items) {
        if (item.status !== 'NEEDS_REVIEW') continue;
        if (!Object.prototype.hasOwnProperty.call(reviewed, item.wallet.id))
          throw Error('Chưa xem ví thanh toán trên máy chủ.');
        const before = reviewed[item.wallet.id];
        const now =
          current.find(wallet => wallet.id === item.wallet.id) ?? null;
        if (
          (before === null) !== (now === null) ||
          (before &&
            now &&
            (before.currency !== now.currency ||
              Number(before.balance) !== Number(now.balance)))
        )
          throw Error('Ví thanh toán đã đổi sau khi xem trước.');
        if (!now) continue;
        item.status = 'PENDING';
        item.lastError = undefined;
        item.revision++;
      }
      await write(userId, state);
      return previewOf(state);
    });
  },
  async sync(
    token: string,
    userId: number,
    expected: ReturnType<typeof previewOf>,
    reviewed: Record<number, Wallet | null>,
    current: () => boolean,
  ) {
    return lock(userId, async () => {
      const state = await read(userId);
      if (JSON.stringify(previewOf(state)) !== JSON.stringify(expected))
        throw Error('Khoản Vay/Nợ chờ đã thay đổi. Hãy xem lại trước khi gửi.');
      let synced = 0;
      for (const item of [...state.items]) {
        if (!current()) break;
        if (item.status === 'NEEDS_REVIEW') continue;
        try {
          const wallet = (await walletsService.getAll(token)).find(
            row => row.id === item.wallet.id,
          );
          if (
            !wallet ||
            wallet.currency !== item.wallet.currency ||
            wallet.wallet_type === 'SAVINGS'
          )
            throw new ApiError(
              'Ví thanh toán đã đổi hoặc không còn. Hãy kiểm tra trước khi gửi.',
              409,
            );
          const shown = reviewed[item.wallet.id];
          if (
            !shown ||
            shown.currency !== wallet.currency ||
            Number(shown.balance) !== Number(wallet.balance)
          )
            throw new ApiError(
              'Số dư ví đã đổi sau khi xem trước. Hãy kiểm tra lại trước khi gửi.',
              409,
            );
          if (!current()) break;
          item.attempts++;
          await write(userId, state);
          // The backend resolves repeat requests using this persisted key, even after a lost reply.
          await loanDebtsService.createQuickEntry(token, item.payload);
          state.items.splice(state.items.indexOf(item), 1);
          synced++;
          await write(userId, state);
        } catch (error) {
          if (
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            ![401, 403].includes(error.status)
          ) {
            item.status = 'NEEDS_REVIEW';
            item.lastError = error.message;
            item.revision++;
            await write(userId, state);
          }
          break;
        }
      }
      return {
        synced,
        pending: state.items.filter(item => item.status === 'PENDING').length,
        needsReview: state.items.filter(item => item.status === 'NEEDS_REVIEW')
          .length,
      };
    });
  },
};
