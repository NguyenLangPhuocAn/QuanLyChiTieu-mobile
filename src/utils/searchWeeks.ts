export const searchDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getDate()).padStart(2, '0')}`;

// The filter presents consecutive seven-day ranges within the selected month.
export const getSearchMonthWeeks = (year: number, month: number, now: Date) => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: Math.ceil(lastDay / 7) }, (_, index) => {
    const start = new Date(year, month, index * 7 + 1);
    const end = new Date(year, month, Math.min(lastDay, index * 7 + 7));
    return { start, end: end > today ? today : end };
  }).filter(range => range.start <= today);
};

export const resolveSearchWeek = (
  ranges: ReturnType<typeof getSearchMonthWeeks>,
  selectedStart: string,
  now: Date,
) =>
  ranges.find(range => searchDateKey(range.start) === selectedStart) ??
  ranges.find(
    range =>
      searchDateKey(range.start) <= searchDateKey(now) &&
      searchDateKey(range.end) >= searchDateKey(now),
  ) ??
  ranges[0];
