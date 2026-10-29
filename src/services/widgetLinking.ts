import { widgetScope } from './widgetSnapshot';
import type { BillScope } from './recurringBills';
export const widgetLink = (scope: BillScope, url: string): string | null => {
  if (!url.startsWith('quanlychitieu://quick-entry?')) return null;
  const params = new URLSearchParams(url.slice(url.indexOf('?') + 1));
  const type = params.get('type'),
    event = params.get('event');
  if (
    params.get('scope') !== widgetScope(scope) ||
    !['EXPENSE', 'INCOME'].includes(type ?? '') ||
    !event ||
    event.length > 100
  )
    return null;
  return `quanlychitieu://home?widgetType=${type}&widgetEvent=${encodeURIComponent(
    event,
  )}`;
};
