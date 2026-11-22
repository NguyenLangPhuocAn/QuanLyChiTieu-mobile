import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineWalletQueue } from '../offlineWalletQueue';
import { walletsService } from '../wallets';
import type { Wallet } from '../../types/wallet';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('../wallets', () => ({
  walletsService: {
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

const storage = new Map<string, string>();
const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;
const wallet = (overrides: Partial<Wallet> = {}): Wallet => ({
  id: 5,
  user_id: 7,
  name: 'Ví QA',
  wallet_type: 'CASH',
  currency: 'VND',
  balance: '100',
  created_at: '2026-11-21T00:00:00Z',
  ...overrides,
});
const metadata = {
  name: 'Ví mới',
  wallet_type: 'CASH' as const,
  currency: 'VND',
};

describe('offlineWalletQueue', () => {
  beforeEach(() => {
    storage.clear();
    jest.clearAllMocks();
    getItem.mockImplementation(async (key: string) => storage.get(key) ?? null);
    setItem.mockImplementation(async (key: string, value: string) => {
      storage.set(key, value);
    });
  });

  it('keeps wallet edits durable and rejects a stale preview', async () => {
    await offlineWalletQueue.update(7, wallet(), metadata);
    const reviewed = await offlineWalletQueue.preview(7);
    expect(
      offlineWalletQueue.apply([wallet()], await offlineWalletQueue.list(7))[0]
        .name,
    ).toBe('Ví mới');
    await offlineWalletQueue.update(7, wallet({ name: 'Ví mới' }), {
      ...metadata,
      name: 'Ví khác',
    });
    await expect(offlineWalletQueue.discard(7, reviewed)).rejects.toThrow(
      'đã thay đổi',
    );
    expect(await offlineWalletQueue.list(7)).toHaveLength(1);
  });

  it('retries wallet creation with the same request id after a lost response', async () => {
    const change = await offlineWalletQueue.create(7, {
      ...metadata,
      balance: '500',
    });
    const preview = await offlineWalletQueue.preview(7);
    (walletsService.create as jest.Mock)
      .mockRejectedValueOnce(Error('lost response'))
      .mockResolvedValueOnce(
        wallet({ id: 20, name: metadata.name, balance: '500' }),
      );
    expect(
      (await offlineWalletQueue.sync('token', 7, preview, () => true)).pending,
    ).toBe(1);
    expect(
      (await offlineWalletQueue.sync('token', 7, preview, () => true)).synced,
    ).toBe(1);
    expect(
      (walletsService.create as jest.Mock).mock.calls.map(
        call => call[1].client_request_id,
      ),
    ).toEqual([change.requestId, change.requestId]);
    expect(await offlineWalletQueue.resolveId(7, change.id)).toBe(20);
  });

  it('blocks deleting a wallet used by a pending transaction', async () => {
    storage.set(
      'quan_ly_chi_tieu_offline_transactions_v1_7',
      JSON.stringify([
        {
          server: require('../api').getApiStorageBaseUrl(),
          payload: { wallet_id: 5 },
        },
      ]),
    );
    await expect(offlineWalletQueue.remove(7, wallet())).rejects.toThrow(
      'giao dịch chờ',
    );
  });

  it('does not overwrite a wallet changed on the server', async () => {
    await offlineWalletQueue.update(7, wallet(), metadata);
    (walletsService.getAll as jest.Mock).mockResolvedValue([
      wallet({ balance: '200' }),
    ]);
    const result = await offlineWalletQueue.sync(
      'token',
      7,
      await offlineWalletQueue.preview(7),
      () => true,
    );
    expect(result.needsReview).toBe(1);
    expect(walletsService.update).not.toHaveBeenCalled();
  });
});
