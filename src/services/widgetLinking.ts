import { widgetScope } from './widgetSnapshot';
import type { BillScope } from './recurringBills';
export const widgetLink = (scope: BillScope, url: string): string | null => {
  if (!url.startsWith('quanlychitieu://quick-entry?')) return null;
  const params = new URLSearchParams(url.slice(url.indexOf('?') + 1));
  const type = params.get('type'),
    event = params.get('event');
  const action = params.get('action') ?? 'FORM';
  const category = params.get('category');
  if (
    params.get('scope') !== widgetScope(scope) ||
    !['EXPENSE', 'INCOME', 'LOAN_DEBT'].includes(type ?? '') ||
    !event ||
    event.length > 100 ||
    !['FORM', 'VOICE', 'CAMERA'].includes(action) ||
    (category !== null &&
      (!/^\d+$/.test(category) ||
        !Number.isSafeInteger(Number(category)) ||
        Number(category) <= 0))
  )
    return null;
  return `quanlychitieu://home?widgetType=${type}&widgetEvent=${encodeURIComponent(
    event,
  )}${action === 'FORM' ? '' : `&widgetAction=${action}`}${
    category === null ? '' : `&widgetCategoryId=${Number(category)}`
  }`;
};
