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

export const formatDisplayDate = (value: string) => {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
};
