import React from 'react';
jest.mock('../src/components/PlanningSyncControls', () => () => null);
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RecurringBillsScreen from '../src/screens/home/RecurringBillsScreen';
import { recurringBillsService as service } from '../src/services/recurringBills';
import { transactionsService } from '../src/services/transactions';
import { apiRequest } from '../src/services/api';
import { getTransactionDateKey } from '../src/utils/mapTransactions';
import type { BillInput } from '../src/utils/recurringBills';
import { billDateOffset, billDueDate } from '../src/utils/recurringBills';

jest.setTimeout(20000);
let mockToken = 'token';
let mockUserId = 99;
let mockCurrency = 'VND';
let mockRouteParams: { reminderDate?: string; editBillId?: string } | undefined;
const mockNavigate = jest.fn();
const mockPush = jest.fn();

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: mockUserId, currency_default: mockCurrency },
    token: mockToken,
  }),
}));
jest.mock('../src/services/api', () => ({
  getApiBaseUrl: () => 'https://test.invalid',
  apiRequest: jest.fn().mockResolvedValue([]),
}));
jest.mock('../src/services/transactions', () => ({
  transactionsService: {
    getPage: jest.fn(),
    getLinkedPayments: jest.fn(),
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));
jest.mock('@react-native-community/datetimepicker', () => 'DatePicker');
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));
const scope = { userId: 99, server: 'https://test.invalid' };
const key = 'recurring-bills:v1:https://test.invalid:99';
const today = getTransactionDateKey(new Date().toISOString());
const bill: BillInput = {
  label: 'Tiền nhà',
  anchorDate: today,
  cycle: 'MONTHLY',
  kind: 'FIXED',
  minAmount: 3000000,
  maxAmount: 3000000,
  currency: 'VND',
  note: '',
};
let renderer: TestRenderer.ReactTestRenderer | undefined;
const screen = () => (
  <RecurringBillsScreen
    {...({
      navigation: {
        goBack: jest.fn(),
        setParams: jest.fn(),
        navigate: mockNavigate,
        push: mockPush,
      },
      route: { params: mockRouteParams },
    } as unknown as React.ComponentProps<typeof RecurringBillsScreen>)}
  />
);
const mount = async () => {
  await act(async () => {
    renderer = TestRenderer.create(screen());
  });
};
const press = (label: string) =>
  renderer!.root
    .findAllByProps({ accessibilityLabel: label })
    .find(node => typeof node.props.onPress === 'function')!
    .props.onPress();
const hasAction = (label: string) =>
  renderer!.root
    .findAllByProps({ accessibilityLabel: label })
    .some(node => typeof node.props.onPress === 'function');
const field = (label: string, value: string) =>
  renderer!.root
    .findAllByProps({ accessibilityLabel: label })
    .find(node => typeof node.props.onChangeText === 'function')!
    .props.onChangeText(value);
const confirm = () => {
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  return buttons.find(button => button.text === 'Xác nhận')!.onPress!();
};
beforeEach(async () => {
  mockToken = 'token';
  mockUserId = 99;
  mockCurrency = 'VND';
  mockRouteParams = undefined;
  await AsyncStorage.removeItem(key);
  await AsyncStorage.removeItem(
    key.replace('recurring-bills:v1:', 'planning-local:v1:'),
  );
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.mocked(transactionsService.getPage).mockResolvedValue({
    data: [
      {
        id: 77,
        wallet_id: 1,
        amount: 3000000,
        currency: 'VND',
        type: 'EXPENSE',
        transaction_date: today,
        note: 'Trả tiền nhà',
      },
    ],
    meta: { page: 1, limit: 40, total: 1, totalPages: 1 },
  });
  jest.mocked(transactionsService.getLinkedPayments).mockResolvedValue({
    requestedIds: [],
    missingIds: [],
    data: [],
  });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
  jest.restoreAllMocks();
});

