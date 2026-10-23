import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import {
  bankScreenCapture,
  type ScreenCapture,
} from '../native/bankScreenCapture';

/** No notification listener or tray fallback: only a fresh, explicit screen capture. */
export function useBankBannerCapture(enabled: boolean, userId?: number) {
  const [capture, setCapture] = useState<ScreenCapture | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const version = useRef(0);
  const inFlight = useRef(false);
  const preparing = useRef(false);
  const alive = useRef(true);
  const identity = useRef({ enabled, userId });
  identity.current = { enabled, userId };
  const reset = useCallback(() => {
    version.current += 1;
    setCapture(null);
    setReady(false);
    // Keep the lock until any pending system permission request has settled.
    bankScreenCapture.stop().catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!enabled) reset();
    return reset;
  }, [enabled, userId, reset]);
  useEffect(() => {
    alive.current = true;
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active' && !preparing.current) reset();
    });
    return () => {
      alive.current = false;
      listener.remove();
      reset();
    };
  }, [reset]);

  const execute = useCallback(async () => {
    if (
      !identity.current.enabled ||
      identity.current.userId !== userId ||
      !userId ||
      inFlight.current
    )
      return;
    inFlight.current = true;
    setBusy(true);
    const request = ++version.current;
    const current = () => alive.current && request === version.current;
    try {
      if (!(await bankScreenCapture.isReady())) {
        if (!current()) return;
        preparing.current = true;
        const granted = await bankScreenCapture.prepare();
        preparing.current = false;
        if (!current()) {
          await bankScreenCapture.stop();
          return;
        }
        setReady(granted);
        if (granted)
          Alert.alert(
            'Đã sẵn sàng',
            'Khi banner ngân hàng đang nổi trên màn hình, bấm chuông một lần nữa để chụp. Phiên chụp dừng khi bạn rời ứng dụng.',
          );
        return;
      }
      if (!current()) return;
      const image = await bankScreenCapture.capture();
      if (!current()) {
        await bankScreenCapture.deleteCapture(image.uri);
        return;
      }
      setCapture(image);
    } catch (error) {
      if (current())
        Alert.alert(
          'Chưa chụp được banner',
          error instanceof Error ? error.message : 'Vui lòng thử lại.',
        );
    } finally {
      preparing.current = false;
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }, [userId]);

  const read = useCallback(async () => {
    if (!enabled || !userId || inFlight.current) return;
    const revision = version.current;
    const sessionReady = await bankScreenCapture.isReady().catch(() => false);
    if (
      revision !== version.current ||
      !identity.current.enabled ||
      identity.current.userId !== userId
    )
      return;
    if (sessionReady) {
      await execute();
      return;
    }
    Alert.alert(
      'Đọc banner trên màn hình',
      'Android sẽ hỏi quyền chia sẻ toàn bộ màn hình cho phiên này. App chỉ lưu ảnh khi bạn bấm chuông; bạn chọn vùng thông báo trước khi đọc chữ trên máy. Ảnh không tự gửi lên máy chủ.',
      [
        { text: 'Để sau', style: 'cancel' },
        {
          text: 'Cấp quyền chụp',
          onPress: () => {
            if (revision === version.current) execute().catch(() => undefined);
          },
        },
      ],
    );
  }, [enabled, userId, execute]);
  return { capture, busy, ready, read, close: reset };
}
