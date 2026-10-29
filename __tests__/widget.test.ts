import {
  buildWidgetSnapshot,
  widgetScope,
} from '../src/services/widgetSnapshot';
import { widgetLink } from '../src/services/widgetLinking';
import type { DashboardCache } from '../src/services/dashboardCache';
it('keeps currencies separate, excludes transfers, uses today, and does not include pending amounts in confirmed totals', () => {
  const snapshot = {
    transactions: [
      {
        amount: -79000,
        currency: 'VND',
        type: 'EXPENSE',
        transaction_date: '2026-10-29T00:00:00Z',
        category: { cash_flow_group: 'NORMAL' },
      },
      {
        amount: -2,
        currency: 'USD',
        type: 'EXPENSE',
        transaction_date: '2026-10-29',
        category: { cash_flow_group: 'NORMAL' },
      },
      {
        amount: -5000,
        currency: 'VND',
        type: 'EXPENSE',
        transaction_date: '2026-10-29',
        category: { cash_flow_group: 'TRANSFER' },
      },
    ],
    updatedAt: '2026-10-29T00:00:00Z',
  } as DashboardCache;
  const data = buildWidgetSnapshot(snapshot, 'VND', 3, new Date(2026, 9, 29));
  expect(data.expense).toBe('79.000 VND');
  expect(data.pending).toBe(3);
  expect(data.income).toBe('0 VND');
  expect(
    buildWidgetSnapshot(snapshot, 'VND', 3, new Date(2026, 9, 30)).hasData,
  ).toBe(false);
});
it('opens only a valid current-account/backend widget link and never includes money or wallet selection', () => {
  const scope = { userId: 5, server: 'https://qa.invalid' };
  const url = `quanlychitieu://quick-entry?scope=${encodeURIComponent(
    widgetScope(scope),
  )}&type=INCOME&event=1`;
  expect(widgetLink(scope, url)).toBe(
    'quanlychitieu://home?widgetType=INCOME&widgetEvent=1',
  );
  expect(widgetLink({ ...scope, userId: 6 }, url)).toBeNull();
  expect(
    widgetLink({ ...scope, server: 'https://other.invalid' }, url),
  ).toBeNull();
  expect(widgetLink(scope, url.replace('INCOME', 'TRANSFER'))).toBeNull();
});