it('creates one schedule for a double tap and restores it on reopening the screen', async () => {
  await mount();
  await act(async () => press('Thêm lịch hóa đơn'));
  await act(async () => {
    field('Tên hóa đơn', 'Tiền nhà');
    field('Số tiền hóa đơn', '3000000');
  });
  await act(async () => {
    press('Lưu lịch');
    press('Lưu lịch');
  });
  expect((await service.load(scope)).bills).toHaveLength(1);
  await act(async () => renderer!.unmount());
  await mount();
  await act(async () => press('Lịch đã tạo'));
  expect(JSON.stringify(renderer!.toJSON())).toContain('Tiền nhà');
  expect(transactionsService.create).not.toHaveBeenCalled();
});
it('preserves editor input on storage failure so it can be retried', async () => {
  await mount();
  await act(async () => press('Thêm lịch hóa đơn'));
  await act(async () => {
    field('Tên hóa đơn', 'Internet');
    field('Số tiền hóa đơn', '200000');
  });
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Disk full'));
  await act(async () => press('Lưu lịch'));
  expect(
    renderer!.root.findAllByProps({ accessibilityLabel: 'Tên hóa đơn' })[0]
      .props.value,
  ).toBe('Internet');
  expect((await service.load(scope)).bills).toEqual([]);
  await act(async () => press('Lưu lịch'));
  expect((await service.load(scope)).bills).toHaveLength(1);
});
it('only links after preview and explicit confirmation; differing actual amounts are disclosed', async () => {
  await service.save(scope, bill);
  jest.mocked(transactionsService.getPage).mockResolvedValue({
    data: [
      {
        id: 77,
        wallet_id: 1,
        amount: 3100000,
        currency: 'VND',
        type: 'EXPENSE',
        transaction_date: today,
        note: 'Trả tiền nhà',
      },
    ],
    meta: { page: 1, limit: 40, total: 1, totalPages: 1 },
  });
  await mount();
  await act(async () => press('Chọn giao dịch đã trả'));
  expect(hasAction('Liên kết giao dịch 77')).toBe(false);
  await act(async () => press('Xem giao dịch khác'));
  await act(async () => press('Liên kết giao dịch 77'));
  expect((await service.load(scope)).periods).toEqual([]);
  expect(jest.mocked(Alert.alert).mock.calls.at(-1)![1]).toContain(
    'Số tiền thực tế khác dự kiến',
  );
  await act(async () => confirm());
  expect((await service.load(scope)).periods).toMatchObject([
    { status: 'PAID', payment: { id: 77, amount: 3100000 } },
  ]);
  expect(transactionsService.create).not.toHaveBeenCalled();
  expect(transactionsService.update).not.toHaveBeenCalled();
});
it('starts with recent matching expenses and loads other real transactions only on request', async () => {
  await service.save(scope, bill);
  jest.mocked(transactionsService.getPage).mockResolvedValue({
    data: [
      {
        id: 71,
        wallet_id: 1,
        amount: 3000000,
        currency: 'VND',
        type: 'EXPENSE',
        transaction_date: today,
        note: 'Tiền nhà',
      },
      {
        id: 72,
        wallet_id: 1,
        amount: 45000,
        currency: 'VND',
        type: 'EXPENSE',
        transaction_date: today,
        note: 'Nhạc',
      },
      {
        id: 73,
        wallet_id: 1,
        amount: 3000000,
        currency: 'VND',
        type: 'EXPENSE',
        transaction_date: billDateOffset(today, -45),
        note: 'Tiền nhà cũ',
      },
    ],
    meta: { page: 1, limit: 40, total: 3, totalPages: 1 },
  });
  await mount();
  await act(async () => press('Chọn giao dịch đã trả'));
  expect(transactionsService.getPage).toHaveBeenCalledWith(
    'token',
    expect.objectContaining({
      from: billDateOffset(today, -30),
      to: today,
      min_amount: 3000000,
      max_amount: 3000000,
    }),
  );
  expect(hasAction('Liên kết giao dịch 71')).toBe(true);
  expect(hasAction('Liên kết giao dịch 72')).toBe(false);
  expect(hasAction('Liên kết giao dịch 73')).toBe(false);
  expect(JSON.stringify(renderer!.toJSON())).not.toContain(
    'Khoản chi trong 365 ngày',
  );
  await act(async () => press('Xem giao dịch khác'));
  expect(transactionsService.getPage).toHaveBeenLastCalledWith(
    'token',
    expect.objectContaining({ to: today, page: 1 }),
  );
  expect(hasAction('Liên kết giao dịch 72')).toBe(true);
  expect(hasAction('Liên kết giao dịch 73')).toBe(true);
  expect(transactionsService.create).not.toHaveBeenCalled();
});
it('uses Đã trả for paid periods, hides skipped periods there, and removes transaction IDs from the row', async () => {
  await service.save(scope, bill);
  await service.save(scope, { ...bill, label: 'Điện' });
  const stored = await service.load(scope);
  await service.linkPayment(scope, stored.bills[0].id, today, {
    id: 77,
    wallet_id: 1,
    amount: 3000000,
    currency: 'VND',
    type: 'EXPENSE',
    transaction_date: today,
    note: 'Trả tiền nhà',
  });
  await service.skip(scope, stored.bills[1].id, billDueDate(stored.bills[1], 0));
  await mount();
  await act(async () => press('Đã trả'));
  const content = JSON.stringify(renderer!.toJSON());
  expect(content).toContain('Đã trả · ');
  expect(content).toContain('3.000.000');
  expect(content).not.toContain('Giao dịch #77');
  expect(content).not.toContain('Điện');
  expect(
    renderer!.root.findAllByProps({ accessibilityRole: 'button' }).some(
      node =>
        String(node.props.accessibilityLabel).startsWith(
          'Xem giao dịch đã trả 3.000.000',
        ),
    ),
  ).toBe(true);
  expect(transactionsService.create).not.toHaveBeenCalled();
});
it('offers creating and paying in the bill, without the backup button on this screen', async () => {
  await service.save(scope, bill);
  await mount();
  expect(JSON.stringify(renderer!.toJSON())).not.toContain(
    'Sao lưu và khôi phục lịch',
  );
  await act(async () => press(`Tạo giao dịch từ Tiền nhà kỳ ${today}`));
  expect(mockPush).toHaveBeenCalledWith(
    'Main',
    expect.objectContaining({
      billPayment: expect.objectContaining({ dueDate: today }),
    }),
  );
  expect(transactionsService.create).not.toHaveBeenCalled();
});
it('a dismissed picker invalidates an outstanding confirmation', async () => {
  await service.save(scope, bill);
  await mount();
  await act(async () => press('Chọn giao dịch đã trả'));
  await act(async () => press('Liên kết giao dịch 77'));
  const confirmStale = confirm;
  await act(async () => press('Đóng chọn giao dịch'));
  await act(async () => confirmStale());
  expect((await service.load(scope)).periods).toEqual([]);
});
it('cancelled requests do not reopen the picker after their network result arrives', async () => {
  await service.save(scope, bill);
  let resolve!: (
    value: Awaited<ReturnType<typeof transactionsService.getPage>>,
  ) => void;
  jest.mocked(transactionsService.getPage).mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  await mount();
  await act(async () => {
    press('Chọn giao dịch đã trả');
  });
  await act(async () => press('Đóng chọn giao dịch'));
  await act(async () =>
    resolve({
      data: [],
      meta: { page: 1, limit: 40, total: 0, totalPages: 0 },
    }),
  );
  const modal = renderer!.root.findByType(require('react-native').Modal);
  expect(modal.props.visible).toBe(false);
});
it('fails closed when local data cannot be read', async () => {
  await AsyncStorage.setItem(key, 'broken');
  await mount();
  expect(JSON.stringify(renderer!.toJSON())).toContain('Giữ nguyên dữ liệu');
  expect(
    renderer!.root.findAllByProps({ accessibilityLabel: 'Thêm lịch hóa đơn' }),
  ).toHaveLength(0);
  expect(await AsyncStorage.getItem(key)).toBe('broken');
});

