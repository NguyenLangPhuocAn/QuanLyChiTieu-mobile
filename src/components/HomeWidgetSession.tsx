import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../services/api';
import { homeWidget } from '../native/homeWidget';
import { dashboardCache } from '../services/dashboardCache';
import { offlineTransactionQueue } from '../services/offlineTransactionQueue';
import { financeRefresh } from '../services/financeRefresh';
import { buildWidgetSnapshot, widgetScope } from '../services/widgetSnapshot';
export default function HomeWidgetSession() {
  const { user, isRestoringSession, sessionRestoreError } = useAuth();
  const userId = user?.id;
  const currency = user?.currency_default ?? 'VND';
  const server = getApiBaseUrl();
  useEffect(() => {
    if (isRestoringSession || (!userId && sessionRestoreError)) return;
    let active = true,
      version = 0;
    const scope = userId ? widgetScope({ userId, server }) : null;
    const update = async () => {
      const rev = ++version;
      await homeWidget.activate(scope);
      if (!userId || !scope) return;
      const [data, drafts] = await Promise.all([
        dashboardCache.read(userId),
        offlineTransactionQueue.list(userId),
      ]);
      if (active && rev === version)
        await homeWidget.update(
          scope,
          buildWidgetSnapshot(data, currency, drafts.length),
        );
    };
    const refresh = () => {
      update().catch(() => undefined);
    };
    refresh();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    const a = financeRefresh.subscribe(refresh),
      b = offlineTransactionQueue.subscribe(refresh);
    const c = dashboardCache.subscribe(refresh);
    return () => {
      active = false;
      version++;
      sub.remove();
      a();
      b();
      c();
    };
  }, [userId, currency, server, isRestoringSession, sessionRestoreError]);
  return null;
}
