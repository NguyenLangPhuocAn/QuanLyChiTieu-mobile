import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import RecurringBillDetailScreen from '../src/screens/home/RecurringBillDetailScreen';
import { recurringBillsService } from '../src/services/recurringBills';
import { getTransactionDateKey } from '../src/utils/mapTransactions';

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 813 }, token: 'qa-token' }),
}));
jest.mock('../src/services/api', () => ({
  getApiBaseUrl: () => 'https://detail.test',
  apiRequest: jest
    .fn()
    .mockResolvedValue([
      { id: 7, name: 'Hóa đơn', type: 'EXPENSE', cash_flow_group: 'NORMAL' },
    ]),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));

const scope = { userId: 813, server: 'https://detail.test' };
const key = 'recurring-bills:v1:https://detail.test:813';
const today = getTransactionDateKey(new Date().toISOString());
const navigation = { goBack: jest.fn(), navigate: jest.fn(), push: jest.fn() };
let renderer: TestRenderer.ReactTestRenderer;
const press = (label: string) =>
  renderer.root
    .findAllByProps({ accessibilityLabel: label })
    .find(node => typeof node.props.onPress === 'function')!
    .props.onPress();

beforeEach(async () => {
  await AsyncStorage.removeItem(key);
  await AsyncStorage.removeItem(
    key.replace('recurring-bills:v1:', 'planning-local:v1:'),
  );
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});

it('shows a separate detail page, opens the normal transaction form, and outlines the red delete action', async () => {
  await recurringBillsService.save(scope, {
    label: 'Internet',
    anchorDate: today,
    cycle: 'MONTHLY',
    kind: 'FIXED',
    minAmount: 300000,
    maxAmount: 300000,
    currency: 'VND',
    categoryId: 7,
    note: '',
  });
  const billId = (await recurringBillsService.load(scope)).bills[0].id;
  await act(async () => {
    renderer = TestRenderer.create(
      <RecurringBillDetailScreen
        {...({
          navigation,
          route: { params: { billId } },
        } as unknown as React.ComponentProps<typeof RecurringBillDetailScreen>)}
      />,
    );
  });
  await act(async () => press('Thêm giao dịch'));
  expect(navigation.push).toHaveBeenCalledWith(
    'Main',
    expect.objectContaining({
      billPayment: expect.objectContaining({
        bill: expect.objectContaining({ categoryId: 7 }),
        dueDate: today,
      }),
    }),
  );
  const deleteButton = renderer.root
    .findAllByProps({ accessibilityLabel: 'Xóa lịch Internet' })
    .find(node => typeof node.props.onPress === 'function')!;
  const style = [deleteButton.props.style].flat().filter(Boolean);
  expect(style).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ borderWidth: 1, borderRadius: 12 }),
    ]),
  );
  expect(
    deleteButton
      .findAllByType(require('react-native').Text)
      .some(node => node.props.children === 'Xóa'),
  ).toBe(true);
  await act(async () => press('Sửa lịch hóa đơn'));
  expect(navigation.navigate).toHaveBeenCalledWith('RecurringBills', {
    editBillId: billId,
  });
});

it('requires explicit confirmation to delete a schedule', async () => {
  await recurringBillsService.save(scope, {
    label: 'Internet',
    anchorDate: today,
    cycle: 'MONTHLY',
    kind: 'FIXED',
    minAmount: 300000,
    maxAmount: 300000,
    currency: 'VND',
    note: '',
  });
  await act(async () => {
    renderer = TestRenderer.create(
      <RecurringBillDetailScreen
        {...({
          navigation,
          route: {
            params: {
              billId: (await recurringBillsService.load(scope)).bills[0].id,
            },
          },
        } as unknown as React.ComponentProps<typeof RecurringBillDetailScreen>)}
      />,
    );
  });
  await act(async () => press('Xóa lịch Internet'));
  expect(
    (await recurringBillsService.load(scope)).bills[0].archived,
  ).toBeFalsy();
  const confirm = jest
    .mocked(Alert.alert)
    .mock.calls.at(-1)![2]!
    .find(item => item.text === 'Xóa lịch')!;
  await act(async () => confirm.onPress!());
  expect((await recurringBillsService.load(scope)).bills[0].archived).toBe(
    true,
  );
});
