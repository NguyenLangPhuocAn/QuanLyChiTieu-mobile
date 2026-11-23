import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, getApiStorageBaseUrl } from './api';
import {
  budgetsService,
  type BudgetExpected,
  type BudgetPayload,
} from './budgets';
import type { Budget } from '../types/budget';
import type { Wallet } from '../types/wallet';
import type { Category } from '../types/category';
import { getBudgetPeriodRange, toDateKey } from '../utils/budgetPeriod';

type BudgetInput = Omit<BudgetPayload, 'client_request_id'>;
export type OfflineBudgetChange = {
  id: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  base?: BudgetExpected;
  payload?: BudgetInput;
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
  changes: OfflineBudgetChange[];
};
const key = (userId: number) =>
  `offline-budgets:v1:${getApiStorageBaseUrl()}:${userId}`;
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
      'Chưa đọc được Ngân sách trên máy. Dữ liệu vẫn được giữ nguyên.',
    );
  }
};
const write = async (userId: number, state: State) => {
  await AsyncStorage.setItem(key(userId), JSON.stringify(state));
  listeners.forEach(listener => listener());
};
const money = (value: string | number) => Number(value).toFixed(2);
export const snapshotBudget = (budget: Budget): BudgetExpected => ({
  name: budget.name.trim(),
  scope: budget.scope,
  wallet_id: budget.wallet_id,
  category_id: budget.category_id ?? null,
  limit_amount: money(budget.limit_amount),
  period: budget.period,
  start_date: new Date(budget.start_date).toISOString(),
  end_date: new Date(budget.end_date).toISOString(),
});
const same = (a: BudgetExpected, b: BudgetExpected) =>
  a.name === b.name &&
  a.scope === b.scope &&
  a.wallet_id === b.wallet_id &&
  (a.category_id ?? null) === (b.category_id ?? null) &&
  money(a.limit_amount) === money(b.limit_amount) &&
  a.period === b.period &&
  new Date(a.start_date).getTime() === new Date(b.start_date).getTime() &&
  new Date(a.end_date).getTime() === new Date(b.end_date).getTime();
const sameDesired = (actual: BudgetExpected, payload: BudgetInput) => {
  const [year, month, day] = payload.start_date
    .slice(0, 10)
    .split('-')
    .map(Number);
  const range =
    payload.period === 'CUSTOM'
      ? {
          start: payload.start_date.slice(0, 10),
          end: payload.end_date.slice(0, 10),
        }
      : getBudgetPeriodRange(payload.period, new Date(year, month - 1, day));
  return (
    actual.name === payload.name.trim() &&
    actual.scope === payload.scope &&
    actual.wallet_id === payload.wallet_id &&
    (actual.category_id ?? null) === (payload.category_id ?? null) &&
    money(actual.limit_amount) === money(payload.limit_amount) &&
    actual.period === payload.period &&
    toDateKey(new Date(actual.start_date)) === range.start &&
    toDateKey(new Date(actual.end_date)) === range.end
  );
};
const previewOf = (state: State) =>
  state.changes
    .map(item => ({ id: item.id, revision: item.revision }))
    .sort((a, b) => a.id - b.id);
const requestId = () =>
  `budget_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 16)}`;

