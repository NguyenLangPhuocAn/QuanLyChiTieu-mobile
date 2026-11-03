import { recurringBillsService, type BillScope } from './recurringBills';
import {
  transactionsService,
  type CreateTransactionPayload,
} from './transactions';
import type { ApiTransaction } from '../types/transaction';
import type { Category } from '../types/category';
import type { BillOccurrence } from '../utils/recurringBills';
import { getCashFlowType } from '../utils/transactionClassification';

/** One stable server idempotency key per user, bill and period, including after app restart. */
export const billPaymentRequestId = (
  userId: number,
  billId: string,
  dueDate: string,
) => {
  const value = `${userId}:${billId}:${dueDate}`;
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  const hash = seeds.map(seed => {
    let result = seed;
    for (let i = 0; i < value.length; i += 1) {
      // eslint-disable-next-line no-bitwise
      result = Math.imul(result ^ value.charCodeAt(i), 16777619);
    }
    // eslint-disable-next-line no-bitwise
    return (result >>> 0).toString(16).padStart(8, '0');
  });
  return `billpay_${hash.join('')}`;
};

export async function payRecurringBill({
  scope,
  token,
  occurrence,
  payload,
  category,
  created,
  onCreated,
  isCurrent,
}: {
  scope: BillScope;
  token: string;
  occurrence: BillOccurrence;
  payload: CreateTransactionPayload;
  category?: Category;
  created?: ApiTransaction | null;
  onCreated: (transaction: ApiTransaction) => void;
  isCurrent: () => boolean;
}) {
  const book = await recurringBillsService.load(scope);
  if (!isCurrent()) throw new Error('Đã đóng màn thanh toán.');
  const bill = book.bills.find(item => item.id === occurrence.bill.id);
  if (
    !bill ||
    bill.archived ||
    bill.paused ||
    bill.currency !== occurrence.bill.currency ||
    bill.label !== occurrence.bill.label ||
    bill.minAmount !== occurrence.bill.minAmount ||
    bill.maxAmount !== occurrence.bill.maxAmount ||
    bill.cycle !== occurrence.bill.cycle ||
    bill.anchorDate !== occurrence.bill.anchorDate ||
    bill.startDate !== occurrence.bill.startDate ||
    bill.categoryId !== occurrence.bill.categoryId
  )
    throw new Error('Lịch đã thay đổi. Hãy mở lại kỳ hóa đơn.');
  if (
    payload.type !== 'EXPENSE' ||
    payload.category_id !== category?.id ||
    (category !== undefined &&
      (category.type !== 'EXPENSE' || getCashFlowType(category) !== 'normal'))
  )
    throw new Error('Cần chọn danh mục chi thông thường.');
  const handled = book.periods.find(
    item => item.billId === bill.id && item.dueDate === occurrence.dueDate,
  );
  if (handled?.status === 'PAID' && created?.id === handled.payment.id)
    return created;
  if (handled) throw new Error('Kỳ hóa đơn đã được xử lý. Hãy tải lại lịch.');
  const transaction =
    created ??
    (await transactionsService.create(token, {
      ...payload,
      client_request_id: billPaymentRequestId(
        scope.userId,
        bill.id,
        occurrence.dueDate,
      ),
    }));
  if (!isCurrent())
    throw new Error(
      'Đã tạo giao dịch nhưng màn đã đóng. Hãy liên kết từ lịch sử.',
    );
  onCreated(transaction);
  await recurringBillsService.linkPayment(scope, bill.id, occurrence.dueDate, {
    ...transaction,
    category: transaction.category ?? category,
  });
  return transaction;
}
