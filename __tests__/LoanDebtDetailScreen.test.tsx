import React from 'react';
import { Modal } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import LoanDebtDetailScreen from '../src/screens/home/LoanDebtDetailScreen';
import { loanDebtsService } from '../src/services/loanDebts';
import { loanDebtsCache } from '../src/services/loanDebtsCache';
import { offlineLoanDebtQueue } from '../src/services/offlineLoanDebtQueue';
import type { LoanDebt } from '../src/types/loanDebt';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    jest.requireActual<typeof React>('react').useEffect(callback, [callback]);
  },
}));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: 'session-token', user: { id: 7 } }),
}));
jest.mock('../src/services/loanDebts', () => ({
  loanDebtsService: { getOne: jest.fn(), addPayment: jest.fn() },
}));
jest.mock('../src/services/loanDebtsCache', () => ({
  loanDebtsCache: { read: jest.fn() },
}));
jest.mock('../src/services/offlineLoanDebtQueue', () => ({
  offlineLoanDebtQueue: {
    list: jest.fn(),
    update: jest.fn(),
    subscribe: jest.fn(() => jest.fn()),
    apply: jest.fn((records: LoanDebt[]) => records),
  },
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
  person_name: 'Khoản vay của Minh',
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
  jest.mocked(loanDebtsCache.read).mockResolvedValue(null);
  jest.mocked(offlineLoanDebtQueue.list).mockResolvedValue([]);
  jest
    .mocked(offlineLoanDebtQueue.update)
    .mockResolvedValue(undefined as never);
});

it('keeps an offline metadata edit locally and blocks payment', async () => {
  jest.mocked(loanDebtsCache.read).mockResolvedValue({
    server: 'https://test',
    userId: 7,
    records: [record],
    updatedAt: '2026-11-24T01:00:00.000Z',
  });
  service.getOne.mockRejectedValue(new Error('Mất kết nối mạng'));
  const renderer = await mount();
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: 'Ghi nhận thanh toán vay nợ',
    }),
  ).toHaveLength(0);
  await act(async () =>
    renderer.root
      .findByProps({ accessibilityLabel: 'Sửa thông tin vay nợ' })
      .props.onPress(),
  );
  const inputs = renderer.root.findAllByType(require('react-native').TextInput);
  await act(async () => inputs[0].props.onChangeText('Khoản vay của Lan'));
  await act(async () =>
    renderer.root
      .findByProps({ accessibilityLabel: 'Lưu thông tin vay nợ trên máy' })
      .props.onPress(),
  );
  expect(offlineLoanDebtQueue.update).toHaveBeenCalledWith(
    7,
    record,
    expect.objectContaining({ person_name: 'Khoản vay của Lan' }),
  );
  expect(service.addPayment).not.toHaveBeenCalled();
  await act(async () => renderer.unmount());
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
  expect(JSON.stringify(renderer.toJSON())).toContain('Khoản vay của Minh');
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
    'session-token',
    1,
    expect.objectContaining({ amount: '0.50', wallet_id: 3 }),
  );
  await act(async () => {
    renderer.root.findAllByType(Modal).at(-1)?.props.onRequestClose();
  });
  expect(renderer.root.findAllByType(Modal).at(-1)?.props.visible).toBe(true);
  await act(async () => {
    resolvePayment(record);
    await pending;
  });
  expect(renderer.root.findAllByType(Modal).at(-1)?.props.visible).toBe(false);
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
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Khoản vay của Minh');
  await act(async () => {
    resolveNext({ ...record, id: 2, person_name: 'Khoản mới' });
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('Khoản mới');
  await act(async () => renderer.unmount());
});
