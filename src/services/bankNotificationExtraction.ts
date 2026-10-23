import { apiRequest } from './api';
import {
  directionInEvidence,
  prepareBankNotificationText,
} from '../utils/bankNotificationText';
import type { ParsedBankNotification } from '../types/bankNotification';

export function parseNotificationText(
  text: string,
  postedAt: number,
): ParsedBankNotification {
  const date = new Date(postedAt);
  const transactionDate = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  try {
    const prepared = prepareBankNotificationText(text);
    const note = prepared.text
      .replace(/\[ĐÃ [^\]]+\]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);
    const unique = new Set(
      prepared.money.map(value => `${value.currency}:${value.amount}`),
    );
    const money = unique.size === 1 ? prepared.money[0] : undefined;
    const direction = directionInEvidence(prepared.text);
    const type =
      money && direction && (!money.direction || money.direction === direction)
        ? direction
        : undefined;
    if (!money || !type)
      return {
        status: 'REVIEW',
        transactionDate,
        note,
        reason: !money
          ? 'Chọn một thông báo có số tiền thu/chi rõ ràng, không lấy số dư.'
          : 'Cần xác nhận đây là khoản thu hay chi.',
      };
    return {
      status: 'READY',
      type,
      amount: String(money.amount),
      currency: money.currency,
      note,
      transactionDate,
    };
  } catch (error) {
    return {
      status: 'REVIEW',
      transactionDate,
      note: '',
      reason: error instanceof Error ? error.message : 'Cần kiểm tra nội dung.',
    };
  }
}

export const bankNotificationExtraction = {
  async analyze(
    token: string,
    text: string,
    postedAt: number,
  ): Promise<ParsedBankNotification> {
    // Call only after a separate user confirmation of this exact sanitized text.
    const prepared = prepareBankNotificationText(text);
    const flags = await apiRequest<{ bank_notification_ai: boolean }>(
      '/features',
      { token },
    );
    if (flags.bank_notification_ai !== true)
      throw new Error(
        'Máy chủ chưa bật hỗ trợ đọc bằng AI. Bạn có thể sửa chữ hoặc nhập giao dịch bằng tay.',
      );
    const result = await apiRequest<{
      status: string;
      type: string | null;
      amount: number | null;
      currency: string | null;
      note: string;
      reason: string;
    }>('/bank-notifications/extract', {
      method: 'POST',
      token,
      timeoutMs: 45000,
      body: { text: prepared.text, consent: true },
    });
    const local = parseNotificationText(text, postedAt);
    const matches = prepared.money.filter(
      m => m.amount === result.amount && m.currency === result.currency,
    );
    const unique = new Set(
      prepared.money.map(m => `${m.currency}:${m.amount}`),
    );
    if (
      result.status !== 'READY' ||
      unique.size !== 1 ||
      !matches.length ||
      !['INCOME', 'EXPENSE'].includes(result.type ?? '') ||
      matches.some(m => m.direction && m.direction !== result.type) ||
      (directionInEvidence(prepared.text) &&
        directionInEvidence(prepared.text) !== result.type)
    ) {
      return {
        ...local,
        status: 'REVIEW',
        amount: undefined,
        type: undefined,
        currency: undefined,
        reason:
          result.reason ||
          'Chưa đọc chắc chắn. Hãy chọn lại vùng thông báo hoặc nhập tay.',
      };
    }
    return {
      ...local,
      status: 'READY',
      type: result.type as 'INCOME' | 'EXPENSE',
      amount: String(result.amount),
      currency: result.currency!,
      note: prepareBankNotificationText(
        result.note || prepared.text,
      ).text.slice(0, 180),
    };
  },
};
