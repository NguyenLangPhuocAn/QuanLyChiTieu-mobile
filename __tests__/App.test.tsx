/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import App from '../App';
import ChatbotScreen from '../src/screens/home/ChatbotScreen';
import NotificationsScreen from '../src/screens/home/NotificationsScreen';
import NotificationSettingsScreen from '../src/screens/home/NotificationSettingsScreen';
import WalletTransactionsScreen from '../src/screens/home/WalletTransactionsScreen';
import { useAuth } from '../src/context/AuthContext';
import { notificationsService } from '../src/services/notifications';
import { transactionsService } from '../src/services/transactions';
import { formatCurrency } from '../src/utils/format';

jest.mock('../src/context/AuthContext', () => {
  const actual = jest.requireActual('../src/context/AuthContext');

  return {
    ...actual,
    useAuth: jest.fn(),
  };
});

jest.mock('../src/services/notifications', () => ({
  notificationsService: {
    getAll: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    remove: jest.fn(),
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
  },
}));

jest.mock('../src/services/transactions', () => ({
  transactionsService: {
    getPage: jest.fn(),
  },
}));

jest.mock('react-native-webview', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  return {
    WebView: (props: Record<string, unknown>) =>
      ReactModule.createElement(View, props),
  };
});

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedNotificationsService = notificationsService as jest.Mocked<
  typeof notificationsService
>;
const mockedTransactionsService = transactionsService as jest.Mocked<
  typeof transactionsService
>;

const flattenTextChildren = (children: unknown): string => {
  if (Array.isArray(children)) {
    return children.map(flattenTextChildren).join('');
  }

  return typeof children === 'string' || typeof children === 'number'
    ? String(children)
    : '';
};

test('renders correctly', async () => {
  mockedUseAuth.mockReturnValue({
    user: null,
    token: null,
    isLoading: true,
  } as ReturnType<typeof useAuth>);
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});

it('renders the static chatbot assistant UI', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  mockedUseAuth.mockReturnValue({ token: null } as ReturnType<typeof useAuth>);

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <NavigationContainer>
        <ChatbotScreen />
      </NavigationContainer>,
    );
  });

  expect(
    renderer!.root.findByProps({ children: 'Trợ lý tài chính' }),
  ).toBeTruthy();
  expect(renderer!.root.findByProps({ children: 'Hỏi nhanh' })).toBeTruthy();
  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Kế hoạch 4 tháng' })
      .props.onPress();
  });
  expect(
    renderer!.root.findByProps({ accessibilityLabel: 'Kế hoạch 4 tháng' }).props
      .accessibilityState.selected,
  ).toBe(true);
  expect(
    renderer!.root.findByProps({ accessibilityLabel: 'Kế hoạch 3 tháng' }).props
      .accessibilityState.selected,
  ).toBe(false);
  expect(
    renderer!.root.findByProps({ placeholder: 'Hỏi về chi tiêu của bạn...' }),
  ).toBeTruthy();
});

it('loads notifications and opens notification settings', async () => {
  mockedUseAuth.mockReturnValue({
    token: 'token-123',
  } as ReturnType<typeof useAuth>);
  mockedNotificationsService.getAll.mockResolvedValue({
    data: [
      {
        id: 7,
        user_id: 1,
        type: 'BUDGET_WARNING',
        severity: 'WARNING',
        title: 'Budget warning',
        message: 'Food budget is close to its limit',
        read_at: null,
        created_at: '2026-05-22T08:00:00.000Z',
      },
    ],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  });

  const navigation = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <NotificationsScreen
        navigation={navigation as never}
        route={{} as never}
      />,
    );
  });

  expect(mockedNotificationsService.getAll).toHaveBeenCalledWith('token-123');
  expect(
    renderer!.root.findByProps({ children: 'Budget warning' }),
  ).toBeTruthy();

  const settingsButton = renderer!.root.findByProps({
    accessibilityLabel: 'Cài đặt thông báo',
  });
  await ReactTestRenderer.act(async () => {
    settingsButton.props.onPress();
  });

  expect(navigation.navigate).toHaveBeenCalledWith('NotificationSettings');
});

it('updates notification settings optimistically', async () => {
  mockedUseAuth.mockReturnValue({
    token: 'token-123',
  } as ReturnType<typeof useAuth>);
  mockedNotificationsService.getSettings.mockResolvedValue({
    id: 1,
    user_id: 1,
    budget_alerts_enabled: true,
    budget_expiring_enabled: false,
    cashflow_forecast_enabled: true,
    savings_plan_alerts_enabled: true,
    system_notifications_enabled: true,
  });
  mockedNotificationsService.updateSettings.mockResolvedValue({
    id: 1,
    user_id: 1,
    budget_alerts_enabled: false,
    budget_expiring_enabled: false,
    cashflow_forecast_enabled: true,
    savings_plan_alerts_enabled: true,
    system_notifications_enabled: true,
  });

  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <NotificationSettingsScreen
        navigation={{ goBack: jest.fn() } as never}
        route={{} as never}
      />,
    );
  });

  const switchControl = renderer!.root.findByProps({
    accessibilityLabel: 'Cảnh báo ngân sách',
  });

  await ReactTestRenderer.act(async () => {
    switchControl.props.onValueChange(false);
  });

  expect(mockedNotificationsService.updateSettings).toHaveBeenCalledWith(
    'token-123',
    {
      budget_alerts_enabled: false,
    },
  );
});

it('renders wallet transaction amounts in display currency', async () => {
  mockedUseAuth.mockReturnValue({
    token: 'token-123',
  } as ReturnType<typeof useAuth>);
  mockedTransactionsService.getPage.mockResolvedValue({
    data: [
      {
        id: 1,
        wallet_id: 2,
        category_id: 3,
        amount: 10,
        currency: 'USD',
        display_amount: 250000,
        display_currency: 'VND',
        note: 'Coffee',
        transaction_date: '2026-05-24T00:00:00.000Z',
        type: 'EXPENSE',
        category: { id: 3, name: 'Food', type: 'EXPENSE' },
      },
    ],
    meta: {
      page: 1,
      limit: 100,
      total: 1,
      totalPages: 1,
      income: 0,
      expense: 10,
      net: -10,
    },
  });

  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <WalletTransactionsScreen
        navigation={{ goBack: jest.fn(), navigate: jest.fn() } as never}
        route={{ params: { walletId: 2, walletName: 'USD wallet' } } as never}
      />,
    );
  });

  expect(mockedTransactionsService.getPage).toHaveBeenCalledWith('token-123', {
    wallet_id: 2,
    page: 1,
    limit: 100,
  });
  expect(
    renderer!.root.findAll(
      node =>
        flattenTextChildren(node.props.children) ===
        `-${formatCurrency(250000, 'VND')}`,
    ),
  ).toHaveLength(2);
});
