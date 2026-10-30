import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import WidgetQuickEntry from '../src/screens/widget/WidgetQuickEntry';
import { homeWidget } from '../src/native/homeWidget';
import {
  dashboardCache,
  type DashboardCache,
} from '../src/services/dashboardCache';
import { transactionsService } from '../src/services/transactions';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Alert } from 'react-native';
import { saveWidgetEntry } from '../src/services/widgetQuickEntry';
import { saveWidgetLoanEntry } from '../src/services/widgetLoanEntry';
import DateTimePicker from '@react-native-community/datetimepicker';
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../src/services/widgetLoanEntry', () => ({
  ...jest.requireActual('../src/services/widgetLoanEntry'),
  saveWidgetLoanEntry: jest.fn(),
}));
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));
const mockAuth = {
  user: { id: 7 } as { id: number } | null,
  token: 'token' as string | null,
  isRestoringSession: false,
  isCurrencySetupRequired: false,
  isOfflineSession: false,
};
jest.mock('../src/context/AuthContext', () => ({
  AuthProvider: ({ children }: React.PropsWithChildren) => children,
  useAuth: () => mockAuth,
}));
jest.mock('../src/components/HomeWidgetSession', () => () => null);
jest.mock('../src/components/OfflineSessionSync', () => () => null);
let mockOnTranscript: (text: string) => void;
const mockVoice = {
  status: 'idle' as 'idle' | 'starting' | 'listening' | 'stopping',
  cancel: jest.fn(),
  toggle: jest.fn(),
};
jest.mock('../src/hooks/useVoiceInput', () => ({
  useVoiceInput: (callback: (text: string) => void) => {
    mockOnTranscript = callback;
    return mockVoice;
  },
}));
jest.mock('../src/services/api', () => ({
  getApiBaseUrl: () => 'http://qa.test',
}));
jest.mock('../src/native/homeWidget', () => ({
  homeWidget: {
    validateLink: jest.fn(),
    closeQuickEntry: jest.fn().mockResolvedValue(true),
    entryReady: jest.fn().mockResolvedValue(undefined),
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
const chooseDate = async (name: string, date: Date) => {
  await press(name);
  await act(async () =>
    renderer.root
      .findByType(DateTimePicker)
      .props.onChange({ type: 'set' }, date),
  );
};
const pickPhoto = async (name = 'Chụp ảnh') => {
  const choices = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
  const choice = choices?.find(item => item.text === name);
  expect(choice).toBeDefined();
  await act(async () => choice?.onPress?.());
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockVoice.status = 'idle';
  mockVoice.toggle.mockImplementation(async () => {
    mockVoice.status = 'starting';
  });
  mockVoice.cancel.mockImplementation(() => {
    mockVoice.status = 'idle';
  });
  Object.assign(mockAuth, {
    user: { id: 7 },
    token: 'token',
    isRestoringSession: false,
  });
  jest.mocked(homeWidget.validateLink).mockResolvedValue(true);
  jest.mocked(dashboardCache.read).mockResolvedValue(data);
});

it.each(['Vay', 'Cho vay'])(
  'previews %s with a person and wallet, never sends a normal transaction, and reuses its key on retry',
  async label => {
    await mount();
    await press('Vay/Nợ');
    if (label === 'Cho vay') await press('Cho vay');
    await fill('Số tiền widget', '100000');
    await press('Kiểm tra');
    expect(saveWidgetLoanEntry).not.toHaveBeenCalled();
    await fill('Tên người vay nợ widget', 'Nguoi QA');
    await chooseDate('Ngày hẹn trả widget', new Date(2026, 10, 30));
    await press('Ví QA · VND');
    await press('Kiểm tra');
    expect(saveWidgetLoanEntry).not.toHaveBeenCalled();
    jest
      .mocked(saveWidgetLoanEntry)
      .mockRejectedValueOnce(Error('Mạng chưa sẵn sàng'));
    await press('Xác nhận lưu');
    expect(homeWidget.closeQuickEntry).not.toHaveBeenCalled();
    const first = jest.mocked(saveWidgetLoanEntry).mock.calls[0][2];
    expect(first).toMatchObject({
      type: label === 'Vay' ? 'BORROWED' : 'LENT',
      person_name: 'Nguoi QA',
      wallet_id: 7,
      principal_amount: '100000',
      due_date: '2026-11-30',
    });
    await press('Sửa lại');
    await press('Kiểm tra');
    jest.mocked(saveWidgetLoanEntry).mockResolvedValueOnce('SAVED');
    await press('Xác nhận lưu');
    expect(
      jest.mocked(saveWidgetLoanEntry).mock.calls[1][2].client_request_id,
    ).toBe(first.client_request_id);
    expect(saveWidgetEntry).not.toHaveBeenCalled();
    expect(homeWidget.closeQuickEntry).toHaveBeenCalledWith('SAVED');
  },
);
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
const mount = async (url = entryUrl) => {
  await act(async () => {
    renderer = TestRenderer.create(<WidgetQuickEntry entryUrl={url} />);
  });
};
it.each(['Chi', 'Thu'])(
  'keeps the same %s request after a failed save and repeated preview',
  async label => {
    await mount();
    if (label === 'Thu') {
      await press('Thu');
      await press('Chọn danh mục');
      await press('Lương');
    }
    await fill('Số tiền widget', '25000');
    await press('Ví QA · VND');
    await press('Kiểm tra');
    jest
      .mocked(saveWidgetEntry)
      .mockRejectedValueOnce(Error('Chưa lưu hàng chờ'));
    await press('Xác nhận lưu');
    const first = jest.mocked(saveWidgetEntry).mock.calls[0][2];
    await press('Sửa lại');
    await press('Kiểm tra');
    jest.mocked(saveWidgetEntry).mockResolvedValueOnce('SAVED');
    await press('Xác nhận lưu');
    expect(jest.mocked(saveWidgetEntry).mock.calls[1][2]).toEqual(first);
  },
);
it.each([
  { kind: 'Chi', result: 'SAVED' as const },
  { kind: 'Chi', result: 'PENDING' as const },
  { kind: 'Vay/Nợ', result: 'SAVED' as const },
])('only retries closing after $kind is $result', async ({ kind, result }) => {
  await mount();
  if (kind === 'Vay/Nợ') {
    await press('Vay/Nợ');
    await fill('Tên người vay nợ widget', 'Nguoi QA');
  }
  await fill('Số tiền widget', '25000');
  await press('Ví QA · VND');
  await press('Kiểm tra');
  jest
    .mocked(homeWidget.closeQuickEntry)
    .mockRejectedValueOnce(Error('Bridge unavailable'));
  if (kind === 'Vay/Nợ')
    jest.mocked(saveWidgetLoanEntry).mockResolvedValueOnce('SAVED');
  else jest.mocked(saveWidgetEntry).mockResolvedValueOnce(result);
  const oldConfirm = control('Xác nhận lưu').props.onPress;
  await act(async () => oldConfirm());
  expect(control('Sửa lại')).toBeUndefined();
  expect(control('Xác nhận lưu')).toBeUndefined();
  expect(control('Đóng')).toBeDefined();
  await act(async () => oldConfirm());
  await press('Đóng');
  expect(saveWidgetEntry).toHaveBeenCalledTimes(kind === 'Vay/Nợ' ? 0 : 1);
  expect(saveWidgetLoanEntry).toHaveBeenCalledTimes(kind === 'Vay/Nợ' ? 1 : 0);
  expect(homeWidget.closeQuickEntry).toHaveBeenLastCalledWith(result);
});
it('opens the loan form directly from the full widget loan selection', async () => {
  await mount(
    entryUrl
      .replace('type=EXPENSE', 'type=LOAN_DEBT')
      .replace('&category=9', ''),
  );
  expect(control('Tên người vay nợ widget')).toBeDefined();
  expect(control('Chọn danh mục')).toBeUndefined();
  expect(saveWidgetLoanEntry).not.toHaveBeenCalled();
});
it('requires wallet and preview before saving, locks repeated confirms, then closes the panel', async () => {
  await mount();
  await fill('Số tiền widget', '25000');
  await press('Kiểm tra');
  expect(saveWidgetEntry).not.toHaveBeenCalled();
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
  expect(launchCamera).not.toHaveBeenCalled();
  await pickPhoto();
  expect(control('Số tiền widget').props.value).toBe('79.000');
  expect(control('Tên món 1').props.value).toBe('Bạc xỉu (2)');
  expect(saveWidgetEntry).not.toHaveBeenCalled();
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
  jest.mocked(dashboardCache.read).mockResolvedValue({
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
  expect(control('Số tiền widget').props.value).toBe('25.000');
  expect(control('Bảo hiểm')).toBeDefined();
  expect(saveWidgetEntry).not.toHaveBeenCalled();
});

it('recovers in place when the initial cache is missing and later arrives', async () => {
  jest.mocked(dashboardCache.read).mockResolvedValueOnce(null);
  await mount();
  expect(control('Số tiền widget')).toBeUndefined();
  await act(async () => {
    jest.mocked(dashboardCache.subscribe).mock.calls[0][0]();
  });
  expect(control('Số tiền widget')).toBeDefined();
  expect(control('Đi lại')).toBeDefined();
});

it('accepts formatted VND and preserves an empty item amount while editing', async () => {
  jest.mocked(launchCamera).mockResolvedValue({
    assets: [{ uri: 'file:///qa.jpg' }],
  });
  jest.mocked(transactionsService.analyzeReceipt).mockResolvedValue({
    amount: 79000,
    currency: 'VND',
    receipt_items: [{ name: 'Bạc xỉu', amount: 94000 }],
    warnings: [],
  });
  await mount(entryUrl + '&action=CAMERA');
  await pickPhoto();
  await fill('Thành tiền món 1', '');
  expect(control('Thành tiền món 1').props.value).toBe('');
  await fill('Thành tiền món 1', '94.000');
  await fill('Số tiền widget', '79.000');
  await press('Ví QA · VND');
  await press('Kiểm tra');
  jest.mocked(saveWidgetEntry).mockResolvedValueOnce('SAVED');
  await press('Xác nhận lưu');
  expect(jest.mocked(saveWidgetEntry).mock.calls[0][2]).toMatchObject({
    amount: '79000',
    receipt_items: [{ name: 'Bạc xỉu', amount: 94000 }],
  });
});

it('locks repeated camera taps immediately and ignores cancelled OCR after manual input', async () => {
  let finish!: (result: Awaited<ReturnType<typeof launchCamera>>) => void;
  jest.mocked(launchCamera).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await mount();
  const camera = control('Chụp ảnh đọc hóa đơn');
  let pending!: Promise<void>;
  await act(async () => {
    camera.props.onPress();
    camera.props.onPress();
  });
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  expect(launchCamera).not.toHaveBeenCalled();
  const choices = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
  await act(async () => {
    pending = choices
      ?.find(item => item.text === 'Chụp ảnh')
      ?.onPress?.() as unknown as Promise<void>;
  });
  expect(launchCamera).toHaveBeenCalledTimes(1);
  await press('Hủy đọc');
  await fill('Số tiền widget', '25000');
  await act(async () => {
    finish({ assets: [{ uri: 'file:///late.jpg' }] });
    await pending;
  });
  expect(transactionsService.analyzeReceipt).not.toHaveBeenCalled();
  expect(control('Số tiền widget').props.value).toBe('25.000');
});

it('keeps decimal-comma input for a non-VND wallet instead of treating it as thousands', async () => {
  jest.mocked(dashboardCache.read).mockResolvedValue({
    ...data,
    wallets: [{ ...data.wallets[0], currency: 'USD' }],
  });
  await mount();
  await press('Ví QA · USD');
  await fill('Số tiền widget', '2,50');
  await press('Kiểm tra');
  jest.mocked(saveWidgetEntry).mockResolvedValueOnce('SAVED');
  await press('Xác nhận lưu');
  expect(jest.mocked(saveWidgetEntry).mock.calls[0][2].amount).toBe('2.50');
});

it('keeps the income draft and wallet through temporary auth-controller restoration', async () => {
  await mount();
  await press('Thu');
  await press('Chọn danh mục');
  await press('Lương');
  await press('Ví QA · VND');
  await fill('Số tiền widget', '125000');
  await fill('Ghi chú widget', 'luong QA');
  await act(async () => {
    Object.assign(mockAuth, {
      user: null,
      token: null,
      isRestoringSession: true,
    });
    renderer.update(<WidgetQuickEntry entryUrl={entryUrl} />);
  });
  await act(async () => {
    Object.assign(mockAuth, {
      user: { id: 7 },
      token: 'new-token',
      isRestoringSession: false,
    });
    renderer.update(<WidgetQuickEntry entryUrl={entryUrl} />);
  });
  expect(control('Số tiền widget').props.value).toBe('125.000');
  expect(control('Lương')).toBeDefined();
  expect(control('Ví QA · VND')).toBeDefined();
  await press('Kiểm tra');
  jest.mocked(saveWidgetEntry).mockResolvedValueOnce('SAVED');
  await press('Xác nhận lưu');
  expect(jest.mocked(saveWidgetEntry).mock.calls[0][2]).toMatchObject({
    type: 'INCOME',
    category_id: 10,
    wallet_id: 7,
    amount: '125000',
    note: 'luong QA',
  });
});

it('lists all wallets in the form and previews the tapped wallet without an intermediate picker', async () => {
  jest.mocked(dashboardCache.read).mockResolvedValue({
    ...data,
    wallets: [
      ...data.wallets,
      {
        ...data.wallets[0],
        id: 8,
        name: 'Tài khoản ngân hàng',
        wallet_type: 'BANK',
      },
      { ...data.wallets[0], id: 9, name: 'Tiết kiệm', wallet_type: 'SAVINGS' },
    ],
  });
  await mount();
  expect(control('Chọn ví')).toBeUndefined();
  expect(control('Ví QA · VND')).toBeDefined();
  expect(control('Tài khoản ngân hàng · VND')).toBeDefined();
  expect(control('Tiết kiệm · VND')).toBeDefined();
  await fill('Số tiền widget', '25000');
  await press('Tài khoản ngân hàng · VND');
  expect(
    control('Tài khoản ngân hàng · VND').props.accessibilityState.selected,
  ).toBe(true);
  expect(control('Ví QA · VND').props.accessibilityState.selected).toBe(false);
  await press('Kiểm tra');
  expect(saveWidgetEntry).not.toHaveBeenCalled();
  jest.mocked(saveWidgetEntry).mockResolvedValueOnce('SAVED');
  await press('Xác nhận lưu');
  expect(jest.mocked(saveWidgetEntry).mock.calls[0][2].wallet_id).toBe(8);
});

it('uses a native calendar, keeps the date on dismissal and submits the selected local day', async () => {
  await mount();
  await fill('Số tiền widget', '25000');
  await press('Ví QA · VND');
  await chooseDate('Ngày giao dịch widget', new Date(2026, 10, 1));
  expect(renderer.root.findAllByType(DateTimePicker)).toHaveLength(0);
  expect(control('Ngày giao dịch widget').props.onChangeText).toBeUndefined();
  await press('Ngày giao dịch widget');
  expect(renderer.root.findByType(DateTimePicker).props.value.getDate()).toBe(
    1,
  );
  await act(async () =>
    renderer.root
      .findByType(DateTimePicker)
      .props.onChange({ type: 'dismissed' }, new Date(2026, 10, 2)),
  );
  await press('Kiểm tra');
  expect(saveWidgetEntry).not.toHaveBeenCalled();
  jest.mocked(saveWidgetEntry).mockResolvedValueOnce('SAVED');
  await press('Xác nhận lưu');
  expect(jest.mocked(saveWidgetEntry).mock.calls[0][2].transaction_date).toBe(
    '2026-11-01',
  );
});

it('lets the optional loan due date be picked and cleared and excludes savings wallets for loans', async () => {
  jest.mocked(dashboardCache.read).mockResolvedValue({
    ...data,
    wallets: [
      ...data.wallets,
      { ...data.wallets[0], id: 9, name: 'Tiết kiệm', wallet_type: 'SAVINGS' },
    ],
  });
  await mount();
  await press('Vay/Nợ');
  expect(control('Tiết kiệm · VND')).toBeUndefined();
  await chooseDate('Ngày hẹn trả widget', new Date(2026, 10, 30));
  await press('Bỏ ngày hẹn trả');
  await fill('Tên người vay nợ widget', 'Nguoi QA');
  await fill('Số tiền widget', '100000');
  await press('Ví QA · VND');
  await press('Kiểm tra');
  expect(saveWidgetLoanEntry).not.toHaveBeenCalled();
  jest.mocked(saveWidgetLoanEntry).mockResolvedValueOnce('SAVED');
  await press('Xác nhận lưu');
  expect(jest.mocked(saveWidgetLoanEntry).mock.calls[0][2].due_date).toBeNull();
});

it('shows only a recording bar from the widget mic and fills the existing draft after speech ends', async () => {
  const url = entryUrl + '&action=VOICE';
  await mount(url);
  expect(mockVoice.toggle).toHaveBeenCalledWith('');
  expect(control('Số tiền widget')).toBeUndefined();
  expect(control('Câu nói widget')).toBeUndefined();
  await act(async () => {
    mockVoice.status = 'listening';
    mockOnTranscript('chi 25 nghìn đi lại');
  });
  expect(control('Số tiền widget')).toBeUndefined();
  await act(async () => {
    mockVoice.status = 'idle';
    renderer.update(<WidgetQuickEntry entryUrl={url} />);
  });
  expect(control('Số tiền widget').props.value).toBe('25.000');
  expect(control('Đi lại')).toBeDefined();
  expect(control('Ví QA · VND').props.accessibilityState.selected).toBe(false);
  expect(saveWidgetEntry).not.toHaveBeenCalled();
});

it('records inside the current form and cancellation preserves manual input despite a late transcript', async () => {
  await mount();
  await fill('Số tiền widget', '1000');
  await fill('Ghi chú widget', 'Ghi chú giữ lại');
  await press('Nói để nhập');
  expect(control('Số tiền widget')).toBeDefined();
  expect(control('Câu nói widget')).toBeUndefined();
  await press('Hủy thu âm');
  await act(async () => mockOnTranscript('chi 25 nghìn đi lại'));
  expect(control('Số tiền widget').props.value).toBe('1.000');
  expect(control('Ghi chú widget').props.value).toBe('Ghi chú giữ lại');
  expect(saveWidgetEntry).not.toHaveBeenCalled();
});

it('chooses a library photo and fills receipt details without attaching the source image', async () => {
  jest
    .mocked(launchImageLibrary)
    .mockResolvedValue({
      assets: [{ uri: 'content://qa/receipt.jpg', type: 'image/jpeg' }],
    });
  jest
    .mocked(transactionsService.analyzeReceipt)
    .mockResolvedValue({
      amount: 79000,
      currency: 'VND',
      receipt_items: [{ name: 'Bạc xỉu', amount: 94000 }],
      warnings: [],
    });
  await mount(entryUrl + '&action=CAMERA');
  await pickPhoto('Chọn từ thư viện');
  expect(launchCamera).not.toHaveBeenCalled();
  expect(launchImageLibrary).toHaveBeenCalledWith(
    expect.objectContaining({ selectionLimit: 1, mediaType: 'photo' }),
  );
  expect(control('Số tiền widget').props.value).toBe('79.000');
  expect(control('Tên món 1').props.value).toBe('Bạc xỉu');
  await press('Ví QA · VND');
  await press('Kiểm tra');
  expect(saveWidgetEntry).not.toHaveBeenCalled();
  jest.mocked(saveWidgetEntry).mockResolvedValueOnce('SAVED');
  await press('Xác nhận lưu');
  expect(
    JSON.stringify(jest.mocked(saveWidgetEntry).mock.calls[0][2]),
  ).not.toContain('content://qa');
});

it('preserves the draft when the photo menu or library is cancelled', async () => {
  await mount();
  await fill('Số tiền widget', '25000');
  await press('Chụp ảnh đọc hóa đơn');
  await pickPhoto('Hủy');
  expect(launchCamera).not.toHaveBeenCalled();
  expect(launchImageLibrary).not.toHaveBeenCalled();
  jest.mocked(launchImageLibrary).mockResolvedValue({ didCancel: true });
  await press('Chụp ảnh đọc hóa đơn');
  await pickPhoto('Chọn từ thư viện');
  expect(transactionsService.analyzeReceipt).not.toHaveBeenCalled();
  expect(control('Số tiền widget').props.value).toBe('25.000');
  expect(control('Kiểm tra').props.disabled).toBe(false);
});

it('ignores an old photo choice after the widget form is closed', async () => {
  await mount();
  await press('Chụp ảnh đọc hóa đơn');
  await act(async () => renderer.unmount());
  await pickPhoto('Chọn từ thư viện');
  expect(launchImageLibrary).not.toHaveBeenCalled();
});
