export type LoanDebtPeriodFilter = 'CURRENT' | 'PREVIOUS_MONTH' | 'PREVIOUS_QUARTER' | 'PREVIOUS_YEAR' | 'CUSTOM_RANGE' | 'ALL';

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

export const toLoanDebtDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseDateKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
};

export const filterLoanDebtsByPeriod = <T extends {
  created_at?: string | null;
  status?: 'OPEN' | 'OVERDUE' | 'PAID';
}>(
  records: T[],
  filter: LoanDebtPeriodFilter,
  now = new Date(),
  customStart?: string,
  customEnd?: string,
) => {
  if (filter === 'ALL') return records;
  if (filter === 'CURRENT') {
    const today = endOfDay(now);
    return records.filter(record => {
      if (record.status !== 'OPEN' && record.status !== 'OVERDUE') return false;
      if (!record.created_at) return true;
      return new Date(record.created_at) <= today;
    });
  }
  let start: Date;
  let end: Date;
  if (filter === 'PREVIOUS_MONTH') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (filter === 'PREVIOUS_QUARTER') {
    const currentQuarterStart = Math.floor(now.getMonth() / 3) * 3;
    start = new Date(now.getFullYear(), currentQuarterStart - 3, 1);
    end = new Date(now.getFullYear(), currentQuarterStart, 0, 23, 59, 59, 999);
  } else if (filter === 'PREVIOUS_YEAR') {
    start = new Date(now.getFullYear() - 1, 0, 1);
    end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
  } else {
    const parsedStart = customStart ? parseDateKey(customStart) : null;
    const parsedEnd = customEnd ? parseDateKey(customEnd) : null;
    if (!parsedStart || !parsedEnd || parsedStart > parsedEnd) return records;
    start = startOfDay(parsedStart);
    end = endOfDay(parsedEnd);
  }
  return records.filter(record => {
    if (!record.created_at) return false;
    const date = new Date(record.created_at);
    return date >= start && date <= end;
  });
};
