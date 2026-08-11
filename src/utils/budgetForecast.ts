import type { BudgetForecast } from '../types/budget';
import { formatCurrency } from './format';

export const buildBudgetForecastView = (
  forecast: BudgetForecast,
  availableLimit: number,
  currency: string,
) => {
  const projectedOverspend = Math.max(0, forecast.projected_spent - availableLimit);
  const money = (amount: number) => formatCurrency(amount, currency).replace(/\u00a0/g, ' ');

  return {
    projectionLabel: `Dự báo cuối kỳ ${money(forecast.projected_spent)}`,
    projectionHint:
      projectedOverspend > 0
        ? `Có thể vượt ${money(projectedOverspend)}`
        : `Dự kiến còn ${money(Math.max(availableLimit - forecast.projected_spent, 0))}`,
    recommendationLabel:
      forecast.days_remaining === 0
        ? 'Kỳ ngân sách đã kết thúc'
        : `Nên chi tối đa ${money(forecast.recommended_daily)}/ngày`,
    tone: projectedOverspend > 0 ? ('danger' as const) : ('normal' as const),
  };
};
