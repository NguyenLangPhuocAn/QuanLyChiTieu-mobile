import { apiRequest } from './api';

export type StatisticsPeriod = 'day' | 'week' | 'month' | 'year';

export type StatisticsResponse = {
  period: StatisticsPeriod;
  display_currency: string;
  summary: {
    income: number;
    expense: number;
    net: number;
    transactionCount: number;
    expenseCount: number;
    averageExpense: number;
    biggestExpense?: number;
    biggestExpenseCategory?: string | null;
  };
  previous_summary: {
    income: number;
    expense: number;
    net: number;
    transactionCount: number;
    expenseCount: number;
    averageExpense: number;
  };
  comparison: {
    expense_change_percent: number | null;
  };
  chart: Array<{
    label: string;
    income: number;
    expense: number;
  }>;
  monthly_trend?: Array<{
    label: string;
    income: number;
    expense: number;
    net: number;
  }>;
  categories: Array<{
    categoryId: number;
    name: string;
    icon?: string | null;
    total: number;
  }>;
  top_categories?: Array<{
    categoryId: number;
    name: string;
    icon?: string | null;
    total: number;
  }>;
  tags: Array<{
    tag: string;
    total: number;
    count?: number;
  }>;
  hot_hashtags?: Array<{
    tag: string;
    total: number;
    count?: number;
  }>;
};

export type ReportFormat = 'excel' | 'pdf';

export type StatisticsReportResponse = {
  filename: string;
  mimeType: string;
  base64: string;
};

export type SendReportResponse = {
  message: string;
  filename: string;
};

export const statisticsService = {
  get(token: string, period: StatisticsPeriod) {
    return apiRequest<StatisticsResponse>(`/statistics?period=${period}`, {
      method: 'GET',
      token,
    });
  },
  exportReport(token: string, period: StatisticsPeriod, format: ReportFormat) {
    return apiRequest<StatisticsReportResponse>(
      `/statistics/report?period=${period}&format=${format}`,
      {
        method: 'GET',
        token,
      },
    );
  },
  sendExcelReport(token: string, period: StatisticsPeriod, email: string) {
    return apiRequest<SendReportResponse>('/statistics/report/email', {
      method: 'POST',
      token,
      body: { period, email },
    });
  },
};
