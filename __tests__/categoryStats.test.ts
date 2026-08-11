import { buildCategoryStats } from '../src/utils/categoryStats';

describe('buildCategoryStats', () => {
  const transactions = [
    { id: '1', type: 'expense', category: 'Ăn uống', displayAmount: 120000, categoryIcon: 'utensils', date: '2026-06-24' },
    { id: '2', type: 'expense', category: 'Ăn uống', displayAmount: 80000, categoryIcon: 'utensils', date: '2026-06-24' },
    { id: '3', type: 'income', category: 'Lương', displayAmount: 10000000, categoryIcon: 'briefcase', date: '2026-06-24' },
    { id: '4', type: 'income', category: 'Thưởng', displayAmount: 500000, categoryIcon: 'gift', date: '2026-06-24' },
  ] as any;

  it('gom riêng danh mục thu nhập, không lẫn giao dịch chi tiêu', () => {
    expect(buildCategoryStats(transactions, 'income')).toEqual([
      { category: 'Lương', total: 10000000, icon: 'briefcase' },
      { category: 'Thưởng', total: 500000, icon: 'gift' },
    ]);
  });
});
