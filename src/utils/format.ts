export const formatCurrency = (value: number, currency = 'VND') => {
  const locale = currency === 'VND' ? 'vi-VN' : 'en-US';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatCompactCurrency = (value: number, currency = 'VND') => {
  const locale = currency === 'VND' ? 'vi-VN' : 'en-US';
  const compactValue = new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

  return currency === 'VND' ? compactValue : `${compactValue} ${currency}`;
};

const parseDateValue = (value: string) => {
  const dateOnly = value.slice(0, 10);
  const [year, month, day] = dateOnly.split('-').map(Number);

  if (year && month && day) {
    return new Date(year, month - 1, day);
  }

  return new Date(value);
};

export const formatShortDate = (value: string) => {
  const date = parseDateValue(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

export const formatDisplayDate = (value: string) => {
  const date = parseDateValue(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};
