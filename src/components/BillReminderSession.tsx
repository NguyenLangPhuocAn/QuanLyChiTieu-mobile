import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../services/api';
import { billReminderSession } from '../services/billReminderSession';

export default function BillReminderSession() {
  const { user, isRestoringSession, sessionRestoreError } = useAuth();
  const userId = user?.id;
  const server = getApiBaseUrl();
  useEffect(() => {
    // Restoring a session/offline restore error is NOT a sign-out.
    if (isRestoringSession || (!userId && sessionRestoreError)) return;
    const scope = userId ? { userId, server } : null;
    billReminderSession.set(scope).catch(() => undefined);
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active' && scope)
        billReminderSession
          .set({ ...scope, server: getApiBaseUrl() })
          .catch(() => undefined);
    });
    return () => listener.remove();
  }, [userId, server, isRestoringSession, sessionRestoreError]);
  return null;
}
