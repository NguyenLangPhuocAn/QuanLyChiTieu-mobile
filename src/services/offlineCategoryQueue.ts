import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, getApiStorageBaseUrl } from './api';
import { categoriesService } from './categories';
import type {
  ApiCategoryCashFlowGroup,
  ApiCategoryType,
  Category,
} from '../types/category';

export type CategoryPayload = {
  name: string;
  type: ApiCategoryType;
  cash_flow_group: ApiCategoryCashFlowGroup;
};
export type CategorySnapshot = CategoryPayload & { icon: string | null };
export type OfflineCategoryChange = {
  id: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  base?: CategorySnapshot;
  payload?: CategoryPayload;
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
  changes: OfflineCategoryChange[];
  idMap: Record<string, number>;
};
const key = (userId: number) =>
  `offline-categories:v1:${getApiStorageBaseUrl()}:${userId}`;
const blank = (userId: number): State => ({
  server: getApiStorageBaseUrl(),
  userId,
  changes: [],
  idMap: {},
});
const locks = new Map<number, Promise<unknown>>();
const listeners = new Set<() => void>();
const lock = <T>(userId: number, operation: () => Promise<T>) => {
  const next = (locks.get(userId) ?? Promise.resolve())
    .catch(() => undefined)
    .then(operation);
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
      !state.idMap ||
      typeof state.idMap !== 'object' ||
      state.changes.some(
        change =>
          !Number.isSafeInteger(change.id) ||
          !Number.isSafeInteger(change.revision) ||
          change.revision < 1 ||
          !['CREATE', 'UPDATE', 'DELETE'].includes(change.action) ||
          !['PENDING', 'NEEDS_REVIEW'].includes(change.status) ||
          (change.action === 'CREATE' &&
            (change.id >= 0 || !change.requestId || !change.payload)) ||
          (change.action === 'UPDATE' && (!change.base || !change.payload)) ||
          (change.action === 'DELETE' && !change.base),
      )
    )
      throw Error();
    return state;
  } catch {
    throw Error(
      'Chưa đọc được thay đổi Danh mục trên máy. Dữ liệu vẫn được giữ nguyên.',
    );
  }
};
const write = async (userId: number, state: State) => {
  await AsyncStorage.setItem(key(userId), JSON.stringify(state));
  listeners.forEach(listener => listener());
};
export const snapshotCategory = (category: Category): CategorySnapshot => ({
  name: category.name.trim().toLowerCase(),
  type: category.type,
  cash_flow_group: category.cash_flow_group ?? 'NORMAL',
  icon: category.icon ?? null,
});
const same = (a: CategorySnapshot, b: CategorySnapshot) =>
  a.name === b.name &&
  a.type === b.type &&
  a.cash_flow_group === b.cash_flow_group &&
  a.icon === b.icon;
const withPayload = (base: CategorySnapshot, payload: CategoryPayload) => ({
  ...base,
  name: payload.name.trim().toLowerCase(),
  type: payload.type,
  cash_flow_group: payload.cash_flow_group,
});
const previewOf = (state: State) =>
  state.changes
    .map(item => ({ id: item.id, revision: item.revision }))
    .sort((a, b) => a.id - b.id);
const makeRequestId = () =>
  `category_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 16)}`;

