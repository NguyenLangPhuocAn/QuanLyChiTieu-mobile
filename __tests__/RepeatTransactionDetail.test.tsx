import React from 'react';
import { Switch } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import Screen from '../src/screens/home/TransactionDetailScreen';
import type { TransactionItem } from '../src/data/mockTransactions';
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 8 } }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));
const source: TransactionItem = {
  id: '30',
  amount: -1250,
  type: 'expense',
  cashFlowType: 'normal',
  currency: 'VND',
  displayAmount: -1250,
  displayCurrency: 'VND',
  date: '2026-10-30',
  category: 'Ăn uống',
  wallet: 'QA',
  note: 'Nhập lại QA',
  receiptItems: [{ name: 'Cà phê', amount: 1250 }],
};
let renderer: TestRenderer.ReactTestRenderer;
const navigate = jest.fn();
const mount = async (transaction = source) =>
  act(async () => {
    const props = {
      route: { params: { transaction } },
      navigation: { navigate, goBack: jest.fn() },
    } as unknown as React.ComponentProps<typeof Screen>;
    renderer = TestRenderer.create(<Screen {...props} />);
  });
const press = () =>
  renderer.root
    .findByProps({ accessibilityLabel: 'Nhập lại giao dịch' })
    .props.onPress();
beforeEach(() => jest.clearAllMocks());
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
it('opens an account-scoped new draft once and leaves item copying off by default', async () => {
  await mount();
  await act(async () => {
    press();
    press();
  });
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(navigate).toHaveBeenCalledWith('Main', {
    repeatTransaction: expect.objectContaining({
      transaction: source,
      userId: 8,
      includeItems: false,
      requestId: expect.any(String),
      server: expect.any(String),
    }),
  });
});
it('only includes item details when the user enables the switch', async () => {
  await mount();
  await act(async () =>
    renderer.root.findByType(Switch).props.onValueChange(true),
  );
  await act(async () => press());
  expect(navigate.mock.calls[0][1].repeatTransaction.includeItems).toBe(true);
});
it('does not offer repeat for loan or saving transfers', async () => {
  await mount({ ...source, cashFlowType: 'loan_debt' });
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: 'Nhập lại giao dịch' }),
  ).toHaveLength(0);
});
