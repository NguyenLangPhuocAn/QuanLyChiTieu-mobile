import type {
  BankNotificationEvent,
  ParsedBankNotification,
} from '../types/bankNotification';

type AmountCandidate = {
  amount: number;
  currency: string;
  score: number;
};

const transactionTerms = [
  'giao dịch',
  'giao dich',
  'số tiền',
  'so tien',
  'biến động',
  'bien dong',
  'amount',
];
const balanceTerms = ['số dư', 'so du', 'balance', 'khả dụng', 'kha dung'];
const incomeTerms = [
  'nhận tiền',
  'nhan tien',
  'tiền vào',
  'tien vao',
  'ghi có',
  'ghi co',
  'credit',
  'được cộng',
  'duoc cong',
  'nhận được',
  'nhan duoc',
];
const expenseTerms = [
  'thanh toán',
  'thanh toan',
  'tiền ra',
  'tien ra',
  'ghi nợ',
  'ghi no',
  'debit',
  'bị trừ',
  'bi tru',
  'chi tiêu',
  'chi tieu',
  'chuyển tiền',
  'chuyen tien',
];
const ignoredTerms = [
  'mã otp',
  'ma otp',
  'mã xác thực',
  'ma xac thuc',
  'verification code',
  'khuyến mãi',
  'khuyen mai',
  'ưu đãi',
  'uu dai',
];

const amountPattern =
  /([+-]?\s*\d[\d.,\s]{0,18})\s*(vnd|vnđ|đ|₫|usd)(?=\s|$|[).,;])|\b(vnd|vnđ|₫|usd)\s*([+-]?\s*\d[\d.,\s]{0,18})/giu;

const parseNumericAmount = (raw: string, currency: string) => {
  const compact = raw.replace(/\s/g, '').replace(/^\+/, '');
  const unsigned = compact.replace(/^-/, '');
  if (!unsigned) return null;

  if (currency === 'VND') {
    const digits = unsigned.replace(/[.,]/g, '');
    return /^\d+$/.test(digits) ? Number(digits) : null;
  }

  const lastComma = unsigned.lastIndexOf(',');
  const lastDot = unsigned.lastIndexOf('.');
  const decimalSeparator = Math.max(lastComma, lastDot);
  const normalized =
    decimalSeparator >= 0 && unsigned.length - decimalSeparator <= 3
      ? `${unsigned.slice(0, decimalSeparator).replace(/[.,]/g, '')}.${unsigned.slice(decimalSeparator + 1)}`
      : unsigned.replace(/[.,]/g, '');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
};

const findDirection = (content: string) => {
  const incomeScore = incomeTerms.filter(term => content.includes(term)).length;
  const expenseScore = expenseTerms.filter(term => content.includes(term)).length;
  if (incomeScore > expenseScore) return 'INCOME' as const;
  if (expenseScore > incomeScore) return 'EXPENSE' as const;
  if (/\+\s*\d/.test(content)) return 'INCOME' as const;
  if (/-\s*\d/.test(content)) return 'EXPENSE' as const;
  return undefined;
};

const findAmounts = (content: string, type?: 'INCOME' | 'EXPENSE') => {
  const candidates: AmountCandidate[] = [];
  for (const match of content.matchAll(amountPattern)) {
    const rawAmount = match[1] ?? match[4] ?? '';
    const rawCurrency = match[2] ?? match[3] ?? '';
    const currency = rawCurrency.toLowerCase() === 'usd' ? 'USD' : 'VND';
    const amount = parseNumericAmount(rawAmount, currency);
    if (!amount || amount <= 0) continue;

    const start = match.index ?? 0;
    const nearby = content.slice(Math.max(0, start - 35), start + match[0].length + 20);
    const balanceContext = content.slice(
      Math.max(0, start - 14),
      start + match[0].length + 8,
    );
    let score = transactionTerms.some(term => nearby.includes(term)) ? 4 : 0;
    if (balanceTerms.some(term => balanceContext.includes(term))) score -= 6;
    if (type === 'INCOME' && rawAmount.trim().startsWith('+')) score += 3;
    if (type === 'EXPENSE' && rawAmount.trim().startsWith('-')) score += 3;
    candidates.push({ amount, currency, score });
  }
  return candidates.sort((left, right) => right.score - left.score);
};

const maskSensitiveNumbers = (value: string) =>
  value
    .replace(/\b\d{8,19}\b/g, number => `***${number.slice(-4)}`)
    .replace(/\s+/g, ' ')
    .trim();

export const parseBankNotification = (
  event: BankNotificationEvent,
): ParsedBankNotification => {
  const originalContent = `${event.title} ${event.text}`.trim();
  const content = originalContent.toLowerCase();
  const eventDate = new Date(event.postedAt);
  const transactionDate = [
    eventDate.getFullYear(),
    String(eventDate.getMonth() + 1).padStart(2, '0'),
    String(eventDate.getDate()).padStart(2, '0'),
  ].join('-');
  const noteContent = maskSensitiveNumbers(originalContent).slice(0, 180);
  const note = `Từ ${event.appName}${noteContent ? `: ${noteContent}` : ''}`;

  if (ignoredTerms.some(term => content.includes(term))) {
    return {
      status: 'IGNORED',
      transactionDate,
      note,
      reason: 'Thông báo xác thực hoặc quảng cáo không phải giao dịch.',
    };
  }

  const type = findDirection(content);
  const amounts = findAmounts(content, type);
  if (!type) {
    return {
      status: 'REVIEW',
      transactionDate,
      note,
      reason: 'Chưa xác định được đây là khoản thu hay chi.',
    };
  }
  if (!amounts.length) {
    return {
      status: 'REVIEW',
      type,
      transactionDate,
      note,
      reason: 'Chưa đọc được số tiền giao dịch.',
    };
  }

  const best = amounts[0];
  const equallyLikely = amounts.find(
    (candidate, index) =>
      index > 0 &&
      best.score - candidate.score < 3 &&
      (candidate.amount !== best.amount || candidate.currency !== best.currency),
  );
  if (equallyLikely) {
    return {
      status: 'REVIEW',
      type,
      transactionDate,
      note,
      reason: 'Thông báo có nhiều số tiền, cần chọn số tiền giao dịch.',
    };
  }

  return {
    status: 'READY',
    type,
    amount: String(best.amount),
    currency: best.currency,
    transactionDate,
    note,
  };
};
