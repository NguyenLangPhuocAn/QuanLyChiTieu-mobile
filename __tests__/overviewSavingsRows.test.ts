import { buildOverviewSavingsRows } from '../src/screens/home/OverviewScreen';
import type { SavingsGoal } from '../src/types/savings';

const goal = (overrides: Partial<SavingsGoal>): SavingsGoal => ({
  id: 1,
  user_id: 7,
  wallet_id: 10,
  wallet_name: 'Ví tiết kiệm',
  wallet_currency: 'VND',
  wallet_balance: 0,
  name: 'Mục tiêu',
  target_amount: 10_000_000,
  current_amount: 2_000_000,
  remaining_amount: 8_000_000,
  progress_percent: 20,
  suggested_monthly: 1_000_000,
  target_date: null,
  status: 'ACTIVE',
  entries: [],
  ...overrides,
});

describe('overview savings rows', () => {
  it('shows only active goals and prioritizes the nearest deadline', () => {
    const rows = buildOverviewSavingsRows([
      goal({ id: 1, name: 'Không thời hạn', progress_percent: 80 }),
      goal({
        id: 2,
        name: 'Cuối năm',
        target_date: '2026-12-31T00:00:00.000Z',
      }),
      goal({
        id: 3,
        name: 'Tháng tới',
        target_date: '2026-10-01T00:00:00.000Z',
      }),
      goal({ id: 4, name: 'Đã xong', status: 'COMPLETED' }),
    ]);

    expect(rows.map(item => item.id)).toEqual([3, 2, 1]);
  });

  it('limits the dashboard to three goals and clamps displayed progress', () => {
    const rows = buildOverviewSavingsRows([
      goal({ id: 1, target_date: '2026-10-01', progress_percent: -5 }),
      goal({ id: 2, target_date: '2026-11-01', progress_percent: 45 }),
      goal({ id: 3, target_date: '2026-12-01', progress_percent: 130 }),
      goal({ id: 4, target_date: '2027-01-01', progress_percent: 60 }),
    ]);

    expect(rows).toHaveLength(3);
    expect(rows.map(item => item.display_progress)).toEqual([0, 45, 100]);
  });
});
