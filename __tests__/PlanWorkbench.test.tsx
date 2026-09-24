import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PlanWorkbench from '../src/components/PlanWorkbench';
import type { FinancialPlanOverview } from '../src/types/financialPlan';
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 42 } }),
}));
jest.mock('../src/services/api', () => ({
  getApiBaseUrl: () => 'https://test.invalid',
}));
const plan = {
  currency: 'VND',
  history: [],
  forecast: [
    {
      month: '2026-09',
      projected_income: 1000,
      projected_expense: 700,
      projected_net: 300,
    },
  ],
  summary: { status: 'STABLE' },
} as unknown as FinancialPlanOverview['cashflow_plans'][number];
const key = 'financial-plan:v1:https://test.invalid:42:VND';
let renderer: TestRenderer.ReactTestRenderer;
const mount = async () => {
  await act(async () => {
    renderer = TestRenderer.create(
      <PlanWorkbench plan={plan} goals={[]} months={3} reduction={0} />,
    );
  });
};
beforeEach(async () => {
  await AsyncStorage.removeItem(key);
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});
it('saves once and restores assumptions after remount', async () => {
  await mount();
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Trả nợ mỗi tháng VND' })
      .props.onChangeText('100');
  });
  await act(async () => {
    const save = renderer.root.findByProps({
      accessibilityLabel: 'Lưu phương án VND',
    }).props.onPress;
    await Promise.all([save(), save()]);
  });
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  expect(
    JSON.parse((await AsyncStorage.getItem(key))!).schedule[0].available,
  ).toBe(200);
  await act(async () => renderer.unmount());
  await mount();
  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Trả nợ mỗi tháng VND' })
      .props.value,
  ).toBe('100');
});
it('retains the draft when saving fails', async () => {
  await mount();
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('disk full'));
  await act(async () => {
    await renderer.root
      .findByProps({ accessibilityLabel: 'Lưu phương án VND' })
      .props.onPress();
  });
  expect(Alert.alert).toHaveBeenCalledWith(
    'Chưa lưu được phương án',
    expect.any(String),
  );
});
