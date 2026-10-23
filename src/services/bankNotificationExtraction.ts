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

export function manualBankNotification(
  text: string,
  postedAt: number,
  reason: string,
): ParsedBankNotification {
  const date = new Date(postedAt);
  let note = '';
  try {
    note = prepareBankNotificationText(text)
      .text.replace(/\[ĐÃ [^\]]+\]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);
  } catch {}
  return {
    status: 'REVIEW',
    note,
    reason,
    transactionDate: [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-'),
  };
}

let flagsCache: { token: string; until: number; enabled: boolean } | null =
  null;
export const bankNotificationExtraction = {
  clearAvailabilityCache() {
    flagsCache = null;
  },
  async isAvailable(token: string, signal?: AbortSignal) {
    if (flagsCache?.token === token && flagsCache.until > Date.now())
      return flagsCache.enabled;
    let enabled: boolean;
    try {
      const flags = await apiRequest<{ bank_notification_ai: boolean }>(
        '/features',
        { token, signal },
      );
      enabled = flags?.bank_notification_ai === true;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        error.status === 404
      )
        enabled = false;
      else throw error;
    }
    flagsCache = {
      token,
      enabled,
      until: Date.now() + (enabled ? 30000 : 3000),
    };
    return enabled;
  },
  async analyze(
    token: string,
    text: string,
    postedAt: number,
    signal?: AbortSignal,
  ): Promise<ParsedBankNotification> {
    // Called only after consent. No local field extraction or regex fallback selects Thu/Chi.
    const prepared = prepareBankNotificationText(text);
    if (!(await bankNotificationExtraction.isAvailable(token, signal)))
      throw new Error(
        'Máy chủ chưa bật đọc thông báo bằng AI. Bạn có thể nhập giao dịch bằng tay.',
      );
    const result = await apiRequest<{
      status: string;
      type: string | null;
      amount: number | null;
      currency: string | null;
      note: string;
      reason: string;
      confidence: number;
      requires_confirmation: boolean;
    }>('/bank-notifications/extract', {
      method: 'POST',
      token,
      signal,
      timeoutMs: 16000,
      body: { text: prepared.text, consent: true },
    });
    const review = manualBankNotification(
      text,
      postedAt,
      result?.reason || 'AI chưa đọc chắc chắn. Hãy kiểm tra hoặc nhập tay.',
    );
    const matches = prepared.money.filter(
      m => m.amount === result?.amount && m.currency === result?.currency,
    );
    if (
      result?.status !== 'READY' ||
      !matches.length ||
      !['INCOME', 'EXPENSE'].includes(result.type ?? '') ||
      typeof result.amount !== 'number' ||
      !Number.isFinite(result.amount) ||
      typeof result.confidence !== 'number' ||
      !Number.isFinite(result.confidence) ||
      result.confidence < 0.9 ||
      result.confidence > 1 ||
      result.requires_confirmation !== true ||
      matches.every(m => m.direction !== null && m.direction !== result.type)
    )
      return review;
    let note: string;
    try {
      note = prepareBankNotificationText(
        `Nội dung: ${result.note || prepared.text}`,
      )
        .text.replace(/\[ĐÃ [^\]]+\]/gu, '')
        .replace(/^Nội dung:\s*/u, '')
        .trim()
        .slice(0, 180);
    } catch {
      return review;
    }
    return {
      ...review,
      status: 'READY',
      type: result.type as 'INCOME' | 'EXPENSE',
      amount: String(result.amount),
      currency: result.currency!,
      note,
      reason: undefined,
    };
  },
};
