import { ApiError, captureApiSession, getApiBaseUrl } from './api';
import { dashboardCache, type DashboardCache } from './dashboardCache';
import {
  transactionsService,
  type CreateTransactionPayload,
} from './transactions';
import { walletsService } from './wallets';
import { categoriesService } from './categories';
import {
  offlineTransactionQueue,
  isRetryableOfflineTransactionError,
} from './offlineTransactionQueue';
import { financeRefresh } from './financeRefresh';
import { parsePositiveMoneyInput } from '../utils/moneyInput';
import type { ReceiptItem } from '../types/transaction';

export async function refreshWidgetEntryCache(
  token: string,
  userId: number,
  current: () => boolean,
) {
  const session = captureApiSession();
  const [wallets, page, categories] = await Promise.all([
    walletsService.getAll(token),
    transactionsService.getPage(token, { limit: 100, page: 1 }),
    categoriesService.getAll(token),
  ]);
  if (!current() || !session()) return;
  // A payment can finish while these reads are in flight. Merge with the
  // latest cache rather than the snapshot from before the network requests.
  const data = await dashboardCache.read(userId);
  if (!current() || !session() || !data) return;
  const ids = new Set(page.data.map(t => t.id));
  await dashboardCache.save(userId, {
    ...data,
    wallets,
    categories,
    transactions: [
      ...page.data,
      ...data.transactions.filter(t => !ids.has(t.id)),
    ],
  });
}

export function widgetEntryPayload(
  data: DashboardCache,
  form: {
    type: 'INCOME' | 'EXPENSE';
    walletId: number | null;
    categoryId: number | null;
    amount: string;
    note: string;
    date: string;
    currency?: string | null;
    items: ReceiptItem[];
  },
  requestId: string,
): CreateTransactionPayload {
  const wallet = data.wallets.find(w => w.id === form.walletId);
  const category = data.categories.find(
    c =>
      c.id === form.categoryId &&
      c.type === form.type &&
      (!c.cash_flow_group || c.cash_flow_group === 'NORMAL'),
  );
  const amount = parsePositiveMoneyInput(form.amount);
  if (!wallet) throw Error('Chọn ví cho giao dịch.');
  if (!category) throw Error('Chọn danh mục phù hợp với Thu/Chi.');
  if (!amount) throw Error('Nhập số tiền lớn hơn 0.');
  if (form.currency && wallet.currency !== form.currency)
    throw Error(`Nội dung dùng ${form.currency}. Chọn ví cùng loại tiền.`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(form.date) ||
    !Number.isFinite(Date.parse(form.date)) ||
    new Date(form.date).toISOString().slice(0, 10) !== form.date
  )
    throw Error('Ngày giao dịch chưa hợp lệ (YYYY-MM-DD).');
  if (
    form.items.some(
      i => !i.name.trim() || !Number.isFinite(i.amount) || i.amount <= 0,
    )
  )
    throw Error('Kiểm tra tên và thành tiền các món.');
  return {
    wallet_id: wallet.id,
    category_id: category.id,
    type: form.type,
    amount,
    note: form.note.trim() || undefined,
    transaction_date: form.date,
    receipt_items: form.items.length ? form.items : null,
    client_request_id: requestId,
  };
}

export async function saveWidgetEntry(
  token: string,
  userId: number,
  payload: CreateTransactionPayload,
  offline: boolean,
  current: () => boolean,
) {
  const session = captureApiSession();
  const server = getApiBaseUrl();
  const valid = () => current() && session() && server === getApiBaseUrl();
  if (!valid()) throw Error('Phiên làm việc đã thay đổi.');
  let created;
  try {
    if (offline) throw Error('OFFLINE');
    created = await transactionsService.create(token, payload);
  } catch (error) {
    if (
      !valid() ||
      (error instanceof ApiError && error.code === 'SESSION_CHANGED')
    )
      throw error;
    if (!isRetryableOfflineTransactionError(error)) throw error;
    await offlineTransactionQueue.enqueue(userId, payload);
    return 'PENDING' as const;
  }
  // A failed cache refresh must never turn a committed payment into a retry/new payment.
  try {
    const data = await dashboardCache.read(userId);
    if (valid() && data)
      await dashboardCache.save(userId, {
        ...data,
        transactions: [
          created,
          ...data.transactions.filter(t => t.id !== created.id),
        ],
      });
  } catch {
    /* main app refreshes server data on resume */
  }
  if (valid()) financeRefresh.emit();
  // The payment is already confirmed. A slow wallet GET must not keep the
  // confirmation button busy or encourage a second payment. Keep this refresh
  // scoped to the captured auth session, even after the widget panel closes.
  const refreshWallets = async () => {
    const wallets = await walletsService.getAll(token);
    if (!session() || server !== getApiBaseUrl()) return;
    const latest = await dashboardCache.read(userId);
    if (session() && server === getApiBaseUrl() && latest)
      await dashboardCache.save(userId, { ...latest, wallets });
  };
  refreshWallets().catch(() => undefined);
  return 'SAVED' as const;
}
