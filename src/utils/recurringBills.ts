export type BillCycle = 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type BillInput = {
  label: string;
  cycle: BillCycle;
  anchorDate: string;
  kind: 'FIXED' | 'VARIABLE';
  minAmount: number;
  maxAmount: number;
  currency: string;
  note: string;
};
export type RecurringBill = BillInput & {
  id: string;
  paused: boolean;
  archived: boolean;
};
export type BillPayment = {
  id: number;
  amount: number;
  currency: string;
  date: string;
  note: string;
};
export type BillPeriod = {
  billId: string;
  dueDate: string;
} & (
  | { status: 'SKIPPED'; payment?: never }
  | { status: 'PAID'; payment: BillPayment }
);
export type BillBook = {
  version: 1;
  bills: RecurringBill[];
  periods: BillPeriod[];
};
export type BillOccurrence = {
  bill: RecurringBill;
  dueDate: string;
  status: 'PENDING' | 'OVERDUE' | 'PAID' | 'SKIPPED';
  payment?: BillPayment;
};

export const isBillDate = (value: string) => {
  if (!/^(20|21)\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};
const moneyValid = (value: number) =>
  Number.isFinite(value) &&
  value > 0 &&
  value <= 9999999999999.99 &&
  Math.abs(value * 100 - Math.round(value * 100)) < 0.00001;

export const validateBillInput = (input: BillInput): BillInput => {
  if (
    typeof input.label !== 'string' ||
    !input.label.trim() ||
    input.label.trim().length > 100
  )
    throw new Error('Tên hóa đơn cần từ 1 đến 100 ký tự.');
  if (
    !['WEEKLY', 'MONTHLY', 'YEARLY'].includes(input.cycle) ||
    !isBillDate(input.anchorDate)
  )
    throw new Error('Chu kỳ hoặc ngày đến hạn chưa hợp lệ.');
  if (
    !['FIXED', 'VARIABLE'].includes(input.kind) ||
    !moneyValid(input.minAmount) ||
    !moneyValid(input.maxAmount) ||
    input.maxAmount < input.minAmount ||
    (input.kind === 'FIXED' && input.minAmount !== input.maxAmount)
  )
    throw new Error('Số tiền hoặc khoảng dự kiến chưa hợp lệ.');
  if (
    typeof input.currency !== 'string' ||
    !/^[A-Z]{3}$/.test(input.currency.trim().toUpperCase())
  )
    throw new Error('Mã tiền tệ cần 3 chữ cái, ví dụ VND.');
  if (
    input.currency.trim().toUpperCase() === 'VND' &&
    (!Number.isInteger(input.minAmount) || !Number.isInteger(input.maxAmount))
  )
    throw new Error('Số tiền VND cần là số nguyên.');
  if (typeof input.note !== 'string' || input.note.length > 500)
    throw new Error('Ghi chú tối đa 500 ký tự.');
  return {
    ...input,
    label: input.label.trim(),
    currency: input.currency.trim().toUpperCase(),
    note: input.note.trim(),
  };
};

/** Always derive from the original day; February clamping must not shift March. */
export const billDueDate = (
  bill: Pick<BillInput, 'anchorDate' | 'cycle'>,
  index: number,
): string => {
  if (
    !isBillDate(bill.anchorDate) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 11000
  )
    throw new Error('Kỳ hóa đơn chưa hợp lệ.');
  const [year, month, day] = bill.anchorDate.split('-').map(Number);
  let date: Date;
  if (bill.cycle === 'WEEKLY') {
    date = new Date(Date.UTC(year, month - 1, day + index * 7));
  } else {
    const first = new Date(
      Date.UTC(year, month - 1 + index * (bill.cycle === 'YEARLY' ? 12 : 1), 1),
    );
    const lastDay = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date = new Date(
      Date.UTC(
        first.getUTCFullYear(),
        first.getUTCMonth(),
        Math.min(day, lastDay),
      ),
    );
  }
  return date.toISOString().slice(0, 10);
};

export const isBillDueDate = (bill: BillInput, dueDate: string) => {
  if (!isBillDate(dueDate) || dueDate < bill.anchorDate) return false;
  const [year, month] = dueDate.split('-').map(Number);
  const [anchorYear, anchorMonth] = bill.anchorDate.split('-').map(Number);
  const months = (year - anchorYear) * 12 + month - anchorMonth;
  const days =
    (Date.parse(`${dueDate}T00:00:00Z`) -
      Date.parse(`${bill.anchorDate}T00:00:00Z`)) /
    86400000;
  const index =
    bill.cycle === 'WEEKLY'
      ? days / 7
      : bill.cycle === 'YEARLY'
      ? months / 12
      : months;
  return Number.isInteger(index) && billDueDate(bill, index) === dueDate;
};

export const billOccurrences = (
  book: BillBook,
  from: string,
  to: string,
  today: string,
): BillOccurrence[] => {
  if (![from, to, today].every(isBillDate) || from > to)
    throw new Error('Khoảng ngày chưa hợp lệ.');
  const periods = new Map(
    book.periods.map(period => [`${period.billId}:${period.dueDate}`, period]),
  );
  const result: BillOccurrence[] = [];
  for (const bill of book.bills) {
    for (let index = 0; index <= 11000; index += 1) {
      const dueDate = billDueDate(bill, index);
      if (dueDate > to) break;
      if (dueDate < from) continue;
      const period = periods.get(`${bill.id}:${dueDate}`);
      if ((bill.paused || bill.archived) && !period) continue;
      result.push({
        bill,
        dueDate,
        status: period?.status ?? (dueDate < today ? 'OVERDUE' : 'PENDING'),
        payment: period?.payment,
      });
    }
  }
  return result.sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) || a.bill.id.localeCompare(b.bill.id),
  );
};

export const billDateOffset = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
