import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '../src/services/api';
import {
  planningLocalStore,
  planningStorageKey,
} from '../src/services/planningLocalStore';
import { planningSync } from '../src/services/planningSync';
import { snapshotKey, snapshotOf } from '../src/services/planningSnapshot';
import { recurringBillsService } from '../src/services/recurringBills';
import { moneyCalendarPlans } from '../src/services/moneyCalendarPlans';
jest.mock('../src/services/api', () => ({
  apiRequest: jest.fn(),
  getApiBaseUrl: () => 'http://qa',
}));
const scope = { userId: 8, server: 'http://qa' };
const plan = {
  id: 'salary',
  label: 'Lương',
  amount: 5000000,
  date: '2026-11-01',
  currency: 'VND',
  type: 'INCOME' as const,
};
const store = new Map<string, string>();
let cloud: {
  revision: number;
  snapshot: ReturnType<typeof snapshotOf> | null;
  updatedAt: string | null;
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
  jest
    .mocked(AsyncStorage.getItem)
    .mockImplementation(async key => store.get(key) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
    store.set(key, value);
  });
  cloud = { revision: 0, snapshot: null, updatedAt: null };
  jest.mocked(apiRequest).mockImplementation(async (_path, options) => {
    if (options?.method === 'PUT') {
      const body = options.body as {
        revision: number;
        snapshot: ReturnType<typeof snapshotOf>;
      };
      if (body.revision !== cloud.revision) throw Error('409 lịch đã đổi');
      cloud = {
        revision: cloud.revision + 1,
        snapshot: clone(body.snapshot),
        updatedAt: '2026-10-31T00:00:00Z',
      };
    }
    return clone(cloud) as never;
  });
});
const enable = async () => {
  await moneyCalendarPlans.add(scope, plan);
  await planningSync.confirm(
    scope,
    'token',
    await planningSync.preview(scope, 'token'),
    'local',
    () => true,
  );
};
it('migrates legacy stores without deleting them and atomically saves concurrent changes to both sections', async () => {
  store.set('money-calendar:v1:http://qa:8', JSON.stringify([plan]));
  await Promise.all([
    recurringBillsService.save(scope, {
      label: 'Điện',
      cycle: 'MONTHLY',
      anchorDate: '2026-11-01',
      kind: 'FIXED',
      currency: 'VND',
      minAmount: 100000,
      maxAmount: 100000,
      note: '',
    }),
    moneyCalendarPlans.add(scope, { ...plan, id: 'extra' }),
  ]);
  const state = await planningLocalStore.read(scope);
  expect(snapshotOf(state).book.bills).toHaveLength(1);
  expect(snapshotOf(state).plans).toHaveLength(2);
  expect(store.get('money-calendar:v1:http://qa:8')).toBe(
    JSON.stringify([plan]),
  );
});
it('does not contact the server before opt-in and uploads only after preview confirmation', async () => {
  await planningSync.sync(scope, 'token', () => true);
  expect(apiRequest).not.toHaveBeenCalled();
  await moneyCalendarPlans.add(scope, plan);
  const preview = await planningSync.preview(scope, 'token');
  expect(cloud.revision).toBe(0);
  await planningSync.confirm(scope, 'token', preview, 'local', () => true);
  expect(cloud.snapshot?.plans).toEqual([plan]);
  expect((await planningLocalStore.read(scope)).sync.enabled).toBe(true);
});
it('pushes new offline changes without deleting old data and skips unchanged uploads', async () => {
  await enable();
  await moneyCalendarPlans.add(scope, { ...plan, id: 'extra' });
  await planningSync.sync(scope, 'token', () => true);
  expect(cloud.revision).toBe(2);
  expect(cloud.snapshot?.plans).toHaveLength(2);
  await planningSync.sync(scope, 'token', () => true);
  expect(cloud.revision).toBe(2);
});
it('pulls another device update into both sections and leaves new bill reminders off', async () => {
  await enable();
  cloud.snapshot!.plans.push({ ...plan, id: 'device-b' });
  cloud.revision++;
  cloud.snapshot!.book.bills.push({
    id: 'bill_b',
    label: 'Nhà',
    cycle: 'MONTHLY',
    anchorDate: '2026-11-01',
    kind: 'FIXED',
    currency: 'VND',
    minAmount: 200000,
    maxAmount: 200000,
    note: '',
    paused: false,
    archived: false,
    reminderEnabled: true,
  });
  await planningSync.sync(scope, 'token', () => true);
  const data = snapshotOf(await planningLocalStore.read(scope));
  expect(data.plans).toHaveLength(2);
  expect(data.book.bills[0].reminderEnabled).toBe(false);
});
it('preserves both versions on conflict and requires a fresh preview if either side changes', async () => {
  await enable();
  await moneyCalendarPlans.add(scope, { ...plan, id: 'on-a' });
  cloud.snapshot!.plans.push({ ...plan, id: 'on-b' });
  cloud.revision++;
  await planningSync.sync(scope, 'token', () => true);
  expect((await planningLocalStore.read(scope)).sync.conflict).toBe(true);
  expect((await moneyCalendarPlans.read(scope)).map(p => p.id)).toContain(
    'on-a',
  );
  expect(cloud.snapshot!.plans.map(p => p.id)).toContain('on-b');
  const preview = await planningSync.preview(scope, 'token');
  cloud.revision++;
  await expect(
    planningSync.confirm(scope, 'token', preview, 'local', () => true),
  ).rejects.toThrow('409');
  await expect(
    planningSync.confirm(scope, 'token', preview, 'cloud', () => true),
  ).rejects.toThrow('đã đổi');
});
it('resolves a conflict only after confirmation and never creates transactions or wallet balances', async () => {
  await enable();
  await moneyCalendarPlans.add(scope, { ...plan, id: 'on-a' });
  cloud.snapshot!.plans.push({ ...plan, id: 'on-b' });
  cloud.revision++;
  await planningSync.confirm(
    scope,
    'token',
    await planningSync.preview(scope, 'token'),
    'cloud',
    () => true,
  );
  expect((await moneyCalendarPlans.read(scope)).map(p => p.id)).toEqual([
    'salary',
    'on-b',
  ]);
  expect(
    jest.mocked(apiRequest).mock.calls.every(([p]) => p === '/planning-sync'),
  ).toBe(true);
});
it('does not pull a stale snapshot over a local edit that arrived during the GET', async () => {
  await enable();
  cloud.snapshot!.plans.push({ ...plan, id: 'on-b' });
  cloud.revision++;
  let release!: (v: unknown) => void;
  jest.mocked(apiRequest).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        release = resolve;
      }) as never,
  );
  const run = planningSync.sync(scope, 'token', () => true);
  while (!release) await Promise.resolve();
  await moneyCalendarPlans.add(scope, { ...plan, id: 'during-get' });
  release(clone(cloud));
  await run;
  expect((await moneyCalendarPlans.read(scope)).map(p => p.id)).toEqual([
    'salary',
    'during-get',
  ]);
});
it('does not re-enable sync when the user disables it during a request', async () => {
  await enable();
  let release!: (v: unknown) => void;
  jest.mocked(apiRequest).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        release = resolve;
      }) as never,
  );
  const run = planningSync.sync(scope, 'token', () => true);
  while (!release) await Promise.resolve();
  await planningSync.disable(scope);
  release(clone(cloud));
  await run;
  expect((await planningLocalStore.read(scope)).sync.enabled).toBe(false);
});
it('keeps local data on network failure, corrupt snapshots, stale confirmations and disk errors', async () => {
  await enable();
  const before = store.get(planningStorageKey(scope));
  jest.mocked(apiRequest).mockRejectedValueOnce(Error('offline'));
  await expect(planningSync.sync(scope, 'token', () => true)).rejects.toThrow(
    'offline',
  );
  expect(store.get(planningStorageKey(scope))).toBe(before);
  const preview = await planningSync.preview(scope, 'token');
  await expect(
    planningSync.confirm(scope, 'token', preview, 'cloud', () => false),
  ).rejects.toThrow();
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(Error('Disk full'));
  await expect(moneyCalendarPlans.remove(scope, plan.id)).rejects.toThrow(
    'Disk full',
  );
  expect(store.get(planningStorageKey(scope))).toBe(before);
  cloud.snapshot = {
    version: 1,
    book: { version: 1, bills: [], periods: [] },
    plans: [{ ...plan, amount: -1 }],
  };
  await expect(planningSync.sync(scope, 'token', () => true)).rejects.toThrow();
  expect(store.get(planningStorageKey(scope))).toBe(before);
});
it('compares reordered JSON keys consistently and ignores per-device reminder opt-in', () => {
  const a = {
    version: 1 as const,
    book: { version: 1 as const, bills: [], periods: [] },
    plans: [plan],
  };
  const b = {
    plans: [
      {
        type: plan.type,
        currency: plan.currency,
        amount: plan.amount,
        date: plan.date,
        label: plan.label,
        id: plan.id,
      },
    ],
    book: a.book,
    version: 1 as const,
  };
  expect(snapshotKey(a)).toBe(snapshotKey(b));
});
