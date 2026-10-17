import type { ParsedBankNotification } from '../types/bankNotification';
import type { ApiTransaction } from '../types/transaction';

const DAY_MS = 86_400_000;

const normalize = (value?: string | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .replace(/\d{4,}/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const words = (value?: string | null) =>
  new Set(
    normalize(value)
      .split(' ')
      .filter(word => word.length >= 3),
  );

export type EvidenceMatch = {
  transaction: ApiTransaction;
  score: number;
  reasons: string[];
};

export const findBestEvidenceMatch = (
  parsed: ParsedBankNotification,
  postedAt: number,
  transactions: ApiTransaction[],
): EvidenceMatch | null => {
  if (
    parsed.status !== 'READY' ||
    !parsed.amount ||
    !parsed.currency ||
    !parsed.type
  ) {
    return null;
  }
  const amount = Number(parsed.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const bankWords = words(parsed.note);

  const candidates = transactions
    .filter(
      transaction =>
        Boolean(transaction.receipt_image) ||
        Boolean(transaction.receipt_items?.length),
    )
    .map(transaction => {
      const transactionAmount = Math.abs(Number(transaction.amount) || 0);
      if (
        transaction.type !== parsed.type ||
        transaction.currency.toUpperCase() !== parsed.currency!.toUpperCase() ||
        Math.abs(transactionAmount - amount) > 1
      ) {
        return null;
      }
      const transactionTime = new Date(transaction.transaction_date).getTime();
      if (Number.isNaN(transactionTime)) return null;
      const dayDifference = Math.abs(transactionTime - postedAt) / DAY_MS;
      if (dayDifference > 2) return null;

      const reasons = ['Trùng số tiền và loại giao dịch'];
      let score = 60;
      if (dayDifference <= 1) {
        score += 30;
        reasons.push('Thời gian cách nhau không quá một ngày');
      } else {
        score += 15;
        reasons.push('Thời gian cách nhau không quá hai ngày');
      }
      const transactionWords = words(transaction.note);
      const sharedWords = [...bankWords].filter(word =>
        transactionWords.has(word),
      );
      if (sharedWords.length) {
        score += 10;
        reasons.push(`Cùng từ khóa: ${sharedWords.slice(0, 2).join(', ')}`);
      }
      return { transaction, score, reasons };
    })
    .filter((value): value is EvidenceMatch => Boolean(value))
    .sort((left, right) => right.score - left.score);

  return candidates[0]?.score >= 75 ? candidates[0] : null;
};

export const mergeBankEvidenceNote = (
  currentNote: string | null | undefined,
  bankNote: string | null | undefined,
) => {
  const current = currentNote?.trim() ?? '';
  const bank = bankNote?.trim() ?? '';
  if (!bank || normalize(current).includes(normalize(bank))) return current;
  return current ? `${current}\nNgân hàng: ${bank}` : `Ngân hàng: ${bank}`;
};
