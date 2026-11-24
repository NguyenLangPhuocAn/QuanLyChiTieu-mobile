import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineLoanCreateQueue } from '../offlineLoanCreateQueue';
import { loanDebtsService } from '../loanDebts';
import { walletsService } from '../wallets';
import { offlineWalletQueue } from '../offlineWalletQueue';
import type { Wallet } from '../../types/wallet';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('../loanDebts', () => ({
  loanDebtsService: { createQuickEntry: jest.fn() },
}));
jest.mock('../wallets', () => ({ walletsService: { getAll: jest.fn() } }));
jest.mock('../offlineWalletQueue', () => ({
  offlineWalletQueue: { list: jest.fn() },
}));
const storage = new Map<string, string>();
const wallet = {
  id: 2,
  name: 'Ví gia đình',
  currency: 'VND',
  wallet_type: 'BANK',
  balance: 500000,
} as Wallet;
const payload = {
  person_name: 'Anh Minh',
  type: 'BORROWED' as const,
  principal_amount: '200000',
  wallet_id: 2,
  transaction_date: '2026-11-24',
  client_request_id: 'loan_20261124_abcdef123456',
};
beforeEach(() => {
  storage.clear();
  jest.clearAllMocks();
  jest
    .mocked(AsyncStorage.getItem)
    .mockImplementation(async key => storage.get(key) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
    storage.set(key, value);
  });
  jest.mocked(offlineWalletQueue.list).mockResolvedValue([]);
  jest.mocked(walletsService.getAll).mockResolvedValue([wallet]);
  jest
    .mocked(loanDebtsService.createQuickEntry)
    .mockResolvedValue({ id: 5 } as never);
});

it('keeps one durable request and rejects different content under the same key', async () => {
  await offlineLoanCreateQueue.enqueue(7, payload, wallet);
  await offlineLoanCreateQueue.enqueue(7, payload, wallet);
  expect(await offlineLoanCreateQueue.list(7)).toHaveLength(1);
  await expect(
    offlineLoanCreateQueue.enqueue(
      7,
      { ...payload, principal_amount: '300000' },
      wallet,
    ),
  ).rejects.toThrow('nội dung khác');
});

it('does not send before reviewed sync and repeats the persisted request after a lost reply', async () => {
  await offlineLoanCreateQueue.enqueue(7, payload, wallet);
  expect(loanDebtsService.createQuickEntry).not.toHaveBeenCalled();
  jest
    .mocked(loanDebtsService.createQuickEntry)
    .mockRejectedValueOnce(Error('Mất phản hồi'));
  const expected = await offlineLoanCreateQueue.preview(7);
  expect(
    (
      await offlineLoanCreateQueue.sync(
        'session',
        7,
        expected,
        { 2: wallet },
        () => true,
      )
    ).pending,
  ).toBe(1);
  expect(
    (
      await offlineLoanCreateQueue.sync(
        'session',
        7,
        expected,
        { 2: wallet },
        () => true,
      )
    ).synced,
  ).toBe(1);
  expect(
    jest
      .mocked(loanDebtsService.createQuickEntry)
      .mock.calls.map(call => call[1].client_request_id),
  ).toEqual([payload.client_request_id, payload.client_request_id]);
  expect(await offlineLoanCreateQueue.list(7)).toHaveLength(0);
});

it('keeps the request for review when its wallet changed on the server', async () => {
  await offlineLoanCreateQueue.enqueue(7, payload, wallet);
  jest
    .mocked(walletsService.getAll)
    .mockResolvedValue([{ ...wallet, currency: 'USD' }]);
  const result = await offlineLoanCreateQueue.sync(
    'session',
    7,
    await offlineLoanCreateQueue.preview(7),
    { 2: wallet },
    () => true,
  );
  expect(result.needsReview).toBe(1);
  expect(loanDebtsService.createQuickEntry).not.toHaveBeenCalled();
});

it('does not send money after the reviewed wallet balance changes', async () => {
  await offlineLoanCreateQueue.enqueue(7, payload, wallet);
  jest
    .mocked(walletsService.getAll)
    .mockResolvedValue([{ ...wallet, balance: 480000 }]);
  const result = await offlineLoanCreateQueue.sync(
    'session',
    7,
    await offlineLoanCreateQueue.preview(7),
    { 2: wallet },
    () => true,
  );
  expect(result.needsReview).toBe(1);
  expect(loanDebtsService.createQuickEntry).not.toHaveBeenCalled();
});

it('keeps the local draft when the server wallet disappeared', async () => {
  await offlineLoanCreateQueue.enqueue(7, payload, wallet);
  jest.mocked(walletsService.getAll).mockResolvedValue([]);
  const result = await offlineLoanCreateQueue.sync(
    'session',
    7,
    await offlineLoanCreateQueue.preview(7),
    { 2: null },
    () => true,
  );
  expect(result.needsReview).toBe(1);
  expect(await offlineLoanCreateQueue.list(7)).toHaveLength(1);
  expect(loanDebtsService.createQuickEntry).not.toHaveBeenCalled();
});

it('stops before sending when the account changes during wallet refresh', async () => {
  await offlineLoanCreateQueue.enqueue(7, payload, wallet);
  const current = jest.fn().mockReturnValueOnce(true).mockReturnValue(false);
  const result = await offlineLoanCreateQueue.sync(
    'session',
    7,
    await offlineLoanCreateQueue.preview(7),
    { 2: wallet },
    current,
  );
  expect(result.pending).toBe(1);
  expect(loanDebtsService.createQuickEntry).not.toHaveBeenCalled();
});

it('checks the reviewed revision before discarding', async () => {
  await offlineLoanCreateQueue.enqueue(7, payload, wallet);
  await expect(offlineLoanCreateQueue.discard(7, [])).rejects.toThrow(
    'thay đổi',
  );
  expect(await offlineLoanCreateQueue.list(7)).toHaveLength(1);
});