it('accepts a decimal comma for a variable bill in a foreign currency', async () => {
  mockCurrency = 'USD';
  await mount();
  await act(async () => press('Thêm lịch hóa đơn'));
  await act(async () => {
    field('Tên hóa đơn', 'Hosting');
    press('Tiền biến thiên');
  });
  await act(async () => {
    field('Số tiền hóa đơn', '12,5');
    field('Số tiền tối đa', '20,75');
  });
  await act(async () => press('Lưu lịch'));
  expect((await service.load(scope)).bills[0]).toMatchObject({
    kind: 'VARIABLE',
    currency: 'USD',
    minAmount: 12.5,
    maxAmount: 20.75,
  });
  expect(
    renderer!.root.findAllByProps({ accessibilityLabel: 'Tiền tệ hóa đơn' }),
  ).toHaveLength(0);
});

it('lets the user keep a bill unclassified or choose an expense category', async () => {
  jest.mocked(apiRequest).mockResolvedValueOnce([
    { id: 7, name: 'Hóa đơn', type: 'EXPENSE', cash_flow_group: 'NORMAL' },
    { id: 8, name: 'Lương', type: 'INCOME', cash_flow_group: 'NORMAL' },
  ]);
  await mount();
  await act(async () => press('Thêm lịch hóa đơn'));
  await act(async () => {
    field('Tên hóa đơn', 'Internet');
    field('Số tiền hóa đơn', '300000');
  });
  await act(async () => press('Lưu lịch'));
  expect((await service.load(scope)).bills[0].categoryId).toBeUndefined();
  await act(async () => press('Lịch đã tạo'));
  mockRouteParams = { editBillId: (await service.load(scope)).bills[0].id };
  await act(async () => renderer!.update(screen()));
  await act(async () => press('Danh mục lịch Hóa đơn'));
  await act(async () => press('Lưu lịch'));
  expect((await service.load(scope)).bills[0].categoryId).toBe(7);
  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: 'Danh mục lịch Lương',
    }),
  ).toHaveLength(0);
});
it('saves an unclassified bill when category loading fails and offers retry', async () => {
  jest.mocked(apiRequest).mockRejectedValueOnce(Error('Mạng yếu'));
  await mount();
  await act(async () => press('Thêm lịch hóa đơn'));
  expect(hasAction('Tải lại danh mục lịch')).toBe(true);
  await act(async () => {
    field('Tên hóa đơn', 'Internet QA');
    field('Số tiền hóa đơn', '15000');
  });
  await act(async () => press('Lưu lịch'));
  expect((await service.load(scope)).bills[0].label).toBe('Internet QA');
  expect((await service.load(scope)).bills[0].categoryId).toBeUndefined();
  expect(transactionsService.create).not.toHaveBeenCalled();
});

