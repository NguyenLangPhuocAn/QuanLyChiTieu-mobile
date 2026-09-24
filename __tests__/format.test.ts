import { formatCompactCurrency, formatCurrency } from '../src/utils/format';

describe('currency formatting', () => {
  it('keeps compact currency labels short for large-value currencies', () => {
    expect(formatCompactCurrency(125000000, 'VND').length).toBeLessThanOrEqual(
      8,
    );
    expect(formatCompactCurrency(125000000, 'IDR')).toContain('IDR');
    expect(formatCompactCurrency(125000000, 'KRW')).toContain('KRW');
  });

  it('formats international currency values with their target currency', () => {
    expect(formatCurrency(1234, 'USD')).toContain('$');
    expect(formatCurrency(1234, 'AED')).toContain('AED');
  });

  it('preserves cents instead of rounding small foreign-currency balances to zero', () => {
    expect(formatCurrency(0.5, 'USD')).toBe('$0.50');
    expect(formatCurrency(12.75, 'USD')).toBe('$12.75');
    expect(formatCurrency(12000, 'VND')).not.toMatch(/,00/);
  });
});
