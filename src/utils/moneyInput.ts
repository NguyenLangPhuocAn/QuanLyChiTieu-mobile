/** Accept a decimal comma or dot, without guessing pasted thousands separators. */
export const parseNonNegativeMoneyInput = (value: string): string | null => {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? normalized : null;
};

export const parsePositiveMoneyInput = (value: string): string | null => {
  const normalized = parseNonNegativeMoneyInput(value);
  return normalized !== null && Number(normalized) > 0 ? normalized : null;
};

/** Keep a VND input as whole-number digits so it can be safely parsed later. */
export const normalizeVndMoneyInput = (value: string): string => {
  const trimmed = value.trim();
  const apiDecimal = /^(\d+)\.0{1,2}$/.exec(trimmed);
  const digits = apiDecimal ? apiDecimal[1] : trimmed.replace(/\D/g, '');
  return digits.replace(/^0+(?=\d)/, '');
};

/** Display whole-number VND input with Vietnamese thousands separators. */
export const formatVndMoneyInput = (value: string): string => {
  const digits = normalizeVndMoneyInput(value);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const isVndCurrency = (currency?: string | null): boolean =>
  currency?.trim().toUpperCase() === 'VND';

/** Format only VND as whole-number groups; keep decimal input for other currencies. */
export const formatMoneyInputForCurrency = (
  value: string,
  currency?: string | null,
): string => (isVndCurrency(currency) ? formatVndMoneyInput(value) : value);

/** Keep component state parseable while the VND input is displayed with separators. */
export const normalizeMoneyInputForCurrency = (
  value: string,
  currency?: string | null,
): string => (isVndCurrency(currency) ? normalizeVndMoneyInput(value) : value);

/** Undefined means no balance edit; null means invalid input. */
export const getWalletBalanceChange = (
  input: string,
  current?: number,
): string | null | undefined => {
  const normalized = input.trim().replace(',', '.');
  if (
    current !== undefined &&
    /^-?\d+(?:\.\d{1,2})?$/.test(normalized) &&
    Number(normalized) === current
  )
    return undefined;
  return parseNonNegativeMoneyInput(
    current === undefined && !normalized ? '0' : normalized,
  );
};