// A category must not disappear while another pending change still points at
// it: the sync would never resolve its id and the queue would stay stuck.
const ensureNotUsedByPendingChanges = async (
  userId: number,
  categoryId: number,
) => {
  const editsRaw = await AsyncStorage.getItem(
    `offline-transaction-changes:v1:${getApiStorageBaseUrl()}:${userId}`,
  );
  if (editsRaw) {
    let edits: Array<{ payload?: { category_id?: number } }>;
    try {
      const parsed: unknown = JSON.parse(editsRaw);
      if (!Array.isArray(parsed)) throw Error();
      edits = parsed;
    } catch {
      throw Error(
        'Chưa đọc được giao dịch sửa trên máy. Không thể xóa danh mục an toàn.',
      );
    }
    if (edits.some(item => item.payload?.category_id === categoryId))
      throw Error(
        'Danh mục đang được dùng bởi giao dịch sửa chờ đồng bộ. Hãy sửa giao dịch đó trước.',
      );
  }
  const budgetsRaw = await AsyncStorage.getItem(
    `offline-budgets:v1:${getApiStorageBaseUrl()}:${userId}`,
  );
  if (budgetsRaw) {
    let budgets: Array<{
      action?: string;
      payload?: { category_id?: number | null };
    }>;
    try {
      const parsed = JSON.parse(budgetsRaw) as { changes?: unknown };
      if (!Array.isArray(parsed?.changes)) throw Error();
      budgets = parsed.changes;
    } catch {
      throw Error(
        'Chưa đọc được ngân sách trên máy. Không thể xóa danh mục an toàn.',
      );
    }
    if (
      budgets.some(
        item =>
          item.action !== 'DELETE' && item.payload?.category_id === categoryId,
      )
    )
      throw Error(
        'Danh mục đang được dùng bởi ngân sách chờ đồng bộ. Hãy sửa ngân sách đó trước.',
      );
  }
};

