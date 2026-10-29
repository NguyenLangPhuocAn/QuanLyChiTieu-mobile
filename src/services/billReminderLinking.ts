import { Linking } from 'react-native';
import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { BillScope } from './recurringBills';
import { billReminder } from '../native/billReminder';
import { widgetLink } from './widgetLinking';

export const createBillReminderLinking = (
  scope: BillScope,
): LinkingOptions<RootStackParamList> => ({
  prefixes: ['quanlychitieu://'],
  config: {
    initialRouteName: 'Main',
    screens: { Main: 'home', RecurringBills: 'bills' },
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    const quick = url ? widgetLink(scope, url) : null;
    if (quick) return quick;
    return url && billReminder.isSupported
      ? billReminder.validatedLink(scope, url).catch(() => null)
      : null;
  },
  subscribe(listener) {
    let active = true;
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const quick = widgetLink(scope, url);
      if (quick) {
        if (active) listener(quick);
        return;
      }
      if (!billReminder.isSupported) return;
      billReminder
        .validatedLink(scope, url)
        .then(target => {
          if (active && target) listener(target);
        })
        .catch(() => undefined);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  },
});