export const offlineBudgetQueue = {
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
  apply(
    budgets: Budget[],
    changes: OfflineBudgetChange[],
    wallets: Wallet[],
    categories: Category[],
    userId: number,
  ): Budget[] {
    const result = [...budgets];
    for (const change of changes) {
      const index = result.findIndex(item => item.id === change.id);
      if (change.action === 'DELETE') {
        if (index >= 0) result.splice(index, 1);
      } else if (change.action === 'UPDATE' && change.payload && index >= 0) {
        const payload = change.payload;
        const previous = result[index];
        const limit = Number(payload.limit_amount);
        const carryOver = Number(previous.carry_over_overspent ?? 0);
        const available = Math.max(0, limit - carryOver);
        const spent = Number(previous.spent ?? 0);
        const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
        const wallet = wallets.find(w => w.id === payload.wallet_id);
        result[index] = {
          ...previous,
          ...payload,
          wallet_name: wallet?.name ?? previous.wallet_name,
          wallet_currency: wallet?.currency ?? previous.wallet_currency,
          limit_amount: limit,
          amount: limit,
          original_limit_amount: limit,
          available_limit_amount: available,
          remaining: limit - spent,
          effective_remaining: limit - carryOver - spent,
          percent,
          percentage: percent,
          effective_percent:
            available > 0 ? Math.round((spent / available) * 100) : 100,
          status:
            spent > available
              ? 'EXCEEDED'
              : spent >= available * 0.8
              ? 'WARNING'
              : 'NORMAL',
          category_name:
            categories.find(c => c.id === payload.category_id)?.name ?? null,
        };
      } else if (change.action === 'CREATE' && change.payload) {
        const payload = change.payload;
        result.unshift({
          id: change.id,
          user_id: userId,
          ...payload,
          wallet_name:
            wallets.find(w => w.id === payload.wallet_id)?.name ?? '',
          wallet_currency:
            wallets.find(w => w.id === payload.wallet_id)?.currency ?? 'VND',
          category_name:
            categories.find(c => c.id === payload.category_id)?.name ?? null,
          limit_amount: Number(payload.limit_amount),
          spent: 0,
          remaining: Number(payload.limit_amount),
          percent: 0,
          percentage: 0,
          status: 'NORMAL',
        });
      }
    }
    return result;
  },
  async create(
    userId: number,
    payload: BudgetInput,
    idempotencyKey = requestId(),
    uncertain = false,
  ) {
    return lock(userId, async () => {
      const state = await read(userId);
      const change: OfflineBudgetChange = {
        id: -Date.now() * 1000 - Math.floor(Math.random() * 1000),
        action: 'CREATE',
        payload,
        requestId: idempotencyKey,
        attempts: uncertain ? 1 : 0,
        revision: 1,
        status: 'PENDING',
        updatedAt: new Date().toISOString(),
      };
      state.changes.push(change);
      await write(userId, state);
      return change;
    });
  },
  async update(
    userId: number,
    budget: Budget,
    payload: BudgetInput,
    uncertain = false,
  ) {
    return lock(userId, async () => {
      const state = await read(userId);
      const previous = state.changes.find(item => item.id === budget.id);
      if (previous?.action === 'DELETE') throw Error('Ngân sách đang chờ xóa.');
      if (previous?.attempts)
        throw Error(
          'Ngân sách có thể đã tới máy chủ. Hãy đối chiếu trước khi sửa.',
        );
      if (budget.id < 0 && !previous)
        throw Error('Không tìm thấy Ngân sách mới trên máy.');
      const change: OfflineBudgetChange = {
        id: budget.id,
        action: budget.id < 0 ? 'CREATE' : 'UPDATE',
        base:
          budget.id < 0 ? undefined : previous?.base ?? snapshotBudget(budget),
        payload,
        requestId: previous?.requestId,
        attempts: uncertain ? 1 : 0,
        revision: (previous?.revision ?? 0) + 1,
        status: 'PENDING',
        updatedAt: new Date().toISOString(),
      };
      state.changes = [
        ...state.changes.filter(item => item.id !== budget.id),
        change,
      ];
      await write(userId, state);
      return change;
    });
  },
  async remove(userId: number, budget: Budget, uncertain = false) {
    return lock(userId, async () => {
      const state = await read(userId);
      const previous = state.changes.find(item => item.id === budget.id);
      if (previous?.attempts)
        throw Error(
          'Ngân sách có thể đã tới máy chủ. Hãy đối chiếu trước khi xóa.',
        );
      if (budget.id < 0) {
        if (!previous) throw Error('Không tìm thấy Ngân sách mới trên máy.');
        state.changes = state.changes.filter(item => item.id !== budget.id);
      } else {
        state.changes = [
          ...state.changes.filter(item => item.id !== budget.id),
          {
            id: budget.id,
            action: 'DELETE' as const,
            base: previous?.base ?? snapshotBudget(budget),
            attempts: uncertain ? 1 : 0,
            revision: (previous?.revision ?? 0) + 1,
            status: 'PENDING' as const,
            updatedAt: new Date().toISOString(),
          },
        ];
      }
      await write(userId, state);
    });
  },
  async discard(userId: number, expected: ReturnType<typeof previewOf>) {
    return lock(userId, async () => {
      const state = await read(userId);
      if (JSON.stringify(previewOf(state)) !== JSON.stringify(expected))
        throw Error('Ngân sách trên máy đã thay đổi. Hãy xem lại.');
      state.changes = [];
      await write(userId, state);
    });
  },
  async rebaseReviewed(
    token: string,
    userId: number,
    expected: ReturnType<typeof previewOf>,
    reviewed: Record<number, Budget | null>,
  ) {
    return lock(userId, async () => {
      const state = await read(userId);
      if (JSON.stringify(previewOf(state)) !== JSON.stringify(expected))
        throw Error('Ngân sách trên máy đã thay đổi. Hãy xem lại.');
      if (
        !state.changes.some(
          item => item.status === 'NEEDS_REVIEW' && item.action !== 'CREATE',
        )
      )
        return expected;
      const remote = await budgetsService.getAll(token);
      for (const change of [...state.changes]) {
        if (change.status !== 'NEEDS_REVIEW' || change.action === 'CREATE')
          continue;
        if (!Object.prototype.hasOwnProperty.call(reviewed, change.id))
          throw Error('Chưa xem bản Ngân sách trên máy chủ.');
        const before = reviewed[change.id];
        const current = remote.find(item => item.id === change.id) ?? null;
        if (
          (before === null) !== (current === null) ||
          (before &&
            current &&
            !same(snapshotBudget(before), snapshotBudget(current)))
        )
          throw Error(
            'Ngân sách trên máy chủ đã đổi sau khi xem trước. Hãy xem lại.',
          );
        if (!current) {
          if (change.action === 'DELETE')
            state.changes.splice(state.changes.indexOf(change), 1);
          continue;
        }
        change.base = snapshotBudget(current);
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
          'Ngân sách trên máy đã thay đổi. Hãy xem lại trước khi lưu.',
        );
      let synced = 0;
      for (const change of [...state.changes]) {
        if (!current()) break;
        if (change.status === 'NEEDS_REVIEW') continue;
        try {
          if (change.action === 'CREATE') {
            change.attempts++;
            await write(userId, state);
            await budgetsService.create(token, {
              ...change.payload!,
              client_request_id: change.requestId,
            });
          } else {
            const remote = (await budgetsService.getAll(token)).find(
              item => item.id === change.id,
            );
            if (!remote && change.action === 'DELETE') {
              state.changes.splice(state.changes.indexOf(change), 1);
              synced++;
              await write(userId, state);
              continue;
            }
            if (!remote)
              throw new ApiError('Ngân sách trên máy chủ không còn.', 409);
            const actual = snapshotBudget(remote);
            if (
              change.action === 'UPDATE' &&
              sameDesired(actual, change.payload!)
            ) {
              state.changes.splice(state.changes.indexOf(change), 1);
              synced++;
              await write(userId, state);
              continue;
            }
            if (!same(actual, change.base!))
              throw new ApiError('Ngân sách trên máy chủ đã thay đổi.', 409);
            change.attempts++;
            await write(userId, state);
            if (change.action === 'UPDATE')
              await budgetsService.update(token, change.id, {
                ...change.payload!,
                offline_expected: change.base,
              });
            else await budgetsService.remove(token, change.id, change.base);
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
