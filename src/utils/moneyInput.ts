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
