import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import LoanDebtsScreen from '../src/screens/home/LoanDebtsScreen';
import { loanDebtsService } from '../src/services/loanDebts';
import type { LoanDebt } from '../src/types/loanDebt';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    jest.requireActual<typeof React>('react').useEffect(callback, [callback]);
  },
}));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: 'test' }),
}));
jest.mock('../src/services/loanDebts', () => ({
  loanDebtsService: { getAll: jest.fn() },
}));
const record: LoanDebt = {
  id: 1,
  user_id: 7,
  person_name: 'Khoản đã trả',
  type: 'BORROWED',
  principal_amount: 100,
  settled_amount: 100,
  remaining_amount: 0,
  currency: 'VND',
  opening_wallet_id: 1,
  opening_transaction_id: 2,
  status: 'PAID',
  payments: [],
};
const service = jest.mocked(loanDebtsService);
let renderer: TestRenderer.ReactTestRenderer;
const mount = async () => {
  await act(async () => {
    renderer = TestRenderer.create(
      <LoanDebtsScreen
        navigation={{ goBack: jest.fn(), navigate: jest.fn() } as never}
        route={{} as never}
      />,
    );
  });
};
beforeEach(() => {
  jest.clearAllMocks();
  service.getAll.mockResolvedValue([record]);
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});

it('shows paid loans when selecting Paid from the default open-loan period', async () => {
  await mount();
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Lọc vay nợ: Đã thanh toán' })
      .props.onPress();
  });
  expect(service.getAll).toHaveBeenLastCalledWith('test', {
    type: undefined,
    status: 'PAID',
  });
  expect(
    renderer.root.findAllByProps({ children: 'Khoản đã trả' }).length,
  ).toBeGreaterThan(0);
});

it('offers retry after a network failure instead of showing an empty loan list', async () => {
  service.getAll.mockRejectedValueOnce(new Error('Mất kết nối mạng'));
  await mount();
  expect(
    renderer.root.findAllByProps({
      children: 'Không có khoản vay/nợ phù hợp với bộ lọc.',
    }),
  ).toHaveLength(0);
  await act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: 'Thử tải lại danh sách vay nợ' })
      .props.onPress();
  });
  expect(service.getAll).toHaveBeenCalledTimes(2);
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: 'Thử tải lại danh sách vay nợ',
    }),
  ).toHaveLength(0);
});

it('ignores old records arriving after the status filter changes', async () => {
  let finish!: (value: LoanDebt[]) => void;
  service.getAll.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await mount();
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Lọc vay nợ: Đã thanh toán' })
      .props.onPress();
  });
  await act(async () => {
    finish([{ ...record, person_name: 'Khoản cũ', status: 'OPEN' }]);
  });
  expect(
    renderer.root.findAllByProps({ children: 'Khoản đã trả' }).length,
  ).toBeGreaterThan(0);
  expect(renderer.root.findAllByProps({ children: 'Khoản cũ' })).toHaveLength(
    0,
  );
});