it('opens an existing schedule on its own page instead of expanding the card', async () => {
  await service.save(scope, {
    ...bill,
    anchorDate: '2026-01-31',
    startDate: '2027-01-31',
    cycle: 'QUARTERLY',
  });
  await mount();
  await act(async () => press('Lịch đã tạo'));
  await act(async () => press('Chi tiết lịch Tiền nhà'));
  expect(mockNavigate).toHaveBeenCalledWith('RecurringBillDetail', {
    billId: (await service.load(scope)).bills[0].id,
  });
  expect(JSON.stringify(renderer!.toJSON())).not.toContain('Quản lý lịch');
});

it('finds a saved bill and creates its next transaction even beyond the 90-day overview', async () => {
  await service.save(scope, {
    ...bill,
    label: 'FPT Internet',
    anchorDate: billDateOffset(today, 180),
    cycle: 'YEARLY',
  });
  await service.save(scope, { ...bill, label: 'Tiền nhà' });
  await mount();
  await act(async () => press('Lịch đã tạo'));
  await act(async () => field('Tìm hóa đơn', 'fpt'));
  expect(JSON.stringify(renderer!.toJSON())).toContain('FPT Internet');
  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: 'Chi tiết lịch Tiền nhà',
    }),
  ).toHaveLength(0);
  await act(async () => press('Chi tiết lịch FPT Internet'));
  expect(mockNavigate).toHaveBeenCalledWith('RecurringBillDetail', {
    billId: (await service.load(scope)).bills.find(
      item => item.label === 'FPT Internet',
    )!.id,
  });
  await act(async () => press('Tạo giao dịch từ lịch FPT Internet'));
  expect(mockPush).toHaveBeenCalledWith(
    'Main',
    expect.objectContaining({
      billPayment: expect.objectContaining({
        bill: expect.objectContaining({ label: 'FPT Internet' }),
      }),
    }),
  );
  expect(transactionsService.create).not.toHaveBeenCalled();
});

it('shows the oldest unpaid overdue period in the saved bill instead of skipping ahead', async () => {
  const overdue = billDateOffset(today, -5);
  await service.save(scope, { ...bill, anchorDate: overdue });
  await mount();
  await act(async () => press('Lịch đã tạo'));
  const content = JSON.stringify(renderer!.toJSON());
  expect(content).toContain('Chưa trả · kỳ');
  expect(content).toContain(overdue.split('-').reverse().join('/'));
});

