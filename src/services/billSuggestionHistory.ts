import { transactionsService } from './transactions';
import type { ApiTransaction } from '../types/transaction';
import { billDateOffset, isBillDate } from '../utils/recurringBills';

export async function loadBillSuggestionHistory(
  token: string,
  today: string,
  isCurrent: () => boolean,
) {
  if (!isBillDate(today)) throw new Error('Ngày kiểm tra chưa hợp lệ.');
  const rows: ApiTransaction[] = [];
  const ids = new Set<number>();
  let total: number | undefined;
  for (let page = 1; page <= 20; page += 1) {
    if (!isCurrent()) return null;
    const result = await transactionsService.getPage(token, {
      type: 'EXPENSE',
      cash_flow: 'normal',
      from: billDateOffset(today, -1096),
      to: today,
      page,
      limit: 100,
    });
    if (!isCurrent()) return null;
    const meta = result.meta;
    if (
      !Array.isArray(result.data) ||
      result.data.length > 100 ||
      meta.page !== page ||
      !Number.isSafeInteger(meta.total) ||
      meta.total < 0 ||
      !Number.isSafeInteger(meta.totalPages) ||
      meta.totalPages < 0 ||
      (total !== undefined && total !== meta.total) ||
      (result.data.length === 0 && page < meta.totalPages)
    )
      throw new Error(
        'Danh sách giao dịch đã thay đổi hoặc chưa tải đủ. Hãy kiểm tra lại.',
      );
    total = meta.total;
    for (const row of result.data) {
      if (!Number.isSafeInteger(row.id) || row.id <= 0 || ids.has(row.id))
        throw new Error(
          'Danh sách giao dịch bị trùng giữa các trang. Hãy kiểm tra lại.',
        );
      ids.add(row.id);
      rows.push(row);
    }
    if (page >= meta.totalPages) {
      if (rows.length !== total)
        throw new Error('Chưa tải đủ giao dịch để kiểm tra.');
      return { rows, total, complete: true };
    }
  }
  return { rows, total: total!, complete: false };
}
