import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert, Text, TextInput, TouchableOpacity } from 'react-native';
import MainScreen from '../src/screens/home/MainScreen';
import ChatbotScreen from '../src/screens/home/ChatbotScreen';
import { launchImageLibrary } from 'react-native-image-picker';
import { transactionsService } from '../src/services/transactions';
import { formatCurrency } from '../src/utils/format';
import { bankNotificationReader } from '../src/native/bankNotificationReader';

let mockUser: { id: number; currency_default: string } | null = null;
let mockShake: () => void;
let mockSpeechEvents: Record<string, (event?: any) => void> = {};
jest.mock('rn-speech-recognition', () => ({
  RNSpeechRecognitionModule: {
    isAvailable: true,
    isRecognitionAvailable: jest.fn(() => true),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    addListener: jest.fn((name, callback) => {
      mockSpeechEvents[name] = callback;
      return { remove: jest.fn() };
    }),
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: () => undefined,
  useIsFocused: () => true,
}));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token', user: mockUser }),
}));
jest.mock('../src/context/FinanceContext', () => {
  const stable = {
    categories: [{ id: 4, name: 'Ăn uống', type: 'EXPENSE' }],
    tags: [],
    transactions: [],
    budgets: [],
    setCategories: jest.fn(),
    setTags: jest.fn(),
    setTransactions: jest.fn(),
    setBudgets: jest.fn(),
    setPreferredCurrency: jest.fn(),
  };
  return {
    useFinance: () => {
      const [selectedTransactionCategory, setSelectedTransactionCategory] =
        require('react').useState(null);
      return {
        ...stable,
        selectedTransactionCategory,
        setSelectedTransactionCategory,
      };
    },
  };
});
jest.mock('../src/screens/home/OverviewScreen', () => () => null);
jest.mock('../src/screens/home/HistoryScreen', () => () => null);
jest.mock('../src/screens/home/ChatbotScreen', () => () => null);
jest.mock('../src/screens/home/AccountScreen', () => () => null);
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));
jest.mock('../src/services/wallets', () => ({
  walletsService: {
    getAll: jest.fn().mockResolvedValue([
      {
        id: 1,
        name: 'Tiền mặt',
        currency: 'VND',
        wallet_type: 'CASH',
        balance: '5000000',
      },
      {
        id: 2,
        name: 'Đô la',
        currency: 'USD',
        wallet_type: 'CASH',
        balance: '100',
      },
    ]),
  },
}));
jest.mock('../src/services/transactions', () => ({
  transactionsService: {
    getAll: jest.fn().mockResolvedValue([]),
    analyzeReceipt: jest.fn(),
    create: jest.fn(),
  },
}));
jest.mock('../src/services/categories', () => ({
  categoriesService: { getAll: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../src/services/tags', () => ({
  tagsService: { getAll: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../src/services/budgets', () => ({
  budgetsService: { getAll: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../src/services/savings', () => ({
  savingsService: { getAll: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../src/services/notifications', () => ({
  notificationsService: {
    getUnreadCount: jest.fn().mockResolvedValue({ count: 0 }),
  },
}));
jest.mock('../src/native/bankNotificationReader', () => ({
  bankNotificationReader: {
    isSupported: true,
    isNotificationAccessGranted: jest.fn().mockResolvedValue(true),
    openNotificationAccessSettings: jest.fn().mockResolvedValue(true),
    getPendingEvents: jest.fn().mockResolvedValue([]),
    setConfiguration: jest.fn().mockResolvedValue(true),
    markProcessed: jest.fn().mockResolvedValue(true),
    dismissEvent: jest.fn().mockResolvedValue(true),
    startShakeDetection: jest.fn().mockResolvedValue(true),
    stopShakeDetection: jest.fn().mockResolvedValue(true),
    onShake: jest.fn(callback => {
      mockShake = callback;
      return { remove: jest.fn() };
    }),
  },
}));

let tree: TestRenderer.ReactTestRenderer;
const draft = {
  type: 'EXPENSE',
  amount: 30000,
  currency: 'VND',
  note: 'Test draft',
  transaction_date: null,
  wallet_name: null,
  category_name: null,
};
const amount = () => tree.root.findByProps({ placeholder: '0' }).props.value;
const draftVisible = () =>
  tree.root.findAllByProps({
    accessibilityLabel: 'Đóng bản nháp giao dịch',
  }).length > 0;
const chat = () => tree.root.findByType(ChatbotScreen).props;
const button = (label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find(node =>
      node.findAllByType(Text).some(text => text.props.children === label),
    )!;
beforeEach(async () => {
  mockSpeechEvents = {};
  mockUser = null;
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await act(async () => {
    tree = TestRenderer.create(<MainScreen />);
  });
  const tab = tree.root
    .findAllByType(TouchableOpacity)
    .find(node =>
      node.findAllByType(Text).some(text => text.props.children === 'Chatbot'),
    )!;
  await act(async () => {
    tab.props.onPress();
  });
});

it('previews speech then fills a draft without saving or choosing a wallet', async () => {
  await act(async () => chat().onCreateTransaction!(draft as any));
  await act(async () =>
    tree.root
      .findByProps({ accessibilityLabel: 'Nhập giao dịch bằng giọng nói' })
      .props.onPress(),
  );
  await act(async () => mockSpeechEvents.start());
  await act(async () =>
    mockSpeechEvents.result({
      results: [{ transcript: 'Chi 79 nghìn ăn trưa hôm nay' }],
    }),
  );
  expect(amount()).toBe('30.000');
  expect(
    tree.root.findByProps({
      accessibilityLabel: 'Điền câu đã nghe vào giao dịch',
    }).props.disabled,
  ).toBe(true);
  await act(async () => mockSpeechEvents.end());
  await act(async () =>
    tree.root
      .findByProps({ accessibilityLabel: 'Điền câu đã nghe vào giao dịch' })
      .props.onPress(),
  );
  expect(amount()).toBe('79.000');
  expect(transactionsService.create).not.toHaveBeenCalled();
  expect(
    tree.root
      .findAllByType(TextInput)
      .some(input => input.props.value === 'Chi 79 nghìn ăn trưa hôm nay'),
  ).toBe(true);
  expect(
    tree.root.findAllByProps({
      accessibilityLabel: 'Nội dung giao dịch bằng giọng nói',
    }),
  ).toHaveLength(0);
});

it('keeps the existing draft when speech is cancelled and ignores late events', async () => {
  await act(async () => chat().onCreateTransaction!(draft as any));
  await act(async () =>
    tree.root
      .findByProps({ accessibilityLabel: 'Nhập giao dịch bằng giọng nói' })
      .props.onPress(),
  );
  const lateResult = mockSpeechEvents.result;
  await act(async () =>
    tree.root
      .findByProps({ accessibilityLabel: 'Hủy nhập bằng giọng nói' })
      .props.onPress(),
  );
  await act(async () =>
    lateResult({ results: [{ transcript: 'thu 90 triệu' }] }),
  );
  expect(amount()).toBe('30.000');
  expect(
    tree.root
      .findAllByType(TextInput)
      .some(input => input.props.value === 'Test draft'),
  ).toBe(true);
  expect(transactionsService.create).not.toHaveBeenCalled();
});

it('does not apply an ambiguous spoken transaction', async () => {
  await act(async () => chat().onCreateTransaction!(draft as any));
  await act(async () =>
    tree.root
      .findByProps({ accessibilityLabel: 'Nhập giao dịch bằng giọng nói' })
      .props.onPress(),
  );
  await act(async () =>
    mockSpeechEvents.result({
      results: [{ transcript: 'chi 70 nghìn và thu 90 nghìn' }],
    }),
  );
  await act(async () => mockSpeechEvents.end());
  const apply = tree.root.findByProps({
    accessibilityLabel: 'Điền câu đã nghe vào giao dịch',
  });
  expect(apply.props.disabled).toBe(true);
  await act(async () => apply.props.onPress());
  expect(amount()).toBe('30.000');
  expect(transactionsService.create).not.toHaveBeenCalled();
});

it('does not overwrite a new draft with a bank read that finishes after closing the form', async () => {
  mockUser = { id: 7, currency_default: 'VND' };
  await act(async () => chat().onCreateTransaction!(draft as any));
  let finish!: (events: unknown[]) => void;
  (bankNotificationReader.getPendingEvents as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  let reading!: Promise<void>;
  await act(async () => {
    reading = tree.root
      .findByProps({ accessibilityLabel: 'Đọc thông báo giao dịch' })
      .props.onPress();
  });
  await act(async () =>
    tree.root
      .findByProps({ accessibilityLabel: 'Đóng bản nháp giao dịch' })
      .props.onPress(),
  );
  await act(async () =>
    chat().onCreateTransaction!({
      ...draft,
      amount: 55000,
      note: 'Bản nháp mới',
    } as any),
  );
  await act(async () => {
    finish([
      {
        id: 'b'.repeat(64),
        packageName: 'bank.test',
        appName: 'Bank',
        title: '',
        text: 'Nhận +752,790 VND',
        postedAt: Date.now(),
      },
    ]);
    await reading;
  });
  expect(amount()).toBe('55.000');
  expect(
    tree.root
      .findAllByType(TextInput)
      .some(input => input.props.value === 'Bản nháp mới'),
  ).toBe(true);
  expect(transactionsService.create).not.toHaveBeenCalled();
});
afterEach(async () => {
  await act(async () => {
    tree.unmount();
  });
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('opens a fresh draft without old amount, note or receipt and does not save', async () => {
  await act(async () => {
    chat().onCreateTransaction!(draft as any);
  });
  expect(amount()).toBe('30.000');
  await act(async () => {
    chat().onCreateTransaction!({ ...draft, amount: null, note: '' } as any);
  });
  expect(amount()).toBe('');
  expect(
    tree.root
      .findAllByType(TextInput)
      .some(input => input.props.value === 'Test draft'),
  ).toBe(false);
  expect(transactionsService.create).not.toHaveBeenCalled();
});

it('ignores a late OCR result after cancelling and opening another draft', async () => {
  let finish!: (value: unknown) => void;
  (launchImageLibrary as jest.Mock).mockResolvedValue({
    assets: [{ uri: 'file:///receipt.jpg', type: 'image/jpeg' }],
  });
  (transactionsService.analyzeReceipt as jest.Mock).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await act(async () => {
    chat().onScanReceipt!();
  });
  const buttons = (Alert.alert as jest.Mock).mock.calls.find(
    call => call[0] === 'Quét hóa đơn',
  )[2];
  await act(async () => {
    buttons.find((choice: any) => choice.text === 'Thư viện ảnh').onPress();
  });
  expect(draftVisible()).toBe(false);
  expect(
    tree.root.findByProps({ accessibilityLabel: 'Đang kiểm tra ảnh hóa đơn' }),
  ).toBeTruthy();
  const cancel = tree.root.findByProps({
    accessibilityLabel: 'Hủy quét hóa đơn',
  });
  await act(async () => {
    cancel.props.onPress();
  });
  await act(async () => {
    chat().onCreateTransaction!({ ...draft, amount: null, note: '' } as any);
  });
  await act(async () => {
    finish({
      amount: 999000,
      currency: 'VND',
      note: 'OLD OCR',
      warnings: [],
      receipt_items: [],
    });
  });
  expect(amount()).toBe('');
  expect(
    tree.root
      .findAllByType(TextInput)
      .some(input => input.props.value === 'OLD OCR'),
  ).toBe(false);
  expect(transactionsService.create).not.toHaveBeenCalled();
});

it('shows the centered OCR loading notice above an open transaction form', async () => {
  (launchImageLibrary as jest.Mock).mockResolvedValue({
    assets: [{ uri: 'file:///receipt.jpg', type: 'image/jpeg' }],
  });
  (transactionsService.analyzeReceipt as jest.Mock).mockImplementation(
    () => new Promise(() => undefined),
  );

  await act(async () => {
    chat().onCreateTransaction!(draft as any);
  });
  await act(async () => {
    tree.root
      .findByProps({ accessibilityLabel: 'Ảnh hóa đơn không bắt buộc' })
      .props.onPress();
  });
  await act(async () => {
    button('Quét ảnh bằng AI').props.onPress();
  });
  const choices = (Alert.alert as jest.Mock).mock.calls.find(
    call => call[0] === 'Quét hóa đơn',
  )[2];
  await act(async () => {
    choices.find((item: any) => item.text === 'Thư viện ảnh').onPress();
  });

  expect(
    tree.root.findByProps({ accessibilityLabel: 'Đang kiểm tra ảnh hóa đơn' }),
  ).toBeTruthy();
  expect(
    tree.root
      .findAllByType(Text)
      .some(text =>
        String(text.props.children).includes(
          'AI đang đọc tổng tiền, ngày, danh mục và từng món',
        ),
      ),
  ).toBe(true);
});

it('attaches a receipt image without running AI', async () => {
  (launchImageLibrary as jest.Mock).mockResolvedValue({
    assets: [
      {
        uri: 'file:///receipt-only.jpg',
        type: 'image/jpeg',
        fileName: 'receipt-only.jpg',
      },
    ],
  });
  await act(async () => {
    chat().onCreateTransaction!(draft as any);
  });
  await act(async () => {
    tree.root
      .findByProps({ accessibilityLabel: 'Ảnh hóa đơn không bắt buộc' })
      .props.onPress();
  });
  await act(async () => {
    button('Thêm ảnh hóa đơn').props.onPress();
  });
  const choices = (Alert.alert as jest.Mock).mock.calls.find(
    call => call[0] === 'Thêm ảnh hóa đơn',
  )[2];
  await act(async () => {
    await choices.find((item: any) => item.text === 'Thư viện ảnh').onPress();
  });

  expect(button('Đổi ảnh')).toBeTruthy();
  expect(button('Đọc bằng AI')).toBeTruthy();
  expect(transactionsService.analyzeReceipt).not.toHaveBeenCalled();
});

it('cancelling the image picker does not create a transaction', async () => {
  (launchImageLibrary as jest.Mock).mockResolvedValue({ didCancel: true });
  await act(async () => {
    chat().onScanReceipt!();
  });
  const buttons = (Alert.alert as jest.Mock).mock.calls.find(
    call => call[0] === 'Quét hóa đơn',
  )[2];
  await act(async () => {
    await buttons
      .find((choice: any) => choice.text === 'Thư viện ảnh')
      .onPress();
  });
  expect(draftVisible()).toBe(false);
  expect(transactionsService.analyzeReceipt).not.toHaveBeenCalled();
  expect(transactionsService.create).not.toHaveBeenCalled();
});

it('does not create a draft when the selected image has no valid receipt total', async () => {
  (launchImageLibrary as jest.Mock).mockResolvedValue({
    assets: [{ uri: 'file:///not-a-receipt.jpg', type: 'image/jpeg' }],
  });
  (transactionsService.analyzeReceipt as jest.Mock).mockResolvedValue({
    amount: null,
    currency: null,
    note: null,
    warnings: ['Ảnh không phải hóa đơn.'],
    receipt_items: [],
  });
  await act(async () => {
    chat().onScanReceipt!();
  });
  const buttons = (Alert.alert as jest.Mock).mock.calls.find(
    call => call[0] === 'Quét hóa đơn',
  )[2];
  await act(async () => {
    await buttons.find((item: any) => item.text === 'Thư viện ảnh').onPress();
  });
  expect(draftVisible()).toBe(false);
  expect(Alert.alert).toHaveBeenCalledWith(
    'Chưa tạo bản nháp',
    expect.stringContaining('Ảnh không phải hóa đơn.'),
  );
  expect(transactionsService.create).not.toHaveBeenCalled();
});

it('submits once when Save is pressed twice before the response', async () => {
  let finish!: (value: unknown) => void;
  (transactionsService.create as jest.Mock).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await act(async () => {
    chat().onCreateTransaction!({
      ...draft,
      wallet_name: 'Tiền mặt',
      category_name: 'Ăn uống',
    });
  });
  const save = button('Lưu giao dịch').props.onPress;
  let pending!: Promise<unknown>;
  await act(async () => {
    pending = save();
    save();
  });
  expect(transactionsService.create).toHaveBeenCalledTimes(1);
  expect(transactionsService.create).toHaveBeenCalledWith(
    'test-token',
    expect.objectContaining({
      wallet_id: 1,
      category_id: 4,
      amount: '30000',
      type: 'EXPENSE',
    }),
  );
  await act(async () => {
    finish({ id: 10 });
    await pending;
  });
});

it('saves a bank notification with its source key and no conflicting client key', async () => {
  mockUser = { id: 7, currency_default: 'VND' };
  await act(async () => {
    tree.update(<MainScreen />);
  });
  (transactionsService.create as jest.Mock).mockResolvedValue({ id: 18 });
  (bankNotificationReader.getPendingEvents as jest.Mock).mockResolvedValue([
    {
      id: 'a'.repeat(64),
      packageName: 'bank.test',
      appName: 'Bank',
      title: 'Giao dịch',
      text: 'Thanh toán -79.000 VND tại CAFE',
      postedAt: Date.now(),
    },
  ]);

  await act(async () => {
    chat().onCreateTransaction!({ ...draft, amount: null, note: '' } as any);
  });
  await act(async () => {
    await tree.root
      .findByProps({ accessibilityLabel: 'Đọc thông báo giao dịch' })
      .props.onPress();
  });
  expect(transactionsService.create).not.toHaveBeenCalled();
  await act(async () => {
    button('Tiền mặt').props.onPress();
    button('Chi').props.onPress();
  });
  await act(async () => {
    await button('Lưu giao dịch').props.onPress();
  });

  expect(transactionsService.create).toHaveBeenCalledWith(
    'test-token',
    expect.objectContaining({
      source: 'BANK_NOTIFICATION',
      source_ref: 'a'.repeat(64),
      wallet_id: 1,
      category_id: 4,
      amount: '79000',
      type: 'EXPENSE',
    }),
  );
  const createdPayload = (
    transactionsService.create as jest.Mock
  ).mock.calls.at(-1)?.[1];
  expect(createdPayload).not.toHaveProperty('client_request_id');
  expect(bankNotificationReader.markProcessed).toHaveBeenCalledWith(
    7,
    'a'.repeat(64),
  );
});

it('opens the latest bank draft with one shake, without saving or preselecting a wallet', async () => {
  mockUser = { id: 7, currency_default: 'VND' };
  await act(async () => tree.update(<MainScreen />));
  (bankNotificationReader.getPendingEvents as jest.Mock).mockResolvedValue([
    {
      id: 'a'.repeat(64),
      packageName: 'bank.test',
      appName: 'Bank',
      title: 'Giao dịch',
      text: 'Thanh toán -79.000 VND',
      postedAt: 100,
    },
    {
      id: 'b'.repeat(64),
      packageName: 'bank.test',
      appName: 'Bank',
      title: 'Giao dịch',
      text: 'Nhận +125.000 VND',
      postedAt: 200,
    },
  ]);
  await act(async () => mockShake());
  expect(amount()).toBe('125.000');
  expect(transactionsService.create).not.toHaveBeenCalled();
  expect(bankNotificationReader.markProcessed).not.toHaveBeenCalled();
  await act(async () => button('Lưu giao dịch').props.onPress());
  expect(transactionsService.create).not.toHaveBeenCalled();
});

it('keeps edits when shaking again for the same notification', async () => {
  mockUser = { id: 7, currency_default: 'VND' };
  await act(async () => tree.update(<MainScreen />));
  (bankNotificationReader.getPendingEvents as jest.Mock).mockResolvedValue([
    {
      id: 'a'.repeat(64),
      packageName: 'bank.test',
      appName: 'Bank',
      title: 'Giao dịch',
      text: 'Thanh toán -79.000 VND',
      postedAt: 100,
    },
  ]);
  await act(async () => mockShake());
  await act(async () =>
    tree.root.findByProps({ placeholder: '0' }).props.onChangeText('80000'),
  );
  await act(async () => mockShake());
  expect(amount()).toBe('80.000');
  expect(
    (Alert.alert as jest.Mock).mock.calls.some(
      call => call[0] === 'Thay nội dung đang nhập?',
    ),
  ).toBe(false);
});

it('asks before replacing an edited form and ignores confirmation after it closes', async () => {
  mockUser = { id: 7, currency_default: 'VND' };
  await act(async () => chat().onCreateTransaction!(draft as any));
  (bankNotificationReader.getPendingEvents as jest.Mock).mockResolvedValue([
    {
      id: 'b'.repeat(64),
      packageName: 'bank.test',
      appName: 'Bank',
      title: 'Giao dịch',
      text: 'Nhận +125.000 VND',
      postedAt: 200,
    },
  ]);
  await act(async () => mockShake());
  expect(amount()).toBe('30.000');
  const prompt = (Alert.alert as jest.Mock).mock.calls.find(
    call => call[0] === 'Thay nội dung đang nhập?',
  );
  expect(prompt).toBeTruthy();
  await act(async () => mockShake());
  expect(
    (Alert.alert as jest.Mock).mock.calls.filter(
      call => call[0] === 'Thay nội dung đang nhập?',
    ),
  ).toHaveLength(1);
  await act(async () =>
    tree.root
      .findByProps({ accessibilityLabel: 'Đóng bản nháp giao dịch' })
      .props.onPress(),
  );
  await act(async () =>
    prompt[2]
      .find((choice: { text: string }) => choice.text === 'Thay nội dung')
      .onPress(),
  );
  expect(draftVisible()).toBe(false);
  expect(transactionsService.create).not.toHaveBeenCalled();
  await act(async () => mockShake());
  expect(draftVisible()).toBe(true);
  expect(amount()).toBe('125.000');
});

it('requires missing draft amount before saving', async () => {
  await act(async () => {
    chat().onCreateTransaction!({ ...draft, amount: null });
  });
  await act(async () => {
    await button('Lưu giao dịch').props.onPress();
  });
  expect(Alert.alert).toHaveBeenCalledWith(
    'Số tiền chưa hợp lệ',
    expect.any(String),
  );
  expect(transactionsService.create).not.toHaveBeenCalled();
});

it('blocks saving an OCR draft into a wallet with another currency', async () => {
  (launchImageLibrary as jest.Mock).mockResolvedValue({
    assets: [{ uri: 'file:///receipt.jpg', type: 'image/jpeg' }],
  });
  (transactionsService.analyzeReceipt as jest.Mock).mockResolvedValue({
    amount: 12.5,
    currency: 'USD',
    note: 'Receipt',
    warnings: [],
    receipt_items: [],
    suggested_category: { id: 4 },
  });
  await act(async () => {
    chat().onScanReceipt!();
  });
  const buttons = (Alert.alert as jest.Mock).mock.calls.find(
    call => call[0] === 'Quét hóa đơn',
  )[2];
  await act(async () => {
    await buttons.find((item: any) => item.text === 'Thư viện ảnh').onPress();
  });
  await act(async () => {
    button('Tiền mặt').props.onPress();
  });
  await act(async () => {
    await button('Lưu giao dịch').props.onPress();
  });
  expect(Alert.alert).toHaveBeenCalledWith(
    'Khác loại tiền',
    expect.any(String),
  );
  expect(transactionsService.create).not.toHaveBeenCalled();
});

it('ignores OCR completion after cancelling the pending scan', async () => {
  let finish!: (value: unknown) => void;
  (launchImageLibrary as jest.Mock).mockResolvedValue({
    assets: [{ uri: 'file:///receipt.jpg', type: 'image/jpeg' }],
  });
  (transactionsService.analyzeReceipt as jest.Mock).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await act(async () => {
    chat().onScanReceipt!();
  });
  const buttons = (Alert.alert as jest.Mock).mock.calls.find(
    call => call[0] === 'Quét hóa đơn',
  )[2];
  await act(async () => {
    buttons.find((item: any) => item.text === 'Thư viện ảnh').onPress();
  });
  await act(async () => {
    tree.root
      .findByProps({ accessibilityLabel: 'Hủy quét hóa đơn' })
      .props.onPress();
  });
  await act(async () => {
    finish({
      amount: 999000,
      currency: 'VND',
      note: 'OLD',
      warnings: [],
      receipt_items: [],
    });
  });
  expect(draftVisible()).toBe(false);
  expect(transactionsService.create).not.toHaveBeenCalled();
});

it('shows OCR line items and saves them with the transaction', async () => {
  (launchImageLibrary as jest.Mock).mockResolvedValue({
    assets: [{ uri: 'file:///detailed-receipt.jpg', type: 'image/jpeg' }],
  });
  (transactionsService.analyzeReceipt as jest.Mock).mockResolvedValue({
    amount: 80000,
    currency: 'VND',
    note: 'Hóa đơn chi tiết',
    warnings: [],
    receipt_items: [
      { name: 'Cua 0,5 kg', amount: 50000 },
      { name: 'Rau', amount: 30000 },
    ],
    suggested_category: { id: 4 },
  });
  (transactionsService.create as jest.Mock).mockResolvedValue({ id: 11 });

  await act(async () => {
    chat().onScanReceipt!();
  });
  const choices = (Alert.alert as jest.Mock).mock.calls.find(
    call => call[0] === 'Quét hóa đơn',
  )[2];
  await act(async () => {
    await choices.find((item: any) => item.text === 'Thư viện ảnh').onPress();
  });

  expect(
    tree.root.findByProps({
      accessibilityLabel: 'Ảnh hóa đơn không bắt buộc',
    }),
  ).toBeTruthy();
  expect(
    tree.root.findByProps({
      accessibilityLabel: 'Chi tiết hóa đơn',
    }),
  ).toBeTruthy();
  expect(
    tree.root.findByProps({ accessibilityLabel: 'Tên món 1' }).props.value,
  ).toBe('Cua 0,5 kg');
  expect(
    tree.root.findByProps({ accessibilityLabel: 'Tên món 2' }).props.value,
  ).toBe('Rau');

  await act(async () => {
    await button('Lưu giao dịch').props.onPress();
  });

  expect(transactionsService.create).toHaveBeenCalledWith(
    'test-token',
    expect.objectContaining({
      amount: '80000',
      receipt_items: [
        { name: 'Cua 0,5 kg', amount: 50000 },
        { name: 'Rau', amount: 30000 },
      ],
    }),
  );
});

it('allows manually entering receipt items and updates their total', async () => {
  await act(async () => {
    chat().onCreateTransaction!(draft as any);
  });
  await act(async () => {
    tree.root
      .findByProps({ accessibilityLabel: 'Chi tiết hóa đơn' })
      .props.onPress();
  });

  expect(
    tree.root
      .findAllByType(Text)
      .some(node => node.props.children === formatCurrency(0, 'VND')),
  ).toBe(true);

  await act(async () => {
    tree.root
      .findByProps({ accessibilityLabel: 'Thêm món hóa đơn' })
      .props.onPress();
  });
  await act(async () => {
    tree.root
      .findByProps({ accessibilityLabel: 'Tên món 1' })
      .props.onChangeText('Bánh mì');
    tree.root
      .findByProps({ accessibilityLabel: 'Thành tiền món 1' })
      .props.onChangeText('12000');
  });

  expect(
    tree.root
      .findAllByType(Text)
      .some(node => node.props.children === formatCurrency(12000, 'VND')),
  ).toBe(true);
});

it('shows selectable hashtags even without recent tag history', async () => {
  await act(async () => {
    chat().onCreateTransaction!(draft as any);
  });

  const hashtagChoice = tree.root
    .findAllByType(TouchableOpacity)
    .find(node =>
      node
        .findAllByType(Text)
        .some(text =>
          Array.isArray(text.props.children)
            ? text.props.children.join('') === '#ăn uống'
            : text.props.children === '#ăn uống',
        ),
    );
  expect(hashtagChoice).toBeTruthy();
  await act(async () => {
    hashtagChoice!.props.onPress();
  });

  expect(
    tree.root.findByProps({ placeholder: 'Ví dụ: #antrua #congviec' }).props
      .value,
  ).toBe('#ăn uống');
});
