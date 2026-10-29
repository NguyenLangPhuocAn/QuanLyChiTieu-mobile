import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { homeWidget } from '../native/homeWidget';
import { offlineTransactionQueue } from '../services/offlineTransactionQueue';
import { financeRefresh } from '../services/financeRefresh';
import { getApiBaseUrl } from '../services/api';

// Foreground only: no polling or claim that JS runs after Android force-stop.
export default function OfflineSessionSync() {
  const { user, token, isRestoringSession, retryRestoreSession } = useAuth();
  const server = getApiBaseUrl();
  const latest = useRef({ userId: user?.id, token, retryRestoreSession });
  latest.current = { userId: user?.id, token, retryRestoreSession };
  useEffect(() => {
    if (!user?.id || isRestoringSession) return;
    const userId = user.id;
    let active = true,
      running = false;
    const attempt = async () => {
      if (!active || running || AppState.currentState !== 'active') return;
      running = true;
      try {
        if (!(await homeWidget.connected())) return;
        if (!(await latest.current.retryRestoreSession())) return;
        const current = () =>
          active &&
          latest.current.userId === userId &&
          getApiBaseUrl() === server;
        if (!current() || !latest.current.token) return;
        await offlineTransactionQueue.sync(
          latest.current.token,
          userId,
          current,
        );
        if (current()) financeRefresh.emit();
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
      foreground.remove();
      reconnect();
      queued();
    };
  }, [user?.id, server, isRestoringSession]);
  return null;
}
