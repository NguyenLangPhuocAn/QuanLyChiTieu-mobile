import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import BudgetsScreen from '../src/screens/home/BudgetsScreen';
import { budgetsService } from '../src/services/budgets';
import { categoriesService } from '../src/services/categories';
import { walletsService } from '../src/services/wallets';
import type { Budget } from '../src/types/budget';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    jest.requireActual<typeof React>('react').useEffect(callback, [callback]);
  },
}));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token' }),
}));
jest.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    selectedBudgetCategory: null,
    setSelectedBudgetCategory: jest.fn(),
  }),
}));
jest.mock('../src/services/budgets', () => ({
  budgetsService: {
    getPage: jest.fn(),
    getAll: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
}));
jest.mock('../src/services/wallets', () => ({
  walletsService: {
    getAll: jest
      .fn()
      .mockResolvedValue([
        { id: 2, name: 'Ví USD', currency: 'USD', wallet_type: 'BANK' },
      ]),
  },
}));
jest.mock('../src/services/categories', () => ({
  categoriesService: { getAll: jest.fn().mockResolvedValue([]) },
}));
const service = jest.mocked(budgetsService);
const budget: Budget = {
  id: 1,
  user_id: 7,
  name: 'Đi lại',
  scope: 'WALLET',
  wallet_id: 2,
  wallet_name: 'Ví USD',
  wallet_currency: 'USD',
  limit_amount: 12.5,
  period: 'MONTH',
  start_date: '2026-09-01',
  end_date: '2026-09-30',
  spent: 0,
  remaining: 12.5,
  percent: 0,
  percentage: 0,
  status: 'NORMAL',
};
const page = {
  data: [budget],
  meta: { page: 1, total: 1, totalPages: 1, limit: 10 },
};
beforeEach(() => {
  jest.clearAllMocks();
  service.getPage.mockResolvedValue(page);
  service.getAll.mockResolvedValue([budget]);
  jest.mocked(categoriesService.getAll).mockResolvedValue([]);
  jest
    .mocked(walletsService.getAll)
    .mockResolvedValue([
      { id: 2, name: 'Ví USD', currency: 'USD', wallet_type: 'BANK' },
    ] as never);
});
const mount = async (draft?: {
  categoryId: number;
  categoryName: string;
  currency: string;
  monthlyLimit: number;
}) => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <BudgetsScreen
        navigation={{ navigate: jest.fn(), goBack: jest.fn() } as never}
        route={{ params: { draft } } as never}
      />,
    );
  });
  return renderer;
};

it('prefills a category budget from the plan and only creates it after Save', async () => {
  jest
    .mocked(categoriesService.getAll)
    .mockResolvedValue([
      { id: 7, name: 'Mua sắm', type: 'EXPENSE', cash_flow_group: 'NORMAL' },
    ] as never);
  service.create.mockResolvedValue(budget);
  const renderer = await mount({
    categoryId: 7,
    categoryName: 'Mua sắm',
    currency: 'USD',
    monthlyLimit: 900.25,
  });
  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Hạn mức ngân sách' }).props
      .value,
  ).toBe('900.25');
  expect(service.create).not.toHaveBeenCalled();
  await act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: 'Lưu ngân sách' })
      .props.onPress();
  });
  expect(service.create).toHaveBeenCalledWith(
    'test-token',
    expect.objectContaining({
      category_id: 7,
      wallet_id: 2,
      limit_amount: '900.25',
      scope: 'CATEGORY',
      period: 'MONTH',
    }),
  );
  await act(async () => renderer.unmount());
});

it('requires a wallet choice for an aggregate plan and only offers the matching currency', async () => {
  jest
    .mocked(categoriesService.getAll)
    .mockResolvedValue([
      { id: 7, name: 'Mua sắm', type: 'EXPENSE', cash_flow_group: 'NORMAL' },
    ] as never);
  jest.mocked(walletsService.getAll).mockResolvedValue([
    { id: 2, name: 'USD chính', currency: 'USD', wallet_type: 'BANK' },
    { id: 3, name: 'USD phụ', currency: 'USD', wallet_type: 'BANK' },
    { id: 4, name: 'Ví đồng', currency: 'VND', wallet_type: 'CASH' },
  ] as never);
  const renderer = await mount({
    categoryId: 7,
    categoryName: 'Mua sắm',
    currency: 'USD',
    monthlyLimit: 25,
  });
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: 'Chọn ví Ví đồng' }),
  ).toHaveLength(0);
  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Chọn ví USD chính' }).props
      .accessibilityState.selected,
  ).toBe(false);
  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Chọn ví USD phụ' }).props
      .accessibilityState.selected,
  ).toBe(false);
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Chọn ví USD phụ' })
      .props.onPress();
  });
  await act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: 'Lưu ngân sách' })
      .props.onPress();
  });
  expect(service.create).toHaveBeenCalledWith(
    'test-token',
    expect.objectContaining({ wallet_id: 3, limit_amount: '25' }),
  );
  await act(async () => renderer.unmount());
});

it('keeps cents while editing and sends only one update for two immediate save taps', async () => {
  let finish!: (value: Budget) => void;
  service.update.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const renderer = await mount();
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Sửa ngân sách Đi lại' })
      .props.onPress();
  });
  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Hạn mức ngân sách' }).props
      .value,
  ).toBe('12.5');
  await act(async () => {
    const save = renderer.root.findByProps({
      accessibilityLabel: 'Lưu ngân sách',
    }).props.onPress;
    save();
    save();
  });
  expect(service.update).toHaveBeenCalledTimes(1);
  expect(service.update).toHaveBeenCalledWith(
    'test-token',
    1,
    expect.objectContaining({ limit_amount: '12.5', wallet_id: 2 }),
  );
  await act(async () => {
    finish(budget);
  });
  await act(async () => renderer.unmount());
});
it('distinguishes a filtered empty result from having no budgets', async () => {
  service.getPage.mockResolvedValue({
    ...page,
    data: [],
    meta: { ...page.meta, total: 0 },
  });
  const renderer = await mount();
  expect(
    renderer.root.findAllByProps({ children: 'Không tìm thấy ngân sách' })
      .length,
  ).toBeGreaterThan(0);
  expect(
    renderer.root.findAllByProps({ children: 'Chưa có ngân sách' }),
  ).toHaveLength(0);
  await act(async () => renderer.unmount());
});
it('offers retry after a loading error without claiming the list is empty', async () => {
  service.getPage.mockRejectedValueOnce(new Error('Network unavailable'));
  const renderer = await mount();
  expect(
    renderer.root.findAllByProps({ children: 'Chưa có ngân sách' }),
  ).toHaveLength(0);
  await act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: 'Thử tải lại ngân sách' })
      .props.onPress();
  });
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: 'Sửa ngân sách Đi lại',
    }).length,
  ).toBeGreaterThan(0);
  await act(async () => renderer.unmount());
});
