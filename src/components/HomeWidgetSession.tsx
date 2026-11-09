import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getApiStorageBaseUrl } from '../services/api';
import { homeWidget } from '../native/homeWidget';
import { dashboardCache } from '../services/dashboardCache';
import { categoriesService } from '../services/categories';
import { offlineTransactionQueue } from '../services/offlineTransactionQueue';
import { financeRefresh } from '../services/financeRefresh';
import { buildWidgetSnapshot, widgetScope } from '../services/widgetSnapshot';
export default function HomeWidgetSession() {
  const { user, token, isRestoringSession, sessionRestoreError } = useAuth();
  const userId = user?.id;
  const currency = user?.currency_default ?? 'VND';
  const server = getApiStorageBaseUrl();
  useEffect(() => {
    if (isRestoringSession || (!userId && sessionRestoreError)) return;
    let active = true,
      version = 0;
    let attemptedCategoryRefresh = false;
    const scope = userId ? widgetScope({ userId, server }) : null;
    const update = async () => {
      const rev = ++version;
      await homeWidget.activate(scope);
      if (!userId || !scope) return;
      const [cached, drafts] = await Promise.all([
        dashboardCache.read(userId),
        offlineTransactionQueue.list(userId),
      ]);
      let data = cached;
      if (data && data.wallets.length && !data.categories.length && token && !attemptedCategoryRefresh) {
        attemptedCategoryRefresh = true;
        try {
          const categories = await categoriesService.getAll(token);
          if (active && rev === version && categories.length) {
            data = await dashboardCache.save(userId, { ...data, categories });
          }
        } catch {
          // Retry when the app returns to the foreground after connectivity changes.
          attemptedCategoryRefresh = false;
        }
      }
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
      if (state === 'active') {
        attemptedCategoryRefresh = false;
        refresh();
      }
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
  }, [userId, token, currency, server, isRestoringSession, sessionRestoreError]);
  return null;
}
