import React from 'react';
import { ScrollView } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import FinancialPlanScreen from '../src/screens/home/FinancialPlanScreen';
import { useAuth } from '../src/context/AuthContext';
import { financialPlansService } from '../src/services/financialPlans';
import type { FinancialPlanOverview } from '../src/types/financialPlan';
import { formatCurrency } from '../src/utils/format';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    const ReactModule = jest.requireActual<typeof React>('react');
    ReactModule.useEffect(callback, [callback]);
  },
}));

jest.mock('../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../src/services/financialPlans', () => ({
  financialPlansService: { getOverview: jest.fn() },
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedService = financialPlansService as jest.Mocked<
  typeof financialPlansService
>;

const overview: FinancialPlanOverview = {
  generated_at: '2026-09-01T08:00:00.000Z',
  methodology: {
    history_months: 4,
    forecast_months: 4,
    excludes_internal_transfers: true,
    note: 'Dự báo chỉ mang tính tham khảo.',
  },
  cashflow_plans: [
    {
      currency: 'VND',
      history: [
        {
          month: '2026-05',
          income: 5000000,
          expense: 3000000,
          transaction_count: 4,
        },
      ],
      forecast: [
        {
          month: '2026-09',
          projected_income: 5000000,
          projected_expense: 3200000,
          projected_net: 1800000,
        },
      ],
      summary: {
        history_average_income: 5000000,
        history_average_expense: 3000000,
        forecast_average_income: 5000000,
        forecast_average_expense: 3200000,
        forecast_average_net: 1800000,
        transaction_count: 4,
        status: 'STABLE',
        confidence: 'MEDIUM',
      },
    },
  ],
  savings_plans: [
    {
      id: 1,
      name: 'Laptop',
      wallet_id: 8,
      currency: 'VND',
      target_amount: 10000000,
      current_amount: 12000000,
      remaining_amount: 0,
      progress_percent: 120,
      suggested_monthly: 0,
      contributed_this_month: 2000000,
      expected_by_today: 10000000,
      monthly_gap: 0,
      status: 'ON_TRACK',
    },
  ],
};

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({ token: 'token-123' } as ReturnType<
    typeof useAuth
  >);
});

it('recalculates the category limit and total reduction for the chosen rate and horizon', async () => {
  mockedService.getOverview.mockResolvedValue({
    ...overview,
    cashflow_plans: [
      {
        ...overview.cashflow_plans[0],
        spending_actions: [
          {
            category_id: 7,
            category: 'Mua sắm',
            monthly_baseline: 1000000,
            monthly_target: 800000,
            monthly_reduction: 200000,
            reduction_percent: 20,
            steps: ['Chờ trước khi mua.'],
          },
        ],
      },
    ],
  });
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <FinancialPlanScreen
        navigation={navigation as never}
        route={{} as never}
      />,
    );
  });
  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Giảm 10% cho Mua sắm (VND)' })
      .props.onPress();
    renderer.root
      .findByProps({ accessibilityLabel: 'Dự báo 2 tháng' })
      .props.onPress();
  });
  expect(
    renderer.root.findByProps({
      children: `Thử giảm 10% → giới hạn ${formatCurrency(900000)}/tháng`,
    }),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({
      accessibilityLabel: 'Giảm 10% cho Mua sắm (VND)',
    }).props.accessibilityState.selected,
  ).toBe(true);
  const total = renderer.root.findAll(
    node =>
      Array.isArray(node.props.children) &&
      node.props.children.includes('Nếu duy trì các mức giảm trên trong '),
  );
  expect(total[0].props.children).toContain(formatCurrency(200000));
  await ReactTestRenderer.act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Lập ngân sách cho Mua sắm' })
      .props.onPress();
  });
  expect(navigation.navigate).toHaveBeenCalledWith('Budgets', {
    draft: {
      categoryId: 7,
      categoryName: 'Mua sắm',
      currency: 'VND',
      monthlyLimit: 900000,
    },
  });
  expect(mockedService.getOverview).toHaveBeenCalledTimes(1);
  await ReactTestRenderer.act(async () => renderer.unmount());
});

