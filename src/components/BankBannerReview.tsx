import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  bankScreenCapture,
  type CropBounds,
  type ScreenCapture,
  type ScreenCrop,
} from '../native/bankScreenCapture';
import {
  bankScreenExtraction,
  parseScreenText,
} from '../services/bankScreenExtraction';
import { prepareBankNotificationText } from '../utils/bankScreenText';
import { formatCurrency } from '../utils/format';
import type {
  BankNotificationItem,
  ParsedBankNotification,
} from '../types/bankNotification';

type Props = {
  capture: ScreenCapture;
  token: string | null;
  onClose: () => void;
  onConfirm: (item: BankNotificationItem) => void;
};
const initialBounds = { left: 0.02, top: 0.025, right: 0.98, bottom: 0.35 };
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export default function BankBannerReview({
  capture,
  token,
  onClose,
  onConfirm,
}: Props) {
  const { width } = useWindowDimensions();
  const [bounds, setBounds] = useState<CropBounds>(initialBounds);
  const [crop, setCrop] = useState<ScreenCrop | null>(null);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedBankNotification | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const version = useRef(0);
  const start = useRef({ x: 0, y: 0 });
  const files = useRef<string[]>([]);
  const displayWidth = Math.min(
    width - 48,
    (390 * capture.width) / capture.height,
  );
  const displayHeight = (displayWidth * capture.height) / capture.width;
  useEffect(
    () => () => {
      version.current += 1;
      files.current.forEach(uri => {
        bankScreenCapture.deleteCapture(uri).catch(() => undefined);
      });
    },
    [],
  );

  async function recognize() {
    if (lock.current) return;
    if (
      bounds.right - bounds.left < 0.05 ||
      bounds.bottom - bounds.top < 0.02
    ) {
      Alert.alert(
        'Vùng chọn quá nhỏ',
        'Kéo để chọn trọn một banner ngân hàng.',
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    const request = ++version.current;
    try {
      const result = await bankScreenCapture.recognize(capture.uri, bounds);
      files.current.push(result.uri);
      if (request !== version.current) {
        await bankScreenCapture.deleteCapture(result.uri);
        return;
      }
      setCrop(result);
      setText(result.text.slice(0, 800));
      setParsed(parseScreenText(result.text, capture.capturedAt));
    } catch (error) {
      if (request === version.current)
        Alert.alert(
          'Chưa đọc được chữ',
          error instanceof Error ? error.message : 'Chọn lại vùng thông báo.',
        );
    } finally {
      lock.current = false;
      if (request === version.current) setBusy(false);
    }
  }

  function askAi() {
    if (!token || lock.current) return;
    try {
      const prepared = prepareBankNotificationText(text);
      const request = version.current;
      Alert.alert(
        'Gửi phần chữ để phân tích?',
        `${prepared.text}\n\nChỉ phần chữ đã che tài khoản và bỏ số dư ở trên được gửi đến dịch vụ AI. Ảnh không được gửi.`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Đồng ý gửi',
            onPress: () => {
              if (request !== version.current || lock.current) return;
              lock.current = true;
              setBusy(true);
              bankScreenExtraction
                .analyze(token!, text, capture.capturedAt)
                .then(result => {
                  if (request === version.current) setParsed(result);
                })
                .catch(error => {
                  if (request === version.current)
                    Alert.alert(
                      'Chưa phân tích được',
                      error instanceof Error
                        ? error.message
                        : 'Bạn có thể nhập tay.',
                    );
                })
                .finally(() => {
                  lock.current = false;
                  if (request === version.current) setBusy(false);
                });
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        'Kiểm tra phần chữ',
        error instanceof Error ? error.message : 'Chọn lại thông báo.',
      );
    }
  }

  function confirm() {
    if (!crop || !parsed || lock.current) return;
    const event = {
      id: crop.sourceRef,
      packageName: '',
      appName: 'Banner đã chọn',
      title: '',
      text,
      postedAt: capture.capturedAt,
    };
    onConfirm({
      event,
      parsed,
      draft:
        parsed.status === 'READY' &&
        parsed.type &&
        parsed.amount &&
        parsed.currency
          ? {
              eventId: event.id,
              sourceApp: event.appName,
              postedAt: event.postedAt,
              type: parsed.type,
              amount: parsed.amount,
              currency: parsed.currency,
              note: parsed.note,
              transactionDate: parsed.transactionDate,
            }
          : null,
    });
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.title}>
              {crop ? 'Kiểm tra thông báo' : 'Chọn vùng thông báo'}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel="Đóng ảnh banner"
            >
              <Text style={styles.link}>Đóng</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {!crop ? (
              <>
                <Text style={styles.description}>
                  Kéo trên ảnh để khoanh đúng một banner ngân hàng đang hiện.
                  Nếu ảnh không có banner, đóng và chụp lại.
                </Text>
                <View
                  style={[
                    styles.captureImage,
                    { width: displayWidth, height: displayHeight },
                  ]}
                  accessibilityLabel="Kéo chọn vùng banner trên ảnh"
                  onStartShouldSetResponder={() => !busy}
                  onMoveShouldSetResponder={() => !busy}
                  onResponderGrant={event => {
                    start.current = {
                      x: clamp(event.nativeEvent.locationX / displayWidth),
                      y: clamp(event.nativeEvent.locationY / displayHeight),
                    };
                  }}
                  onResponderMove={event => {
                    const x = clamp(event.nativeEvent.locationX / displayWidth);
                    const y = clamp(
                      event.nativeEvent.locationY / displayHeight,
                    );
                    setBounds({
                      left: Math.min(start.current.x, x),
                      right: Math.max(start.current.x, x),
                      top: Math.min(start.current.y, y),
                      bottom: Math.max(start.current.y, y),
                    });
                  }}
                >
                  <Image
                    source={{ uri: capture.uri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="stretch"
                  />
                  <View
                    pointerEvents="none"
                    style={[
                      styles.selection,
                      {
                        left: bounds.left * displayWidth,
                        top: bounds.top * displayHeight,
                        width: (bounds.right - bounds.left) * displayWidth,
                        height: (bounds.bottom - bounds.top) * displayHeight,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.hint}>
                  Ảnh chỉ lưu tạm trên máy. Vùng chọn sẽ được đọc chữ ngoại
                  tuyến.
                </Text>
                <TouchableOpacity
                  style={styles.primary}
                  disabled={busy}
                  onPress={() => {
                    recognize().catch(() => undefined);
                  }}
                >
                  <Text style={styles.primaryText}>Đọc vùng đã chọn</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Image
                  source={{ uri: crop.uri }}
                  style={[
                    styles.crop,
                    { aspectRatio: crop.width / crop.height },
                  ]}
                  resizeMode="contain"
                />
                <Text style={styles.label}>Chữ đã đọc — có thể sửa</Text>
                <TextInput
                  accessibilityLabel="Nội dung banner đã đọc"
                  value={text}
                  editable={!busy}
                  maxLength={800}
                  multiline
                  style={styles.input}
                  onChangeText={value => {
                    version.current += 1;
                    setText(value);
                    setParsed(parseScreenText(value, capture.capturedAt));
                  }}
                />
                <View style={styles.result}>
                  <Text style={styles.label}>
                    {parsed?.status === 'READY'
                      ? `${
                          parsed.type === 'INCOME' ? 'Thu +' : 'Chi −'
                        }${formatCurrency(
                          Number(parsed.amount),
                          parsed.currency,
                        )}`
                      : 'Cần kiểm tra lại'}
                  </Text>
                  <Text style={styles.description}>
                    {parsed?.status === 'READY'
                      ? 'Chỉ điền bản nháp. Bạn chọn ví, danh mục và bấm lưu ở bước tiếp theo.'
                      : parsed?.reason}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.primary}
                  disabled={busy}
                  onPress={confirm}
                  accessibilityLabel="Điền banner vào bản nháp"
                >
                  <Text style={styles.primaryText}>
                    {parsed?.status === 'READY'
                      ? 'Điền vào giao dịch'
                      : 'Mở form để nhập tay'}
                  </Text>
                </TouchableOpacity>
                {parsed?.status !== 'READY' && token ? (
                  <TouchableOpacity disabled={busy} onPress={askAi}>
                    <Text style={styles.link}>Nhờ AI đọc phần chữ này</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  disabled={busy}
                  onPress={() => {
                    version.current += 1;
                    setCrop(null);
                    setParsed(null);
                  }}
                >
                  <Text style={styles.link}>Chọn lại vùng</Text>
                </TouchableOpacity>
              </>
            )}
            {busy ? (
              <View style={styles.row}>
                <ActivityIndicator color="#FF8C00" />
                <Text style={styles.description}>Đang đọc…</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#0008',
    justifyContent: 'center',
    padding: 12,
  },
  card: {
    backgroundColor: '#FFFCF8',
    borderRadius: 24,
    maxHeight: '96%',
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFD5B2',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { color: '#4B2A19', fontSize: 18, fontWeight: '700', flex: 1 },
  content: { gap: 14, paddingTop: 14, paddingBottom: 8 },
  description: { color: '#815A3C', fontSize: 13, lineHeight: 20 },
  hint: { color: '#815A3C', fontSize: 12, lineHeight: 18 },
  label: { color: '#4B2A19', fontSize: 14, fontWeight: '700' },
  link: {
    color: '#B95308',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 8,
    textAlign: 'center',
  },
  selection: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#FF8C00',
    backgroundColor: '#FF8C0018',
  },
  primary: {
    backgroundColor: '#FF8C00',
    borderRadius: 14,
    padding: 15,
    alignItems: 'center',
  },
  primaryText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FFD5B2',
    borderRadius: 14,
    padding: 12,
    color: '#4B2A19',
    minHeight: 100,
    maxHeight: 190,
    textAlignVertical: 'top',
  },
  result: { backgroundColor: '#FFF1E1', borderRadius: 14, padding: 12, gap: 6 },
  crop: {
    width: '100%',
    maxHeight: 220,
    borderRadius: 12,
    backgroundColor: '#FFF1E1',
  },
  captureImage: { alignSelf: 'center' },
});
