import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { homeWidget } from '../native/homeWidget';
import { getApiBaseUrl } from '../services/api';
import { planningLocalStore } from '../services/planningLocalStore';
import { planningSync } from '../services/planningSync';
export default function PlanningSyncSession() {
  const { user, token, isRestoringSession } = useAuth();
  const server = getApiBaseUrl(),
    latest = useRef({ userId: user?.id, token, server });
  latest.current = { userId: user?.id, token, server };
  useEffect(() => {
    if (!user?.id || !token || isRestoringSession) return;
    const scope = { userId: user.id, server };
    let active = true,
      timer: ReturnType<typeof setTimeout> | undefined;
    const current = () =>
      active &&
      latest.current.userId === scope.userId &&
      latest.current.server === server;
    const attempt = async () => {
      if (!current() || AppState.currentState !== 'active') return;
      if (
        !(await planningLocalStore.read(scope)).sync.enabled ||
        !(await homeWidget.connected()) ||
        !current()
      )
        return;
      await planningSync.sync(scope, latest.current.token!, current);
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        attempt().catch(() => undefined);
      }, 800);
    };
    const changes = planningLocalStore.subscribe(changed => {
      if (changed.userId === scope.userId && changed.server === scope.server)
        schedule();
    });
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') schedule();
    });
    const reconnect = homeWidget.subscribe(schedule);
    const poll = setInterval(schedule, 30000);
    schedule();
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(poll);
      changes();
      foreground.remove();
      reconnect();
    };
  }, [user?.id, token, server, isRestoringSession]);
  return null;
}
