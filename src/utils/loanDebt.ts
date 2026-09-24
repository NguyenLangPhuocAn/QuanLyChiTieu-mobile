import type {
  LoanDebtStatus,
  LoanDebtType,
  UpdateLoanDebtPayload,
} from '../types/loanDebt';
import { parsePositiveMoneyInput } from './moneyInput';

const numericLoanDebtAmount = (value: string) =>
  Number(parsePositiveMoneyInput(value)) || 0;

export const calculateLoanDebtProgress = (
  settledAmount: number,
  principalAmount: number,
) => {
  if (principalAmount <= 0) return 0;
  return Math.min(
    100,
    Math.max(0, Math.round((settledAmount / principalAmount) * 100)),
  );
};

export const calculateRemainingAfterPayment = (
  paymentInput: string,
  remainingAmount: number,
) =>
  Math.max(
    0,
    Math.round((remainingAmount - numericLoanDebtAmount(paymentInput)) * 100) /
      100,
  );

export const getFullSettlementAmount = (remainingAmount: number) =>
  remainingAmount > 0 ? String(remainingAmount) : '';

export const formatLoanDebtPaymentDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const buildLoanDebtUpdatePayload = (
  payload: UpdateLoanDebtPayload,
  openingLocked: boolean,
): UpdateLoanDebtPayload => {
  if (!openingLocked) return payload;
  const editable = { ...payload };
  delete editable.principal_amount;
  delete editable.wallet_id;
  return editable;
};

export const getLoanDebtActionLabel = (type: LoanDebtType) =>
  type === 'BORROWED' ? 'Trả nợ' : 'Thu hồi nợ';

export const getLoanDebtTypeLabel = (type: LoanDebtType) =>
  type === 'BORROWED' ? 'Vay' : 'Cho vay';

export const getLoanDebtPrincipalLabel = (type: LoanDebtType) =>
  type === 'BORROWED' ? 'Tổng tiền vay' : 'Tổng tiền cho vay';

export const getLoanDebtStatusLabel = (status: LoanDebtStatus) => {
  if (status === 'PAID') return 'Đã thanh toán';
  if (status === 'OVERDUE') return 'Quá hạn';
  return 'Đang mở';
};

export const validateLoanDebtPayment = (
  value: string,
  remainingAmount: number,
) => {
  const amount = numericLoanDebtAmount(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Nhập số tiền lớn hơn 0, tối đa 2 số thập phân (ví dụ 12,50), không dùng dấu phân cách hàng nghìn.';
  }
  if (amount > remainingAmount) {
    return 'Số tiền vượt quá khoản còn lại.';
  }
  return null;
};

export const getLoanDebtErrorMessage = (
  error: unknown,
  fallback = 'Chưa xử lý được khoản vay/nợ. Vui lòng thử lại sau.',
) => {
  const raw = error instanceof Error ? error.message : '';
  const message = raw.trim();

  if (!message) {
    return fallback;
  }

  if (/phiên đăng nhập|đăng nhập lại/i.test(message)) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }

  if (/kết nối|mạng|hệ thống đang gặp|thử lại sau/i.test(message)) {
    return message;
  }

  if (/số tiền vượt|vượt quá khoản còn lại/i.test(message)) {
    return 'Số tiền nhập vượt quá khoản còn lại.';
  }

  if (/đã được thanh toán|đã thanh toán/i.test(message)) {
    return 'Khoản này đã được thanh toán xong.';
  }

  if (/cùng tiền tệ|tiền tệ/i.test(message)) {
    return 'Vui lòng chọn ví có cùng loại tiền với khoản vay/nợ.';
  }

  if (/không tìm thấy|not found/i.test(message)) {
    return 'Không tìm thấy khoản vay/nợ này. Dữ liệu có thể đã được thay đổi.';
  }

  if (/ngày|date/i.test(message)) {
    return 'Ngày chưa hợp lệ. Vui lòng chọn lại ngày.';
  }

  if (/số tiền|amount|principal|payment|decimal|number/i.test(message)) {
    return 'Số tiền chưa hợp lệ. Vui lòng nhập số tiền lớn hơn 0.';
  }

  if (/wallet|ví/i.test(message)) {
    return 'Vui lòng chọn ví hợp lệ.';
  }

  if (
    /type|enum|int|string|matches|validation|constraint|input|property|must be|should not|undefined|null|request|token|jwt|401|403|500|prisma|sql|database/i.test(
      message,
    )
  ) {
    return 'Thông tin khoản vay/nợ chưa hợp lệ. Vui lòng kiểm tra lại tên người, số tiền, ví và ngày hẹn trả.';
  }

  return message;
};
