import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (userId: number) => `@nova/bank-ai-consent/v1/${userId}`;
/** Consent is per account, opt-in, revocable; no notification content is persisted here. */
export const bankAiConsent = {
  async has(userId: number) {
    try {
      return (await AsyncStorage.getItem(key(userId))) === 'allowed';
    } catch {
      return false;
    }
  },
  async allow(userId: number) {
    await AsyncStorage.setItem(key(userId), 'allowed');
  },
  async reset(userId: number) {
    await AsyncStorage.removeItem(key(userId));
  },
};
