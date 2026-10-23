import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { bankNotificationReader } from '../native/bankNotificationReader';
import { latestBankNotificationEvent } from '../services/latestBankNotification';
import {
  bankNotificationExtraction,
  manualBankNotification,
} from '../services/bankNotificationExtraction';
import { bankAiConsent } from '../services/bankAiConsent';
import { prepareBankNotificationText } from '../utils/bankNotificationText';
import type {
  BankNotificationItem,
  ParsedBankNotification,
} from '../types/bankNotification';

export function useLatestBankNotification(
  enabled: boolean,
  userId: number | undefined,
  onRead: (item: BankNotificationItem, isCurrent: () => boolean) => void,
  canRead: () => boolean = () => true,
  token?: string | null,
) {
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'reading' | 'consent' | 'ai'>(
    'idle',
  );
  const pendingConsent = useRef<
    ((choice: 'once' | 'always' | 'manual') => void) | null
  >(null);
  const cached = useRef<{
    userId: number;
    token: string;
    eventId: string;
    text: string;
    until: number;
    parsed: ParsedBankNotification;
  } | null>(null);
  const [shakeAvailable, setShakeAvailable] = useState<boolean | null>(null);
  const revision = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const permissionPrompt = useRef(false);
  const alive = useRef(true);
  const active = useRef(
    AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
  );
  const current = useRef({ enabled, userId, onRead, canRead, token });
  current.current = { enabled, userId, onRead, canRead, token };

  const clearConfiguration = useCallback(() => {
    if (bankNotificationReader.isSupported)
      bankNotificationReader.setConfiguration(null, []).catch(() => undefined);
  }, []);
  const cancel = useCallback(() => {
    revision.current += 1;
    requestController.current?.abort();
    requestController.current = null;
    permissionPrompt.current = false;
    pendingConsent.current?.('manual');
    pendingConsent.current = null;
    if (alive.current) {
      setBusy(false);
      setPhase('idle');
    }
    clearConfiguration();
  }, [clearConfiguration]);

  const read = useCallback(async () => {
    const id = current.current.userId;
    const sessionToken = current.current.token;
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
    setPhase('reading');
    const request = ++revision.current;
    const controller = new AbortController();
    requestController.current = controller;
    const valid = () =>
      alive.current &&
      request === revision.current &&
      current.current.userId === id &&
      current.current.token === sessionToken &&
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
      // Collection ends before consent/model network work starts.
      await bankNotificationReader.setConfiguration(null, []);
      if (!valid()) return;
      const event = latestBankNotificationEvent(events, id);
      if (!event) {
        Alert.alert(
          'Chưa có thông báo giao dịch',
          'Không có thông báo giao dịch chưa xử lý còn trên thanh thông báo. Thông báo đã vuốt bỏ sẽ không được đọc lại.',
        );
        return;
      }
      const raw = `${event.title}\n${event.text}`.trim();
      let parsed = manualBankNotification(
        raw,
        event.postedAt,
        'Nhập hoặc kiểm tra giao dịch trước khi lưu.',
      );
      try {
        const prepared = prepareBankNotificationText(raw).text;
        const previous = cached.current;
        if (
          sessionToken &&
          previous?.userId === id &&
          previous.token === sessionToken &&
          previous.eventId === event.id &&
          previous.text === prepared &&
          previous.until > Date.now()
        ) {
          parsed = previous.parsed;
        } else {
          if (!sessionToken)
            throw new Error('Phiên đăng nhập chưa sẵn sàng để đọc bằng AI.');
          if (
            !(await bankNotificationExtraction.isAvailable(
              sessionToken,
              controller.signal,
            ))
          )
            throw new Error(
              'Máy chủ chưa bật đọc thông báo bằng AI. Bạn có thể nhập giao dịch bằng tay.',
            );
          if (!valid()) return;
          const remembered = await bankAiConsent.has(id);
          let choice: 'once' | 'always' | 'manual' = remembered
            ? 'always'
            : 'manual';
          if (!valid()) return;
          if (choice !== 'always') {
            setPhase('consent');
            choice = await new Promise(resolve => {
              pendingConsent.current = resolve;
              const choose = (value: 'once' | 'always' | 'manual') => {
                if (pendingConsent.current !== resolve) return;
                pendingConsent.current = null;
                resolve(value);
              };
              Alert.alert(
                'Dùng AI đọc thông báo?',
                `Phần chữ này sẽ được gửi đến máy chủ và Gemini để trích xuất Thu/Chi, số tiền và nội dung. Không gửi ảnh; không tự lưu giao dịch.\n\n${prepared}\n\nBạn có thể đặt lại quyền AI trong form giao dịch.`,
                [
                  {
                    text: 'Nhập tay',
                    style: 'cancel',
                    onPress: () => choose('manual'),
                  },
                  { text: 'Chỉ lần này', onPress: () => choose('once') },
                  { text: 'Luôn cho phép', onPress: () => choose('always') },
                ],
                { onDismiss: () => choose('manual') },
              );
            });
          }
          if (!valid()) return;
          if (choice === 'manual') {
            parsed = manualBankNotification(
              raw,
              event.postedAt,
              'Bạn đã chọn nhập tay; nội dung chưa được gửi để AI phân tích.',
            );
          } else {
            if (choice === 'always' && !remembered)
              await bankAiConsent.allow(id).catch(() => undefined);
            if (!valid()) return;
            setPhase('ai');
            parsed = await bankNotificationExtraction.analyze(
              sessionToken,
              prepared,
              event.postedAt,
              controller.signal,
            );
            if (!valid()) return;
            cached.current = {
              userId: id,
              token: sessionToken,
              eventId: event.id,
              text: prepared,
              until: Date.now() + 120000,
              parsed,
            };
          }
        }
      } catch (error) {
        parsed = manualBankNotification(
          raw,
          event.postedAt,
          error instanceof Error
            ? error.message
            : 'AI chưa đọc được; vui lòng nhập tay.',
        );
      }
      if (!valid()) return;
      current.current.onRead({ event, parsed, draft: null }, valid);
    } catch (error) {
      if (valid())
        Alert.alert(
          'Chưa đọc được thông báo',
          error instanceof Error ? error.message : 'Vui lòng thử lại.',
        );
    } finally {
      if (requestController.current === controller)
        requestController.current = null;
      clearConfiguration();
      inFlight.current = false;
      if (alive.current) {
        setBusy(false);
        setPhase('idle');
      }
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
  }, [enabled, userId, token, cancel, read]);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const resetAiConsent = useCallback(() => {
    const id = current.current.userId;
    if (!id) return;
    Alert.alert(
      'Đặt lại quyền AI?',
      'Lần đọc tiếp theo sẽ hỏi lại trước khi gửi chữ thông báo đến Gemini.',
      [
        { text: 'Giữ nguyên', style: 'cancel' },
        {
          text: 'Đặt lại',
          onPress: () => {
            if (current.current.userId !== id) return;
            cancel();
            cached.current = null;
            bankAiConsent
              .reset(id)
              .catch(() =>
                Alert.alert('Chưa đặt lại được quyền AI', 'Vui lòng thử lại.'),
              );
          },
        },
      ],
    );
  }, [cancel]);
  return { read, cancel, busy, phase, resetAiConsent, shakeAvailable };
}
