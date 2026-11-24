import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import WalletsScreen from '../src/screens/home/WalletsScreen';
import { walletsService } from '../src/services/wallets';
import { budgetsService } from '../src/services/budgets';
import { dashboardCache } from '../src/services/dashboardCache';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    jest.requireActual<typeof React>('react').useEffect(callback, [callback]);
  },
}));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'session-token',
    user: { id: 7, role: 'BASIC', currency_default: 'VND' },
    isOfflineSession: false,
  }),
}));
jest.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({ preferredCurrency: 'VND', transactions: [] }),
}));
jest.mock('../src/services/wallets', () => ({
  walletsService: { getAll: jest.fn() },
}));
jest.mock('../src/services/budgets', () => ({
  budgetsService: { getAll: jest.fn() },
}));
jest.mock('../src/services/dashboardCache', () => ({
  dashboardCache: {
    read: jest.fn(),
    readReferences: jest.fn(),
    saveReferences: jest.fn(),
  },
}));

it('shows fresh wallets when the separate budget API fails', async () => {
  jest.mocked(dashboardCache.read).mockResolvedValue(null);
  jest.mocked(dashboardCache.readReferences).mockResolvedValue(null);
  jest.mocked(walletsService.getAll).mockResolvedValue([
    {
      id: 8,
      user_id: 7,
      name: 'Ví sinh hoạt',
      wallet_type: 'CASH',
      currency: 'VND',
      balance: '1000',
      created_at: '2026-11-21T00:00:00Z',
    },
  ]);
  jest
    .mocked(budgetsService.getAll)
    .mockRejectedValue(new Error('Budget API unavailable'));
  let renderer: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <WalletsScreen
        navigation={{ goBack: jest.fn() } as never}
        route={{ params: {} } as never}
      />,
    );
  });
  const texts = renderer!.root
    .findAllByType(Text)
    .map(node => node.props.children);
  expect(texts).toContain('Ví sinh hoạt');
  expect(texts).not.toContain('Bạn chưa có ví nào');
  await act(async () => renderer!.unmount());
});
