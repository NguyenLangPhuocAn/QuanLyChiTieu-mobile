import RNFS from 'react-native-fs';
const { Buffer } = require('buffer');
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest, apiUploadRequest } from '../src/services/api';
import {
  billBackupPreview,
  encodeBackupBase64,
  billBookBackupService as backup,
} from '../src/services/billBookBackup';
import { recurringBillsService as service } from '../src/services/recurringBills';
import type { BillBook, RecurringBill } from '../src/utils/recurringBills';
jest.mock('../src/services/api', () => ({
  apiRequest: jest.fn(),
  apiUploadRequest: jest.fn(),
}));
const scope = { userId: 488, server: 'https://backup.invalid' };
const key = 'recurring-bills:v1:https://backup.invalid:488';
const file = {
  uri: 'file:///qa.stcn-backup',
  name: 'qa.stcn-backup',
  type: 'application/octet-stream',
};
const bill: RecurringBill = {
  id: 'b1',
  label: 'Internet QA',
  cycle: 'MONTHLY',
  anchorDate: '2026-10-28',
  kind: 'FIXED',
  minAmount: 100000,
  maxAmount: 100000,
  currency: 'VND',
  note: '',
  paused: false,
  archived: false,
  reminderEnabled: true,
};
const imported: BillBook = {
  version: 1,
  bills: [bill],
  periods: [
    {
      billId: bill.id,
      dueDate: bill.anchorDate,
      status: 'PAID',
      payment: {
        id: 13,
        date: bill.anchorDate,
        amount: 100000,
        currency: 'VND',
        note: 'Internet QA',
      },
    },
  ],
  suggestions: [
    {
      key: 'bill-suggest:v1:VND:MONTHLY:internet qa',
      status: 'TRACKED',
      billId: bill.id,
    },
    { key: 'bill-suggest:v1:VND:MONTHLY:video qa', status: 'IGNORED' },
    {
      key: 'bill-suggest:v1:VND:MONTHLY:electric qa',
      status: 'LATER',
      until: '2027-01-01',
    },
  ],
  reviewedAlerts: [
    JSON.stringify([
      'bill-alert:v1',
      'DUPLICATE',
      bill.id,
      'MONTHLY',
      'VND',
      bill.anchorDate,
      100000,
      'internet qa',
      bill.anchorDate,
      [
        [13, bill.anchorDate, 100000],
        [14, bill.anchorDate, 100000],
      ],
    ]),
  ],
};
const blank: BillBook = { version: 1, bills: [], periods: [] };

jest.mock('react-native-fs', () => ({ stat: jest.fn(), readFile: jest.fn() }));
const text = (book = imported) =>
  JSON.stringify({
    format: 'SO_THU_CHI_NOVA_BILL_BOOK',
    version: 2,
    source: { userId: scope.userId, server: scope.server },
    createdAt: '2026-10-28T06:00:00.000Z',
    book,
  });
beforeEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await AsyncStorage.removeItem(key);
  await AsyncStorage.removeItem(
    key.replace('recurring-bills:v1:', 'planning-local:v1:'),
  );
  jest.mocked(RNFS.stat).mockResolvedValue({ size: 100 } as never);
  jest.mocked(RNFS.readFile).mockResolvedValue(text());
});
it('exports ordinary UTF8 JSON with full metadata and no API/password/encryption', async () => {
  await AsyncStorage.setItem(key, JSON.stringify(imported));
  const result = await backup.export(scope);
  const data = JSON.parse(
    Buffer.from(result.base64, 'base64').toString('utf8'),
  );
  expect(data.book).toEqual(imported);
  expect(data.version).toBe(3);
  expect(data.ciphertext).toBeUndefined();
  expect(apiRequest).not.toHaveBeenCalled();
  expect(apiUploadRequest).not.toHaveBeenCalled();
  for (const value of [
    '',
    'a',
    'ab',
    'abc',
    'Sổ thu chi – cà phê ☕ 🧾',
    '\u0000 / % 😀',
  ])
    expect(encodeBackupBase64(value)).toBe(
      Buffer.from(value, 'utf8').toString('base64'),
    );
});
it('previews without writing and rejects wrong account/server, JSON errors and invalid links', async () => {
  const preview = await backup.preview(scope, file);
  expect(preview.book).toEqual(imported);
  expect(await service.load(scope)).toEqual(blank);
  for (const raw of [
    'null',
    '{',
    JSON.stringify({
      ...JSON.parse(text()),
      source: { userId: 1, server: scope.server },
    }),
    JSON.stringify({
      ...JSON.parse(text()),
      source: { userId: scope.userId, server: 'https://other.invalid' },
    }),
    text({ ...imported, bills: [bill, bill] }),
    text({ ...imported, bills: [] }),
    text({ ...imported, periods: [...imported.periods, ...imported.periods] }),
  ])
    expect(() => billBackupPreview(scope, blank, raw)).toThrow();
});
it('restores complete metadata once per ID, turns reminders off and keeps other accounts untouched', async () => {
  let preview = await backup.preview(scope, file);
  await backup.restore(scope, file, preview, () => true);
  const restored = await service.load(scope);
  expect(restored).toEqual({
    ...imported,
    bills: [{ ...bill, reminderEnabled: false }],
  });
  preview = await backup.preview(scope, file);
  await backup.restore(scope, file, preview, () => true);
  expect(await service.load(scope)).toEqual(restored);
  expect(await service.load({ ...scope, userId: 489 })).toEqual(blank);
});
it('rejects file changes and a newer queued local mutation after preview', async () => {
  const preview = await backup.preview(scope, file);
  jest
    .mocked(RNFS.readFile)
    .mockResolvedValue(text().replace('Internet QA', 'Đổi QA'));
  await expect(
    backup.restore(scope, file, preview, () => true),
  ).rejects.toThrow('File đã thay đổi');
  jest.mocked(RNFS.readFile).mockResolvedValue(text());
  const save = service.save(scope, { ...bill, label: 'Mới QA' });
  const restore = backup.restore(scope, file, preview, () => true);
  await save;
  await expect(restore).rejects.toThrow('đã thay đổi');
  expect((await service.load(scope)).bills[0].label).toBe('Mới QA');
});
it('cancels before/after file reads and keeps original data on write failure', async () => {
  const preview = billBackupPreview(scope, blank, text());
  await expect(
    backup.restore(scope, file, preview, () => false),
  ).rejects.toThrow();
  let active = true;
  jest.mocked(RNFS.readFile).mockImplementationOnce(async () => {
    active = false;
    return text();
  });
  await expect(
    backup.restore(scope, file, preview, () => active),
  ).rejects.toThrow();
  expect(await service.load(scope)).toEqual(blank);
  jest
    .spyOn(AsyncStorage, 'setItem')
    .mockRejectedValueOnce(new Error('Disk full'));
  await expect(
    backup.restore(scope, file, preview, () => true),
  ).rejects.toThrow('Disk full');
  expect(await service.load(scope)).toEqual(blank);
});
it('preserves corrupt local data, rejects oversized files before reading, and never assigns prototypes', async () => {
  await AsyncStorage.setItem(key, 'bad-local');
  await expect(backup.preview(scope, file)).rejects.toThrow();
  expect(await AsyncStorage.getItem(key)).toBe('bad-local');
  await AsyncStorage.removeItem(key);
  await AsyncStorage.removeItem(
    key.replace('recurring-bills:v1:', 'planning-local:v1:'),
  );
  jest
    .mocked(RNFS.stat)
    .mockResolvedValueOnce({ size: 512 * 1024 + 1 } as never);
  await expect(backup.preview(scope, file)).rejects.toThrow('512 KB');
  await service.restoreBackup(
    scope,
    JSON.stringify(blank),
    '{"version":1,"bills":[],"periods":[],"__proto__":{"polluted":true}}',
    () => true,
  );
  expect(await service.load(scope)).toEqual(blank);
});
