import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking } from 'react-native';
import type { RNSpeechRecognitionModule } from 'rn-speech-recognition';

type SpeechModule = typeof RNSpeechRecognitionModule;

export function useVoiceInput(onTranscript: (text: string) => void) {
  const [status, setStatus] = useState<
    'idle' | 'starting' | 'listening' | 'stopping'
  >('idle');
  const session = useRef(0);
  const busy = useRef(false);
  const moduleRef = useRef<SpeechModule | null>(null);
  const subscriptions = useRef<Array<{ remove: () => void }>>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callback = useRef(onTranscript);
  callback.current = onTranscript;

  const cleanup = useCallback(() => {
    subscriptions.current.forEach(subscription => subscription.remove());
    subscriptions.current = [];
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    busy.current = false;
  }, []);

  const cancel = useCallback(() => {
    session.current += 1;
    cleanup();
    moduleRef.current?.abort();
    setStatus('idle');
  }, [cleanup]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') cancel();
    });
    return () => {
      session.current += 1;
      cleanup();
      moduleRef.current?.abort();
      subscription.remove();
    };
  }, [cancel, cleanup]);

  const toggle = async (draft: string) => {
    if (busy.current) {
      if (status === 'listening') {
        setStatus('stopping');
        moduleRef.current?.stop();
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(cancel, 8000);
      }
      return;
    }
    busy.current = true;
    const currentSession = ++session.current;
    setStatus('starting');
    try {
      const { RNSpeechRecognitionModule: speech } =
        require('rn-speech-recognition') as typeof import('rn-speech-recognition');
      if (session.current !== currentSession) return;
      moduleRef.current = speech;
      if (!speech.isAvailable || !speech.isRecognitionAvailable()) {
        throw new Error(
          'Thiết bị chưa có dịch vụ nhận dạng giọng nói. Bạn vẫn có thể nhập câu hỏi bằng bàn phím.',
        );
      }
      const permissions = await speech.requestPermissionsAsync();
      if (session.current !== currentSession) return;
      if (!permissions.granted) {
        cancel();
        Alert.alert(
          'Chưa có quyền dùng giọng nói',
          'Cho phép micro và nhận dạng giọng nói trong Cài đặt để nhập câu hỏi.',
          [
            { text: 'Để sau', style: 'cancel' },
            {
              text: 'Cài đặt',
              onPress: () => {
                Linking.openSettings().catch(() => undefined);
              },
            },
          ],
        );
        return;
      }
      const finish = () => {
        if (session.current !== currentSession) return;
        session.current += 1;
        cleanup();
        setStatus('idle');
      };
      subscriptions.current = [
        speech.addListener('start', () => {
          if (session.current === currentSession) setStatus('listening');
        }),
        speech.addListener('result', event => {
          if (session.current !== currentSession) return;
          const text = event.results[0]?.transcript?.trim();
          if (text)
            callback.current([draft.trim(), text].filter(Boolean).join(' '));
        }),
        speech.addListener('end', finish),
        speech.addListener('error', event => {
          if (session.current !== currentSession) return;
          finish();
          if (event.error !== 'aborted')
            Alert.alert(
              'Chưa nhận được giọng nói',
              event.error === 'no-speech'
                ? 'Chưa nghe rõ. Hãy thử nói lại hoặc nhập bằng bàn phím.'
                : 'Không thể nhận dạng lúc này. Kiểm tra quyền micro, ngôn ngữ tiếng Việt và kết nối mạng rồi thử lại.',
            );
        }),
      ];
      timer.current = setTimeout(cancel, 60000);
      speech.start({
        lang: 'vi-VN',
        interimResults: true,
        continuous: false,
        recordingOptions: { persist: false },
      });
    } catch (error) {
      if (session.current !== currentSession) return;
      cancel();
      Alert.alert(
        'Chưa bật được giọng nói',
        error instanceof Error ? error.message : 'Vui lòng thử lại.',
      );
    }
  };

  return { status, isBusy: status !== 'idle', toggle, cancel };
}
