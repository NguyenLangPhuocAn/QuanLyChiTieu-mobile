import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert, Text, TextInput, TouchableOpacity } from 'react-native';
import MainScreen from '../src/screens/home/MainScreen';
import ChatbotScreen from '../src/screens/home/ChatbotScreen';
import { launchImageLibrary } from 'react-native-image-picker';
import { transactionsService } from '../src/services/transactions';
import { formatCurrency } from '../src/utils/format';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: () => undefined,
}));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token', user: null }),
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
