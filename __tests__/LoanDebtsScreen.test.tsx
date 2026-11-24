import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import LoanDebtsScreen from '../src/screens/home/LoanDebtsScreen';
import { loanDebtsService } from '../src/services/loanDebts';
import { offlineLoanCreateQueue } from '../src/services/offlineLoanCreateQueue';
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
  loanDebtsService: { getAll: jest.fn() },
}));
jest.mock('../src/services/loanDebtsCache', () => ({
  loanDebtsCache: {
    read: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
  },
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
  jest.restoreAllMocks();
});

it('keeps new local loans in a separate pending section even while filtering paid records', async () => {
  jest.spyOn(offlineLoanCreateQueue, 'list').mockResolvedValue([
    {
      id: 'loan_20261125_abcdef123456',
      revision: 1,
      attempts: 1,
      status: 'PENDING',
      updatedAt: '2026-11-25T08:00:00.000Z',
      wallet: {
        id: 2,
        name: 'Ví gia đình',
        currency: 'VND',
        balance: '500000',
      },
      payload: {
        person_name: 'Anh Minh',
        type: 'LENT',
        principal_amount: '200000',
        wallet_id: 2,
        client_request_id: 'loan_20261125_abcdef123456',
      },
    },
  ]);
  await mount();
  await act(async () =>
    renderer.root
      .findByProps({ accessibilityLabel: 'Lọc vay nợ: Đã thanh toán' })
      .props.onPress(),
  );
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: 'Chờ đồng bộ 1 khoản Vay/Nợ',
    }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer.root.findAllByProps({ children: 'Anh Minh' }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer.root.findAllByProps({ children: 'Khoản đã trả' }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer.root.findAllByProps({
      children:
        'Chưa rõ máy chủ đã ghi hay chưa. Khi có mạng, mở Dữ liệu và xuất nhập để đối chiếu.',
    }).length,
  ).toBeGreaterThan(0);
});

it('shows paid loans when selecting Paid from the default open-loan period', async () => {
  await mount();
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Lọc vay nợ: Đã thanh toán' })
      .props.onPress();
  });
  expect(service.getAll).toHaveBeenLastCalledWith('session-token');
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

it('keeps the selected status filter when records arrive later', async () => {
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
  expect(renderer.root.findAllByProps({ children: 'Khoản cũ' })).toHaveLength(
    0,
  );
  expect(
    renderer.root.findAllByProps({
      children: 'Không có khoản vay/nợ phù hợp với bộ lọc.',
    }).length,
  ).toBeGreaterThan(0);
});
