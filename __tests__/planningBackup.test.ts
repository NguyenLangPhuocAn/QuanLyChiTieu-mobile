import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { billBookBackupService as backup } from '../src/services/billBookBackup';
import {
  planningStorageKey,
} from '../src/services/planningLocalStore';
import { moneyCalendarPlans } from '../src/services/moneyCalendarPlans';
import { recurringBillsService } from '../src/services/recurringBills';
const { Buffer } = require('buffer');
jest.mock('../src/services/api', () => ({ getApiBaseUrl: () => 'http://qa' }));
const scope = { userId: 8, server: 'http://qa' };
const plan = {
  id: 'salary',
  label: 'Lương',
  amount: 5000000,
  date: '2026-11-01',
  currency: 'VND',
  type: 'INCOME' as const,
};
const file = {
  uri: 'file:///qa.json',
  name: 'qa.json',
  type: 'application/json',
};
const map = new Map<string, string>();
let text: string;
beforeEach(() => {
  jest.clearAllMocks();
  map.clear();
  jest
    .mocked(AsyncStorage.getItem)
    .mockImplementation(async key => map.get(key) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
    map.set(key, value);
  });
  jest.mocked(RNFS.stat).mockResolvedValue({ size: 100 } as never);
  jest.mocked(RNFS.readFile).mockImplementation(async () => text);
});
const seed = async () => {
  await moneyCalendarPlans.add(scope, plan);
  await recurringBillsService.save(scope, {
    label: 'Điện',
    cycle: 'MONTHLY',
    anchorDate: '2026-11-01',
    kind: 'FIXED',
    currency: 'VND',
    minAmount: 100000,
    maxAmount: 100000,
    note: '',
    reminderEnabled: true,
  });
  text = Buffer.from((await backup.export(scope)).base64, 'base64').toString(
    'utf8',
  );
};
it('exports one ordinary file for bills and plans and restores both in one write with reminders off', async () => {
  await seed();
  const exported = JSON.parse(text);
  expect(exported.version).toBe(3);
  expect(exported.plans).toEqual([plan]);
  map.clear();
  const preview = await backup.preview(scope, file);
  expect(preview.currentPlanCount).toBe(0);
  jest.mocked(AsyncStorage.setItem).mockClear();
  await backup.restore(scope, file, preview, () => true);
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  expect(await moneyCalendarPlans.read(scope)).toEqual([plan]);
  expect(
    (await recurringBillsService.load(scope)).bills[0].reminderEnabled,
  ).toBe(false);
});
it('imports version2 bill files while preserving current expected income and expenses', async () => {
  await seed();
  const data = JSON.parse(text);
  data.version = 2;
  delete data.plans;
  text = JSON.stringify(data);
  const preview = await backup.preview(scope, file);
  expect(preview.plans).toBeNull();
  await backup.restore(scope, file, preview, () => true);
  expect(await moneyCalendarPlans.read(scope)).toEqual([plan]);
});
it('rejects a changed plan or file after preview and cannot partially replace a book on disk failure', async () => {
  await seed();
  const preview = await backup.preview(scope, file);
  await moneyCalendarPlans.add(scope, { ...plan, id: 'later' });
  await expect(
    backup.restore(scope, file, preview, () => true),
  ).rejects.toThrow('đã thay đổi');
  const next = await backup.preview(scope, file),
    before = map.get(planningStorageKey(scope));
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(Error('Disk full'));
  await expect(backup.restore(scope, file, next, () => true)).rejects.toThrow(
    'Disk full',
  );
  expect(map.get(planningStorageKey(scope))).toBe(before);
  text = text.replace('Lương', 'File khác');
  await expect(backup.restore(scope, file, next, () => true)).rejects.toThrow(
    'File đã thay đổi',
  );
});
it('rejects malformed or duplicate planned items and retains original local data', async () => {
  await seed();
  const before = map.get(planningStorageKey(scope)),
    data = JSON.parse(text);
  data.plans.push(plan);
  text = JSON.stringify(data);
  await expect(backup.preview(scope, file)).rejects.toThrow();
  expect(map.get(planningStorageKey(scope))).toBe(before);
});
