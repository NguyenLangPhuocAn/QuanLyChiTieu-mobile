import type { ApiTransaction } from '../types/transaction';
import { getTransactionDateKey } from './mapTransactions';
import { billMerchantIdentity } from './billMerchantIdentity';
import { getCashFlowType } from './transactionClassification';
import {
  billDueDate,
  billCycleMonths,
  isBillDate,
  type BillBook,
  type BillCycle,
  type BillInput,
} from './recurringBills';

export type BillSuggestion = {
  key: string;
  merchant: string;
  input: BillInput;
  nextDate: string;
  missingDates?: string[];
  nameVariants?: string[];
  evidence: { id: number; date: string; amount: number; note: string }[];
};
export type BillSuggestionDecision = {
  key: string;
  status: 'IGNORED' | 'LATER' | 'TRACKED';
  until?: string;
  billId?: string;
};
// Keep plan/package numbers. Only explicitly labelled changing references/months are removed.
const cleanLabel = (note: string) =>
  note
    .replace(
      /\s+(?:ref|mã gd|ma gd|mã giao dịch|ma giao dich|gd)\s*[:#]\s*[^\s].*$/iu,
      '',
    )
    .replace(/\s+(?:tháng|thang|kỳ|ky)\s+\d{1,2}[/.-]\d{4}\s*$/iu, '')
    .trim();
export const billMerchant = (note: string) =>
  cleanLabel(note)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/^(?:thanh toan|tra|payment for)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export const isSuggestionKey = (key: unknown): key is string =>
  typeof key === 'string' &&
  /^bill-suggest:v1:[A-Z]{3}:(WEEKLY|MONTHLY|QUARTERLY|YEARLY):[a-z0-9 ]{3,160}$/.test(
    key,
  );
const dayGap = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000,
  );
const monthIndex = (date: string) =>
  Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));

