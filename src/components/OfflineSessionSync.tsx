import { useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { homeWidget } from '../native/homeWidget';
import { offlineTransactionQueue } from '../services/offlineTransactionQueue';
import { offlineCategoryQueue } from '../services/offlineCategoryQueue';
import { offlineWalletQueue } from '../services/offlineWalletQueue';
import { walletsService } from '../services/wallets';
import { categoriesService } from '../services/categories';
import {
  offlineTransactionChanges,
  snapshotTransaction,
} from '../services/offlineTransactionChanges';
import { transactionsService } from '../services/transactions';
import { financeRefresh } from '../services/financeRefresh';
import { getApiStorageBaseUrl } from '../services/api';
import OfflineSyncReviewModal, {
  type OfflineSyncReview,
} from './OfflineSyncReviewModal';

// Retry only while a foreground session has local writes waiting for the API.
// Android connectivity events do not cover an API outage on working Wi-Fi.
const RECONNECT_RETRY_MS = 20_000;
const promptedUsers = new Set<number>();
export default function OfflineSessionSync({
  onSynced,
}: { onSynced?: () => Promise<void> } = {}) {
  const { user, token, isRestoringSession, retryRestoreSession } = useAuth();
  const server = getApiStorageBaseUrl();
  const [review, setReview] = useState<OfflineSyncReview | null>(null);
  const choiceRef = useRef<
    ((choice: 'later' | 'local' | 'server') => void) | null
  >(null);
  const latest = useRef({
    userId: user?.id,
    token,
    retryRestoreSession,
    onSynced,
  });
  latest.current = { userId: user?.id, token, retryRestoreSession, onSynced };
  useEffect(() => {
    if (!user?.id || isRestoringSession) return;
    const userId = user.id;
    let active = true,
      running = false,
      asking = false,
      reviewVisible = false,
      shownKey = '';
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const clearRetry = () => {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = undefined;
    };
    const scheduleRetry = () => {
      if (!active || asking || retryTimer || AppState.currentState !== 'active')
        return;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        attempt().catch(() => undefined);
      }, RECONNECT_RETRY_MS);
    };
    const refresh = async () => {
      await latest.current.onSynced?.();
      financeRefresh.emit();
    };
    const attempt = async () => {
      if (
        !active ||
        running ||
        asking ||
        promptedUsers.has(userId) ||
        AppState.currentState !== 'active'
      )
        return;
      running = true;
      let retryPending = false;
      try {
        const current = () =>
          active &&
          latest.current.userId === userId &&
          getApiStorageBaseUrl() === server;
        const drafts = (await offlineTransactionQueue.list(userId)).filter(
          item => item.server === server,
        );
        const changes = await offlineTransactionChanges.list(userId);
        const categories = await offlineCategoryQueue.list(userId);
        const wallets = await offlineWalletQueue.list(userId);
        if (!current()) return;
        retryPending = Boolean(
          drafts.length ||
            changes.length ||
            categories.length ||
            wallets.length,
        );
        if (offlineTransactionQueue.isSyncing(userId)) return;
        if (!(await homeWidget.connected())) return;
        if (!(await latest.current.retryRestoreSession())) return;
        if (!current() || !latest.current.token) return;
        if (
          !drafts.length &&
          !changes.length &&
          !categories.length &&
          !wallets.length
        ) {
          shownKey = '';
          clearRetry();
          if (current()) await refresh();
          return;
        }
        const expected = drafts.map(item => ({
          id: item.id,
          updatedAt: item.updatedAt,
        }));
        const expectedChanges = await offlineTransactionChanges.preview(userId);
        const expectedCategories = await offlineCategoryQueue.preview(userId);
        const expectedWallets = await offlineWalletQueue.preview(userId);
        const key = JSON.stringify([
          expected,
          expectedChanges,
          expectedCategories,
          expectedWallets,
        ]);
        if (shownKey === key || !current()) {
          retryPending = false;
          return;
        }
        const remote: OfflineSyncReview['remote'] = {};
        const remoteCategories: NonNullable<
          OfflineSyncReview['remoteCategories']
        > = {};
        const remoteWallets: NonNullable<OfflineSyncReview['remoteWallets']> =
          {};
        if (wallets.some(item => item.action !== 'CREATE')) {
          const serverWallets = await walletsService.getAll(
            latest.current.token,
          );
          for (const item of wallets)
            if (item.action !== 'CREATE')
              remoteWallets[item.id] =
                serverWallets.find(row => row.id === item.id) ?? null;
        }
        if (categories.some(item => item.action !== 'CREATE')) {
          const serverCategories = await categoriesService.getAll(
            latest.current.token,
          );
          for (const item of categories)
            if (item.action !== 'CREATE')
              remoteCategories[item.id] =
                serverCategories.find(row => row.id === item.id) ?? null;
        }
        if (changes.length) {
          for (let offset = 0; offset < changes.length; offset += 100) {
            const batch = changes.slice(offset, offset + 100);
            const response = await transactionsService.getLinkedPayments(
              latest.current.token,
              batch.map(item => item.transactionId),
            );
            for (const item of batch) {
              const row = response.data.find(
                entry => entry.id === item.transactionId,
              );
              remote[item.transactionId] = row
                ? snapshotTransaction(row)
                : null;
            }
          }
        }
        if (!current()) return;
        // A manual sync may finish while remote snapshots are being fetched.
        // Never offer a choice for a queue that has already changed or emptied.
        const latestDrafts = (
          await offlineTransactionQueue.list(userId)
        ).filter(item => item.server === server);
        const latestChanges = await offlineTransactionChanges.preview(userId);
        const latestCategories = await offlineCategoryQueue.preview(userId);
        const latestWallets = await offlineWalletQueue.preview(userId);
        if (
          !current() ||
          offlineTransactionQueue.isSyncing(userId) ||
          JSON.stringify(
            latestDrafts.map(item => ({
              id: item.id,
              updatedAt: item.updatedAt,
            })),
          ) !== JSON.stringify(expected) ||
          JSON.stringify(latestChanges) !== JSON.stringify(expectedChanges) ||
          JSON.stringify(latestCategories) !==
            JSON.stringify(expectedCategories) ||
          JSON.stringify(latestWallets) !== JSON.stringify(expectedWallets)
        )
          return;
        shownKey = key;
        asking = true;
        reviewVisible = true;
        retryPending = false;
        clearRetry();
        promptedUsers.add(userId);
        const choose = async (source: 'local' | 'cloud') => {
          let retryAfterChoice = false;
          try {
            if (!current() || !latest.current.token) return;
            if (source === 'cloud') {
              const nowChanges = await offlineTransactionChanges.preview(
                userId,
              );
              if (
                JSON.stringify(nowChanges) !== JSON.stringify(expectedChanges)
              )
                throw Error(
                  'Thay đổi trên máy đã đổi. Hãy xem lại trước khi bỏ.',
                );
              await offlineTransactionQueue.discardLocal(userId, expected);
              await offlineTransactionChanges.discard(userId, expectedChanges);
              await offlineCategoryQueue.discard(userId, expectedCategories);
              await offlineWalletQueue.discard(userId, expectedWallets);
              shownKey = '';
            } else {
              const now = (await offlineTransactionQueue.list(userId)).filter(
                item => item.server === server,
              );
              if (
                JSON.stringify(
                  now.map(item => ({ id: item.id, updatedAt: item.updatedAt })),
                ) !== JSON.stringify(expected)
              )
                throw Error(
                  'Bản trên máy đã thay đổi. Hãy xem lại trước khi đồng bộ.',
                );
              if (
                JSON.stringify(
                  await offlineTransactionChanges.preview(userId),
                ) !== JSON.stringify(expectedChanges)
              )
                throw Error(
                  'Thay đổi trên máy đã đổi. Hãy xem lại trước khi đồng bộ.',
                );
              if (
                JSON.stringify(await offlineCategoryQueue.preview(userId)) !==
                JSON.stringify(expectedCategories)
              )
                throw Error(
                  'Danh mục trên máy đã đổi. Hãy xem lại trước khi đồng bộ.',
                );
              if (
                JSON.stringify(await offlineWalletQueue.preview(userId)) !==
                JSON.stringify(expectedWallets)
              )
                throw Error(
                  'Ví trên máy đã đổi. Hãy xem lại trước khi đồng bộ.',
                );
              const rebasedWallets = await offlineWalletQueue.rebaseReviewed(
                latest.current.token,
                userId,
                expectedWallets,
                remoteWallets,
              );
              const walletResult = await offlineWalletQueue.sync(
                latest.current.token,
                userId,
                rebasedWallets,
                current,
              );
              const rebasedCategories =
                await offlineCategoryQueue.rebaseReviewed(
                  latest.current.token,
                  userId,
                  expectedCategories,
                  remoteCategories,
                );
              const categoryResult = await offlineCategoryQueue.sync(
                latest.current.token,
                userId,
                rebasedCategories,
                current,
              );
              const categoriesReady =
                !categoryResult.pending &&
                !categoryResult.needsReview &&
                !walletResult.pending &&
                !walletResult.needsReview;
              const result = categoriesReady
                ? await offlineTransactionQueue.sync(
                    latest.current.token,
                    userId,
                    current,
                    expected,
                  )
                : { synced: 0, pending: expected.length, needsReview: 0 };
              const edits =
                !categoriesReady || result.pending || result.needsReview
                  ? {
                      synced: 0,
                      pending: expectedChanges.length,
                      needsReview: 0,
                    }
                  : await offlineTransactionChanges.sync(
                      latest.current.token,
                      userId,
                      expectedChanges,
                      current,
                    );
              if (
                result.pending ||
                result.needsReview ||
                edits.pending ||
                edits.needsReview ||
                categoryResult.pending ||
                categoryResult.needsReview ||
                walletResult.pending ||
                walletResult.needsReview
              ) {
                shownKey = '';
                retryAfterChoice = Boolean(
                  result.pending ||
                    edits.pending ||
                    categoryResult.pending ||
                    walletResult.pending,
                );
                Alert.alert(
                  'Còn dữ liệu cần kiểm tra',
                  `${
                    result.pending +
                    edits.pending +
                    categoryResult.pending +
                    walletResult.pending
                  } đang chờ · ${
                    result.needsReview +
                    edits.needsReview +
                    categoryResult.needsReview +
                    walletResult.needsReview
                  } cần xem lại.`,
                );
              } else {
                shownKey = '';
                const savedCount =
                  result.synced +
                  edits.synced +
                  categoryResult.synced +
                  walletResult.synced;
                if (savedCount > 0 && current())
                  Alert.alert(
                    'Đã sao lưu dữ liệu thành công',
                    `${savedCount} thay đổi đã được lưu lên máy chủ.`,
                  );
              }
            }
            if (current()) await refresh();
          } catch (error) {
            shownKey = '';
            retryAfterChoice = source === 'local';
            Alert.alert(
              'Chưa hoàn tất',
              error instanceof Error
                ? error.message
                : 'Dữ liệu trên máy vẫn được giữ nguyên.',
            );
          } finally {
            asking = false;
            promptedUsers.delete(userId);
            choiceRef.current = null;
            if (retryAfterChoice && current()) scheduleRetry();
          }
        };
        choiceRef.current = choice => {
          if (choice === 'later') {
            setReview(null);
            reviewVisible = false;
            asking = false;
            promptedUsers.delete(userId);
            choiceRef.current = null;
          } else if (choice === 'local') {
            setReview(null);
            reviewVisible = false;
            choose('local').catch(() => undefined);
          } else {
            Alert.alert(
              'Bỏ thay đổi trên máy?',
              `${
                drafts.length +
                changes.length +
                categories.length +
                wallets.length
              } thay đổi chưa đồng bộ sẽ bị bỏ khỏi điện thoại. Dữ liệu trên máy chủ được giữ nguyên.`,
              [
                { text: 'Quay lại', style: 'cancel' },
                {
                  text: 'Bỏ thay đổi',
                  style: 'destructive',
                  onPress: () => {
                    setReview(null);
                    reviewVisible = false;
                    choose('cloud').catch(() => undefined);
                  },
                },
              ],
            );
          }
        };
        setReview({
          drafts,
          changes,
          categories,
          wallets,
          remote,
          remoteCategories,
          remoteWallets,
        });
      } catch {
        /* Durable drafts remain; retry only for pending writes in foreground. */
      } finally {
        running = false;
        if (retryPending) scheduleRetry();
      }
    };
    const reviewQueueChanged = () => {
      if (!reviewVisible) {
        attempt().catch(() => undefined);
        return;
      }
      Promise.all([
        offlineTransactionQueue.list(userId),
        offlineTransactionChanges.preview(userId),
        offlineCategoryQueue.preview(userId),
        offlineWalletQueue.preview(userId),
      ])
        .then(([drafts, changes, categories, wallets]) => {
          if (!active || !reviewVisible) return;
          const key = JSON.stringify([
            drafts
              .filter(item => item.server === server)
              .map(item => ({ id: item.id, updatedAt: item.updatedAt })),
            changes,
            categories,
            wallets,
          ]);
          if (key === shownKey) return;
          setReview(null);
          reviewVisible = false;
          asking = false;
          shownKey = '';
          promptedUsers.delete(userId);
          choiceRef.current = null;
          attempt().catch(() => undefined);
        })
        .catch(() => undefined);
    };
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') attempt().catch(() => undefined);
      else clearRetry();
    });
    const reconnect = homeWidget.subscribe(() => {
      attempt().catch(() => undefined);
    });
    const queued = offlineTransactionQueue.subscribe(reviewQueueChanged);
    const changed = offlineTransactionChanges.subscribe(reviewQueueChanged);
    const changedCategories =
      offlineCategoryQueue.subscribe(reviewQueueChanged);
    const changedWallets = offlineWalletQueue.subscribe(reviewQueueChanged);
    attempt().catch(() => undefined);
    return () => {
      active = false;
      reviewVisible = false;
      clearRetry();
      if (asking) promptedUsers.delete(userId);
      choiceRef.current = null;
      setReview(null);
      foreground.remove();
      reconnect();
      queued();
      changed();
      changedCategories();
      changedWallets();
    };
  }, [user?.id, server, isRestoringSession]);
  return (
    <OfflineSyncReviewModal
      review={review}
      onChoose={choice => choiceRef.current?.(choice)}
    />
  );
}
