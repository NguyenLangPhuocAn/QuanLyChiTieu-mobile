import type { ApiTransaction } from '../types/transaction';
import { getTransactionDateKey } from './mapTransactions';
import { getCashFlowType } from './transactionClassification';
import {
  billDateOffset,
  isBillDate,
  type BillPayment,
  type BillPeriod,
  type RecurringBill,
} from './recurringBills';

export type PaidBillPeriod = Extract<BillPeriod, { status: 'PAID' }>;
export type BillPaymentTarget = { bill: RecurringBill; period: PaidBillPeriod };
export type BillPaymentCheck =
  | { kind: 'MATCHED' | 'CHANGED'; current: BillPayment }
  | { kind: 'UNAVAILABLE' | 'INELIGIBLE' };

export const paymentKey = (payment: BillPayment) =>
  JSON.stringify([
    payment.id,
    payment.amount,
    payment.currency,
    payment.date,
    payment.note,
  ]);
export const paymentTargetKey = ({ bill, period }: BillPaymentTarget) =>
  JSON.stringify([
    bill.id,
    bill.currency,
    period.dueDate,
    paymentKey(period.payment),
  ]);

export function currentBillPayment(
  target: BillPaymentTarget,
  transaction: ApiTransaction,
): BillPayment | null {
  if (
    transaction.id !== target.period.payment.id ||
    transaction.type !== 'EXPENSE' ||
    transaction.currency !== target.bill.currency ||
    getCashFlowType(transaction.category) !== 'normal' ||
    (transaction.category?.cash_flow_group &&
      transaction.category.cash_flow_group !== 'NORMAL') ||
    (transaction.note != null && typeof transaction.note !== 'string') ||
    typeof transaction.transaction_date !== 'string' ||
    !['string', 'number'].includes(typeof transaction.amount)
  )
    return null;
  const sourceDate = transaction.transaction_date;
  if (
    !isBillDate(sourceDate.slice(0, 10)) ||
    (!isBillDate(sourceDate) &&
      (!/^\d{4}-\d{2}-\d{2}T/.test(sourceDate) ||
        !Number.isFinite(Date.parse(sourceDate))))
  )
    return null;
  const amount = Math.abs(Number(transaction.amount));
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 9999999999999.99 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001 ||
    (transaction.currency === 'VND' && !Number.isInteger(amount))
  )
    return null;
  let date: string;
  try {
    date = getTransactionDateKey(transaction.transaction_date);
  } catch {
    return null;
  }
  if (
    !isBillDate(date) ||
    date < billDateOffset(target.period.dueDate, -31) ||
    date > billDateOffset(target.period.dueDate, 31)
  )
    return null;
  return {
    id: transaction.id,
    amount,
    currency: transaction.currency,
    date,
    note: transaction.note?.trim() ?? '',
  };
}

export function checkBillPayment(
  target: BillPaymentTarget,
  transaction: ApiTransaction | undefined,
): BillPaymentCheck {
  if (!transaction) return { kind: 'UNAVAILABLE' };
  const current = currentBillPayment(target, transaction);
  if (!current) return { kind: 'INELIGIBLE' };
  return {
    kind:
      paymentKey(current) === paymentKey(target.period.payment)
        ? 'MATCHED'
        : 'CHANGED',
    current,
  };
}
