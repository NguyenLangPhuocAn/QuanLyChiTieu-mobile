import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from './api';

export type PlanningScope = { userId: number; server: string };
export type PlanningLocalState = {
  version: 1;
  book: string | null;
  plans: string | null;
  sync: {
    enabled: boolean;
    revision: number;
    baseline: string | null;
    updatedAt: string | null;
    conflict: boolean;
  };
};
export const planningStorageKey = (scope: PlanningScope) => {
  if (!Number.isSafeInteger(scope.userId) || scope.userId <= 0 || !scope.server)
    throw Error('Chưa xác định được tài khoản cho lịch.');
  return `planning-local:v1:${scope.server.replace(/\/$/, '')}:${scope.userId}`;
};
const queues = new Map<string, Promise<unknown>>();
const listeners = new Set<(scope: PlanningScope) => void>();
const read = async (scope: PlanningScope): Promise<PlanningLocalState> => {
  const raw = await AsyncStorage.getItem(planningStorageKey(scope));
  if (raw !== null) {
    try {
      const state = JSON.parse(raw) as PlanningLocalState;
      if (
        state.version !== 1 ||
        !(state.book === null || typeof state.book === 'string') ||
        !(state.plans === null || typeof state.plans === 'string') ||
        typeof state.sync.enabled !== 'boolean' ||
        !Number.isSafeInteger(state.sync.revision) ||
        state.sync.revision < 0 ||
        !(
          state.sync.baseline === null ||
          typeof state.sync.baseline === 'string'
        ) ||
        !(
          state.sync.updatedAt === null ||
          typeof state.sync.updatedAt === 'string'
        ) ||
        typeof state.sync.conflict !== 'boolean'
      )
        throw Error();
      return state;
    } catch {
      throw Error(
        'Chưa đọc được dữ liệu lịch trên máy. Dữ liệu được giữ nguyên.',
      );
    }
  }
  const [book, plans] = await Promise.all([
    AsyncStorage.getItem(
      `recurring-bills:v1:${scope.server.replace(/\/$/, '')}:${scope.userId}`,
    ),
    AsyncStorage.getItem(`money-calendar:v1:${scope.server}:${scope.userId}`),
  ]);
  return {
    version: 1,
    book,
    plans,
    sync: {
      enabled: false,
      revision: 0,
      baseline: null,
      updatedAt: null,
      conflict: false,
    },
  };
};
export const planningLocalStore = {
  async read(scope: PlanningScope) {
    await queues.get(planningStorageKey(scope));
    return read(scope);
  },
  update<T>(
    scope: PlanningScope,
    change: (state: PlanningLocalState) => T,
    current: () => boolean = () => true,
  ): Promise<T> {
    const key = planningStorageKey(scope);
    const run = (queues.get(key) ?? Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        if (!current())
          throw Error('Phiên hoặc máy chủ đã thay đổi. Hãy xem trước lại.');
        const state = await read(scope),
          before = JSON.stringify(state);
        const result = change(state);
        if (!current())
          throw Error('Phiên hoặc máy chủ đã thay đổi. Hãy xem trước lại.');
        const next = JSON.stringify(state);
        if (before !== next) {
          await AsyncStorage.setItem(key, next);
          listeners.forEach(listener => listener(scope));
        }
        return result;
      });
    queues.set(key, run);
    run
      .finally(() => {
        if (queues.get(key) === run) queues.delete(key);
      })
      .catch(() => undefined);
    return run;
  },
  subscribe(listener: (scope: PlanningScope) => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
export const currentPlanningServer = (scope: PlanningScope) =>
  scope.server.replace(/\/$/, '') === getApiBaseUrl().replace(/\/$/, '');
