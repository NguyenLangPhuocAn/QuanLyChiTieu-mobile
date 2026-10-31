import AsyncStorage from '@react-native-async-storage/async-storage';
import { billReminder, billReminderPayload } from '../src/native/billReminder';
import { billReminderSession } from '../src/services/billReminderSession';
import { recurringBillsService as service } from '../src/services/recurringBills';
import type { BillInput } from '../src/utils/recurringBills';

jest.mock('../src/native/billReminder', () => {
  const actual = jest.requireActual('../src/native/billReminder');
  return {
    ...actual,
    billReminder: {
      isSupported: true,
      activate: jest.fn(async () => {}),
      sync: jest.fn(async () => {}),
      invalidate: jest.fn(async () => {}),
    },
  };
});
const a = { userId: 1, server: 'https://qa.invalid' };
const b = { userId: 2, server: 'https://qa.invalid' };
const input: BillInput = {
  label: 'Private name',
  cycle: 'MONTHLY',
  anchorDate: '2026-10-27',
  kind: 'FIXED',
  minAmount: 123456,
  maxAmount: 123456,
  currency: 'VND',
  note: 'Private bank details',
};
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
beforeEach(async () => {
  jest.restoreAllMocks();
  await billReminderSession.set(null);
  await AsyncStorage.removeItem('recurring-bills:v1:https://qa.invalid:1');
  await AsyncStorage.removeItem(
    'recurring-bills:v1:https://qa.invalid:1'.replace(
      'recurring-bills:v1:',
      'planning-local:v1:',
    ),
  );
  await AsyncStorage.removeItem('recurring-bills:v1:https://qa.invalid:2');
  await AsyncStorage.removeItem(
    'recurring-bills:v1:https://qa.invalid:2'.replace(
      'recurring-bills:v1:',
      'planning-local:v1:',
    ),
  );
  jest.clearAllMocks();
});

it('syncs persisted mutations without mirroring names, notes, money or payment data', async () => {
  await billReminderSession.set(a);
  await service.save(a, input);
  await flush();
  const payload = jest.mocked(billReminder.sync).mock.calls.at(-1)![1];
  expect(payload.bills).toHaveLength(1);
  const text = billReminderPayload(payload);
  expect(text).not.toContain('Private');
  expect(text).not.toContain('123456');
  expect(JSON.parse(text).bills[0].reminderEnabled).toBe(true);
});

it('does not sync a late book load into a different account', async () => {
  await billReminderSession.set(a);
  let resolve!: (book: Awaited<ReturnType<typeof service.load>>) => void;
  const old = await service.load(a);
  jest.spyOn(service, 'load').mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const pending = billReminderSession.sync(a);
  await flush();
  await billReminderSession.set(b);
  const count = jest.mocked(billReminder.sync).mock.calls.length;
  resolve(old);
  await pending;
  expect(billReminder.sync).toHaveBeenCalledTimes(count);
  expect(jest.mocked(billReminder.sync).mock.calls.at(-1)![0]).toEqual(b);
});

it('cancels the owner at logout and discards pending sync work', async () => {
  await billReminderSession.set(a);
  const old = await service.load(a);
  let resolve!: (book: typeof old) => void;
  jest.spyOn(service, 'load').mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const pending = billReminderSession.sync(a);
  await flush();
  await billReminderSession.set(null);
  const count = jest.mocked(billReminder.sync).mock.calls.length;
  resolve(old);
  await pending;
  expect(billReminder.activate).toHaveBeenLastCalledWith(null);
  expect(billReminder.sync).toHaveBeenCalledTimes(count);
});

it('cancels the native mirror if local storage is corrupt, preserving the original data', async () => {
  await AsyncStorage.setItem(
    'recurring-bills:v1:https://qa.invalid:1',
    'broken',
  );
  await expect(billReminderSession.set(a)).rejects.toThrow(
    'Giữ nguyên dữ liệu',
  );
  expect(billReminder.invalidate).toHaveBeenCalledWith(a);
  expect(
    await AsyncStorage.getItem('recurring-bills:v1:https://qa.invalid:1'),
  ).toBe('broken');
});

it('ignores background mutations belonging to another account', async () => {
  await billReminderSession.set(a);
  jest.mocked(billReminder.sync).mockClear();
  await service.save(b, input);
  await flush();
  expect(billReminder.sync).not.toHaveBeenCalled();
});

it('mirrors opt-out, skipped and archived state without financial writes', async () => {
  await billReminderSession.set(a);
  await service.save(a, input);
  const id = (await service.load(a)).bills[0].id;
  await service.setReminder(a, id, false);
  await service.skip(a, id, input.anchorDate);
  await service.archive(a, id);
  await flush();
  const value = JSON.parse(billReminderPayload(await service.load(a)));
  expect(value.bills[0]).toMatchObject({
    reminderEnabled: false,
    archived: true,
  });
  expect(value.periods).toEqual([
    { billId: id, dueDate: '2026-10-27', status: 'SKIPPED' },
  ]);
});

it('does not roll back a stored bill if native synchronization fails', async () => {
  await billReminderSession.set(a);
  jest
    .mocked(billReminder.sync)
    .mockRejectedValueOnce(new Error('native unavailable'));
  await service.save(a, input);
  await flush();
  expect((await service.load(a)).bills).toHaveLength(1);
  expect(billReminder.invalidate).toHaveBeenCalledWith(a);
});

it('drops an older sync snapshot when a newer read wins', async () => {
  await billReminderSession.set(a);
  const old = await service.load(a);
  let resolve!: (book: typeof old) => void;
  jest.spyOn(service, 'load').mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const pending = billReminderSession.sync(a);
  await flush();
  await billReminderSession.sync(a);
  const count = jest.mocked(billReminder.sync).mock.calls.length;
  resolve(old);
  await pending;
  expect(billReminder.sync).toHaveBeenCalledTimes(count);
});
