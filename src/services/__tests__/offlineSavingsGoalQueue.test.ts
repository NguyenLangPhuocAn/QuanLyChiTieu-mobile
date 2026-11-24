import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineSavingsGoalQueue } from '../offlineSavingsGoalQueue';
import { savingsService } from '../savings';
import type { SavingsGoal } from '../../types/savings';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('../savings', () => ({
  savingsService: { getAll: jest.fn(), update: jest.fn() },
}));

const storage = new Map<string, string>();
const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;
const goal = (overrides: Partial<SavingsGoal> = {}): SavingsGoal => ({
  id: 4,
  user_id: 7,
  wallet_id: 9,
  wallet_currency: 'VND',
  wallet_balance: 500000,
  name: 'Quỹ dự phòng',
  target_amount: 2000000,
  current_amount: 500000,
  remaining_amount: 1500000,
  progress_percent: 25,
  suggested_monthly: 0,
  target_date: null,
  note: null,
  status: 'ACTIVE',
  entries: [],
  ...overrides,
});
const payload = {
  name: 'Quỹ gia đình',
  target_amount: '3000000',
  target_date: null,
  note: 'Dành cho sinh hoạt',
};

describe('offlineSavingsGoalQueue', () => {
  beforeEach(() => {
    storage.clear();
    jest.clearAllMocks();
    getItem.mockImplementation(async (key: string) => storage.get(key) ?? null);
    setItem.mockImplementation(async (key: string, value: string) => {
      storage.set(key, value);
    });
  });

  it('keeps the original snapshot through repeated local edits', async () => {
    await offlineSavingsGoalQueue.update(7, goal(), payload);
    const pending = offlineSavingsGoalQueue.apply(
      [goal()],
      await offlineSavingsGoalQueue.list(7),
    )[0];
    await offlineSavingsGoalQueue.update(7, pending, {
      ...payload,
      target_amount: '3500000',
    });
    const [change] = await offlineSavingsGoalQueue.list(7);
    expect(change.base.name).toBe('Quỹ dự phòng');
    expect(change.base.target_amount).toBe('2000000.00');
    expect(change.payload.target_amount).toBe('3500000');
    expect(change.revision).toBe(2);
  });

  it('keeps an unknown server result and recognizes it on retry', async () => {
    await offlineSavingsGoalQueue.update(7, goal(), payload);
    (savingsService.getAll as jest.Mock)
      .mockResolvedValueOnce([goal()])
      .mockResolvedValueOnce([goal({ ...payload, target_amount: 3000000 })]);
    (savingsService.update as jest.Mock).mockRejectedValueOnce(
      Error('response lost'),
    );
    const expected = await offlineSavingsGoalQueue.preview(7);
    expect(
      (await offlineSavingsGoalQueue.sync('token', 7, expected, () => true))
        .pending,
    ).toBe(1);
    await expect(
      offlineSavingsGoalQueue.update(7, goal(), {
        ...payload,
        name: 'Quỹ học tập',
      }),
    ).rejects.toThrow('Hãy đối chiếu trước khi sửa');
    expect(
      (await offlineSavingsGoalQueue.sync('token', 7, expected, () => true))
        .synced,
    ).toBe(1);
    expect(savingsService.update).toHaveBeenCalledTimes(1);
    expect(await offlineSavingsGoalQueue.list(7)).toHaveLength(0);
  });

  it('does not overwrite changed server metadata', async () => {
    await offlineSavingsGoalQueue.update(7, goal(), payload);
    (savingsService.getAll as jest.Mock).mockResolvedValue([
      goal({ name: 'Quỹ học tập' }),
    ]);
    const result = await offlineSavingsGoalQueue.sync(
      'token',
      7,
      await offlineSavingsGoalQueue.preview(7),
      () => true,
    );
    expect(result.needsReview).toBe(1);
    expect(savingsService.update).not.toHaveBeenCalled();
  });

  it('does not discard changes after the review snapshot is stale', async () => {
    await offlineSavingsGoalQueue.update(7, goal(), payload);
    const expected = await offlineSavingsGoalQueue.preview(7);
    await offlineSavingsGoalQueue.update(7, goal(), {
      ...payload,
      note: 'Cho gia đình',
    });
    await expect(offlineSavingsGoalQueue.discard(7, expected)).rejects.toThrow(
      'đã thay đổi',
    );
    expect(await offlineSavingsGoalQueue.list(7)).toHaveLength(1);
  });

  it('rebases only after the user reviewed an unchanged server copy', async () => {
    await offlineSavingsGoalQueue.update(7, goal(), payload);
    const reviewed = goal({ name: 'Quỹ học tập' });
    (savingsService.getAll as jest.Mock).mockResolvedValue([reviewed]);
    await offlineSavingsGoalQueue.sync(
      'token',
      7,
      await offlineSavingsGoalQueue.preview(7),
      () => true,
    );
    const expected = await offlineSavingsGoalQueue.preview(7);
    const rebased = await offlineSavingsGoalQueue.rebaseReviewed(
      'token',
      7,
      expected,
      { 4: reviewed },
    );
    expect(rebased[0].revision).toBeGreaterThan(expected[0].revision);
    expect((await offlineSavingsGoalQueue.list(7))[0].base.name).toBe(
      'Quỹ học tập',
    );
  });

  it('rejects a reviewed server copy that changed before applying the local choice', async () => {
    await offlineSavingsGoalQueue.update(7, goal(), payload);
    (savingsService.getAll as jest.Mock).mockResolvedValue([
      goal({ name: 'Quỹ học tập' }),
    ]);
    await offlineSavingsGoalQueue.sync(
      'token',
      7,
      await offlineSavingsGoalQueue.preview(7),
      () => true,
    );
    const expected = await offlineSavingsGoalQueue.preview(7);
    await expect(
      offlineSavingsGoalQueue.rebaseReviewed('token', 7, expected, {
        4: goal(),
      }),
    ).rejects.toThrow('đã đổi');
    expect(savingsService.update).not.toHaveBeenCalled();
    expect(await offlineSavingsGoalQueue.list(7)).toHaveLength(1);
  });
});
