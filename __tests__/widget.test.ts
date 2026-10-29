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

it('offers only normal income/expense categories and carries a validated category and input action', () => {
  const data = {
    transactions: [],
    categories: [
      { id: 4, name: ' Ăn uống ', type: 'EXPENSE', cash_flow_group: 'NORMAL' },
      { id: 5, name: 'Lương', type: 'INCOME' },
      { id: 6, name: 'Vay', type: 'INCOME', cash_flow_group: 'LOAN_DEBT' },
    ],
    updatedAt: new Date().toISOString(),
  } as unknown as DashboardCache;
  expect(buildWidgetSnapshot(data, 'VND', 0).categories).toEqual([
    { id: 4, name: 'Ăn uống', type: 'EXPENSE' },
    { id: 5, name: 'Lương', type: 'INCOME' },
  ]);
  const scope = { server: 'https://qa.invalid', userId: 5 };
  const base = `quanlychitieu://quick-entry?scope=${encodeURIComponent(
    widgetScope(scope),
  )}&type=EXPENSE&event=2`;
  expect(widgetLink(scope, base + '&action=CAMERA&category=4')).toBe(
    'quanlychitieu://home?widgetType=EXPENSE&widgetEvent=2&widgetAction=CAMERA&widgetCategoryId=4',
  );
  expect(widgetLink(scope, base + '&action=VOICE&category=5')).toContain(
    'widgetAction=VOICE&widgetCategoryId=5',
  );
  for (const suffix of [
    '&action=SAVE',
    '&category=-1',
    '&category=1.2',
    '&category=9007199254740992',
  ])
    expect(widgetLink(scope, base + suffix)).toBeNull();
});