export const offlineCategoryQueue = {
  createRequestId: makeRequestId,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  async list(userId: number) {
    return (await read(userId)).changes;
  },
  async preview(userId: number) {
    return previewOf(await read(userId));
  },
  async resolveId(userId: number, categoryId: number) {
    if (categoryId > 0) return categoryId;
    return (await read(userId)).idMap[String(categoryId)] ?? null;
  },
  async resolvedIds(userId: number) {
    return { ...(await read(userId)).idMap };
  },
  apply(categories: Category[], changes: OfflineCategoryChange[]): Category[] {
    const visible = [...categories];
    for (const change of changes) {
      if (change.action === 'DELETE') {
        const index = visible.findIndex(item => item.id === change.id);
        if (index >= 0) visible.splice(index, 1);
      } else if (change.action === 'UPDATE' && change.payload) {
        const index = visible.findIndex(item => item.id === change.id);
        if (index >= 0)
          visible[index] = { ...visible[index], ...change.payload };
      } else if (change.action === 'CREATE' && change.payload) {
        visible.unshift({
          id: change.id,
          user_id: null,
          is_system: false,
          icon: null,
          ...change.payload,
        });
      }
    }
    return visible;
  },
  async create(
    userId: number,
    payload: CategoryPayload,
    requestId = makeRequestId(),
  ) {
    return lock(userId, async () => {
      const state = await read(userId);
      const id = -Date.now() * 1000 - Math.floor(Math.random() * 1000);
      const change: OfflineCategoryChange = {
        id,
        action: 'CREATE',
        payload,
        requestId,
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
  async update(userId: number, category: Category, payload: CategoryPayload) {
    return lock(userId, async () => {
      const state = await read(userId);
      const previous = state.changes.find(item => item.id === category.id);
      if (previous?.action === 'DELETE')
        throw Error('Danh mục đang chờ xóa. Hãy đối chiếu trước khi sửa.');
      if (previous?.attempts)
        throw Error(
          'Danh mục có thể đã tới máy chủ. Hãy đối chiếu trước khi sửa.',
        );
      const change: OfflineCategoryChange = {
        id: category.id,
        action: category.id < 0 ? 'CREATE' : 'UPDATE',
        base:
          category.id < 0
            ? undefined
            : previous?.base ?? snapshotCategory(category),
        payload,
        requestId: previous?.requestId,
        attempts: 0,
        revision: (previous?.revision ?? 0) + 1,
        status: 'PENDING',
        updatedAt: new Date().toISOString(),
      };
      if (category.id < 0 && !previous)
        throw Error('Không tìm thấy danh mục mới trên máy.');
      state.changes = [
        ...state.changes.filter(item => item.id !== category.id),
        change,
      ];
      await write(userId, state);
      return change;
    });
  },
  async remove(userId: number, category: Category) {
    return lock(userId, async () => {
      await ensureNotUsedByPendingChanges(userId, category.id);
      const rawDrafts = await AsyncStorage.getItem(
        `quan_ly_chi_tieu_offline_transactions_v1_${userId}`,
      );
      if (rawDrafts) {
        let drafts: Array<{
          server?: string;
          payload?: { category_id?: number };
        }>;
        try {
          const parsed: unknown = JSON.parse(rawDrafts);
          if (!Array.isArray(parsed)) throw Error();
          drafts = parsed;
        } catch {
          throw Error(
            'Chưa đọc được giao dịch trên máy. Không thể xóa danh mục an toàn.',
          );
        }
        if (
          drafts.some(
            item =>
              item.server === getApiStorageBaseUrl() &&
              item.payload?.category_id === category.id,
          )
        )
          throw Error(
            'Danh mục đang được dùng bởi giao dịch chờ đồng bộ. Hãy sửa giao dịch đó trước.',
          );
      }
      const state = await read(userId);
      const previous = state.changes.find(item => item.id === category.id);
      if (previous?.attempts)
        throw Error(
          'Danh mục có thể đã tới máy chủ. Hãy đối chiếu trước khi xóa.',
        );
      if (category.id < 0) {
        if (!previous) throw Error('Không tìm thấy danh mục mới trên máy.');
        state.changes = state.changes.filter(item => item.id !== category.id);
      } else {
        state.changes = [
          ...state.changes.filter(item => item.id !== category.id),
          {
            id: category.id,
            action: 'DELETE',
            base: previous?.base ?? snapshotCategory(category),
            attempts: 0,
            revision: (previous?.revision ?? 0) + 1,
            status: 'PENDING',
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
        throw Error('Danh mục trên máy đã thay đổi. Hãy xem lại.');
      state.changes = [];
      await write(userId, state);
    });
  },
  async rebaseReviewed(
    token: string,
    userId: number,
    expected: ReturnType<typeof previewOf>,
    reviewedRemote: Record<number, Category | null>,
  ) {
    return lock(userId, async () => {
      const state = await read(userId);
      if (JSON.stringify(previewOf(state)) !== JSON.stringify(expected))
        throw Error('Danh mục trên máy đã thay đổi. Hãy xem lại.');
      if (
        !state.changes.some(
          item => item.status === 'NEEDS_REVIEW' && item.action !== 'CREATE',
        )
      )
        return expected;
      const remote = await categoriesService.getAll(token);
      for (const change of [...state.changes]) {
        if (change.status !== 'NEEDS_REVIEW' || change.action === 'CREATE')
          continue;
        if (!Object.prototype.hasOwnProperty.call(reviewedRemote, change.id))
          throw Error('Chưa xem bản danh mục trên máy chủ.');
        const before = reviewedRemote[change.id];
        const current = remote.find(item => item.id === change.id) ?? null;
        if (
          (before === null) !== (current === null) ||
          (before &&
            current &&
            !same(snapshotCategory(before), snapshotCategory(current)))
        )
          throw Error(
            'Danh mục trên máy chủ đã đổi sau khi xem trước. Hãy xem lại.',
          );
        if (!current) {
          if (change.action === 'DELETE')
            state.changes.splice(state.changes.indexOf(change), 1);
          continue;
        }
        change.base = snapshotCategory(current);
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
          'Danh mục trên máy đã thay đổi. Hãy xem lại trước khi lưu.',
        );
      let synced = 0;
      for (const change of [...state.changes]) {
        if (!current()) break;
        if (change.status === 'NEEDS_REVIEW') continue;
        try {
          if (change.action === 'CREATE') {
            change.attempts++;
            await write(userId, state);
            const saved = await categoriesService.create(token, {
              ...change.payload!,
              client_request_id: change.requestId,
            });
            state.idMap[String(change.id)] = saved.id;
            await write(userId, state);
          } else {
            const remote = (await categoriesService.getAll(token)).find(
              item => item.id === change.id,
            );
            if (!remote && change.action === 'DELETE') {
              state.changes.splice(state.changes.indexOf(change), 1);
              synced++;
              await write(userId, state);
              continue;
            }
            if (!remote) throw Error('Danh mục trên máy chủ không còn.');
            const actual = snapshotCategory(remote);
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
              throw new ApiError('Danh mục trên máy chủ đã thay đổi.', 409);
            change.attempts++;
            await write(userId, state);
            if (change.action === 'UPDATE')
              await categoriesService.update(token, change.id, {
                ...change.payload!,
                offline_expected: change.base,
              });
            else await categoriesService.remove(token, change.id, change.base);
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
