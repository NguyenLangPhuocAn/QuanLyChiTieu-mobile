import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, getApiStorageBaseUrl } from './api';
import { loanDebtsService } from './loanDebts';
import type { LoanDebt, LoanDebtExpected } from '../types/loanDebt';

export type LoanDebtMetadata = {
  person_name: string;
  due_date: string | null;
  note: string | null;
};
export type OfflineLoanDebtChange = {
  id: number;
  base: LoanDebtExpected;
  payload: LoanDebtMetadata;
  attempts: number;
  revision: number;
  status: 'PENDING' | 'NEEDS_REVIEW';
  updatedAt: string;
  lastError?: string;
};
type State = {
  server: string;
  userId: number;
  changes: OfflineLoanDebtChange[];
};
const key = (userId: number) =>
  `offline-loan-debts:v1:${getApiStorageBaseUrl()}:${userId}`;
const blank = (userId: number): State => ({
  server: getApiStorageBaseUrl(),
  userId,
  changes: [],
});
const listeners = new Set<() => void>();
const locks = new Map<number, Promise<unknown>>();
const lock = <T>(userId: number, task: () => Promise<T>) => {
  const next = (locks.get(userId) ?? Promise.resolve())
    .catch(() => undefined)
    .then(task);
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
  if (!raw) return blank(userId);
  try {
    const state = JSON.parse(raw) as State;
    if (
      state.server !== getApiStorageBaseUrl() ||
      state.userId !== userId ||
      !Array.isArray(state.changes) ||
      state.changes.some(
        change =>
          !Number.isSafeInteger(change.id) ||
          change.id <= 0 ||
          !Number.isSafeInteger(change.revision) ||
          change.revision < 1 ||
          !change.base ||
          !change.payload ||
          !['PENDING', 'NEEDS_REVIEW'].includes(change.status),
      )
    )
      throw Error();
    return state;
  } catch {
    throw Error(
      'Chưa đọc được thay đổi Vay/Nợ trên máy. Dữ liệu vẫn được giữ nguyên.',
    );
  }
};
const write = async (userId: number, state: State) => {
  await AsyncStorage.setItem(key(userId), JSON.stringify(state));
  listeners.forEach(listener => listener());
};
const money = (value: string | number) => Number(value).toFixed(2);
export const snapshotLoanDebt = (record: LoanDebt): LoanDebtExpected => ({
  person_name: record.person_name,
  principal_amount: money(record.principal_amount),
  opening_wallet_id: record.opening_wallet_id,
  type: record.type,
  due_date: record.due_date ?? null,
  note: record.note ?? null,
  settled_amount: money(record.settled_amount),
});
const date = (value: string | null) => value?.slice(0, 10) ?? null;
const same = (a: LoanDebtExpected, b: LoanDebtExpected) =>
  a.person_name === b.person_name &&
  money(a.principal_amount) === money(b.principal_amount) &&
  a.opening_wallet_id === b.opening_wallet_id &&
  a.type === b.type &&
  date(a.due_date) === date(b.due_date) &&
  a.note === b.note &&
  money(a.settled_amount) === money(b.settled_amount);
const sameDesired = (actual: LoanDebtExpected, desired: LoanDebtMetadata) =>
  actual.person_name === desired.person_name.trim() &&
  date(actual.due_date) === date(desired.due_date) &&
  (actual.note ?? '') === (desired.note?.trim() ?? '');
const previewOf = (state: State) =>
  state.changes
    .map(change => ({ id: change.id, revision: change.revision }))
    .sort((a, b) => a.id - b.id);

