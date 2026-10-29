import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import WidgetQuickEntry from '../src/screens/widget/WidgetQuickEntry';
import { homeWidget } from '../src/native/homeWidget';
import {
  dashboardCache,
  type DashboardCache,
} from '../src/services/dashboardCache';
import { transactionsService } from '../src/services/transactions';
import { launchCamera } from 'react-native-image-picker';
import { saveWidgetEntry } from '../src/services/widgetQuickEntry';
jest.mock('react-native-image-picker', () => ({ launchCamera: jest.fn() }));
jest.mock('../src/context/AuthContext', () => ({
  AuthProvider: ({ children }: React.PropsWithChildren) => children,
  useAuth: () => ({
    user: { id: 7 },
    token: 'token',
    isRestoringSession: false,
    isCurrencySetupRequired: false,
    isOfflineSession: false,
  }),
}));
jest.mock('../src/components/HomeWidgetSession', () => () => null);
jest.mock('../src/components/OfflineSessionSync', () => () => null);
jest.mock('../src/hooks/useVoiceInput', () => ({
  useVoiceInput: () => ({
    status: 'idle',
    cancel: jest.fn(),
    toggle: jest.fn().mockResolvedValue(undefined),
  }),
}));
jest.mock('../src/services/api', () => ({
  getApiBaseUrl: () => 'http://qa.test',
}));
jest.mock('../src/native/homeWidget', () => ({
  homeWidget: {
    validateLink: jest.fn(),
    closeQuickEntry: jest.fn().mockResolvedValue(true),
  },
}));
jest.mock('../src/services/dashboardCache', () => ({
  dashboardCache: { read: jest.fn(), subscribe: jest.fn(() => jest.fn()) },
}));
jest.mock('../src/services/transactions', () => ({
  transactionsService: { analyzeReceipt: jest.fn() },
}));
jest.mock('../src/services/widgetQuickEntry', () => ({
  ...jest.requireActual('../src/services/widgetQuickEntry'),
  saveWidgetEntry: jest.fn(),
}));
const data = {
  wallets: [{ id: 7, name: 'Ví QA', currency: 'VND' }],
  categories: [
    { id: 9, name: 'Đi lại', type: 'EXPENSE' },
    { id: 10, name: 'Lương', type: 'INCOME' },
  ],
  transactions: [],
} as unknown as DashboardCache;
const entryUrl =
  'quanlychitieu://quick-entry?scope=http%3A%2F%2Fqa.test%3A7&type=EXPENSE&event=abc&category=9';
let renderer: TestRenderer.ReactTestRenderer;
const control = (name: string) =>
  renderer.root.findAll(
    node =>
      node.props.accessibilityLabel === name && typeof node.type !== 'string',
  )[0];
const press = async (name: string) => {
  await act(async () => control(name).props.onPress());
};
const fill = async (name: string, value: string) => {
  await act(async () => control(name).props.onChangeText(value));
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(homeWidget.validateLink).mockResolvedValue(true);
  jest.mocked(dashboardCache.read).mockResolvedValue(data);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
const mount = async (url = entryUrl) => {
  await act(async () => {
    renderer = TestRenderer.create(<WidgetQuickEntry entryUrl={url} />);
  });
};
it('requires wallet and preview before saving, locks repeated confirms, then closes the panel', async () => {
  await mount();
  await fill('Số tiền widget', '25000');
  await press('Kiểm tra');
  expect(saveWidgetEntry).not.toHaveBeenCalled();
  await press('Chọn ví');
  await press('Ví QA · VND');
  await press('Kiểm tra');
  expect(saveWidgetEntry).not.toHaveBeenCalled();
  let done!: (v: 'SAVED') => void;
  jest.mocked(saveWidgetEntry).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        done = resolve;
      }),
  );
  const button = control('Xác nhận lưu');
  let pending!: Promise<void>;
  await act(async () => {
    pending = button.props.onPress();
    button.props.onPress();
  });
  expect(saveWidgetEntry).toHaveBeenCalledTimes(1);
  expect(jest.mocked(saveWidgetEntry).mock.calls[0][2]).toMatchObject({
    wallet_id: 7,
    category_id: 9,
    amount: '25000',
    type: 'EXPENSE',
  });
  await act(async () => {
    done('SAVED');
    await pending;
  });
  expect(homeWidget.closeQuickEntry).toHaveBeenCalledWith('SAVED');
});
it('cancel never writes and a stale widget link cannot show financial fields', async () => {
  await mount();
  await press('Hủy');
  expect(saveWidgetEntry).not.toHaveBeenCalled();
  await act(async () => renderer.unmount());
  jest.mocked(homeWidget.validateLink).mockResolvedValue(false);
  await mount();
  expect(
    renderer.root.findAll(n => n.props.accessibilityLabel === 'Số tiền widget'),
  ).toHaveLength(0);
});
it('camera fills editable items and amount but never saves or attaches its photo', async () => {
  jest.mocked(launchCamera).mockResolvedValue({
    assets: [{ uri: 'file:///temporary.jpg', type: 'image/jpeg' }],
  });
  jest.mocked(transactionsService.analyzeReceipt).mockResolvedValue({
    amount: 79000,
    currency: 'VND',
    note: 'Café',
    receipt_items: [{ name: 'Bạc xỉu (2)', amount: 94000 }],
    warnings: ['Giảm 15.000'],
  });
  await mount(entryUrl + '&action=CAMERA');
  expect(control('Số tiền widget').props.value).toBe('79000');
  expect(control('Tên món 1').props.value).toBe('Bạc xỉu (2)');
  expect(saveWidgetEntry).not.toHaveBeenCalled();
  await press('Chọn ví');
  await press('Ví QA · VND');
  await press('Kiểm tra');
  jest.mocked(saveWidgetEntry).mockResolvedValueOnce('PENDING');
  await press('Xác nhận lưu');
  const payload = jest.mocked(saveWidgetEntry).mock.calls[0][2];
  expect(payload).toMatchObject({
    amount: '79000',
    receipt_items: [{ name: 'Bạc xỉu (2)', amount: 94000 }],
  });
  expect(JSON.stringify(payload)).not.toContain('temporary.jpg');
  expect(homeWidget.closeQuickEntry).toHaveBeenCalledWith('PENDING');
});
it('updates the complete category cache while keeping the entered amount', async () => {
  await mount();
  await fill('Số tiền widget', '25000');
  jest
    .mocked(dashboardCache.read)
    .mockResolvedValue({
      ...data,
      categories: [
        ...data.categories,
        { id: 35, name: 'Bảo hiểm', type: 'EXPENSE' },
      ],
    });
  await act(async () => {
    jest.mocked(dashboardCache.subscribe).mock.calls[0][0]();
  });
  await press('Đi lại');
  expect(control('Bảo hiểm')).toBeDefined();
  await press('Bảo hiểm');
  expect(control('Số tiền widget').props.value).toBe('25000');
  expect(control('Bảo hiểm')).toBeDefined();
  expect(saveWidgetEntry).not.toHaveBeenCalled();
});
