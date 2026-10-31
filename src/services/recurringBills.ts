import { planningLocalStore } from './planningLocalStore';
import type { ApiTransaction } from '../types/transaction';
import { getTransactionDateKey } from '../utils/mapTransactions';
import { getCashFlowType } from '../utils/transactionClassification';
import { billActivityMerchant, readBillAlertKey } from '../utils/billActivity';
import {
  currentBillPayment,
  paymentKey,
  type BillPaymentTarget,
} from '../utils/billPaymentChecks';
import {
  isSuggestionKey,
  type BillSuggestionDecision,
} from '../utils/billSuggestions';
import {
  isBillDate,
  billDateOffset,
  isBillDueDate,
  validateBillInput,
  type BillBook,
  type BillInput,
  type BillPeriod,
  type BillPayment,
} from '../utils/recurringBills';

export type BillScope = { userId: number; server: string };
const empty = (): BillBook => ({ version: 1, bills: [], periods: [] });
const corrupt = () =>
  new Error(
    'Dữ liệu hóa đơn trên máy chưa đọc được. Giữ nguyên dữ liệu; hãy thử lại hoặc liên hệ hỗ trợ.',
  );
export const parseBillBook = (raw: string): BillBook => {
  try {
    const value = JSON.parse(raw) as BillBook;
    if (
      value.version !== 1 ||
      !Array.isArray(value.bills) ||
      !Array.isArray(value.periods)
    )
      throw corrupt();
    const ids = new Set<string>();
    for (const bill of value.bills) {
      validateBillInput(bill);
      if (
        typeof bill.id !== 'string' ||
        !bill.id ||
        ids.has(bill.id) ||
        typeof bill.paused !== 'boolean' ||
        typeof bill.archived !== 'boolean'
      )
        throw corrupt();
      ids.add(bill.id);
    }
    const periods = new Set<string>();
    const transactions = new Set<number>();
    for (const period of value.periods) {
      const bill = value.bills.find(item => item.id === period.billId);
      const periodKey = `${period.billId}:${period.dueDate}`;
      if (
        !bill ||
        !isBillDueDate(bill, period.dueDate) ||
        periods.has(periodKey)
      )
        throw corrupt();
      periods.add(periodKey);
      if (period.status === 'PAID') {
        const payment = period.payment;
        if (
          !payment ||
          !Number.isSafeInteger(payment.id) ||
          payment.id <= 0 ||
          transactions.has(payment.id) ||
          !Number.isFinite(payment.amount) ||
          payment.amount <= 0 ||
          payment.currency !== bill.currency ||
          !isBillDate(payment.date) ||
          typeof payment.note !== 'string'
        )
          throw corrupt();
        transactions.add(payment.id);
      } else if (period.status !== 'SKIPPED' || period.payment) throw corrupt();
    }
    if (value.suggestions !== undefined) {
      if (!Array.isArray(value.suggestions)) throw corrupt();
      const keys = new Set<string>();
      for (const decision of value.suggestions) {
        if (
          !isSuggestionKey(decision?.key) ||
          keys.has(decision.key) ||
          !['IGNORED', 'LATER', 'TRACKED'].includes(decision.status) ||
          (decision.status === 'LATER' &&
            (!decision.until || !isBillDate(decision.until))) ||
          (decision.status === 'TRACKED' &&
            !value.bills.some(b => b.id === decision.billId))
        )
          throw corrupt();
        keys.add(decision.key);
      }
    }
    if (value.reviewedAlerts !== undefined) {
      if (
        !Array.isArray(value.reviewedAlerts) ||
        new Set(value.reviewedAlerts).size !== value.reviewedAlerts.length
      )
        throw corrupt();
      for (const alertValue of value.reviewedAlerts) {
        const parsed = readBillAlertKey(alertValue);
        if (!parsed || !ids.has(parsed[2])) throw corrupt();
      }
    }
    return value;
  } catch {
    throw corrupt();
  }
};
const mutate = <T>(
  scope: BillScope,
  change: (book: BillBook) => T,
): Promise<T> =>
  planningLocalStore.update(scope, state => {
    const book = state.book === null ? empty() : parseBillBook(state.book);
    const result = change(book);
    state.book = JSON.stringify(book);
    return result;
  });
const findBill = (book: BillBook, id: string) => {
  const bill = book.bills.find(item => item.id === id && !item.archived);
  if (!bill) throw new Error('Lịch hóa đơn không còn tồn tại.');
  return bill;
};
const identity = (input: BillInput) =>
  `${input.label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')}|${input.cycle}|${input.anchorDate}|${
    input.currency
  }`;

