import type { Category } from '../types/category';
import type { Wallet } from '../types/wallet';

export type NaturalTransactionFilters = {
  q?: string;
  type?: 'INCOME' | 'EXPENSE';
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
  walletId?: number;
  categoryId?: number;
  understood: string[];
  remainder: string;
};

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLocaleLowerCase('vi')
    .replace(/\s+/g, ' ')
    .trim();

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

const startOfWeek = (date: Date) => {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = value.getDay();
  value.setDate(value.getDate() + (day === 0 ? -6 : 1 - day));
  return value;
};

const parseAmount = (raw: string, unit?: string) => {
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  const multiplier = /trieu|\btr\b/.test(unit ?? '')
    ? 1_000_000
    : /nghin|ngan|\bk\b/.test(unit ?? '')
    ? 1_000
    : 1;
  return Math.round(number * multiplier);
};

const findNamedEntity = <T extends { id: number; name: string }>(
  text: string,
  items: T[],
) =>
  [...items]
    .sort((left, right) => right.name.length - left.name.length)
    .find(item => text.includes(normalize(item.name)));

export const parseNaturalTransactionSearch = (
  input: string,
  options: {
    wallets?: Wallet[];
    categories?: Category[];
    now?: Date;
  } = {},
): NaturalTransactionFilters => {
  const now = options.now ?? new Date();
  let text = normalize(input);
  const understood: string[] = [];
  const result: NaturalTransactionFilters = { understood, remainder: '' };

  if (/\b(thu|nhan tien|luong|tien vao)\b/.test(text)) {
    result.type = 'INCOME';
    understood.push('Loại: tiền vào');
  } else if (/\b(chi|mua|thanh toan|tien ra)\b/.test(text)) {
    result.type = 'EXPENSE';
    understood.push('Loại: tiền ra');
  }

  const setRange = (from: Date, to: Date, label: string) => {
    result.from = toDateKey(from);
    result.to = toDateKey(to);
    understood.push(`Thời gian: ${label}`);
  };
  if (text.includes('hom nay')) {
    setRange(now, now, 'hôm nay');
  } else if (text.includes('thang truoc')) {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    setRange(from, to, 'tháng trước');
  } else if (text.includes('thang nay')) {
    setRange(
      new Date(now.getFullYear(), now.getMonth(), 1),
      new Date(now.getFullYear(), now.getMonth() + 1, 0),
      'tháng này',
    );
  } else if (text.includes('tuan nay')) {
    const from = startOfWeek(now);
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    setRange(from, to, 'tuần này');
  } else if (text.includes('nam nay')) {
    setRange(
      new Date(now.getFullYear(), 0, 1),
      new Date(now.getFullYear(), 11, 31),
      'năm nay',
    );
  }

  const rangeMatch = text.match(
    /tu\s+([\d.,]+)\s*(trieu|tr|nghin|ngan|k)?\s+(?:den|toi)\s+([\d.,]+)\s*(trieu|tr|nghin|ngan|k)?/,
  );
  if (rangeMatch) {
    const first = parseAmount(rangeMatch[1], rangeMatch[2] || rangeMatch[4]);
    const second = parseAmount(rangeMatch[3], rangeMatch[4] || rangeMatch[2]);
    if (first !== null && second !== null) {
      result.minAmount = Math.min(first, second);
      result.maxAmount = Math.max(first, second);
      understood.push(`Số tiền: ${result.minAmount}–${result.maxAmount}`);
    }
  } else {
    const minMatch = text.match(
      /(?:tren|hon|tu)\s+([\d.,]+)\s*(trieu|tr|nghin|ngan|k)?/,
    );
    const maxMatch = text.match(
      /(?:duoi|nho hon|toi da)\s+([\d.,]+)\s*(trieu|tr|nghin|ngan|k)?/,
    );
    const minAmount = minMatch
      ? parseAmount(minMatch[1], minMatch[2])
      : null;
    const maxAmount = maxMatch
      ? parseAmount(maxMatch[1], maxMatch[2])
      : null;
    if (minAmount !== null) {
      result.minAmount = minAmount;
      understood.push(`Tối thiểu: ${minAmount}`);
    }
    if (maxAmount !== null) {
      result.maxAmount = maxAmount;
      understood.push(`Tối đa: ${maxAmount}`);
    }
  }

  const wallet = findNamedEntity(text, options.wallets ?? []);
  if (wallet) {
    result.walletId = wallet.id;
    understood.push(`Ví: ${wallet.name}`);
  }
  const category = findNamedEntity(text, options.categories ?? []);
  if (category) {
    result.categoryId = category.id;
    result.type = category.type;
    understood.push(`Danh mục: ${category.name}`);
  }

  const removable = [
    /\b(thu|chi|nhan tien|tien vao|tien ra|mua|thanh toan)\b/g,
    /\b(hom nay|thang truoc|thang nay|tuan nay|nam nay)\b/g,
    /tu\s+[\d.,]+\s*(trieu|tr|nghin|ngan|k)?\s+(den|toi)\s+[\d.,]+\s*(trieu|tr|nghin|ngan|k)?/g,
    /(?:tren|hon|tu|duoi|nho hon|toi da)\s+[\d.,]+\s*(trieu|tr|nghin|ngan|k)?/g,
  ];
  removable.forEach(pattern => {
    text = text.replace(pattern, ' ');
  });
  if (wallet) text = text.replace(normalize(wallet.name), ' ');
  if (category) text = text.replace(normalize(category.name), ' ');
  result.remainder = text.replace(/\s+/g, ' ').trim();
  if (result.remainder) result.q = result.remainder;

  return result;
};
