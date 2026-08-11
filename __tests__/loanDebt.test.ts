import {
  buildLoanDebtUpdatePayload,
  calculateLoanDebtProgress,
  calculateRemainingAfterPayment,
  formatLoanDebtAmountInput,
  formatLoanDebtPaymentDate,
  getFullSettlementAmount,
  getLoanDebtActionLabel,
  getLoanDebtPrincipalLabel,
  getLoanDebtStatusLabel,
  getLoanDebtTypeLabel,
  validateLoanDebtPayment,
} from '../src/utils/loanDebt';

describe('loan debt helpers', () => {
  it('uses repayment and recovery labels for each ledger type', () => {
    expect(getLoanDebtActionLabel('BORROWED')).toBe('Trả nợ');
    expect(getLoanDebtActionLabel('LENT')).toBe('Thu hồi nợ');
  });

  it('maps ledger statuses to Vietnamese labels', () => {
    expect(getLoanDebtStatusLabel('OPEN')).toBe('Đang mở');
    expect(getLoanDebtStatusLabel('OVERDUE')).toBe('Quá hạn');
    expect(getLoanDebtStatusLabel('PAID')).toBe('Đã thanh toán');
  });

  it('labels the original principal without implying a comparison', () => {
    expect(getLoanDebtPrincipalLabel('BORROWED')).toBe('Tổng tiền vay');
    expect(getLoanDebtPrincipalLabel('LENT')).toBe('Tổng tiền cho vay');
  });

  it('uses concise loan/debt type labels', () => {
    expect(getLoanDebtTypeLabel('BORROWED')).toBe('Vay');
    expect(getLoanDebtTypeLabel('LENT')).toBe('Cho vay');
  });

  it('rejects empty, zero, and excessive partial payments', () => {
    expect(validateLoanDebtPayment('', 100000)).toBeTruthy();
    expect(validateLoanDebtPayment('0', 100000)).toBeTruthy();
    expect(validateLoanDebtPayment('100001', 100000)).toBeTruthy();
    expect(validateLoanDebtPayment('50000', 100000)).toBeNull();
  });

  it('does not resend locked opening fields after a partial payment', () => {
    expect(
      buildLoanDebtUpdatePayload(
        {
          person_name: 'Nguyen Van A',
          principal_amount: '100000',
          wallet_id: 10,
          due_date: '2026-07-01',
          note: 'Gia han',
        },
        true,
      ),
    ).toEqual({
      person_name: 'Nguyen Van A',
      due_date: '2026-07-01',
      note: 'Gia han',
    });
  });

  it('clamps gradual settlement progress between zero and one hundred', () => {
    expect(calculateLoanDebtProgress(300000, 1000000)).toBe(30);
    expect(calculateLoanDebtProgress(1200000, 1000000)).toBe(100);
    expect(calculateLoanDebtProgress(-1, 1000000)).toBe(0);
    expect(calculateLoanDebtProgress(100, 0)).toBe(0);
  });

  it('formats payment input while preserving its numeric value', () => {
    expect(formatLoanDebtAmountInput('1000000')).toBe('1.000.000');
    expect(formatLoanDebtAmountInput('1.000.000 đ')).toBe('1.000.000');
    expect(formatLoanDebtAmountInput('')).toBe('');
  });

  it('previews the remaining balance after a partial payment', () => {
    expect(calculateRemainingAfterPayment('250000', 1000000)).toBe(750000);
    expect(calculateRemainingAfterPayment('1200000', 1000000)).toBe(0);
    expect(calculateRemainingAfterPayment('', 1000000)).toBe(1000000);
  });

  it('fills the exact outstanding amount for full settlement', () => {
    expect(getFullSettlementAmount(2500000)).toBe('2.500.000');
    expect(getFullSettlementAmount(0)).toBe('');
  });

  it('keeps the selected local calendar date when submitting', () => {
    expect(formatLoanDebtPaymentDate(new Date(2026, 5, 13))).toBe(
      '2026-06-13',
    );
  });
});
