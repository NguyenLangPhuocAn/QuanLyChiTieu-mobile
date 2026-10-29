import { Linking } from 'react-native';
import { createBillReminderLinking } from '../src/services/billReminderLinking';
import { billReminder } from '../src/native/billReminder';
import { homeWidget } from '../src/native/homeWidget';
jest.mock('../src/native/homeWidget', () => ({
  homeWidget: { validateLink: jest.fn() },
}));
jest.mock('../src/native/billReminder', () => ({
  billReminder: { isSupported: true, validatedLink: jest.fn() },
}));
const scope = { userId: 8, server: 'https://qa.invalid' };
const widgetUrl =
  'quanlychitieu://quick-entry?scope=https%3A%2F%2Fqa.invalid%3A8&type=EXPENSE&event=widget&action=CAMERA&category=4';
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

it('rejects a guessed widget camera link or unavailable native validator on cold start', async () => {
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(widgetUrl);
  jest.mocked(homeWidget.validateLink).mockResolvedValueOnce(false);
  expect(await createBillReminderLinking(scope).getInitialURL!()).toBeNull();
  jest
    .mocked(homeWidget.validateLink)
    .mockRejectedValueOnce(new Error('native unavailable'));
  expect(await createBillReminderLinking(scope).getInitialURL!()).toBeNull();
});

it('forwards a widget action only after native origin validation', async () => {
  let event!: (value: { url: string }) => void;
  jest.spyOn(Linking, 'addEventListener').mockImplementation((_, listener) => {
    event = listener;
    return { remove: jest.fn() } as any;
  });
  const listener = jest.fn();
  const unsubscribe = createBillReminderLinking(scope).subscribe!(
    listener,
  ) as () => void;
  jest.mocked(homeWidget.validateLink).mockResolvedValueOnce(false);
  event({ url: widgetUrl });
  await Promise.resolve();
  expect(listener).not.toHaveBeenCalled();
  jest.mocked(homeWidget.validateLink).mockResolvedValueOnce(true);
  event({ url: widgetUrl });
  await Promise.resolve();
  expect(listener).toHaveBeenCalledWith(
    'quanlychitieu://home?widgetType=EXPENSE&widgetEvent=widget&widgetAction=CAMERA&widgetCategoryId=4',
  );
  unsubscribe();
});

it('drops native widget verification if navigation has already closed', async () => {
  let event!: (value: { url: string }) => void;
  jest.spyOn(Linking, 'addEventListener').mockImplementation((_, listener) => {
    event = listener;
    return { remove: jest.fn() } as any;
  });
  let resolve!: (valid: boolean) => void;
  jest.mocked(homeWidget.validateLink).mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const listener = jest.fn();
  const unsubscribe = createBillReminderLinking(scope).subscribe!(
    listener,
  ) as () => void;
  event({ url: widgetUrl });
  unsubscribe();
  resolve(true);
  await Promise.resolve();
  expect(listener).not.toHaveBeenCalled();
});
