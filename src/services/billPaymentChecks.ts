import { transactionsService } from './transactions';
import { recurringBillsService, type BillScope } from './recurringBills';
import {
  checkBillPayment,
  paymentKey,
  paymentTargetKey,
  type BillPaymentCheck,
  type BillPaymentTarget,
} from '../utils/billPaymentChecks';
import type { ApiTransaction } from '../types/transaction';
import type { BillPayment } from '../utils/recurringBills';

const cancelled = () => new Error('Đã dừng kiểm tra liên kết.');
export async function readLinkedPayments(token: string, ids: number[]) {
  if (
    !ids.length ||
    ids.length > 100 ||
    new Set(ids).size !== ids.length ||
    ids.some(id => !Number.isSafeInteger(id) || id <= 0 || id > 2147483647)
  )
    throw new Error('Danh sách liên kết chưa hợp lệ.');
  const result = await transactionsService.getLinkedPayments(token, ids);
  // A missing route, error or malformed/partial response never means deleted.
  if (
    !result ||
    !Array.isArray(result.requestedIds) ||
    !Array.isArray(result.missingIds) ||
    !Array.isArray(result.data) ||
    JSON.stringify(result.requestedIds) !== JSON.stringify(ids)
  )
    throw new Error('Chưa nhận được kết quả đối chiếu đầy đủ.');
  const returned = [...result.data.map(row => row?.id), ...result.missingIds];
  if (
    returned.length !== ids.length ||
    new Set(returned).size !== ids.length ||
    returned.some(id => !ids.includes(id))
  )
    throw new Error('Chưa nhận được kết quả đối chiếu đầy đủ.');
  return new Map<number, ApiTransaction>(result.data.map(row => [row.id, row]));
}

export async function checkPaymentLinks(
  token: string,
  targets: BillPaymentTarget[],
  isCurrent: () => boolean,
  onProgress: (checked: number, total: number) => void,
) {
  const ids = [...new Set(targets.map(target => target.period.payment.id))];
  const rows = new Map<number, ApiTransaction>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    if (!isCurrent()) throw cancelled();
    const page = await readLinkedPayments(
      token,
      ids.slice(offset, offset + 100),
    );
    if (!isCurrent()) throw cancelled();
    page.forEach((row, id) => rows.set(id, row));
    onProgress(Math.min(offset + 100, ids.length), ids.length);
  }
  return Object.fromEntries(
    targets.map(target => [
      paymentTargetKey(target),
      checkBillPayment(target, rows.get(target.period.payment.id)),
    ]),
  ) as Record<string, BillPaymentCheck>;
}

export async function refreshPaymentLink(
  scope: BillScope,
  token: string,
  target: BillPaymentTarget,
  shown: BillPayment,
  isCurrent: () => boolean,
) {
  if (!isCurrent()) throw cancelled();
  const rows = await readLinkedPayments(token, [target.period.payment.id]);
  if (!isCurrent()) throw cancelled();
  const transaction = rows.get(target.period.payment.id);
  const check = checkBillPayment(target, transaction);
  if (
    !transaction ||
    !('current' in check) ||
    paymentKey(check.current) !== paymentKey(shown)
  )
    throw new Error(
      'Giao dịch vừa thay đổi. Hãy kiểm tra liên kết lại trước khi xác nhận.',
    );
  await recurringBillsService.refreshPayment(
    scope,
    target,
    transaction,
    isCurrent,
  );
}