export const offlineLoanDebtQueue = {
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
  apply(records: LoanDebt[], changes: OfflineLoanDebtChange[]) {
    return records.map(record => {
      const change = changes.find(item => item.id === record.id);
      if (!change) return record;
      const today = new Date();
      const dateKey = `${today.getFullYear()}-${String(
        today.getMonth() + 1,
      ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const due = date(change.payload.due_date);
      return {
        ...record,
        ...change.payload,
        status:
          record.status === 'PAID'
            ? ('PAID' as const)
            : due && due < dateKey
            ? ('OVERDUE' as const)
            : ('OPEN' as const),
      };
    });
  },
  async update(
    userId: number,
    record: LoanDebt,
    payload: LoanDebtMetadata,
    uncertain = false,
  ) {
    return lock(userId, async () => {
      const state = await read(userId);
      const previous = state.changes.find(item => item.id === record.id);
      if (previous && (previous.attempts || previous.status === 'NEEDS_REVIEW'))
        throw Error(
          'Khoản Vay/Nợ có thể đã tới máy chủ. Hãy đối chiếu trước khi sửa.',
        );
      const change: OfflineLoanDebtChange = {
        id: record.id,
        base: previous?.base ?? snapshotLoanDebt(record),
        payload,
        attempts: uncertain ? 1 : 0,
        revision: (previous?.revision ?? 0) + 1,
        status: 'PENDING',
        updatedAt: new Date().toISOString(),
      };
      state.changes = [
        ...state.changes.filter(item => item.id !== record.id),
        change,
      ];
      await write(userId, state);
      return change;
    });
  },
  async discard(userId: number, expected: ReturnType<typeof previewOf>) {
    return lock(userId, async () => {
      const state = await read(userId);
      if (JSON.stringify(previewOf(state)) !== JSON.stringify(expected))
        throw Error('Khoản Vay/Nợ trên máy đã đổi. Hãy xem lại.');
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
        throw Error('Khoản Vay/Nợ trên máy đã đổi. Hãy xem lại.');
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
    reviewed: Record<number, LoanDebt | null>,
  ) {
    return lock(userId, async () => {
      const state = await read(userId);
      if (JSON.stringify(previewOf(state)) !== JSON.stringify(expected))
        throw Error('Khoản Vay/Nợ trên máy đã đổi. Hãy xem lại.');
      if (!state.changes.some(change => change.status === 'NEEDS_REVIEW'))
        return expected;
      const remote = await loanDebtsService.getAll(token);
      for (const change of state.changes) {
        if (change.status !== 'NEEDS_REVIEW') continue;
        if (!Object.prototype.hasOwnProperty.call(reviewed, change.id))
          throw Error('Chưa xem bản Vay/Nợ trên máy chủ.');
        const before = reviewed[change.id];
        const current = remote.find(item => item.id === change.id) ?? null;
        if (
          (before === null) !== (current === null) ||
          (before &&
            current &&
            !same(snapshotLoanDebt(before), snapshotLoanDebt(current)))
        )
          throw Error('Khoản Vay/Nợ trên máy chủ đã đổi sau khi xem trước.');
        if (!current) continue;
        change.base = snapshotLoanDebt(current);
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
        throw Error('Khoản Vay/Nợ trên máy đã đổi. Hãy xem lại trước khi lưu.');
      let synced = 0;
      for (const change of [...state.changes]) {
        if (!current()) break;
        if (change.status === 'NEEDS_REVIEW') continue;
        try {
          const remote = (await loanDebtsService.getAll(token)).find(
            item => item.id === change.id,
          );
          if (!remote)
            throw new ApiError('Khoản Vay/Nợ trên máy chủ không còn.', 409);
          const actual = snapshotLoanDebt(remote);
          if (sameDesired(actual, change.payload)) {
            state.changes.splice(state.changes.indexOf(change), 1);
            synced++;
            await write(userId, state);
            continue;
          }
          if (!same(actual, change.base))
            throw new ApiError('Khoản Vay/Nợ trên máy chủ đã thay đổi.', 409);
          change.attempts++;
          await write(userId, state);
          await loanDebtsService.update(token, change.id, {
            ...change.payload,
            offline_expected: change.base,
          });
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
