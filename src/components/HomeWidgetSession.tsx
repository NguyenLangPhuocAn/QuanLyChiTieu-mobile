import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getApiStorageBaseUrl } from '../services/api';
import { homeWidget } from '../native/homeWidget';
import { dashboardCache } from '../services/dashboardCache';
import { categoriesService } from '../services/categories';
import { offlineTransactionQueue } from '../services/offlineTransactionQueue';
import { offlineCategoryQueue } from '../services/offlineCategoryQueue';
import { offlineWalletQueue } from '../services/offlineWalletQueue';
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
      const [cached, drafts, categoryChanges, resolvedIds, walletChanges] =
        await Promise.all([
          dashboardCache.read(userId),
          offlineTransactionQueue.list(userId),
          offlineCategoryQueue.list(userId),
          offlineCategoryQueue.resolvedIds(userId),
          offlineWalletQueue.list(userId),
        ]);
      const selectedMappedIds: number[] = [];
      for (const [fromId, toId] of Object.entries(resolvedIds)) {
        if (!active || rev !== version) return;
        if (await homeWidget.remapCategory(scope, Number(fromId), toId))
          selectedMappedIds.push(toId);
      }
      let data = cached;
      const missingResolvedCategory = selectedMappedIds.some(
        id => !data?.categories.some(category => category.id === id),
      );
      if (
        data &&
        ((data.wallets.length > 0 && !data.categories.length) ||
          missingResolvedCategory) &&
        token &&
        !attemptedCategoryRefresh
      ) {
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
          buildWidgetSnapshot(
            data
              ? {
                  ...data,
                  wallets: offlineWalletQueue
                    .apply(data.wallets, walletChanges)
                    .filter(item => item.id > 0),
                  categories: offlineCategoryQueue.apply(
                    data.categories,
                    categoryChanges,
                  ),
                }
              : null,
            currency,
            drafts.length,
          ),
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
    const d = offlineCategoryQueue.subscribe(refresh);
    const e = offlineWalletQueue.subscribe(refresh);
    return () => {
      active = false;
      version++;
      sub.remove();
      a();
      b();
      c();
      d();
      e();
    };
  }, [
    userId,
    token,
    currency,
    server,
    isRestoringSession,
    sessionRestoreError,
  ]);
  return null;
}
