import type { ParsedBankNotification } from '../../types/bankNotification';
import type { ApiTransaction } from '../../types/transaction';
import { findBestEvidenceMatch, mergeBankEvidenceNote } from '../evidenceMatcher';

const parsed: ParsedBankNotification = {
  status: 'READY',
  type: 'EXPENSE',
  amount: '79000',
  currency: 'VND',
  note: 'Thanh toán tại THANG 2 CAFE',
  transactionDate: '2026-10-17',
};

const receiptTransaction: ApiTransaction = {
  id: 9,
  wallet_id: 2,
  category_id: 3,
  amount: -79000,
  currency: 'VND',
  type: 'EXPENSE',
  note: 'Tháng 2 Cafe',
  receipt_image: 'receipt.jpg',
  receipt_items: [{ name: 'Bạc xỉu', amount: 94000 }],
  transaction_date: '2026-10-17T12:00:00.000Z',
};

describe('evidenceMatcher', () => {
  it('matches bank evidence with a same-day receipt transaction', () => {
    const result = findBestEvidenceMatch(
      parsed,
      new Date('2026-10-17T13:00:00.000Z').getTime(),
      [receiptTransaction],
    );

    expect(result?.transaction.id).toBe(9);
    expect(result?.score).toBeGreaterThanOrEqual(90);
    expect(result?.reasons).toContain('Trùng số tiền và loại giao dịch');
  });

  it('does not match a different amount or a transaction without receipt evidence', () => {
    expect(
      findBestEvidenceMatch(parsed, Date.now(), [
        { ...receiptTransaction, amount: -99000 },
        {
          ...receiptTransaction,
          id: 10,
          receipt_image: null,
          receipt_items: null,
        },
      ]),
    ).toBeNull();
  });

  it('appends bank evidence only once', () => {
    const merged = mergeBankEvidenceNote(
      'Tháng 2 Cafe',
      'Thanh toán tại THANG 2 CAFE',
    );
    expect(merged).toContain('Ngân hàng:');
    expect(mergeBankEvidenceNote(merged, parsed.note)).toBe(merged);
  });
});
