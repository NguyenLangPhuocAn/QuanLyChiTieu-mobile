import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, getApiStorageBaseUrl } from './api';
import {
  savingsService,
  type SavingsGoalExpected,
  type SavingsGoalUpdate,
} from './savings';
import type { SavingsGoal } from '../types/savings';

export type OfflineSavingsGoalChange = {
  id: number;
  base: SavingsGoalExpected;
  payload: SavingsGoalUpdate;
  attempts: number;
  revision: number;
  status: 'PENDING' | 'NEEDS_REVIEW';
  updatedAt: string;
  lastError?: string;
};
type State = {
  server: string;
  userId: number;
  changes: OfflineSavingsGoalChange[];
};
const key = (userId: number) =>
  `offline-savings-goals:v1:${getApiStorageBaseUrl()}:${userId}`;
const empty = (userId: number): State => ({
  server: getApiStorageBaseUrl(),
  userId,
  changes: [],
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
      !Array.isArray(state.changes) ||
      state.changes.some(
        item =>
          !Number.isSafeInteger(item.id) ||
          item.id <= 0 ||
          !Number.isSafeInteger(item.revision) ||
          item.revision < 1 ||
          !item.base ||
          !item.payload ||
          !['PENDING', 'NEEDS_REVIEW'].includes(item.status),
      )
    )
      throw Error();
    return state;
  } catch {
    throw Error(
      'Chưa đọc được Mục tiêu tiết kiệm trên máy. Dữ liệu vẫn được giữ nguyên.',
    );
  }
};
const write = async (userId: number, state: State) => {
  await AsyncStorage.setItem(key(userId), JSON.stringify(state));
  listeners.forEach(listener => listener());
};
const money = (value: string | number) => Number(value).toFixed(2);
export const snapshotSavingsGoal = (
  goal: SavingsGoal,
): SavingsGoalExpected => ({
  name: goal.name,
  target_amount: money(goal.target_amount),
  target_date: goal.target_date ?? null,
  note: goal.note ?? null,
  status: goal.status,
});
const same = (left: SavingsGoalExpected, right: SavingsGoalExpected) =>
  left.name === right.name &&
  money(left.target_amount) === money(right.target_amount) &&
  (left.target_date ?? null) === (right.target_date ?? null) &&
  (left.note ?? null) === (right.note ?? null) &&
  left.status === right.status;
const sameDesired = (actual: SavingsGoalExpected, desired: SavingsGoalUpdate) =>
  actual.name === desired.name.trim() &&
  money(actual.target_amount) === money(desired.target_amount) &&
  (actual.target_date?.slice(0, 10) ?? null) ===
    (desired.target_date?.slice(0, 10) ?? null) &&
  (actual.note ?? '') === (desired.note?.trim() ?? '');
const previewOf = (state: State) =>
  state.changes
    .map(item => ({ id: item.id, revision: item.revision }))
    .sort((a, b) => a.id - b.id);

export const offlineSavingsGoalQueue = {
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
  apply(goals: SavingsGoal[], changes: OfflineSavingsGoalChange[]) {
    return goals.map(goal => {
      const change = changes.find(item => item.id === goal.id);
      if (!change) return goal;
      const target = Number(change.payload.target_amount);
      const current = Number(goal.current_amount);
      return {
        ...goal,
        ...change.payload,
        target_amount: target,
        remaining_amount: Math.max(0, target - current),
        progress_percent: Math.min(100, Math.round((current / target) * 100)),
        status: current >= target ? 'COMPLETED' : 'ACTIVE',
      } satisfies SavingsGoal;
    });
  },
  async update(
    userId: number,
    goal: SavingsGoal,
    payload: SavingsGoalUpdate,
    uncertain = false,
  ) {
    return lock(userId, async () => {
      const state = await read(userId);
      const previous = state.changes.find(item => item.id === goal.id);
      if (previous?.attempts)
        throw Error(
          'Mục tiêu có thể đã tới máy chủ. Hãy đối chiếu trước khi sửa.',
        );
      const change: OfflineSavingsGoalChange = {
        id: goal.id,
        base: previous?.base ?? snapshotSavingsGoal(goal),
        payload,
        attempts: uncertain ? 1 : 0,
        revision: (previous?.revision ?? 0) + 1,
        status: 'PENDING',
        updatedAt: new Date().toISOString(),
      };
      state.changes = [
        ...state.changes.filter(item => item.id !== goal.id),
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
        throw Error('Mục tiêu trên máy đã thay đổi. Hãy xem lại.');
      state.changes = [];
      await write(userId, state);
    });
  },
  async rebaseReviewed(
    token: string,
    userId: number,
    expected: ReturnType<typeof previewOf>,
    reviewed: Record<number, SavingsGoal | null>,
  ) {
    return lock(userId, async () => {
      const state = await read(userId);
      if (JSON.stringify(previewOf(state)) !== JSON.stringify(expected))
        throw Error('Mục tiêu trên máy đã thay đổi. Hãy xem lại.');
      const remote = await savingsService.getAll(token);
      for (const change of state.changes) {
        if (change.status !== 'NEEDS_REVIEW') continue;
        if (!Object.prototype.hasOwnProperty.call(reviewed, change.id))
          throw Error('Chưa xem bản Mục tiêu trên máy chủ.');
        const before = reviewed[change.id];
        const current = remote.find(item => item.id === change.id) ?? null;
        if (
          (before === null) !== (current === null) ||
          (before &&
            current &&
            !same(snapshotSavingsGoal(before), snapshotSavingsGoal(current)))
        )
          throw Error('Mục tiêu trên máy chủ đã đổi sau khi xem trước.');
        if (!current) continue;
        change.base = snapshotSavingsGoal(current);
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
        throw Error(
          'Mục tiêu trên máy đã thay đổi. Hãy xem lại trước khi lưu.',
        );
      let synced = 0;
      for (const change of [...state.changes]) {
        if (!current()) break;
        if (change.status === 'NEEDS_REVIEW') continue;
        try {
          const remote = (await savingsService.getAll(token)).find(
            item => item.id === change.id,
          );
          if (!remote)
            throw new ApiError('Mục tiêu trên máy chủ không còn.', 409);
          const actual = snapshotSavingsGoal(remote);
          if (sameDesired(actual, change.payload)) {
            state.changes.splice(state.changes.indexOf(change), 1);
            synced++;
            await write(userId, state);
            continue;
          }
          if (!same(actual, change.base))
            throw new ApiError('Mục tiêu trên máy chủ đã thay đổi.', 409);
          change.attempts++;
          await write(userId, state);
          await savingsService.update(token, change.id, {
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
