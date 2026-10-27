import { Linking } from 'react-native';
import { createBillReminderLinking } from '../src/services/billReminderLinking';
import { billReminder } from '../src/native/billReminder';
jest.mock('../src/native/billReminder', () => ({
  billReminder: { isSupported: true, validatedLink: jest.fn() },
}));
const scope = { userId: 8, server: 'https://qa.invalid' };
afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});
it('restores a valid initial notification link after JS starts', async () => {
  jest
    .spyOn(Linking, 'getInitialURL')
    .mockResolvedValue('quanlychitieu://bills?scope=current');
  jest
    .mocked(billReminder.validatedLink)
    .mockResolvedValue('quanlychitieu://bills?reminderDate=2026-10-27');
  expect(await createBillReminderLinking(scope).getInitialURL!()).toBe(
    'quanlychitieu://bills?reminderDate=2026-10-27',
  );
});
it('fails closed if native link validation fails', async () => {
  jest
    .spyOn(Linking, 'getInitialURL')
    .mockResolvedValue('quanlychitieu://bills?scope=current');
  jest
    .mocked(billReminder.validatedLink)
    .mockRejectedValueOnce(new Error('native unavailable'));
  expect(await createBillReminderLinking(scope).getInitialURL!()).toBeNull();
});
it('rejects an initial link owned by another account', async () => {
  jest
    .spyOn(Linking, 'getInitialURL')
    .mockResolvedValue('quanlychitieu://bills?scope=other');
  jest.mocked(billReminder.validatedLink).mockResolvedValue(null);
  expect(await createBillReminderLinking(scope).getInitialURL!()).toBeNull();
  expect(billReminder.validatedLink).toHaveBeenCalledWith(
    scope,
    'quanlychitieu://bills?scope=other',
  );
});
it('discards a validated link arriving after its navigation subscription has closed', async () => {
  let event!: (value: { url: string }) => void;
  jest.spyOn(Linking, 'addEventListener').mockImplementation((_, listener) => {
    event = listener;
    return { remove: jest.fn() } as unknown as ReturnType<
      typeof Linking.addEventListener
    >;
  });
  let resolve!: (value: string) => void;
  jest.mocked(billReminder.validatedLink).mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const listener = jest.fn();
  const unsubscribe = createBillReminderLinking(scope).subscribe!(
    listener,
  ) as () => void;
  event({ url: 'quanlychitieu://bills?scope=current' });
  unsubscribe();
  resolve('quanlychitieu://bills?reminderDate=2026-10-27');
  await Promise.resolve();
  expect(listener).not.toHaveBeenCalled();
});
it('passes a validated event to navigation without fetching or writing transactions', async () => {
  let event!: (value: { url: string }) => void;
  jest.spyOn(Linking, 'addEventListener').mockImplementation((_, listener) => {
    event = listener;
    return { remove: jest.fn() } as unknown as ReturnType<
      typeof Linking.addEventListener
    >;
  });
  jest
    .mocked(billReminder.validatedLink)
    .mockResolvedValue('quanlychitieu://bills?reminderDate=2026-10-27');
  const listener = jest.fn();
  const unsubscribe = createBillReminderLinking(scope).subscribe!(
    listener,
  ) as () => void;
  event({ url: 'quanlychitieu://bills?scope=current' });
  await Promise.resolve();
  expect(listener).toHaveBeenCalledWith(
    'quanlychitieu://bills?reminderDate=2026-10-27',
  );
  unsubscribe();
});
