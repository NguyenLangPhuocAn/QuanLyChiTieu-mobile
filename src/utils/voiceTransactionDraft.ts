import type { ChatTransactionDraft } from '../types/chatbot';
import { toDateKey } from './budgetPeriod';

const normalize = (value: string) =>
  value
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();

const digits: Record<string, number> = {
  khong: 0,
  mot: 1,
  hai: 2,
  ba: 3,
  bon: 4,
  tu: 4,
  nam: 5,
  lam: 5,
  sau: 6,
  bay: 7,
  tam: 8,
  chin: 9,
};
const scales: Record<string, number> = {
  nghin: 1000,
  ngan: 1000,
  k: 1000,
  trieu: 1_000_000,
  tr: 1_000_000,
  ty: 1_000_000_000,
};
const numberWords = Object.keys(digits).concat(['muoi', 'tram', 'linh', 'le']);
const numericToken = '(?:\\d+(?:[.,]\\d+)*|' + numberWords.join('|') + ')';
const numberPattern = new RegExp(
  `(?:^|\\s)(${numericToken}(?:\\s+${numericToken})*(?:\\s*(?:nghin|ngan|trieu|ty|tr|k)\\b(?:\\s+ruoi\\b)?(?:\\s+${numericToken}(?:\\s+${numericToken})*\\s*(?:nghin|ngan|trieu|ty|tr|k)\\b)*)?)(?=\\s|$)`,
  'g',
);

const readNumber = (value: string): number | null => {
  const tokens = value.trim().split(/\s+/);
  let total = 0;
  let group = 0;
  let part = 0;
  let previousScale = 0;
  let previousWasDigit = false;
  for (const token of tokens) {
    if (/^\d/.test(token)) {
      const normalized = /^\d{1,3}(?:[.,]\d{3})+$/.test(token)
        ? token.replace(/[.,]/g, '')
        : token.replace(',', '.');
      const numeric = Number(normalized);
      if (!Number.isFinite(numeric) || group !== 0 || part !== 0) return null;
      part = numeric;
    } else if (token in digits) {
      if (previousWasDigit) return null;
      part += digits[token];
    } else if (token === 'muoi') {
      group += (part || 1) * 10;
      part = 0;
    } else if (token === 'tram') {
      group += (part || 1) * 100;
      part = 0;
    } else if (token in scales) {
      const scale = scales[token];
      if (previousScale && scale >= previousScale) return null;
      total += (group + part) * scale;
      group = 0;
      part = 0;
      previousScale = scale;
    } else if (token === 'ruoi') {
      if (!previousScale) return null;
      total += previousScale / 2;
    } else if (part) {
      return null;
    }
    previousWasDigit = token in digits || /^\d/.test(token);
  }
  if (previousScale && (group || part)) return null;
  return total + group + part;
};

export type VoiceTransactionPreview = {
  draft: ChatTransactionDraft | null;
  issues: string[];
};

/** Local extraction only. A preview never writes transactions or chooses a wallet. */
export const parseVoiceTransactionDraft = (
  transcript: string,
  now = new Date(),
): VoiceTransactionPreview => {
  const text = normalize(transcript.replace(/đô(?=\s|$)/gi, 'USD')).replace(
    /(\d)(k|tr)\b/g,
    '$1 $2',
  );
  const issues: string[] = [];
  if (!text)
    return { draft: null, issues: ['Nói hoặc nhập một khoản thu hay chi.'] };

  const income = /\b(thu|nhan|luong|hoan tien|tien vao)\b/.test(text);
  const expense = /\b(chi|mua|tra|thanh toan|tien ra)\b/.test(text);
  if (income === expense) {
    issues.push('Nêu rõ một khoản thu hoặc chi trong mỗi lần nhập.');
  }
  if (/\b(vay|no|chuyen vi)\b/.test(text)) {
    issues.push(
      'Khoản vay, trả nợ hoặc chuyển ví cần nhập bằng form tương ứng.',
    );
  }
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const explicitDate = text.match(
    /\b(?:ngay\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?\b/,
  );
  let amountText = text;
  if (explicitDate) {
    const day = Number(explicitDate[1]);
    const month = Number(explicitDate[2]);
    const year = Number(explicitDate[3] ?? now.getFullYear());
    date.setFullYear(year, month - 1, day);
    if (
      date.getDate() !== day ||
      date.getMonth() !== month - 1 ||
      date.getFullYear() !== year
    ) {
      issues.push('Ngày chưa hợp lệ. Sửa ngày theo dạng ngày/tháng/năm.');
    }
    amountText = text.replace(explicitDate[0], ' ');
  } else if (/\bhom qua\b/.test(text)) {
    date.setDate(date.getDate() - 1);
  } else if (
    /\b(hom kia|ngay mai|ngay kia|tuan|thang truoc|ngay\s+\d)\b/.test(text)
  ) {
    issues.push(
      'Nêu ngày cụ thể theo dạng ngày/tháng/năm, hôm nay hoặc hôm qua.',
    );
  }

  const amounts = Array.from(amountText.matchAll(numberPattern))
    // A currency unit or magnitude is required: dates, quantity and account IDs are not money.
    .filter(
      match =>
        /\b(nghin|ngan|trieu|ty|tr|k|ruoi)\b/.test(match[1]) ||
        /^\s*(?:(dong|vnd|d|usd)\b|\$|₫)/.test(
          amountText.slice(match.index! + match[0].length),
        ),
    )
    .map(match => readNumber(match[1]));
  const amount = amounts.length === 1 ? amounts[0] : null;
  if (!amount || !Number.isSafeInteger(amount) || amount <= 0) {
    issues.push(
      amounts.length > 1
        ? 'Có nhiều số tiền. Chỉ giữ một giao dịch trong mỗi lần nhập.'
        : 'Chưa rõ số tiền. Ví dụ: 79 nghìn, một triệu rưỡi hoặc 79000 đồng.',
    );
  }
  const currencies = [
    /\b(dong|vnd)\b|₫/.test(text) ? 'VND' : null,
    /\busd\b|\$/.test(text) ? 'USD' : null,
  ].filter(Boolean);
  if (currencies.length > 1 || /\b(eur|euro|yen|jpy)\b/.test(text)) {
    issues.push('Hãy nhập riêng một loại tiền được hỗ trợ: VND hoặc USD.');
  }
  return {
    issues,
    draft: issues.length
      ? null
      : {
          type: income ? 'INCOME' : 'EXPENSE',
          amount,
          currency: currencies[0] ?? 'VND',
          note: transcript.trim(),
          transaction_date: toDateKey(date),
          category_name: null,
          wallet_name: null,
        },
  };
};