it('moves the first tracked date when the user changes it in the editor', async () => {
  await service.save(scope, {
    ...bill,
    anchorDate: '2026-01-31',
    startDate: '2027-01-31',
    cycle: 'QUARTERLY',
  });
  await mount();
  await act(async () => press('Lịch đã tạo'));
  mockRouteParams = { editBillId: (await service.load(scope)).bills[0].id };
  await act(async () => renderer!.update(screen()));
  await act(async () => press('Chọn ngày đến hạn đầu tiên'));
  await act(async () =>
    renderer!.root
      .findByType('DatePicker' as React.ElementType)
      .props.onChange({ type: 'set' }, new Date(2027, 3, 30)),
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain('30/04/2027');
  await act(async () => press('Lưu lịch'));
  expect((await service.load(scope)).bills[0]).toMatchObject({
    anchorDate: '2027-04-30',
    startDate: '2027-04-30',
  });
});

it('keeps an unsaved draft when the same account refreshes its token', async () => {
  await mount();
  await act(async () => press('Thêm lịch hóa đơn'));
  await act(async () => {
    field('Tên hóa đơn', 'Internet draft');
    field('Số tiền hóa đơn', '200000');
  });
  await act(async () => {
    mockToken = 'rotated-token';
    renderer!.update(screen());
  });
  expect(
    renderer!.root.findAllByProps({ accessibilityLabel: 'Tên hóa đơn' })[0]
      ?.props.value,
  ).toBe('Internet draft');
});

it('keeps a pending payment picker open across token refresh', async () => {
  await service.save(scope, bill);
  let resolve!: (
    value: Awaited<ReturnType<typeof transactionsService.getPage>>,
  ) => void;
  jest.mocked(transactionsService.getPage).mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  await mount();
  await act(async () => {
    press('Chọn giao dịch đã trả');
  });
  await act(async () => {
    mockToken = 'rotated-token';
    renderer!.update(screen());
  });
  await act(async () =>
    resolve({
      data: [
        {
          id: 77,
          wallet_id: 1,
          amount: 3000000,
          currency: 'VND',
          type: 'EXPENSE',
          transaction_date: today,
        },
      ],
      meta: { page: 1, limit: 40, total: 1, totalPages: 1 },
    }),
  );
  expect(
    renderer!.root.findByType(require('react-native').Modal).props.visible,
  ).toBe(true);
  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: 'Liên kết giao dịch 77',
    }).length,
  ).toBeGreaterThan(0);
});

it('clears the editor when the account actually changes', async () => {
  await mount();
  await act(async () => press('Thêm lịch hóa đơn'));
  await act(async () => field('Tên hóa đơn', 'Private draft'));
  await act(async () => {
    mockUserId = 100;
    mockToken = 'other-account';
    renderer!.update(screen());
  });
  expect(
    renderer!.root.findAllByProps({ accessibilityLabel: 'Tên hóa đơn' }),
  ).toHaveLength(0);
  expect(JSON.stringify(renderer!.toJSON())).not.toContain('Private draft');
});

it('shows a retryable network error without claiming that no payments exist', async () => {
  await service.save(scope, bill);
  jest
    .mocked(transactionsService.getPage)
    .mockRejectedValueOnce(new Error('Offline'));
  await mount();
  await act(async () => press('Chọn giao dịch đã trả'));
  const content = JSON.stringify(renderer!.toJSON());
  expect(content).toContain('Chưa tải được giao dịch');
  expect(content).not.toContain('Chưa có khoản chi phù hợp');
  await act(async () => press('Thử tải giao dịch'));
  expect(transactionsService.getPage).toHaveBeenLastCalledWith(
    'token',
    expect.objectContaining({ page: 1 }),
  );
  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: 'Liên kết giao dịch 77',
    }).length,
  ).toBeGreaterThan(0);
});

it('navigates to schedule detail without changing reminders or payments', async () => {
  await service.save(scope, bill);
  await mount();
  await act(async () => press('Lịch đã tạo'));
  await act(async () => press('Chi tiết lịch Tiền nhà'));
  expect(mockNavigate).toHaveBeenCalledWith('RecurringBillDetail', {
    billId: (await service.load(scope)).bills[0].id,
  });
  expect((await service.load(scope)).bills[0]).toMatchObject({
    paused: false,
  });
  expect((await service.load(scope)).periods).toEqual([]);
  expect(transactionsService.create).not.toHaveBeenCalled();
});

it('opens the notification day group and lets the user return to all periods', async () => {
  await service.save(scope, {
    ...bill,
    label: 'Due tomorrow',
    anchorDate: billDateOffset(today, 1),
  });
  await service.save(scope, {
    ...bill,
    label: 'Later bill',
    anchorDate: billDateOffset(today, 10),
  });
  mockRouteParams = { reminderDate: today };
  await mount();
  expect(JSON.stringify(renderer!.toJSON())).toContain('Due tomorrow');
  expect(JSON.stringify(renderer!.toJSON())).not.toContain('Later bill');
  await act(async () => press('Xem tất cả kỳ'));
  expect(JSON.stringify(renderer!.toJSON())).toContain('Later bill');
});