export const recurringBillsService = {
  restoreBackup(
    scope: BillScope,
    expected: string,
    imported: string,
    isCurrent: () => boolean,
  ) {
    const validated = parseBillBook(imported);
    return mutate(scope, book => {
      if (!isCurrent())
        throw new Error('Phiên khôi phục đã đóng. Hãy xem trước lại.');
      if (JSON.stringify(book) !== expected)
        throw new Error(
          'Lịch trên máy đã thay đổi. Hãy xem trước lại trước khi khôi phục.',
        );
      // Keep account-local global preferences; restored schedules require deliberate re-enabling.
      for (const bill of validated.bills) bill.reminderEnabled = false;
      book.bills = validated.bills;
      book.periods = validated.periods;
      book.suggestions = validated.suggestions;
      book.reviewedAlerts = validated.reviewedAlerts;
    });
  },
  subscribe(listener: (scope: BillScope) => void) {
    return planningLocalStore.subscribe(listener);
  },
  async load(scope: BillScope) {
    const state = await planningLocalStore.read(scope);
    return state.book === null ? empty() : parseBillBook(state.book);
  },
  save(
    scope: BillScope,
    input: BillInput,
    id?: string,
    suggestionKey?: string,
  ) {
    const validated = validateBillInput(input);
    if (suggestionKey !== undefined && (!isSuggestionKey(suggestionKey) || id))
      throw new Error('Gợi ý chưa hợp lệ.');
    return mutate(scope, book => {
      if (
        suggestionKey &&
        book.suggestions?.some(
          item => item.key === suggestionKey && item.status === 'TRACKED',
        )
      )
        return;
      const existing = id ? findBill(book, id) : undefined;
      if (
        book.bills.some(
          bill =>
            !bill.archived &&
            bill.id !== id &&
            identity(bill) === identity(validated),
        )
      )
        throw new Error(
          'Đã có lịch cùng tên, tiền tệ, chu kỳ và ngày bắt đầu.',
        );
      if (
        existing &&
        book.periods.some(period => period.billId === existing.id) &&
        (existing.anchorDate !== validated.anchorDate ||
          existing.startDate !== validated.startDate ||
          existing.cycle !== validated.cycle ||
          existing.currency !== validated.currency)
      )
        throw new Error(
          'Lịch đã có kỳ xử lý. Hãy tạo lịch mới để đổi chu kỳ, ngày gốc hoặc tiền tệ.',
        );
      if (existing) Object.assign(existing, validated);
      else {
        const bill = {
          ...validated,
          id: `bill_${Date.now().toString(36)}_${Math.random()
            .toString(36)
            .slice(2)}`,
          paused: false,
          archived: false,
        };
        book.bills.push(bill);
        if (suggestionKey)
          book.suggestions = [
            ...(book.suggestions ?? []).filter(
              item => item.key !== suggestionKey,
            ),
            { key: suggestionKey, status: 'TRACKED', billId: bill.id },
          ];
      }
    });
  },
  decideSuggestion(
    scope: BillScope,
    key: string,
    status: 'IGNORED' | 'LATER',
    until?: string,
  ) {
    if (
      !isSuggestionKey(key) ||
      !['IGNORED', 'LATER'].includes(status) ||
      (status === 'LATER' && (!until || !isBillDate(until)))
    )
      throw new Error('Lựa chọn gợi ý chưa hợp lệ.');
    return mutate(scope, book => {
      if (
        book.suggestions?.some(
          item => item.key === key && item.status === 'TRACKED',
        )
      )
        throw new Error('Khoản này đã được theo dõi.');
      const decision: BillSuggestionDecision =
        status === 'LATER' ? { key, status, until } : { key, status };
      book.suggestions = [
        ...(book.suggestions ?? []).filter(item => item.key !== key),
        decision,
      ];
    });
  },
  restoreSuggestion(scope: BillScope, key: string) {
    if (!isSuggestionKey(key)) throw new Error('Gợi ý chưa hợp lệ.');
    return mutate(scope, book => {
      book.suggestions = book.suggestions?.filter(
        item => item.key !== key || item.status === 'TRACKED',
      );
    });
  },
  reviewAlert(
    scope: BillScope,
    key: string,
    reviewed: boolean,
    isCurrent: () => boolean,
  ) {
    const parsed = readBillAlertKey(key);
    if (!parsed || typeof reviewed !== 'boolean')
      throw new Error('Cảnh báo chưa hợp lệ.');
    return mutate(scope, book => {
      if (!isCurrent()) throw new Error('Đã dừng lưu lựa chọn.');
      const bill = findBill(book, parsed[2]);
      if (
        bill.paused ||
        bill.cycle !== parsed[3] ||
        bill.currency !== parsed[4] ||
        Math.round(bill.maxAmount * (bill.currency === 'VND' ? 1 : 100)) !==
          parsed[6] ||
        billActivityMerchant(book, bill) !== parsed[7] ||
        bill.anchorDate !== parsed[8]
      )
        throw new Error(
          'Lịch vừa thay đổi. Hãy kiểm tra lại trước khi ẩn cảnh báo.',
        );
      const existing = (book.reviewedAlerts ?? []).filter(item => item !== key);
      if (reviewed) {
        const cutoff = billDateOffset(
          parsed[5],
          bill.cycle === 'YEARLY' ? -800 : -180,
        );
        const eventOf = (
          parts: NonNullable<ReturnType<typeof readBillAlertKey>>,
        ) =>
          JSON.stringify([
            parts[1],
            parts[2],
            parts[3],
            parts[4],
            parts[5],
            parts[7],
            parts[1] === 'DUPLICATE'
              ? Math.min(...parts[9].map(row => row[0]))
              : null,
          ]);
        const own = existing.filter(item => {
          const previous = readBillAlertKey(item)!;
          return (
            previous[2] === bill.id &&
            previous[5] >= cutoff &&
            eventOf(previous) !== eventOf(parsed)
          );
        });
        book.reviewedAlerts = [
          ...existing.filter(item => readBillAlertKey(item)![2] !== bill.id),
          ...own,
          key,
        ];
      } else book.reviewedAlerts = existing;
    });
  },
  setPaused(scope: BillScope, id: string, paused: boolean) {
    return mutate(scope, book => {
      findBill(book, id).paused = paused;
    });
  },
  setReminder(scope: BillScope, id: string, enabled: boolean) {
    if (typeof enabled !== 'boolean')
      throw new Error('Trạng thái nhắc chưa hợp lệ.');
    return mutate(scope, book => {
      findBill(book, id).reminderEnabled = enabled;
    });
  },
  archive(scope: BillScope, id: string) {
    // Keep payment references reserved, even after removing the schedule from view.
    return mutate(scope, book => {
      findBill(book, id).archived = true;
    });
  },
  skip(scope: BillScope, billId: string, dueDate: string) {
    return mutate(scope, book => {
      const bill = findBill(book, billId);
      if (bill.paused || !isBillDueDate(bill, dueDate))
        throw new Error('Kỳ hóa đơn không hoạt động.');
      const current = book.periods.find(
        item => item.billId === billId && item.dueDate === dueDate,
      );
      if (current?.status === 'PAID')
        throw new Error('Kỳ này đã liên kết giao dịch.');
      if (!current) book.periods.push({ billId, dueDate, status: 'SKIPPED' });
    });
  },
  reopen(
    scope: BillScope,
    billId: string,
    dueDate: string,
    expected?: BillPayment,
  ) {
    return mutate(scope, book => {
      if (!book.bills.some(bill => bill.id === billId))
        throw new Error('Lịch hóa đơn không còn tồn tại.');
      if (expected) {
        const current = book.periods.find(
          p => p.billId === billId && p.dueDate === dueDate,
        );
        if (
          current?.status !== 'PAID' ||
          paymentKey(current.payment) !== paymentKey(expected)
        )
          throw new Error(
            'Liên kết vừa thay đổi. Hãy tải lại trước khi mở kỳ.',
          );
      }
      book.periods = book.periods.filter(
        item => item.billId !== billId || item.dueDate !== dueDate,
      );
    });
  },
  refreshPayment(
    scope: BillScope,
    target: BillPaymentTarget,
    transaction: ApiTransaction,
    isCurrent: () => boolean,
  ) {
    return mutate(scope, book => {
      if (!isCurrent()) throw new Error('Đã dừng cập nhật liên kết.');
      const bill = book.bills.find(b => b.id === target.bill.id);
      const current = book.periods.find(
        p => p.billId === target.bill.id && p.dueDate === target.period.dueDate,
      );
      if (
        !bill ||
        current?.status !== 'PAID' ||
        paymentKey(current.payment) !== paymentKey(target.period.payment)
      )
        throw new Error(
          'Liên kết vừa thay đổi. Hãy tải lại trước khi cập nhật.',
        );
      const payment = currentBillPayment(
        { bill, period: current },
        transaction,
      );
      if (!payment)
        throw new Error('Giao dịch không còn phù hợp với kỳ hóa đơn.');
      // Keep the same transaction reservation and period; no money/API writes.
      current.payment = payment;
    });
  },
  linkPayment(
    scope: BillScope,
    billId: string,
    dueDate: string,
    transaction: ApiTransaction,
  ) {
    return mutate(scope, book => {
      const bill = findBill(book, billId);
      if (bill.paused || !isBillDueDate(bill, dueDate))
        throw new Error('Kỳ hóa đơn không hoạt động.');
      const current = book.periods.find(
        item => item.billId === billId && item.dueDate === dueDate,
      );
      const amount = Math.abs(Number(transaction.amount));
      const date = getTransactionDateKey(transaction.transaction_date);
      if (
        transaction.type !== 'EXPENSE' ||
        getCashFlowType(transaction.category) !== 'normal' ||
        transaction.currency !== bill.currency ||
        !Number.isSafeInteger(transaction.id) ||
        transaction.id <= 0 ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !isBillDate(date)
      )
        throw new Error(
          'Cần giao dịch chi thông thường cùng tiền tệ với hóa đơn.',
        );
      if (current?.status === 'PAID' && current.payment.id === transaction.id)
        return;
      if (current)
        throw new Error('Kỳ này đã được xử lý. Mở lại kỳ trước khi liên kết.');
      if (
        book.periods.some(
          item => item.status === 'PAID' && item.payment.id === transaction.id,
        )
      )
        throw new Error('Giao dịch này đã được dùng cho một kỳ hóa đơn khác.');
      const period: BillPeriod = {
        billId,
        dueDate,
        status: 'PAID',
        payment: {
          id: transaction.id,
          amount,
          currency: bill.currency,
          date,
          note: transaction.note?.trim() ?? '',
        },
      };
      book.periods.push(period);
    });
  },
};
