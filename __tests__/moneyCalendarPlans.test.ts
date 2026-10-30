import AsyncStorage from '@react-native-async-storage/async-storage';
import { moneyCalendarPlans as service } from '../src/services/moneyCalendarPlans';
let mockServer = 'http://qa';
jest.mock('../src/services/api', () => ({ getApiBaseUrl: () => mockServer }));
const scope = { userId: 1, server: 'http://qa' };
const plan = {
  id: 'salary',
  label: 'Lương',
  date: '2026-11-01',
  amount: 5000000,
  currency: 'VND',
  type: 'INCOME' as const,
};
const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  jest
    .mocked(AsyncStorage.getItem)
    .mockImplementation(async key => storage.get(key) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
    storage.set(key, value);
  });
  mockServer = scope.server;
});
it('persists plans isolated by account and backend, then removes only the requested plan', async () => {
  await service.add(scope, plan);
  expect(await service.read(scope)).toEqual([plan]);
  expect(await service.read({ ...scope, userId: 2 })).toEqual([]);
  expect(await service.read({ ...scope, server: 'http://other' })).toEqual([]);
  await service.remove(scope, plan.id);
  expect(await service.read(scope)).toEqual([]);
});
it('serializes writes and rejects duplicate ids or a changed backend', async () => {
  await Promise.all([
    service.add(scope, plan),
    service.add(scope, { ...plan, id: 'fee' }),
  ]);
  expect(await service.read(scope)).toHaveLength(2);
  await expect(service.add(scope, plan)).rejects.toThrow('tồn tại');
  mockServer = 'http://other';
  await expect(service.add(scope, { ...plan, id: 'late' })).rejects.toThrow(
    'thay đổi',
  );
});
it('preserves corrupt storage and never replaces it when adding a plan', async () => {
  const key = 'money-calendar:v1:http://qa:1';
  await AsyncStorage.setItem(key, 'broken');
  await expect(service.add(scope, plan)).rejects.toThrow('giữ nguyên');
  expect(await AsyncStorage.getItem(key)).toBe('broken');
});
