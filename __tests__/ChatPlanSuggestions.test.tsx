import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import ChatPlanSuggestions from '../src/components/ChatPlanSuggestions';
import { financialPlansService } from '../src/services/financialPlans';
import type { FinancialPlanOverview } from '../src/types/financialPlan';
jest.mock('../src/services/financialPlans', () => ({ financialPlansService: { getOverview: jest.fn() } }));
const onSelect = jest.fn();
let renderer: TestRenderer.ReactTestRenderer;
beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(financialPlansService.getOverview).mockResolvedValue({ cashflow_plans: [{ currency: 'VND', spending_actions: [{ monthly_baseline: 1000, reduction_percent: 20 }], forecast: [{ month: '2026-09' }], summary: { status: 'STABLE' } }] } as unknown as FinancialPlanOverview);
  await act(async () => { renderer = TestRenderer.create(<ChatPlanSuggestions token="test" months={3} onSelect={onSelect} />); });
});
afterEach(async () => { await act(async () => renderer.unmount()); });
it('loads numbers on demand and opens the selected reduction level', async () => {
  expect(financialPlansService.getOverview).not.toHaveBeenCalled();
  await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'So sánh phương án tài chính' }).props.onPress(); });
  expect(financialPlansService.getOverview).toHaveBeenCalledTimes(1);
  await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'Chỉnh phương án Giảm nhẹ' }).props.onPress(); });
  expect(onSelect).toHaveBeenCalledWith(0.5);
});
it('provides retry when fetching financial data fails', async () => {
  jest.mocked(financialPlansService.getOverview).mockRejectedValueOnce(new Error('offline'));
  await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'So sánh phương án tài chính' }).props.onPress(); });
  await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'Tải lại phương án chatbot' }).props.onPress(); });
  expect(financialPlansService.getOverview).toHaveBeenCalledTimes(2);
  expect(renderer.root.findByProps({ accessibilityLabel: 'Chỉnh phương án Giảm nhẹ' })).toBeDefined();
});
