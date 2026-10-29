import { ApiError, captureApiSession, getApiBaseUrl } from './api';
import type { DashboardCache } from './dashboardCache';
import { loanDebtsService } from './loanDebts';
import type { CreateLoanDebtPayload, LoanDebtType } from '../types/loanDebt';
import { parsePositiveMoneyInput } from '../utils/moneyInput';
import { financeRefresh } from './financeRefresh';
import { refreshWidgetEntryCache } from './widgetQuickEntry';

export type WidgetLoanPayload = CreateLoanDebtPayload & {
  client_request_id: string;
};
const validDay = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  Number.isFinite(Date.parse(date)) &&
  new Date(date).toISOString().slice(0, 10) === date;
export function widgetLoanPayload(
  data: DashboardCache,
  form: {
    type: LoanDebtType;
    personName: string;
    amount: string;
    walletId: number | null;
    date: string;
    dueDate: string;
    note: string;
    currency: string | null;
  },
  requestId: string,
): WidgetLoanPayload {
  const wallet = data.wallets.find(w => w.id === form.walletId);
  if (!wallet) throw Error('Chọn ví cho khoản vay/nợ.');
  if (wallet.wallet_type === 'SAVINGS')
    throw Error('Chọn ví thông thường cho khoản vay/nợ.');
  const person = form.personName.trim();
  if (!person || person.length > 100)
    throw Error('Nhập tên người, tối đa 100 ký tự.');
  const amount = parsePositiveMoneyInput(form.amount);
  if (!amount) throw Error('Nhập số tiền lớn hơn 0.');
  if (
    !validDay(form.date) ||
    (form.dueDate.trim() && !validDay(form.dueDate.trim()))
  )
    throw Error('Ngày chưa hợp lệ (YYYY-MM-DD).');
  if (form.currency && form.currency !== wallet.currency)
    throw Error(`Chọn ví cùng tiền tệ ${form.currency}.`);
  return {
    type: form.type,
    person_name: person,
    principal_amount: amount,
    wallet_id: wallet.id,
    transaction_date: form.date,
    due_date: form.dueDate.trim() || null,
    note: form.note.trim() || undefined,
    client_request_id: requestId,
  };
}

export async function saveWidgetLoanEntry(
  token: string,
  userId: number,
  payload: WidgetLoanPayload,
  offline: boolean,
  current: () => boolean,
) {
  if (offline)
    throw Error(
      'Vay/Nợ cần kết nối mạng để lưu. Nội dung đang nhập được giữ trên form.',
    );
  const session = captureApiSession(),
    server = getApiBaseUrl();
  const valid = () => current() && session() && server === getApiBaseUrl();
  if (!valid()) throw Error('Phiên làm việc đã thay đổi.');
  try {
    await loanDebtsService.createQuickEntry(token, payload);
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 404 &&
      /^(?:Cannot POST\b|not found$)/i.test(error.message)
    )
      throw Error(
        'Máy chủ chưa hỗ trợ nhập Vay/Nợ chống trùng. Cần cập nhật máy chủ trước.',
      );
    throw error;
  }
  if (valid()) {
    financeRefresh.emit();
    refreshWidgetEntryCache(
      token,
      userId,
      () => session() && server === getApiBaseUrl(),
    ).catch(() => undefined);
  }
  return 'SAVED' as const;
}
