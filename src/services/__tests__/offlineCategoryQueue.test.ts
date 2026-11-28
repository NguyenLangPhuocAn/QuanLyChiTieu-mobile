import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineCategoryQueue } from '../offlineCategoryQueue';
import { getApiStorageBaseUrl } from '../api';
import type { Category } from '../../types/category';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('../categories', () => ({
  categoriesService: {
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

const storage = new Map<string, string>();
const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;
const payload = {
  name: 'Thú cưng',
  type: 'EXPENSE' as const,
  cash_flow_group: 'NORMAL' as const,
};
const asCategory = (id: number): Category => ({ id, ...payload });

describe('offlineCategoryQueue.remove', () => {
  beforeEach(() => {
    storage.clear();
    jest.clearAllMocks();
    getItem.mockImplementation(async (key: string) => storage.get(key) ?? null);
    setItem.mockImplementation(async (key: string, value: string) => {
      storage.set(key, value);
    });
  });

  it('removes an unused offline category', async () => {
    const created = await offlineCategoryQueue.create(7, payload);
    await offlineCategoryQueue.remove(7, asCategory(created.id));
    expect(await offlineCategoryQueue.list(7)).toHaveLength(0);
  });

  it('blocks deleting a category used by a pending transaction edit', async () => {
    const created = await offlineCategoryQueue.create(7, payload);
    storage.set(
      `offline-transaction-changes:v1:${getApiStorageBaseUrl()}:7`,
      JSON.stringify([
        { transactionId: 3, action: 'UPDATE', payload: { category_id: created.id } },
      ]),
    );
    await expect(
      offlineCategoryQueue.remove(7, asCategory(created.id)),
    ).rejects.toThrow('giao dịch sửa chờ đồng bộ');
    expect(await offlineCategoryQueue.list(7)).toHaveLength(1);
  });

  it('blocks deleting a category used by a pending budget', async () => {
    storage.set(
      `offline-budgets:v1:${getApiStorageBaseUrl()}:7`,
      JSON.stringify({
        changes: [{ id: -1, action: 'CREATE', payload: { category_id: 12 } }],
      }),
    );
    await expect(offlineCategoryQueue.remove(7, asCategory(12))).rejects.toThrow(
      'ngân sách chờ đồng bộ',
    );
  });
});
