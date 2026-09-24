import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import LoanDebtFormScreen from '../src/screens/home/LoanDebtFormScreen';
import { loanDebtsService } from '../src/services/loanDebts';
import type { LoanDebt } from '../src/types/loanDebt';

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: 'test' }),
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
  loanDebtsService: { getOne: jest.fn(), update: jest.fn(), create: jest.fn() },
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
const mount = async () => {
  await act(async () => {
    renderer = TestRenderer.create(
      <LoanDebtFormScreen
        navigation={{ goBack: jest.fn() } as never}
        route={{ params: { loanDebtId: 1 } } as never}
      />,
    );
  });
};
beforeEach(() => {
  jest.clearAllMocks();
  service.getOne.mockResolvedValue(record);
  service.update.mockResolvedValue(record);
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});

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
  const payload = service.update.mock.calls[0][2];
  expect(payload.person_name).toBe('Tên mới');
  expect(payload).not.toHaveProperty('wallet_id');
  expect(payload).not.toHaveProperty('principal_amount');
});
