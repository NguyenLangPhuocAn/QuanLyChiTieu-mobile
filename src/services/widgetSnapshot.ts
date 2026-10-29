import type { DashboardCache } from './dashboardCache';
import type { BillScope } from './recurringBills';
export const widgetScope = (scope: BillScope) =>
  `${scope.server.replace(/\/$/, '')}:${scope.userId}`;
export const buildWidgetSnapshot = (
  data: DashboardCache | null,
  currency: string,
  pending: number,
  now = new Date(),
) => {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(now.getDate()).padStart(2, '0')}`;
  const rows =
    data?.transactions.filter(
      t =>
        t.currency === currency &&
        t.transaction_date.slice(0, 10) === today &&
        t.category?.cash_flow_group === 'NORMAL',
    ) ?? [];
  const amount = (type: string) =>
    rows
      .filter(t => t.type === type)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
  const money = (value: number) =>
    `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(
      value,
    )} ${currency}`;
  return {
    day: today,
    expense: money(amount('EXPENSE')),
    income: money(amount('INCOME')),
    pending,
    updatedAt: data?.updatedAt ?? null,
    currency,
    categories: (data?.categories ?? [])
      .filter(
        c =>
          Number.isSafeInteger(c.id) &&
          c.id > 0 &&
          c.name.trim() &&
          ['EXPENSE', 'INCOME'].includes(c.type) &&
          (!c.cash_flow_group || c.cash_flow_group === 'NORMAL'),
      )
      .map(c => ({ id: c.id, name: c.name.trim().slice(0, 80), type: c.type })),
    hasData:
      !!data && new Date(data.updatedAt).toDateString() === now.toDateString(),
  };
};
