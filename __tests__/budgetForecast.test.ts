import { buildBudgetForecastView } from '../src/utils/budgetForecast';

describe('budget forecast view', () => {
  it('describes projected overspending and recommended daily spending', () => {
    expect(
      buildBudgetForecastView(
        {
          total_days: 30,
          elapsed_days: 10,
          days_remaining: 20,
          daily_average: 300000,
          projected_spent: 9000000,
          recommended_daily: 150000,
        },
        6000000,
        'VND',
      ),
    ).toEqual({
      projectionLabel: 'Dự báo cuối kỳ 9.000.000 ₫',
      projectionHint: 'Có thể vượt 3.000.000 ₫',
      recommendationLabel: 'Nên chi tối đa 150.000 ₫/ngày',
      tone: 'danger',
    });
  });

  it('does not divide by zero when the period has ended', () => {
    expect(
      buildBudgetForecastView(
        {
          total_days: 30,
          elapsed_days: 30,
          days_remaining: 0,
          daily_average: 100000,
          projected_spent: 3000000,
          recommended_daily: 0,
        },
        6000000,
        'VND',
      ).recommendationLabel,
    ).toBe('Kỳ ngân sách đã kết thúc');
  });
});
