import { buildWalletBudgetAlerts } from '../src/utils/budgetAlerts';
import type { Budget } from '../src/types/budget';
import type { Wallet } from '../src/types/wallet';

describe('wallet budget alerts', () => {
  it('attaches the active budget range and treats exactly 100 percent as warning', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const wallet = {
      id: 1,
      name: 'Ví chính',
      currency: 'VND',
      balance: 1000000,
    } as Wallet;
    const budget = {
      id: 1,
      user_id: 1,
      name: 'Sinh hoạt',
      scope: 'WALLET',
      wallet_id: 1,
      wallet_name: 'Ví chính',
      wallet_currency: 'VND',
      limit_amount: 500000,
      period: 'MONTH',
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      spent: 500000,
      remaining: 0,
      percent: 100,
      percentage: 100,
      status: 'WARNING',
    } as Budget;

    const [alert] = buildWalletBudgetAlerts([wallet], [], [budget]);

    expect(alert).toMatchObject({
      periodExpense: 500000,
      periodStart: budget.start_date,
      periodEnd: budget.end_date,
      level: 'warning',
    });
  });
});
