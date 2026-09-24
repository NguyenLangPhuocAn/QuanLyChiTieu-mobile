import type { FinancialPlanOverview } from '../types/financialPlan';

export type PlanAssumptions = {
  debt: number;
  essentialFloor: number;
  reserve: number;
};
export type PlanMonth = {
  month: string;
  income: number;
  expense: number;
  debt: number;
  reserve: number;
  scheduled: number;
  available: number;
};
export type SavedFinancialPlan = {
  version: 1;
  currency: string;
  savedAt: string;
  months: number;
  assumptions: PlanAssumptions;
  reduction: number;
  schedule: PlanMonth[];
  goals: Array<{ id: number; name: string; amount: number }>;
};

export function buildPlanSchedule(
  plan: FinancialPlanOverview['cashflow_plans'][number],
  goals: FinancialPlanOverview['savings_plans'],
  months: number,
  reduction: number,
  assumptions: PlanAssumptions,
): PlanMonth[] {
  return plan.forecast.slice(0, Math.min(4, Math.max(1, months))).map(row => {
    // Essential spending is a floor within total spending, not an extra expense.
    const expense = Math.max(
      assumptions.essentialFloor,
      row.projected_expense - reduction,
      0,
    );
    const scheduled = goals
      .filter(goal => goal.currency === plan.currency)
      .reduce(
        (sum, goal) =>
          sum +
          (goal.roadmap?.schedule ?? [])
            .filter(item => item.due_date.slice(0, 7) === row.month)
            .reduce((total, item) => total + item.amount, 0),
        0,
      );
    return {
      month: row.month,
      income: row.projected_income,
      expense,
      debt: assumptions.debt,
      reserve: assumptions.reserve,
      scheduled,
      available:
        row.projected_income -
        expense -
        assumptions.debt -
        assumptions.reserve -
        scheduled,
    };
  });
}

export function readSavedPlan(
  raw: string | null,
  currency: string,
): SavedFinancialPlan | null {
  if (!raw) return null;
  try {
    const item = JSON.parse(raw) as SavedFinancialPlan;
    const amount = (value: unknown) =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0;
    if (
      item.version !== 1 ||
      item.currency !== currency ||
      !Number.isFinite(Date.parse(item.savedAt)) ||
      !Number.isInteger(item.months) ||
      item.months < 1 ||
      item.months > 4 ||
      !amount(item.reduction) ||
      !item.assumptions ||
      !Object.values(item.assumptions).every(amount) ||
      !['debt', 'essentialFloor', 'reserve'].every(key =>
        amount(item.assumptions[key as keyof PlanAssumptions]),
      ) ||
      !Array.isArray(item.schedule) ||
      item.schedule.length > 4 ||
      !item.schedule.every(
        row =>
          typeof row.month === 'string' &&
          /^\d{4}-\d{2}$/.test(row.month) &&
          ['income', 'expense', 'debt', 'reserve', 'scheduled'].every(key =>
            amount(row[key as keyof PlanMonth]),
          ) &&
          Number.isFinite(row.available),
      ) ||
      !Array.isArray(item.goals) ||
      !item.goals.every(
        goal =>
          Number.isSafeInteger(goal.id) &&
          goal.id > 0 &&
          typeof goal.name === 'string' &&
          amount(goal.amount),
      )
    )
      return null;
    return item;
  } catch {
    return null;
  }
}
