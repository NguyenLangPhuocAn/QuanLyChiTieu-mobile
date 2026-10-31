import { apiRequest } from './api';
import {
  currentPlanningServer,
  planningLocalStore,
  type PlanningScope,
  type PlanningLocalState,
} from './planningLocalStore';
import {
  parsePlanningSnapshot,
  portableSnapshot,
  replacePlanningSnapshot,
  snapshotKey,
  snapshotOf,
  type PlanningSnapshot,
} from './planningSnapshot';
type Remote = {
  revision: number;
  snapshot: PlanningSnapshot | null;
  updatedAt: string | null;
};
const validUpdatedAt = (result: Remote) =>
  result.revision === 0
    ? result.updatedAt === null
    : typeof result.updatedAt === 'string' &&
      Number.isFinite(Date.parse(result.updatedAt));
export type PlanningSyncPreview = {
  local: PlanningSnapshot;
  cloud: Remote;
  expected: string;
};
const fingerprint = (state: PlanningLocalState) =>
  JSON.stringify([state.book, state.plans]);
const remote = async (token: string): Promise<Remote> => {
  const result = await apiRequest<Remote>('/planning-sync', { token });
  if (
    !result ||
    !Number.isSafeInteger(result.revision) ||
    result.revision < 0 ||
    (result.revision === 0 ? result.snapshot !== null : !result.snapshot) ||
    !validUpdatedAt(result)
  )
    throw Error('Phản hồi đồng bộ chưa hợp lệ.');
  return {
    ...result,
    snapshot:
      result.snapshot === null
        ? null
        : portableSnapshot(parsePlanningSnapshot(result.snapshot)),
  };
};
const inflight = new Map<string, Promise<void>>();
const ack = (
  scope: PlanningScope,
  cloud: Remote,
  baseline: string,
  current: () => boolean,
  expectedSync?: string,
) =>
  planningLocalStore.update(
    scope,
    state => {
      if (
        expectedSync !== undefined &&
        JSON.stringify(state.sync) !== expectedSync
      )
        return;
      state.sync = {
        enabled: true,
        revision: cloud.revision,
        baseline,
        updatedAt: cloud.updatedAt,
        conflict: false,
      };
    },
    current,
  );
const upload = async (
  token: string,
  revision: number,
  snapshot: PlanningSnapshot,
) => {
  const result = await apiRequest<Remote>('/planning-sync', {
    token,
    method: 'PUT',
    body: { revision, snapshot: portableSnapshot(snapshot) },
  });
  if (
    !result ||
    !Number.isSafeInteger(result.revision) ||
    result.revision <= 0 ||
    !result.snapshot ||
    !validUpdatedAt(result) ||
    snapshotKey(parsePlanningSnapshot(result.snapshot)) !==
      snapshotKey(snapshot)
  )
    throw Error('Chưa xác nhận được bản lịch đã đồng bộ. Giữ bản trên máy.');
  return result;
};
export const planningSync = {
  async preview(
    scope: PlanningScope,
    token: string,
  ): Promise<PlanningSyncPreview> {
    const state = await planningLocalStore.read(scope);
    const local = snapshotOf(state),
      cloud = await remote(token);
    if (!currentPlanningServer(scope)) throw Error('Máy chủ đã thay đổi.');
    return { local, cloud, expected: fingerprint(state) };
  },
  async confirm(
    scope: PlanningScope,
    token: string,
    preview: PlanningSyncPreview,
    source: 'local' | 'cloud',
    isCurrent: () => boolean,
  ) {
    const current = () => isCurrent() && currentPlanningServer(scope);
    if (
      !current() ||
      fingerprint(await planningLocalStore.read(scope)) !== preview.expected
    )
      throw Error('Lịch trên máy đã thay đổi. Hãy xem trước lại.');
    if (source === 'local') {
      const cloud = await upload(token, preview.cloud.revision, preview.local);
      await ack(scope, cloud, snapshotKey(preview.local), current);
    } else {
      const cloud = await remote(token);
      if (!cloud.snapshot || cloud.revision !== preview.cloud.revision)
        throw Error('Bản lịch tài khoản đã đổi. Hãy xem trước lại.');
      await planningLocalStore.update(
        scope,
        state => {
          if (fingerprint(state) !== preview.expected)
            throw Error('Lịch trên máy đã thay đổi. Hãy xem trước lại.');
          replacePlanningSnapshot(state, cloud.snapshot!, true);
          state.sync = {
            enabled: true,
            revision: cloud.revision,
            baseline: snapshotKey(cloud.snapshot!),
            updatedAt: cloud.updatedAt,
            conflict: false,
          };
        },
        current,
      );
    }
  },
  async disable(scope: PlanningScope) {
    await planningLocalStore.update(scope, state => {
      state.sync.enabled = false;
    });
  },
  sync(
    scope: PlanningScope,
    token: string,
    isCurrent: () => boolean,
  ): Promise<void> {
    const key = `${scope.server}:${scope.userId}`;
    const existing = inflight.get(key);
    if (existing) return existing;
    const current = () => isCurrent() && currentPlanningServer(scope);
    const run = (async () => {
      const state = await planningLocalStore.read(scope);
      if (!state.sync.enabled || state.sync.conflict || !current()) return;
      const local = snapshotOf(state),
        own = snapshotKey(local);
      const cloud = await remote(token);
      const expectedSync = JSON.stringify(state.sync);
      if (
        !current() ||
        JSON.stringify((await planningLocalStore.read(scope)).sync) !==
          expectedSync
      )
        return;
      const theirs = cloud.snapshot ? snapshotKey(cloud.snapshot) : null;
      if (own === theirs) {
        await ack(scope, cloud, own, current, expectedSync);
        return;
      }
      if (theirs === state.sync.baseline) {
        const saved = await upload(token, cloud.revision, local);
        await ack(scope, saved, own, current, expectedSync);
      } else if (own === state.sync.baseline && cloud.snapshot) {
        await planningLocalStore.update(
          scope,
          now => {
            if (JSON.stringify(now.sync) !== expectedSync) return;
            if (fingerprint(now) !== fingerprint(state)) return;
            replacePlanningSnapshot(now, cloud.snapshot!, true);
            now.sync = {
              enabled: true,
              revision: cloud.revision,
              baseline: theirs,
              updatedAt: cloud.updatedAt,
              conflict: false,
            };
          },
          current,
        );
      } else {
        await planningLocalStore.update(
          scope,
          now => {
            if (JSON.stringify(now.sync) === expectedSync)
              now.sync.conflict = true;
          },
          current,
        );
      }
    })();
    inflight.set(key, run);
    run
      .finally(() => {
        if (inflight.get(key) === run) inflight.delete(key);
      })
      .catch(() => undefined);
    return run;
  },
};
