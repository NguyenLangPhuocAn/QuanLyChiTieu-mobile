import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Text } from 'react-native';
import { Plus } from 'lucide-react-native';
import CategoriesScreen from '../src/screens/home/CategoriesScreen';
import { useAuth } from '../src/context/AuthContext';
import { useFinance } from '../src/context/FinanceContext';
import { categoriesService } from '../src/services/categories';
import { dashboardCache } from '../src/services/dashboardCache';

jest.mock('../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../src/context/FinanceContext', () => ({
  useFinance: jest.fn(),
}));

jest.mock('../src/services/categories', () => ({
  categoriesService: {
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    uploadIcon: jest.fn(),
  },
}));
jest.mock('../src/services/dashboardCache', () => ({
  dashboardCache: { read: jest.fn() },
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseFinance = useFinance as jest.MockedFunction<typeof useFinance>;
const mockedCategoriesService = categoriesService as jest.Mocked<typeof categoriesService>;
const mockedCache = dashboardCache as jest.Mocked<typeof dashboardCache>;

const renderCategoriesScreen = async (
  role: 'BASIC' | 'PREMIUM' | 'ADMIN',
  params: Record<string, unknown> = {},
  offline = false,
) => {
  mockedUseAuth.mockReturnValue({
    token: 'token-123',
    isOfflineSession: offline,
    user: {
      id: 1,
      email: 'user@example.com',
      role,
      wallet_count: 0,
    },
  } as ReturnType<typeof useAuth>);
  mockedUseFinance.mockReturnValue({
    preferredCurrency: 'VND',
    setPreferredCurrency: jest.fn(),
    transactions: [],
    setTransactions: jest.fn(),
    categories: [],
    setCategories: jest.fn(),
    tags: [],
    setTags: jest.fn(),
    budgets: [],
    setBudgets: jest.fn(),
    selectedTransactionCategory: null,
    setSelectedTransactionCategory: jest.fn(),
    selectedBudgetCategory: null,
    setSelectedBudgetCategory: jest.fn(),
  } as ReturnType<typeof useFinance>);
  mockedCategoriesService.getAll.mockResolvedValue([]);

  let renderer: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <CategoriesScreen
        navigation={{ goBack: jest.fn() } as never}
        route={{ params } as never}
      />,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  return renderer!;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedCache.read.mockResolvedValue(null);
});

it('does not render an add category button for Basic users', async () => {
  const renderer = await renderCategoriesScreen('BASIC');

  expect(renderer.root.findAllByType(Plus)).toHaveLength(0);
});

it('renders a single add category button for Premium users', async () => {
  const renderer = await renderCategoriesScreen('PREMIUM');

  expect(renderer.root.findAllByType(Plus)).toHaveLength(1);
});

it('hides the income tab when selecting a budget category', async () => {
  const renderer = await renderCategoriesScreen('BASIC', {
    selectMode: true,
    selectTarget: 'budget',
    categoryType: 'EXPENSE',
  });

  expect(renderer.root.findAllByProps({ children: 'Thu' })).toHaveLength(0);
});

it('loads saved categories without calling the API during an offline session', async () => {
  mockedCache.read.mockResolvedValue({
    server: 'https://qa.test',
    updatedAt: '2026-11-16T10:00:00.000Z',
    categories: [{ id: 7, name: 'Ăn uống QA', type: 'EXPENSE' }],
    wallets: [],
    transactions: [],
    tags: [],
    budgets: [],
    savingsGoals: [],
  } as never);
  const renderer = await renderCategoriesScreen('BASIC', {}, true);

  expect(mockedCache.read).toHaveBeenCalledWith(1);
  expect(mockedCategoriesService.getAll).not.toHaveBeenCalled();
  expect(mockedUseFinance().setCategories).toHaveBeenCalledWith([
    expect.objectContaining({ id: 7, name: 'Ăn uống QA' }),
  ]);
  expect(
    renderer.root.findAllByType(Text).some(node =>
      String(node.props.children).includes('Dữ liệu danh mục trên máy'),
    ),
  ).toBe(true);
});

it('blocks category creation while offline before opening an editor', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const renderer = await renderCategoriesScreen('PREMIUM', {}, true);
  let button = renderer.root.findByType(Plus).parent;
  while (button && typeof button.props.onPress !== 'function') button = button.parent;

  ReactTestRenderer.act(() => {
    button?.props.onPress();
  });

  expect(alert).toHaveBeenCalledWith('Cần kết nối', expect.stringContaining('danh mục cần có mạng'));
  expect(mockedCategoriesService.create).not.toHaveBeenCalled();
  alert.mockRestore();
});
