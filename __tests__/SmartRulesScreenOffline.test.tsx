import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TestRenderer, { act } from 'react-test-renderer';
import SmartRulesScreen from '../src/screens/home/SmartRulesScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
}));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7 } }),
}));
jest.mock('../src/context/FinanceContext', () => {
  const categories = [
    { id: 9, name: 'Di chuyển', type: 'EXPENSE', cash_flow_group: 'NORMAL' },
  ];
  return { useFinance: () => ({ categories }) };
});

const key = 'quan_ly_chi_tieu_smart_rules_7';
const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  jest
    .mocked(AsyncStorage.getItem)
    .mockImplementation(async item => storage.get(item) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (item, value) => {
    storage.set(item, value);
  });
});

it('does not recreate the sample rule after all rules were deleted and the screen reopened', async () => {
  storage.set(key, '[]');
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<SmartRulesScreen />);
  });
  expect(renderer.root.findAllByProps({ children: 'Grab' })).toHaveLength(0);
  expect(storage.get(key)).toBe('[]');
  await act(async () => renderer.unmount());
});

it('creates the sample rule once for a user who has never saved rules', async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<SmartRulesScreen />);
  });
  expect(renderer.root.findAllByProps({ children: 'Grab' }).length).toBeGreaterThan(0);
  expect(JSON.parse(storage.get(key) ?? '[]')).toHaveLength(1);
  await act(async () => renderer.unmount());
});