it('keeps the latest refresh when an older request finishes afterwards', async () => {
  mockedService.getOverview.mockResolvedValueOnce(overview);
  let resolveOlder!: (value: FinancialPlanOverview) => void;
  let resolveLatest!: (value: FinancialPlanOverview) => void;
  mockedService.getOverview
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveOlder = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveLatest = resolve;
        }),
    );
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <FinancialPlanScreen
        navigation={navigation as never}
        route={{} as never}
      />,
    );
  });
  await ReactTestRenderer.act(async () => {
    const refresh =
      renderer.root.findByType(ScrollView).props.refreshControl.props.onRefresh;
    refresh();
    refresh();
  });
  await ReactTestRenderer.act(async () => {
    resolveLatest({
      ...overview,
      savings_plans: [{ ...overview.savings_plans[0], name: 'Mục tiêu mới' }],
    });
  });
  await ReactTestRenderer.act(async () => {
    resolveOlder(overview);
  });
  expect(
    renderer.root.findAllByProps({ children: 'Mục tiêu mới' }).length,
  ).toBeGreaterThan(0);
  expect(renderer.root.findAllByProps({ children: 'Laptop' })).toHaveLength(0);
  await ReactTestRenderer.act(async () => renderer.unmount());
});

it('changes forecast rows and totals when choosing a shorter horizon', async () => {
  mockedService.getOverview.mockResolvedValue({
    ...overview,
    cashflow_plans: [
      {
        ...overview.cashflow_plans[0],
        forecast: [1, 2, 3, 4].map(month => ({
          month: `2026-${String(month + 8).padStart(2, '0')}`,
          projected_income: 5000000,
          projected_expense: 3000000,
          projected_net: 2000000,
        })),
      },
    ],
  });
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <FinancialPlanScreen
        navigation={navigation as never}
        route={{} as never}
      />,
    );
  });
  expect(
    renderer!.root.findAllByProps({ children: 'T12/2026' }).length,
  ).toBeGreaterThan(0);
  await ReactTestRenderer.act(async () =>
    renderer!.root
      .findByProps({ accessibilityLabel: 'Dự báo 1 tháng' })
      .props.onPress(),
  );
  expect(renderer!.root.findAllByProps({ children: 'T12/2026' })).toHaveLength(
    0,
  );
  expect(
    renderer!.root.findByProps({ accessibilityLabel: 'Dự báo 1 tháng' }).props
      .accessibilityState.selected,
  ).toBe(true);
  expect(mockedService.getOverview).toHaveBeenCalledTimes(1);
  await ReactTestRenderer.act(async () => renderer!.unmount());
});

it('renders readable forecast columns and clamps savings progress', async () => {
  mockedService.getOverview.mockResolvedValue(overview);
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <FinancialPlanScreen
        navigation={navigation as never}
        route={{} as never}
      />,
    );
  });

  expect(renderer!.root.findByProps({ children: 'Thu dự kiến' })).toBeTruthy();
  expect(renderer!.root.findByProps({ children: 'Chi dự kiến' })).toBeTruthy();
  expect(
    renderer!.root.findAll(
      node =>
        Array.isArray(node.props.style) &&
        node.props.style.some(
          (style: { width?: string } | undefined) => style?.width === '100%',
        ),
    ),
  ).not.toHaveLength(0);
});

it('shows a retry state and recovers after a loading failure', async () => {
  mockedService.getOverview
    .mockRejectedValueOnce(new Error('Mất kết nối'))
    .mockResolvedValueOnce({
      ...overview,
      cashflow_plans: [],
      savings_plans: [],
    });
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <FinancialPlanScreen
        navigation={navigation as never}
        route={{} as never}
      />,
    );
  });

  const retry = renderer!.root.findByProps({
    accessibilityLabel: 'Thử tải lại kế hoạch',
  });
  await ReactTestRenderer.act(async () => retry.props.onPress());

  expect(mockedService.getOverview).toHaveBeenCalledTimes(2);
  expect(
    renderer!.root.findByProps({ children: 'Chưa có dữ liệu để dự báo' }),
  ).toBeTruthy();
  expect(
    renderer!.root.findByProps({ children: 'Chưa có kế hoạch tiết kiệm' }),
  ).toBeTruthy();
});
