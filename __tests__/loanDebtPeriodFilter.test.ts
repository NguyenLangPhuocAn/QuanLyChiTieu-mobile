import { filterLoanDebtsByPeriod } from '../src/utils/loanDebtPeriodFilter';

describe('filterLoanDebtsByPeriod', () => {
  const records = [
    { id: 1, created_at: '2026-06-15T08:00:00.000Z', status: 'OPEN' },
    { id: 2, created_at: '2026-05-20T08:00:00.000Z', status: 'OVERDUE' },
    { id: 3, created_at: '2026-06-18T08:00:00.000Z', status: 'PAID' },
  ] as any;

  it('hiển thị mọi khoản còn hiệu lực dù được tạo từ kỳ trước', () => {
    expect(filterLoanDebtsByPeriod(records, 'CURRENT', new Date(2026, 5, 24))).toEqual([
      records[0],
      records[1],
    ]);
  });

  it('vẫn lọc các kỳ trước theo ngày tạo', () => {
    expect(filterLoanDebtsByPeriod(records, 'PREVIOUS_MONTH', new Date(2026, 5, 24))).toEqual([
      records[1],
    ]);
  });
});
