import AsyncStorage from '@react-native-async-storage/async-storage';
import { bankAiConsent } from '../src/services/bankAiConsent';
beforeEach(async () => {
  await bankAiConsent.reset(71);
  await bankAiConsent.reset(72);
});
it('defaults to no AI consent and isolates accounts', async () => {
  expect(await bankAiConsent.has(71)).toBe(false);
  await bankAiConsent.allow(71);
  expect(await bankAiConsent.has(71)).toBe(true);
  expect(await bankAiConsent.has(72)).toBe(false);
});
it('can revoke consent without storing notification contents', async () => {
  await bankAiConsent.allow(71);
  await bankAiConsent.reset(71);
  expect(await bankAiConsent.has(71)).toBe(false);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    '@nova/bank-ai-consent/v1/71',
    'allowed',
  );
});
it('fails closed when storage cannot be read', async () => {
  (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
    new Error('storage unavailable'),
  );
  expect(await bankAiConsent.has(71)).toBe(false);
});
