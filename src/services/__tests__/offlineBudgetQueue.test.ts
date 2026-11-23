import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineBudgetQueue } from '../offlineBudgetQueue';
import { budgetsService } from '../budgets';
import type { Budget } from '../../types/budget';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('../budgets', () => ({
  budgetsService: {
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

const storage = new Map<string, string>();
const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;
const budget = (overrides: Partial<Budget> = {}): Budget => ({
  id: 4,
  user_id: 7,
  name: 'Ăn uống tháng 11',
  scope: 'WALLET',
  wallet_id: 3,
  wallet_name: 'Ví sinh hoạt',
  wallet_currency: 'VND',
  category_id: null,
  limit_amount: 1500000,
  period: 'CUSTOM',
  start_date: '2026-10-31T17:00:00.000Z',
  end_date: '2026-11-30T16:59:59.000Z',
  spent: 0,
  remaining: 1500000,
  percent: 0,
  percentage: 0,
  status: 'NORMAL',
  ...overrides,
});
const payload = {
  name: 'Ăn uống tháng 11',
  scope: 'WALLET' as const,
  wallet_id: 3,
  category_id: null,
  limit_amount: '1500000',
  period: 'CUSTOM' as const,
  start_date: '2026-11-01',
  end_date: '2026-11-30',
};

describe('offlineBudgetQueue', () => {
  beforeEach(() => {
    storage.clear();
    jest.clearAllMocks();
    getItem.mockImplementation(async (key: string) => storage.get(key) ?? null);
    setItem.mockImplementation(async (key: string, value: string) => {
      storage.set(key, value);
    });
  });

  it('keeps the same request key when a creation response is lost', async () => {
    const change = await offlineBudgetQueue.create(7, payload);
    const expected = await offlineBudgetQueue.preview(7);
    (budgetsService.create as jest.Mock)
      .mockRejectedValueOnce(Error('connection lost'))
      .mockResolvedValueOnce(budget({ id: 14 }));
    expect(
      (await offlineBudgetQueue.sync('token', 7, expected, () => true)).pending,
    ).toBe(1);
    expect(
      (await offlineBudgetQueue.sync('token', 7, expected, () => true)).synced,
    ).toBe(1);
    expect(
      (budgetsService.create as jest.Mock).mock.calls.map(
        call => call[1].client_request_id,
      ),
    ).toEqual([change.requestId, change.requestId]);
    expect(await offlineBudgetQueue.list(7)).toHaveLength(0);
  });

  it('blocks changing a budget whose server response is unknown', async () => {
    const pending = await offlineBudgetQueue.create(
      7,
      payload,
      'budget-uncertain',
      true,
    );
    await expect(
      offlineBudgetQueue.update(7, budget({ id: pending.id }), {
        ...payload,
        limit_amount: '1600000',
      }),
    ).rejects.toThrow('Hãy đối chiếu trước khi sửa');
    await expect(
      offlineBudgetQueue.remove(7, budget({ id: pending.id })),
    ).rejects.toThrow('Hãy đối chiếu trước khi xóa');
    expect((await offlineBudgetQueue.list(7))[0].requestId).toBe(
      'budget-uncertain',
    );
  });

  it('keeps a changed server budget for review without overwriting it', async () => {
    await offlineBudgetQueue.update(7, budget(), {
      ...payload,
      name: 'Bữa ăn gia đình',
    });
    (budgetsService.getAll as jest.Mock).mockResolvedValue([
      budget({ limit_amount: 1800000 }),
    ]);
    const result = await offlineBudgetQueue.sync(
      'token',
      7,
      await offlineBudgetQueue.preview(7),
      () => true,
    );
    expect(result.needsReview).toBe(1);
    expect(budgetsService.update).not.toHaveBeenCalled();
  });

  it('recognizes an update already saved before its response was lost', async () => {
    await offlineBudgetQueue.update(7, budget(), {
      ...payload,
      name: 'Bữa ăn gia đình',
      limit_amount: '1700000',
    });
    (budgetsService.getAll as jest.Mock).mockResolvedValue([
      budget({ name: 'Bữa ăn gia đình', limit_amount: 1700000 }),
    ]);
    const result = await offlineBudgetQueue.sync(
      'token',
      7,
      await offlineBudgetQueue.preview(7),
      () => true,
    );
    expect(result.synced).toBe(1);
    expect(budgetsService.update).not.toHaveBeenCalled();
    expect(await offlineBudgetQueue.list(7)).toHaveLength(0);
  });

  it('treats a missing server budget as a completed delete after a lost response', async () => {
    await offlineBudgetQueue.remove(7, budget());
    (budgetsService.getAll as jest.Mock).mockResolvedValue([]);
    const result = await offlineBudgetQueue.sync(
      'token',
      7,
      await offlineBudgetQueue.preview(7),
      () => true,
    );
    expect(result.synced).toBe(1);
    expect(budgetsService.remove).not.toHaveBeenCalled();
    expect(await offlineBudgetQueue.list(7)).toHaveLength(0);
  });
});
