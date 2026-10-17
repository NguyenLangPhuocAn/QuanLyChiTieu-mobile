import AsyncStorage from '@react-native-async-storage/async-storage';
import { financialPlanningService } from '../financialPlanning';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const storage = new Map<string, string>();
const getItem = AsyncStorage.getItem as jest.MockedFunction<
  typeof AsyncStorage.getItem
>;
const setItem = AsyncStorage.setItem as jest.MockedFunction<
  typeof AsyncStorage.setItem
>;

describe('financialPlanningService', () => {
  beforeEach(() => {
    storage.clear();
    jest.clearAllMocks();
    getItem.mockImplementation(async key => storage.get(key) ?? null);
    setItem.mockImplementation(async (key, value) => {
      storage.set(key, value);
    });
  });

  it('persists one decision per recurring pattern', async () => {
    await financialPlanningService.setRecurringDecision(
      7,
      'expense|netflix|80000',
      'CONFIRMED',
    );
    await financialPlanningService.setRecurringDecision(
      7,
      'expense|netflix|80000',
      'IGNORED',
    );

    await expect(
      financialPlanningService.listRecurringDecisions(7),
    ).resolves.toEqual([
      expect.objectContaining({
        patternKey: 'expense|netflix|80000',
        status: 'IGNORED',
      }),
    ]);
  });

  it('adds and removes a valid manual money plan', async () => {
    const plan = await financialPlanningService.addManualPlan(7, {
      label: 'Tiền nhà',
      type: 'EXPENSE',
      amount: 4_000_000,
      currency: 'vnd',
      date: '2026-11-01',
    });

    await expect(financialPlanningService.listManualPlans(7)).resolves.toEqual([
      expect.objectContaining({
        id: plan.id,
        label: 'Tiền nhà',
        currency: 'VND',
      }),
    ]);

    await financialPlanningService.removeManualPlan(7, plan.id);
    await expect(financialPlanningService.listManualPlans(7)).resolves.toEqual(
      [],
    );
  });

  it('rejects an invalid date without writing data', async () => {
    await expect(
      financialPlanningService.addManualPlan(7, {
        label: 'Tiền nhà',
        type: 'EXPENSE',
        amount: 4_000_000,
        currency: 'VND',
        date: '2026-02-31',
      }),
    ).rejects.toThrow('Ngày dự kiến chưa hợp lệ');
    await expect(financialPlanningService.listManualPlans(7)).resolves.toEqual(
      [],
    );
  });
});
