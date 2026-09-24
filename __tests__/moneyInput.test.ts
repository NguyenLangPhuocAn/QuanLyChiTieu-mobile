import {
  parsePositiveMoneyInput,
  getWalletBalanceChange,
} from '../src/utils/moneyInput';

it('does not request a balance adjustment when only renaming a wallet, including a negative wallet', () => {
  expect(getWalletBalanceChange('-12.50', -12.5)).toBeUndefined();
  expect(getWalletBalanceChange('12,50', 12.5)).toBeUndefined();
  expect(getWalletBalanceChange('', 12.5)).toBeNull();
  expect(getWalletBalanceChange('13,25', 12.5)).toBe('13.25');
  expect(getWalletBalanceChange('0', 12.5)).toBe('0');
  expect(getWalletBalanceChange('')).toBe('0');
});

it.each([
  ['12.50', '12.50'],
  ['12,50', '12.50'],
  [' 1250 ', '1250'],
  ['0.05', '0.05'],
])('preserves the monetary value of %s', (input, expected) => {
  expect(parsePositiveMoneyInput(input)).toBe(expected);
});
it.each([
  '1,250.50',
  '1.250,50',
  '1,000',
  '12.345',
  '0',
  '-5',
  'Infinity',
  '',
  '12abc',
])('rejects invalid or ambiguous money %s', input => {
  expect(parsePositiveMoneyInput(input)).toBeNull();
});
