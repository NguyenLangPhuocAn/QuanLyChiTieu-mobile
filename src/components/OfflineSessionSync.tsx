import { useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { homeWidget } from '../native/homeWidget';
import { offlineTransactionQueue } from '../services/offlineTransactionQueue';
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

// Foreground only: no polling or claim that JS runs after Android force-stop.
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
      shownKey = '';
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
      try {
        if (!(await homeWidget.connected())) return;
        if (!(await latest.current.retryRestoreSession())) return;
        const current = () =>
          active &&
          latest.current.userId === userId &&
          getApiStorageBaseUrl() === server;
        if (!current() || !latest.current.token) return;
        const drafts = (await offlineTransactionQueue.list(userId)).filter(
          item => item.server === server,
        );
        const changes = await offlineTransactionChanges.list(userId);
        if (!drafts.length && !changes.length) {
          shownKey = '';
          if (current()) await refresh();
          return;
        }
        const expected = drafts.map(item => ({
          id: item.id,
          updatedAt: item.updatedAt,
        }));
        const expectedChanges = await offlineTransactionChanges.preview(userId);
        const key = JSON.stringify([expected, expectedChanges]);
        if (shownKey === key || !current()) return;
        const remote: OfflineSyncReview['remote'] = {};
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
        shownKey = key;
        asking = true;
        promptedUsers.add(userId);
        const choose = async (source: 'local' | 'cloud') => {
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
              const result = await offlineTransactionQueue.sync(
                latest.current.token,
                userId,
                current,
                expected,
              );
              const edits = result.pending
                ? { synced: 0, pending: expectedChanges.length, needsReview: 0 }
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
                edits.needsReview
              )
                Alert.alert(
                  'Còn giao dịch cần kiểm tra',
                  `${result.pending + edits.pending} đang chờ · ${
                    result.needsReview + edits.needsReview
                  } cần xem lại.`,
                );
              else shownKey = '';
            }
            if (current()) await refresh();
          } catch (error) {
            shownKey = '';
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
          }
        };
        choiceRef.current = choice => {
          if (choice === 'later') {
            setReview(null);
            asking = false;
            promptedUsers.delete(userId);
            choiceRef.current = null;
          } else if (choice === 'local') {
            setReview(null);
            choose('local').catch(() => undefined);
          } else {
            Alert.alert(
              'Bỏ thay đổi trên máy?',
              `${
                drafts.length + changes.length
              } thay đổi chưa đồng bộ sẽ bị bỏ khỏi điện thoại. Dữ liệu trên máy chủ được giữ nguyên.`,
              [
                { text: 'Quay lại', style: 'cancel' },
                {
                  text: 'Bỏ thay đổi',
                  style: 'destructive',
                  onPress: () => {
                    setReview(null);
                    choose('cloud').catch(() => undefined);
                  },
                },
              ],
            );
          }
        };
        setReview({ drafts, changes, remote });
      } catch {
        /* durable drafts remain; next reconnect/resume retries */
      } finally {
        running = false;
      }
    };
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') attempt().catch(() => undefined);
    });
    const reconnect = homeWidget.subscribe(() => {
      attempt().catch(() => undefined);
    });
    const queued = offlineTransactionQueue.subscribe(() => {
      attempt().catch(() => undefined);
    });
    attempt().catch(() => undefined);
    return () => {
      active = false;
      if (asking) promptedUsers.delete(userId);
      foreground.remove();
      reconnect();
      queued();
    };
  }, [user?.id, server, isRestoringSession]);
  return (
    <OfflineSyncReviewModal
      review={review}
      onChoose={choice => choiceRef.current?.(choice)}
    />
  );
}