/** Suggestions only. No amount/wallet buckets, no AI, and never writes money. */
export function suggestBills(
  transactions: ApiTransaction[],
  today: string,
): BillSuggestion[] {
  if (!isBillDate(today)) throw new Error('Ngày kiểm tra chưa hợp lệ.');
  const groups = new Map<string, ApiTransaction[]>();
  const dateCache = new Map<string, string>();
  const dateOf = (value: string) => {
    if (!dateCache.has(value))
      dateCache.set(value, getTransactionDateKey(value));
    return dateCache.get(value)!;
  };
  const ids = new Set<number>();
  for (const row of transactions) {
    if (
      !row ||
      typeof row.transaction_date !== 'string' ||
      (row.note != null && typeof row.note !== 'string')
    )
      continue;
    if (ids.has(row.id)) continue;
    ids.add(row.id);
    const amount = Math.abs(Number(row.amount));
    const date = dateOf(row.transaction_date);
    const merchant = billMerchant(row.note ?? '');
    if (
      [
        'chuyen khoan',
        'thanh toan',
        'giao dich',
        'khac',
        'chi',
        'payment',
      ].includes(merchant) ||
      /^(chuyen vi|wallet transfer|hoan tien|refund)\b/.test(merchant) ||
      /\b(chuyen vi|wallet transfer)\b/.test(
        billMerchant(
          typeof row.category?.name === 'string' ? row.category.name : '',
        ),
      )
    )
      continue;
    if (
      row.type !== 'EXPENSE' ||
      getCashFlowType(row.category) !== 'normal' ||
      !Number.isSafeInteger(row.id) ||
      row.id <= 0 ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 9999999999999.99 ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001 ||
      !/^[A-Z]{3}$/.test(row.currency) ||
      (row.currency === 'VND' && !Number.isInteger(amount)) ||
      !isBillDate(date) ||
      date > today ||
      merchant.length < 3 ||
      merchant.length > 160
    )
      continue;
    const identity = billMerchantIdentity(merchant);
    if (
      identity.length < 3 ||
      identity.length > 160 ||
      [
        'chuyen khoan',
        'thanh toan',
        'giao dich',
        'khac',
        'chi',
        'payment',
      ].includes(identity) ||
      /^(chuyen vi|wallet transfer|hoan tien|refund)\b/.test(identity)
    )
      continue;
    const key = row.currency + '|' + identity;
    const current = groups.get(key);
    if (current) current.push(row);
    else groups.set(key, [row]);
  }
  const result: BillSuggestion[] = [];
  for (const [group, rows] of groups) {
    const evidence = rows
      .map(row => ({
        id: row.id,
        date: dateOf(row.transaction_date),
        amount: Math.abs(Number(row.amount)),
        note: row.note ?? '',
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    if (
      evidence.length < 3 ||
      new Set(evidence.map(item => item.date)).size !== evidence.length
    )
      continue;
    const [currency, merchant] = group.split('|');
    let found: BillSuggestion | undefined;
    for (const cycle of [
      'MONTHLY',
      'QUARTERLY',
      'YEARLY',
      'WEEKLY',
    ] as BillCycle[]) {
      const first = evidence[0].date;
      const originalDay = Math.max(
        ...evidence.map(item => Number(item.date.slice(8))),
      );
      const step = billCycleMonths(cycle);
      let anchorDate = first;
      if (cycle !== 'WEEKLY') {
        let year = Number(first.slice(0, 4)),
          month = Number(first.slice(5, 7));
        while (new Date(Date.UTC(year, month, 0)).getUTCDate() < originalDay) {
          month -= step;
          while (month < 1) {
            month += 12;
            year -= 1;
          }
        }
        anchorDate =
          year +
          '-' +
          String(month).padStart(2, '0') +
          '-' +
          String(originalDay).padStart(2, '0');
      }
      if (!isBillDate(anchorDate)) continue;
      const indexes = evidence.map(item =>
        cycle === 'WEEKLY'
          ? Math.round(dayGap(item.date, anchorDate) / 7)
          : (monthIndex(item.date) - monthIndex(anchorDate)) / step,
      );
      if (
        indexes.some(
          (index, i) =>
            !Number.isInteger(index) ||
            index < 0 ||
            index > 11000 ||
            (i > 0 &&
              (index <= indexes[i - 1] || index - indexes[i - 1] > 3)) ||
            Math.abs(
              dayGap(
                evidence[i].date,
                billDueDate({ anchorDate, cycle }, index),
              ),
            ) > (cycle === 'WEEKLY' ? 1 : 3),
        )
      )
        continue;
      const firstIndex = indexes[0],
        lastIndex = indexes.at(-1)!;
      const missingCount = lastIndex - firstIndex + 1 - evidence.length;
      // At least 3 observations, a real adjacent pair, >= 2/3 coverage,
      // at most 2 missing slots: never turn arbitrary sparse purchases into a bill.
      if (
        missingCount > 2 ||
        missingCount * 2 > evidence.length ||
        !indexes.slice(1).some((n, i) => n - indexes[i] === 1)
      )
        continue;
      if (
        dayGap(today, evidence.at(-1)!.date) >
        (cycle === 'WEEKLY'
          ? 21
          : cycle === 'MONTHLY'
          ? 75
          : cycle === 'QUARTERLY'
          ? 210
          : 400)
      )
        continue;
      const seen = new Set(indexes);
      const missingDates: string[] = [];
      for (let i = firstIndex; i <= lastIndex; i++)
        if (!seen.has(i))
          missingDates.push(billDueDate({ anchorDate, cycle }, i));
      let nextIndex = lastIndex + 1;
      let nextDate = billDueDate({ anchorDate, cycle }, nextIndex);
      while (nextDate < today && nextIndex < 11000) {
        missingDates.push(nextDate);
        nextDate = billDueDate({ anchorDate, cycle }, ++nextIndex);
      }
      if (!isBillDate(nextDate)) continue;
      const amounts = evidence.map(item => item.amount);
      const minAmount = Math.min(...amounts),
        maxAmount = Math.max(...amounts);
      const label = cleanLabel(
        rows.find(row => row.id === evidence.at(-1)!.id)!.note ?? '',
      ).slice(0, 100);
      const variants = new Map<string, string>();
      for (const row of rows)
        variants.set(billMerchant(row.note ?? ''), cleanLabel(row.note ?? ''));
      found = {
        key: 'bill-suggest:v1:' + currency + ':' + cycle + ':' + merchant,
        merchant,
        nextDate,
        evidence,
        missingDates,
        nameVariants: variants.size > 1 ? [...variants.values()].sort() : [],
        input: {
          label,
          currency,
          cycle,
          anchorDate,
          startDate: nextDate,
          minAmount,
          maxAmount,
          kind: minAmount === maxAmount ? 'FIXED' : 'VARIABLE',
          note: '',
        },
      };
      break;
    }
    if (found) result.push(found);
  }
  return result.sort(
    (a, b) =>
      a.nextDate.localeCompare(b.nextDate) || a.key.localeCompare(b.key),
  );
}

export function equivalentSuggestionKeys(a: string, b: string) {
  if (!isSuggestionKey(a) || !isSuggestionKey(b)) return false;
  const left = a.split(':'),
    right = b.split(':');
  return (
    left[2] === right[2] &&
    left[3] === right[3] &&
    billMerchantIdentity(left[4]) === billMerchantIdentity(right[4])
  );
}

export function suggestionVisibility(
  candidate: BillSuggestion,
  book: BillBook,
  today: string,
) {
  const decisions =
    book.suggestions?.filter(item =>
      equivalentSuggestionKeys(item.key, candidate.key),
    ) ?? [];
  if (
    decisions.some(d => d.status === 'TRACKED') ||
    book.bills.some(
      bill =>
        !bill.archived &&
        bill.currency === candidate.input.currency &&
        bill.cycle === candidate.input.cycle &&
        billMerchantIdentity(billMerchant(bill.label)) === candidate.merchant,
    )
  )
    return 'TRACKED';
  if (
    decisions.some(
      d => d.status === 'IGNORED' || (d.status === 'LATER' && d.until! > today),
    )
  )
    return 'HIDDEN';
  return 'VISIBLE';
}

export function billSuggestionNotes(candidate: BillSuggestion): string[] {
  const notes: string[] = [];
  if (candidate.missingDates?.length)
    notes.push(
      'Chưa thấy giao dịch ở ' +
        candidate.missingDates.length +
        ' kỳ: ' +
        candidate.missingDates
          .slice(0, 6)
          .map(d => d.split('-').reverse().join('/'))
          .join(', ') +
        '. Không đồng nghĩa chưa thanh toán.',
    );
  if (candidate.nameVariants?.length)
    notes.push(
      'Khác cách ghi tên: ' +
        candidate.nameVariants.slice(0, 3).join(' · ') +
        '. Kiểm tra cùng dịch vụ và gói trước khi theo dõi.',
    );
  return notes;
}
