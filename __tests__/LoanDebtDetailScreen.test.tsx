import React from 'react';
import { Modal } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import LoanDebtDetailScreen from '../src/screens/home/LoanDebtDetailScreen';
import { loanDebtsService } from '../src/services/loanDebts';
import type { LoanDebt } from '../src/types/loanDebt';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    jest.requireActual<typeof React>('react').useEffect(callback, [callback]);
  },
}));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token' }),
}));
jest.mock('../src/services/loanDebts', () => ({
  loanDebtsService: { getOne: jest.fn(), addPayment: jest.fn() },
}));
jest.mock('../src/services/wallets', () => ({
  walletsService: {
    getAll: jest
      .fn()
      .mockResolvedValue([
        { id: 3, name: 'Ví USD', currency: 'USD', balance: 100 },
      ]),
  },
}));
const service = jest.mocked(loanDebtsService);
const record: LoanDebt = {
  id: 1,
  user_id: 7,
  person_name: 'Khoản vay thử',
  type: 'BORROWED',
  principal_amount: 12.75,
  settled_amount: 0,
  remaining_amount: 12.75,
  currency: 'USD',
  opening_wallet_id: 3,
  opening_transaction_id: 9,
  status: 'OPEN',
  payments: [],
};
const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const screen = (id = 1) => (
  <LoanDebtDetailScreen
    navigation={navigation as never}
    route={{ params: { loanDebtId: id } } as never}
  />
);
const mount = async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(screen());
  });
  return renderer;
};
beforeEach(() => {
  jest.clearAllMocks();
  service.getOne.mockResolvedValue(record);
});

it('recovers from a failed initial load through the retry button', async () => {
  service.getOne.mockRejectedValueOnce(new Error('Mất kết nối mạng'));
  const renderer = await mount();
  expect(JSON.stringify(renderer.toJSON())).toContain('Mất kết nối mạng');
  await act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: 'Thử tải lại khoản vay nợ' })
      .props.onPress();
  });
  expect(service.getOne).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(renderer.toJSON())).toContain('Khoản vay thử');
  await act(async () => renderer.unmount());
});

it('keeps decimal payment, prevents repeat submission and keeps the pending form open', async () => {
  let resolvePayment!: (value: LoanDebt) => void;
  service.addPayment.mockImplementation(
    () =>
      new Promise(resolve => {
        resolvePayment = resolve;
      }),
  );
  const renderer = await mount();
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Ghi nhận thanh toán vay nợ' })
      .props.onPress();
  });
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Số tiền thanh toán vay nợ' })
      .props.onChangeText('0,50');
  });
  let pending!: Promise<unknown>;
  await act(async () => {
    const save = renderer.root.findByProps({
      accessibilityLabel: 'Xác nhận thanh toán vay nợ',
    }).props.onPress;
    pending = save();
    save();
  });
  expect(service.addPayment).toHaveBeenCalledTimes(1);
  expect(service.addPayment).toHaveBeenCalledWith(
    'test-token',
    1,
    expect.objectContaining({ amount: '0.50', wallet_id: 3 }),
  );
  await act(async () => {
    renderer.root.findByType(Modal).props.onRequestClose();
  });
  expect(renderer.root.findByType(Modal).props.visible).toBe(true);
  await act(async () => {
    resolvePayment(record);
    await pending;
  });
  expect(renderer.root.findByType(Modal).props.visible).toBe(false);
  await act(async () => renderer.unmount());
});

it('does not display the previous loan while a different loan is loading', async () => {
  const renderer = await mount();
  let resolveNext!: (value: LoanDebt) => void;
  service.getOne.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveNext = resolve;
      }),
  );
  await act(async () => renderer.update(screen(2)));
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Khoản vay thử');
  await act(async () => {
    resolveNext({ ...record, id: 2, person_name: 'Khoản mới' });
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('Khoản mới');
  await act(async () => renderer.unmount());
});
