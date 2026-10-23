import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { bankNotificationReader } from '../native/bankNotificationReader';
import { latestBankNotification } from '../services/latestBankNotification';
import type { BankNotificationItem } from '../types/bankNotification';

export function useLatestBankNotification(
  enabled: boolean,
  userId: number | undefined,
  onRead: (item: BankNotificationItem, isCurrent: () => boolean) => void,
  canRead: () => boolean = () => true,
) {
  const [busy, setBusy] = useState(false);
  const [shakeAvailable, setShakeAvailable] = useState<boolean | null>(null);
  const revision = useRef(0);
  const inFlight = useRef(false);
  const permissionPrompt = useRef(false);
  const alive = useRef(true);
  const active = useRef(
    AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
  );
  const current = useRef({ enabled, userId, onRead, canRead });
  current.current = { enabled, userId, onRead, canRead };

  const clearConfiguration = useCallback(() => {
    if (bankNotificationReader.isSupported)
      bankNotificationReader.setConfiguration(null, []).catch(() => undefined);
  }, []);
  const cancel = useCallback(() => {
    revision.current += 1;
    permissionPrompt.current = false;
    clearConfiguration();
  }, [clearConfiguration]);

  const read = useCallback(async () => {
    const id = current.current.userId;
    if (
      !id ||
      !current.current.enabled ||
      !active.current ||
      inFlight.current ||
      permissionPrompt.current ||
      !current.current.canRead()
    )
      return;
    inFlight.current = true;
    setBusy(true);
    const request = ++revision.current;
    const valid = () =>
      alive.current &&
      request === revision.current &&
      current.current.userId === id &&
      current.current.enabled &&
      active.current;
    try {
      const granted =
        await bankNotificationReader.isNotificationAccessGranted();
      if (!valid()) return;
      if (!granted) {
        permissionPrompt.current = true;
        Alert.alert(
          'Cho phép đọc thông báo',
          'Bật quyền truy cập thông báo cho Nova một lần để dùng chuông hoặc lắc điện thoại. App đọc chữ thông báo trực tiếp trên máy, không chụp màn hình và không tự lưu giao dịch.',
          [
            {
              text: 'Để sau',
              style: 'cancel',
              onPress: () => {
                permissionPrompt.current = false;
              },
            },
            {
              text: 'Mở cài đặt',
              onPress: () => {
                permissionPrompt.current = false;
                if (valid())
                  bankNotificationReader
                    .openNotificationAccessSettings()
                    .catch(() => undefined);
              },
            },
          ],
          {
            onDismiss: () => {
              permissionPrompt.current = false;
            },
          },
        );
        return;
      }
      await bankNotificationReader.setConfiguration(id, []);
      if (!valid()) return;
      const events = await bankNotificationReader.getPendingEvents(id);
      if (!valid()) return;
      const item = latestBankNotification(events, id);
      if (item) current.current.onRead(item, valid);
      else
        Alert.alert(
          'Chưa có thông báo giao dịch',
          'Không có thông báo giao dịch chưa xử lý còn trên thanh thông báo. Thông báo đã vuốt bỏ sẽ không được đọc lại.',
        );
    } catch (error) {
      if (valid())
        Alert.alert(
          'Chưa đọc được thông báo',
          error instanceof Error ? error.message : 'Vui lòng thử lại.',
        );
    } finally {
      clearConfiguration();
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }, [clearConfiguration]);

  useEffect(() => {
    alive.current = true;
    cancel();
    const arm = () => {
      if (
        !bankNotificationReader.isSupported ||
        !current.current.enabled ||
        !active.current ||
        !current.current.userId
      )
        return;
      bankNotificationReader
        .startShakeDetection()
        .then(available => {
          if (alive.current && current.current.enabled)
            setShakeAvailable(available);
        })
        .catch(() => {
          if (alive.current) setShakeAvailable(false);
        });
    };
    const stop = () => {
      if (bankNotificationReader.isSupported)
        bankNotificationReader.stopShakeDetection().catch(() => undefined);
    };
    arm();
    const shakes = bankNotificationReader.onShake(() => {
      read().catch(() => undefined);
    });
    const app = AppState.addEventListener('change', state => {
      active.current = state === 'active';
      if (active.current) arm();
      else {
        cancel();
        stop();
      }
    });
    return () => {
      shakes.remove();
      app.remove();
      cancel();
      stop();
    };
  }, [enabled, userId, cancel, read]);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  return { read, cancel, busy, shakeAvailable };
}
