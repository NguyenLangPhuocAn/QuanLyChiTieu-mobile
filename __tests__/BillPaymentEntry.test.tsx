import React from 'react';
import { Alert, AppState } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import BillPaymentEntry from '../src/components/BillPaymentEntry';
import { categoriesService } from '../src/services/categories';
import { payRecurringBill } from '../src/services/payRecurringBill';
import { walletsService } from '../src/services/wallets';
import type { BillOccurrence } from '../src/utils/recurringBills';

jest.mock('../src/services/wallets', () => ({
  walletsService: { getAll: jest.fn() },
}));
jest.mock('../src/services/categories', () => ({
  categoriesService: { getAll: jest.fn() },
}));
jest.mock('../src/services/payRecurringBill', () => ({
  payRecurringBill: jest.fn(),
}));
jest.mock('@react-native-community/datetimepicker', () => 'DatePicker');
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));

const occurrence: BillOccurrence = {
  bill: {
    id: 'fpt-1',
    label: 'FPT Internet',
    anchorDate: '2026-11-30',
    cycle: 'MONTHLY',
    kind: 'FIXED',
    minAmount: 300000,
    maxAmount: 300000,
    currency: 'VND',
    note: '',
    paused: false,
    archived: false,
  },
  dueDate: '2026-11-30',
  status: 'PENDING',
};
let renderer!: TestRenderer.ReactTestRenderer;
const onClose = jest.fn();
const onLinked = jest.fn().mockResolvedValue(undefined);
const press = (label: string) =>
  renderer.root
    .findAllByProps({ accessibilityLabel: label })
    .find(node => typeof node.props.onPress === 'function')!
    .props.onPress();
const change = (label: string, value: string) =>
  renderer.root
    .findAllByProps({ accessibilityLabel: label })
    .find(node => typeof node.props.onChangeText === 'function')!
    .props.onChangeText(value);
const confirm = () => {
  const actions = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] ?? [];
  return actions.find(item => item.text === 'Tạo và trả')!.onPress!();
};

beforeEach(async () => {
  jest.clearAllMocks();
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest
    .mocked(walletsService.getAll)
    .mockResolvedValue([
      { id: 2, name: 'Ví QA', currency: 'VND', wallet_type: 'CASH' },
    ] as Awaited<ReturnType<typeof walletsService.getAll>>);
  jest
    .mocked(categoriesService.getAll)
    .mockResolvedValue([
      { id: 7, name: 'Hóa đơn', type: 'EXPENSE', cash_flow_group: 'NORMAL' },
    ]);
  jest.mocked(payRecurringBill).mockResolvedValue({ id: 912 } as never);
  await act(async () => {
    renderer = TestRenderer.create(
      <BillPaymentEntry
        occurrence={occurrence}
        scope={{ userId: 801, server: 'https://test.invalid' }}
        token="qa-token"
        onClose={onClose}
        onLinked={onLinked}
      />,
    );
  });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});

it('loads wallet/category and writes only after a separate preview and confirmation', async () => {
  await act(async () => {
    press('Ví trả hóa đơn Ví QA');
    press('Danh mục trả hóa đơn Hóa đơn');
  });
  await act(async () => press('Kiểm tra và trả'));
  expect(payRecurringBill).not.toHaveBeenCalled();
  expect(jest.mocked(Alert.alert).mock.calls.at(-1)?.[1]).toContain('300.000');
  await act(async () => confirm());
  expect(payRecurringBill).toHaveBeenCalledTimes(1);
  expect(payRecurringBill).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({
        wallet_id: 2,
        category_id: 7,
        amount: '300000',
        type: 'EXPENSE',
      }),
    }),
  );
});

it('invalidates an older confirmation when the user edits the amount', async () => {
  await act(async () => {
    press('Ví trả hóa đơn Ví QA');
    press('Danh mục trả hóa đơn Hóa đơn');
  });
  await act(async () => press('Kiểm tra và trả'));
  const oldConfirm = jest
    .mocked(Alert.alert)
    .mock.calls.at(-1)![2]!
    .find(item => item.text === 'Tạo và trả')!.onPress!;
  await act(async () => change('Số tiền trả hóa đơn', '330000'));
  await act(async () => oldConfirm());
  expect(payRecurringBill).not.toHaveBeenCalled();
});

it('allows a BASIC account with no visible categories to create an uncategorized expense', async () => {
  await act(async () => renderer.unmount());
  jest.mocked(categoriesService.getAll).mockResolvedValue([]);
  await act(async () => {
    renderer = TestRenderer.create(
      <BillPaymentEntry
        occurrence={occurrence}
        scope={{ userId: 801, server: 'https://test.invalid' }}
        token="qa-token"
        onClose={onClose}
        onLinked={onLinked}
      />,
    );
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('chưa phân loại');
  await act(async () => press('Ví trả hóa đơn Ví QA'));
  await act(async () => press('Kiểm tra và trả'));
  expect(payRecurringBill).not.toHaveBeenCalled();
  await act(async () => confirm());
  expect(payRecurringBill).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({
        category_id: undefined,
        type: 'EXPENSE',
      }),
      category: undefined,
    }),
  );
});

it('does not honor an old confirmation after the app goes to background', async () => {
  await act(async () => {
    press('Ví trả hóa đơn Ví QA');
    press('Danh mục trả hóa đơn Hóa đơn');
  });
  await act(async () => press('Kiểm tra và trả'));
  const oldConfirm = jest
    .mocked(Alert.alert)
    .mock.calls.at(-1)![2]!
    .find(item => item.text === 'Tạo và trả')!.onPress!;
  await act(async () => {
    const listeners = (AppState.addEventListener as jest.Mock).mock.calls;
    const handler = listeners.at(-1)?.[1];
    handler('background');
  });
  await act(async () => oldConfirm());
  expect(payRecurringBill).not.toHaveBeenCalled();
});
