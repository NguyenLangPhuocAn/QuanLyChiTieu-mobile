import {
  buildPlanSchedule,
  readSavedPlan,
} from '../src/utils/savedFinancialPlan';
import type { FinancialPlanOverview } from '../src/types/financialPlan';

const plan = {
  currency: 'VND',
  forecast: [
    {
      month: '2026-09',
      projected_income: 1000,
      projected_expense: 700,
      projected_net: 300,
    },
  ],
} as FinancialPlanOverview['cashflow_plans'][number];
it('uses essential spending as a floor and subtracts obligations once', () => {
  const rows = buildPlanSchedule(plan, [], 1, 200, {
    essentialFloor: 600,
    debt: 100,
    reserve: 50,
  });
  expect(rows[0]).toMatchObject({ expense: 600, available: 250 });
});
it('combines same-currency goals without allocating the same surplus twice', () => {
  const goals = [
    {
      currency: 'VND',
      roadmap: { schedule: [{ due_date: '2026-09-30', amount: 200 }] },
    },
    {
      currency: 'VND',
      roadmap: { schedule: [{ due_date: '2026-09-30', amount: 200 }] },
    },
    {
      currency: 'USD',
      roadmap: { schedule: [{ due_date: '2026-09-30', amount: 100 }] },
    },
  ] as FinancialPlanOverview['savings_plans'];
  expect(
    buildPlanSchedule(plan, goals, 1, 0, {
      essentialFloor: 0,
      debt: 0,
      reserve: 0,
    })[0],
  ).toMatchObject({ scheduled: 400, available: -100 });
});
it('rejects corrupt local plans instead of rendering invalid amounts', () => {
  expect(readSavedPlan('{broken', 'VND')).toBeNull();
  expect(
    readSavedPlan(
      JSON.stringify({
        version: 1,
        currency: 'VND',
        savedAt: '2026-09-22',
        months: 3,
        reduction: 0,
        assumptions: {},
        schedule: [],
        goals: [],
      }),
      'VND',
    ),
  ).toBeNull();
});
