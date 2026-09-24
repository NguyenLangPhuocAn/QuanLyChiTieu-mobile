export type SavingsRoadmap = {
  status: 'COMPLETE' | 'NO_DEADLINE' | 'OVERDUE' | 'SCHEDULED';
  remaining_amount: number;
  remaining_months: number;
  contributed_this_month: number;
  next_contribution: number | null;
  next_due_date: string | null;
  weekly_amount: number | null;
  recent_monthly_contribution: number;
  recent_history_months: number;
  months_at_current_pace: number | null;
  monthly_pace_gap: number | null;
  schedule: Array<{ due_date: string; amount: number; target_balance: number }>;
  schedule_truncated: boolean;
};
