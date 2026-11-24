import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import LoanDebtFormScreen from '../src/screens/home/LoanDebtFormScreen';
import { loanDebtsService } from '../src/services/loanDebts';
import { offlineLoanCreateQueue } from '../src/services/offlineLoanCreateQueue';
import { dashboardCache } from '../src/services/dashboardCache';
import type { LoanDebt } from '../src/types/loanDebt';

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
let mockOfflineSession = false;
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'test',
    user: { id: 7 },
    isOfflineSession: mockOfflineSession,
  }),
}));
jest.mock('../src/services/offlineLoanCreateQueue', () => ({
  offlineLoanCreateQueue: { enqueue: jest.fn().mockResolvedValue({}) },
}));
jest.mock('../src/services/wallets', () => ({
  walletsService: {
    getAll: jest.fn().mockResolvedValue([
      { id: 2, name: 'Ví VND', currency: 'VND', wallet_type: 'CASH' },
      { id: 3, name: 'Ví USD', currency: 'USD', wallet_type: 'BANK' },
      { id: 4, name: 'Mục tiêu USD', currency: 'USD', wallet_type: 'SAVINGS' },
    ]),
  },
}));
jest.mock('../src/services/loanDebts', () => ({
  loanDebtsService: {
    getOne: jest.fn(),
    update: jest.fn(),
    createQuickEntry: jest.fn(),
  },
}));
const record: LoanDebt = {
  id: 1,
  user_id: 7,
  person_name: 'Bạn học',
  type: 'BORROWED',
  principal_amount: 12.75,
  settled_amount: 0,
  remaining_amount: 12.75,
  currency: 'USD',
  opening_wallet_id: 3,
  opening_transaction_id: 9,
  status: 'OPEN',
  payments: [],
  note: 'Ghi chú cũ',
};
const service = jest.mocked(loanDebtsService);
let renderer: TestRenderer.ReactTestRenderer;
const press = (label: string) =>
  renderer.root.findByProps({ accessibilityLabel: label }).props.onPress();
const mount = async (loanDebtId: number | null = 1) => {
  await act(async () => {
    renderer = TestRenderer.create(
      <LoanDebtFormScreen
        navigation={{ goBack: jest.fn() } as never}
        route={{ params: { loanDebtId: loanDebtId ?? undefined } } as never}
      />,
    );
  });
};
beforeEach(() => {
  mockOfflineSession = false;
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  service.getOne.mockResolvedValue(record);
  service.update.mockResolvedValue(record);
  service.createQuickEntry.mockResolvedValue(record);
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});
const confirm = async () => {
  const actions = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
  const action = actions?.find(item => item.text === 'Xác nhận');
  expect(action).toBeDefined();
  await act(async () => action?.onPress?.());
};

it('does not expose an empty edit form after loading fails and recovers on retry', async () => {
  service.getOne.mockRejectedValueOnce(new Error('Mất kết nối mạng'));
  await mount();
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: 'Lưu khoản vay nợ' }),
  ).toHaveLength(0);
  await act(async () => {
    await press('Thử tải lại biểu mẫu vay nợ');
  });
  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Tiền gốc vay nợ' }).props
      .value,
  ).toBe('12.75');
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: 'Chọn ví vay nợ Ví VND',
    }),
  ).toHaveLength(0);
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: 'Chọn ví vay nợ Mục tiêu USD',
    }),
  ).toHaveLength(0);
});

it('preserves principal cents and explicitly clears an existing note once', async () => {
  await mount();
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Ghi chú khoản vay nợ' })
      .props.onChangeText('');
  });
  await act(async () => {
    await Promise.all([press('Lưu khoản vay nợ'), press('Lưu khoản vay nợ')]);
  });
  await confirm();
  expect(service.update).toHaveBeenCalledTimes(1);
  expect(service.update).toHaveBeenCalledWith(
    'test',
    1,
    expect.objectContaining({
      principal_amount: '12.75',
      wallet_id: 3,
      note: '',
    }),
  );
});

it('allows a name edit after payments without changing the archived opening wallet or principal', async () => {
  service.getOne.mockResolvedValueOnce({
    ...record,
    opening_wallet_id: 99,
    payments: [{ id: 11 }],
  } as LoanDebt);
  await mount();
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Tên người vay nợ' })
      .props.onChangeText('Tên mới');
  });
  await act(async () => {
    await press('Lưu khoản vay nợ');
  });
  await confirm();
  const payload = service.update.mock.calls[0][2];
  expect(payload.person_name).toBe('Tên mới');
  expect(payload).not.toHaveProperty('wallet_id');
  expect(payload).not.toHaveProperty('principal_amount');
});

it('previews a new loan and retains its request id after a lost reply', async () => {
  service.createQuickEntry.mockRejectedValueOnce(new Error('Mất phản hồi'));
  await mount(null);
  await act(async () =>
    renderer.root
      .findByProps({ accessibilityLabel: 'Tên người vay nợ' })
      .props.onChangeText('Anh Minh'),
  );
  await act(async () =>
    renderer.root
      .findByProps({ accessibilityLabel: 'Tiền gốc vay nợ' })
      .props.onChangeText('50000'),
  );
  await act(async () => press('Lưu khoản vay nợ'));
  expect(service.createQuickEntry).not.toHaveBeenCalled();
  await confirm();
  const first = service.createQuickEntry.mock.calls[0][1];
  expect(offlineLoanCreateQueue.enqueue).toHaveBeenCalledWith(
    7,
    expect.objectContaining({
      client_request_id: first.client_request_id,
      person_name: 'Anh Minh',
    }),
    expect.objectContaining({ id: 2 }),
    true,
  );
  expect(service.createQuickEntry).toHaveBeenCalledTimes(1);
  expect(jest.mocked(Alert.alert).mock.calls.at(-1)?.[0]).toBe(
    'Đã giữ khoản Vay/Nợ trên máy',
  );
  expect(first.client_request_id).toMatch(/^[a-zA-Z0-9_-]{16,64}$/);
});

it('uses cached wallets and queues a loan without calling the server in an offline session', async () => {
  mockOfflineSession = true;
  jest.spyOn(dashboardCache, 'readReferences').mockResolvedValue({
    server: 'local',
    updatedAt: '2026-11-24T05:00:00.000Z',
    categories: [],
    wallets: [
      {
        id: 2,
        name: 'Ví VND',
        currency: 'VND',
        wallet_type: 'CASH',
        balance: 100000,
      },
    ] as never,
  });
  await mount(null);
  await act(async () =>
    renderer.root
      .findByProps({ accessibilityLabel: 'Tên người vay nợ' })
      .props.onChangeText('Anh Minh'),
  );
  await act(async () =>
    renderer.root
      .findByProps({ accessibilityLabel: 'Tiền gốc vay nợ' })
      .props.onChangeText('50000'),
  );
  await act(async () => press('Lưu khoản vay nợ'));
  await confirm();
  expect(service.createQuickEntry).not.toHaveBeenCalled();
  expect(offlineLoanCreateQueue.enqueue).toHaveBeenCalledWith(
    7,
    expect.objectContaining({ principal_amount: '50000' }),
    expect.objectContaining({ id: 2 }),
    false,
  );
});
