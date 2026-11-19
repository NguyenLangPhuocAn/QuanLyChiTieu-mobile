import AsyncStorage from '@react-native-async-storage/async-storage';
import { dashboardCache } from '../src/services/dashboardCache';
import { getApiStorageBaseUrl } from '../src/services/api';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), setItem: jest.fn(),
}));

const wallet = {
  id: 8, user_id: 7, name: 'Ví QA', currency: 'VND', balance: '100000',
  created_at: '2026-11-16T00:00:00.000Z',
};
const category = { id: 4, name: 'Ăn uống', type: 'EXPENSE' as const };

const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  jest.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
    storage.set(key, value);
  });
});

it('retains wallets and categories independently of a full dashboard snapshot', async () => {
  await dashboardCache.saveReferences(7, [wallet], [category]);
  expect(await dashboardCache.read(7)).toBeNull();
  expect(await dashboardCache.readReferences(7)).toEqual(expect.objectContaining({
    server: getApiStorageBaseUrl(),
    wallets: [wallet], categories: [category],
  }));
  expect(await dashboardCache.readReferences(8)).toBeNull();
});

it('rejects a malformed or foreign-server reference cache', async () => {
  const key = 'quan_ly_chi_tieu_transaction_references_7';
  await AsyncStorage.setItem(key, '{');
  expect(await dashboardCache.readReferences(7)).toBeNull();
  await AsyncStorage.setItem(key, JSON.stringify({
    server: 'https://other.invalid', wallets: [wallet], categories: [category],
    updatedAt: '2026-11-16T00:00:00.000Z',
  }));
  expect(await dashboardCache.readReferences(7)).toBeNull();
});
