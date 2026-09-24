import {
  getSearchMonthWeeks,
  resolveSearchWeek,
  searchDateKey,
} from '../src/utils/searchWeeks';

describe('transaction search week ranges', () => {
  const now = new Date(2026, 8, 16);
  it('ends the final range at month end, including leap February', () => {
    const february = getSearchMonthWeeks(2024, 1, now);
    expect(searchDateKey(february.at(-1)!.start)).toBe('2024-02-29');
    expect(searchDateKey(february.at(-1)!.end)).toBe('2024-02-29');
    expect(searchDateKey(getSearchMonthWeeks(2026, 7, now).at(-1)!.end)).toBe(
      '2026-08-31',
    );
  });
  it('clips the current range at today and excludes future ranges', () => {
    const ranges = getSearchMonthWeeks(2026, 8, now);
    expect(ranges).toHaveLength(3);
    const range = resolveSearchWeek(ranges, '2026-09-14', now)!;
    expect(searchDateKey(range.start)).toBe('2026-09-15');
    expect(searchDateKey(range.end)).toBe('2026-09-16');
  });
  it('uses the selected year when the old week belongs to another year', () => {
    const range = resolveSearchWeek(
      getSearchMonthWeeks(2025, 8, now),
      '2026-09-15',
      now,
    )!;
    expect(searchDateKey(range.start)).toBe('2025-09-01');
    expect(searchDateKey(range.end)).toBe('2025-09-07');
  });
});
