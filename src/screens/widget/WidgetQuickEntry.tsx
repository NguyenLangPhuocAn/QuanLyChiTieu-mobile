import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Camera, Mic } from 'lucide-react-native';
import { launchCamera } from 'react-native-image-picker';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import HomeWidgetSession from '../../components/HomeWidgetSession';
import OfflineSessionSync from '../../components/OfflineSessionSync';
import { homeWidget } from '../../native/homeWidget';
import { getApiBaseUrl } from '../../services/api';
import {
  dashboardCache,
  type DashboardCache,
} from '../../services/dashboardCache';
import { widgetScope } from '../../services/widgetSnapshot';
import { widgetLink } from '../../services/widgetLinking';
import { createClientRequestId } from '../../services/offlineTransactionQueue';
import {
  transactionsService,
  type CreateTransactionPayload,
} from '../../services/transactions';
import {
  saveWidgetEntry,
  widgetEntryPayload,
  refreshWidgetEntryCache,
} from '../../services/widgetQuickEntry';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { parseVoiceTransactionDraft } from '../../utils/voiceTransactionDraft';
import { toDateKey } from '../../utils/budgetPeriod';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import type { ReceiptItem } from '../../types/transaction';
import { widgetPanelState } from '../../services/widgetPanelState';

type Props = { entryUrl: string };
function Panel({ entryUrl }: Props) {
  const {
    user,
    token,
    isRestoringSession,
    isCurrencySetupRequired,
    isOfflineSession,
  } = useAuth();
  const server = getApiBaseUrl();
  const sessionAvailable = Boolean(token);
  const [data, setData] = useState<DashboardCache | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [categoryId, setCategory] = useState<number | null>(null);
  const [walletId, setWallet] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(toDateKey(new Date()));
  const [currency, setCurrency] = useState<string | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [picker, setPicker] = useState<'wallet' | 'category' | null>(null);
  const [review, setReview] = useState<CreateTransactionPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [transcript, setTranscript] = useState('');
  const voice = useVoiceInput(setTranscript);
  const alive = useRef(true);
  const operation = useRef(0);
  const saving = useRef(false);
  const latest = useRef({ userId: user?.id, server });
  latest.current = { userId: user?.id, server };
  const initialAction = useRef<string | null>(null);
  const close = () => {
    if (saving.current) return;
    operation.current++;
    voice.cancel();
    homeWidget.closeQuickEntry().catch(() => undefined);
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (saving.current) return true;
      if (picker) setPicker(null);
      else if (review) setReview(null);
      else close();
      return true;
    });
    return () => {
      back.remove();
    };
    // Rebind only the Back button's current panel state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker, review]);
  useEffect(() => {
    if (isRestoringSession) return;
    let active = true;
    setReady(false);
    const load = async () => {
      if (
        !user?.id ||
        !sessionAvailable ||
        user.must_change_password ||
        isCurrencySetupRequired
      )
        throw Error('Mở app để đăng nhập và hoàn tất thiết lập trước.');
      const scope = { userId: user.id, server };
      const link = widgetLink(scope, entryUrl);
      if (
        !link ||
        !(await homeWidget.validateLink(widgetScope(scope), entryUrl))
      )
        throw Error('Lối tắt đã thay đổi. Đóng rồi bấm lại widget.');
      const cached = await dashboardCache.read(user.id);
      if (!cached?.wallets.length || !cached.categories.length)
        throw Error('Mở app có mạng một lần để tải ví và danh mục.');
      if (!active) return;
      const params = new URLSearchParams(link.slice(link.indexOf('?') + 1));
      const nextType =
        params.get('widgetType') === 'INCOME' ? 'INCOME' : 'EXPENSE';
      const nextId = Number(params.get('widgetCategoryId'));
      setType(nextType);
      setCategory(
        cached.categories.some(
          c =>
            c.id === nextId &&
            c.type === nextType &&
            (!c.cash_flow_group || c.cash_flow_group === 'NORMAL'),
        )
          ? nextId
          : null,
      );
      setData(cached);
      initialAction.current = params.get('widgetAction');
      setReady(true);
      setError('');
    };
    load().catch(e => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [
    user?.id,
    sessionAvailable,
    server,
    isRestoringSession,
    entryUrl,
    isCurrencySetupRequired,
    user?.must_change_password,
  ]);

  const scan = async () => {
    if (!token || ocrBusy || saving.current) return;
    const version = ++operation.current;
    const owner = user?.id;
    const current = () =>
      alive.current &&
      operation.current === version &&
      latest.current.userId === owner &&
      latest.current.server === server;
    setOcrBusy(true);
    setError('');
    voice.cancel();
    try {
      const picked = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1600,
        maxHeight: 1600,
        saveToPhotos: false,
      });
      if (!current() || picked.didCancel) return;
      const asset = picked.assets?.[0];
      if (picked.errorCode || !asset?.uri)
        throw Error(
          picked.errorMessage || 'Chưa lấy được ảnh. Bạn vẫn có thể nhập tay.',
        );
      const result = await transactionsService.analyzeReceipt(token, {
        uri: asset.uri,
        name: asset.fileName || 'receipt.jpg',
        type: asset.type || 'image/jpeg',
      });
      if (!current()) return;
      if (result.amount && result.amount > 0) setAmount(String(result.amount));
      if (result.note || result.merchant)
        setNote(result.note || result.merchant || '');
      if (result.currency) setCurrency(result.currency);
      if (result.transaction_date)
        setDate(result.transaction_date.slice(0, 10));
      setItems(result.receipt_items ?? []);
      setWarnings(result.warnings ?? []);
      // OCR photo is transient; never pass it to transaction upload or offline queue.
    } catch (e) {
      if (current())
        setError(
          getUserFriendlyErrorMessage(
            e,
            'Chưa đọc được ảnh. Nhập tay hoặc thử lại.',
          ),
        );
    } finally {
      if (current()) setOcrBusy(false);
    }
  };
  useEffect(() => {
    if (!ready) return;
    const action = initialAction.current;
    initialAction.current = null;
    if (action === 'VOICE') {
      setVoiceVisible(true);
      voice.toggle('').catch(() => undefined);
    }
    if (action === 'CAMERA') scan().catch(() => undefined);
    // Execute the initial widget action once, after validated cache is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  const wallet = data?.wallets.find(w => w.id === walletId);
  const category = data?.categories.find(
    c => c.id === categoryId && c.type === type,
  );
  const voicePreview = parseVoiceTransactionDraft(transcript);
  const prepare = () => {
    if (!data || busy || ocrBusy) return;
    try {
      setReview(
        widgetEntryPayload(
          data,
          { type, categoryId, walletId, amount, note, date, currency, items },
          createClientRequestId(),
        ),
      );
      setError('');
      voice.cancel();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const save = async () => {
    if (!review || !token || !user?.id || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    const owner = user.id;
    try {
      const result = await saveWidgetEntry(
        token,
        owner,
        review,
        isOfflineSession,
        () =>
          alive.current &&
          latest.current.userId === owner &&
          latest.current.server === server,
      );
      if (alive.current) await homeWidget.closeQuickEntry(result);
    } catch (e) {
      if (alive.current)
        setError(
          getUserFriendlyErrorMessage(
            e,
            'Chưa lưu được. Giữ thông tin và thử lại.',
          ),
        );
    } finally {
      saving.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const button = (
    label: string,
    press: () => void,
    primary = false,
    disabled = false,
  ) => (
    <TouchableOpacity
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={press}
      style={[s.button, primary && s.primary, disabled && s.disabled]}
    >
      <Text style={[s.buttonText, primary && s.primaryText]}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <KeyboardAvoidingView style={s.backdrop} behavior="height">
      <View style={s.card}>
        <View style={s.header}>
          <Text style={s.title}>
            {review ? 'Kiểm tra giao dịch' : 'Thêm giao dịch'}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Đóng khung nhập"
            disabled={busy}
            onPress={close}
          >
            <Text style={s.close}>Đóng</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          {!ready ? (
            <>
              {!error && <ActivityIndicator color="#FF8800" />}
              <Text style={s.muted}>
                {error || 'Đang mở dữ liệu trên máy…'}
              </Text>
              {!!error &&
                button('Mở app', () => {
                  homeWidget.closeQuickEntry('OPEN').catch(() => undefined);
                })}
            </>
          ) : review ? (
            <>
              <Text style={s.total}>
                {review.type === 'INCOME' ? '+' : '−'}
                {Number(review.amount).toLocaleString('vi-VN')}{' '}
                {wallet?.currency}
              </Text>
              <Text style={s.review}>
                {wallet?.name} · {category?.name}
              </Text>
              <Text style={s.muted}>{review.transaction_date}</Text>
              <Text style={s.review}>{review.note || 'Không có ghi chú'}</Text>
              {!!review.receipt_items?.length && (
                <Text style={s.muted}>
                  {review.receipt_items.length} món · không đính kèm ảnh quét
                </Text>
              )}
              {isOfflineSession && (
                <Text style={s.muted}>
                  Đang ngoại tuyến: giữ trên máy, có mạng sẽ đồng bộ.
                </Text>
              )}
            </>
          ) : picker ? (
            <>
              <Text style={s.label}>
                {picker === 'wallet'
                  ? 'Chọn ví'
                  : type === 'INCOME'
                  ? 'Danh mục thu'
                  : 'Danh mục chi'}
              </Text>
              {(picker === 'wallet'
                ? data?.wallets.map(w => ({
                    id: w.id,
                    name: `${w.name} · ${w.currency}`,
                  }))
                : data?.categories.filter(
                    c =>
                      c.type === type &&
                      (!c.cash_flow_group || c.cash_flow_group === 'NORMAL'),
                  )
              )?.map(item =>
                button(item.name, () => {
                  if (picker === 'wallet') setWallet(item.id);
                  else setCategory(item.id);
                  setPicker(null);
                }),
              )}
              {button('Quay lại', () => setPicker(null))}
            </>
          ) : (
            <>
              <View style={s.row}>
                {button(
                  'Chi',
                  () => {
                    setType('EXPENSE');
                    if (type !== 'EXPENSE') setCategory(null);
                  },
                  type === 'EXPENSE',
                  ocrBusy,
                )}
                {button(
                  'Thu',
                  () => {
                    setType('INCOME');
                    if (type !== 'INCOME') setCategory(null);
                  },
                  type === 'INCOME',
                  ocrBusy,
                )}
              </View>
              <TextInput
                accessibilityLabel="Số tiền widget"
                placeholder="Số tiền"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                style={s.amount}
                editable={!ocrBusy}
              />
              <View style={s.row}>
                {button(
                  category?.name || 'Chọn danh mục',
                  () => setPicker('category'),
                  false,
                  ocrBusy,
                )}
                {button(
                  wallet ? `${wallet.name} · ${wallet.currency}` : 'Chọn ví',
                  () => setPicker('wallet'),
                  false,
                  ocrBusy,
                )}
              </View>
              <TextInput
                accessibilityLabel="Ghi chú widget"
                placeholder="Ghi chú"
                value={note}
                onChangeText={setNote}
                style={s.input}
                editable={!ocrBusy}
              />
              <TextInput
                accessibilityLabel="Ngày giao dịch widget"
                placeholder="YYYY-MM-DD"
                value={date}
                onChangeText={setDate}
                style={s.input}
                editable={!ocrBusy}
              />
              <View style={s.row}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Nói để nhập"
                  disabled={ocrBusy}
                  onPress={() => {
                    setVoiceVisible(true);
                    voice.toggle(transcript).catch(() => undefined);
                  }}
                  style={s.tool}
                >
                  <Mic size={21} color="#A75410" />
                  <Text style={s.buttonText}>
                    {voice.status === 'idle' ? 'Nói' : 'Dừng nghe'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Chụp ảnh đọc hóa đơn"
                  disabled={ocrBusy}
                  onPress={scan}
                  style={s.tool}
                >
                  <Camera size={21} color="#A75410" />
                  <Text style={s.buttonText}>Chụp hóa đơn</Text>
                </TouchableOpacity>
              </View>
              {voiceVisible && (
                <View style={s.subpanel}>
                  <TextInput
                    accessibilityLabel="Câu nói widget"
                    placeholder="Ví dụ: chi 25 nghìn đi lại"
                    multiline
                    value={transcript}
                    onChangeText={setTranscript}
                    style={s.input}
                  />
                  <Text style={s.muted}>
                    {voicePreview.draft
                      ? `${
                          voicePreview.draft.type === 'INCOME' ? 'Thu' : 'Chi'
                        } ${voicePreview.draft.amount} ${
                          voicePreview.draft.currency
                        }`
                      : voicePreview.issues.join('\n')}
                  </Text>
                  {button(
                    'Điền vào giao dịch',
                    () => {
                      const draft = voicePreview.draft;
                      if (!draft) return;
                      setAmount(String(draft.amount));
                      setNote(draft.note || '');
                      setDate(draft.transaction_date || date);
                      setCurrency(draft.currency || null);
                      if (type !== draft.type) {
                        setType(draft.type);
                        setCategory(null);
                      }
                      setVoiceVisible(false);
                      voice.cancel();
                    },
                    false,
                    !voicePreview.draft,
                  )}
                </View>
              )}
              {ocrBusy && (
                <View style={s.row}>
                  <ActivityIndicator color="#FF8800" />
                  <Text style={s.muted}>Đang đọc ảnh…</Text>
                  {button('Hủy đọc', () => {
                    operation.current++;
                    setOcrBusy(false);
                  })}
                </View>
              )}
              {warnings.map((w, i) => (
                <Text key={i} style={s.muted}>
                  {w}
                </Text>
              ))}
              {!!items.length && (
                <View style={s.subpanel}>
                  <Text style={s.label}>Các món ({items.length})</Text>
                  {items.map((item, index) => (
                    <View key={index} style={s.row}>
                      <TextInput
                        accessibilityLabel={`Tên món ${index + 1}`}
                        value={item.name}
                        style={[s.input, s.itemName]}
                        onChangeText={name =>
                          setItems(previous =>
                            previous.map((r, i) =>
                              i === index ? { ...r, name } : r,
                            ),
                          )
                        }
                      />
                      <TextInput
                        accessibilityLabel={`Thành tiền món ${index + 1}`}
                        value={String(item.amount)}
                        keyboardType="decimal-pad"
                        style={[s.input, s.itemAmount]}
                        onChangeText={value =>
                          setItems(previous =>
                            previous.map((r, i) =>
                              i === index ? { ...r, amount: Number(value) } : r,
                            ),
                          )
                        }
                      />
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Xóa món ${index + 1}`}
                        onPress={() =>
                          setItems(previous =>
                            previous.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Text style={s.close}>Xóa</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
          {!!error && ready && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
        </ScrollView>
        {ready && !picker && (
          <View style={s.footer}>
            {review ? (
              <>
                {button('Sửa lại', () => setReview(null), false, busy)}
                {button(busy ? 'Đang lưu…' : 'Xác nhận lưu', save, true, busy)}
              </>
            ) : (
              <>
                {button('Hủy', close)}
                {button('Kiểm tra', prepare, true, ocrBusy)}
              </>
            )}
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
export default function WidgetQuickEntry(props: Props) {
  useEffect(() => {
    widgetPanelState.set(true);
    return () => widgetPanelState.set(false);
  }, []);
  return (
    <AuthProvider>
      <HomeWidgetSession />
      <WidgetSync />
      <Panel {...props} />
    </AuthProvider>
  );
}
function WidgetSync() {
  const { user, token } = useAuth();
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return (
    <OfflineSessionSync
      onSynced={async () => {
        if (user?.id && token)
          await refreshWidgetEntryCache(
            token,
            user.id,
            () => active.current && owner.current === user.id,
          );
      }}
    />
  );
}
const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 36,
    backgroundColor: 'rgba(34,20,10,0.18)',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '100%',
    backgroundColor: '#FFF9F2',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F4D2AE',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F4E4D4',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#4A2B1A' },
  close: { color: '#A75410', fontWeight: '600', padding: 8 },
  content: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  button: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 44,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFEAD3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: '#FF8800' },
  disabled: { opacity: 0.45 },
  buttonText: { color: '#7A4A28', fontSize: 14, fontWeight: '600' },
  primaryText: { color: '#FFF' },
  amount: {
    fontSize: 30,
    fontWeight: '700',
    color: '#4A2B1A',
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECC7A2',
    borderRadius: 14,
    backgroundColor: '#FFF',
  },
  input: {
    minHeight: 44,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ECD6C1',
    borderRadius: 12,
    backgroundColor: '#FFF',
    color: '#4A2B1A',
  },
  label: { fontWeight: '700', color: '#4A2B1A' },
  muted: { color: '#886449', lineHeight: 21 },
  error: { color: '#B53828', lineHeight: 21 },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F4E4D4',
  },
  tool: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF0DF',
  },
  subpanel: {
    gap: 8,
    padding: 12,
    backgroundColor: '#FFF2E4',
    borderRadius: 14,
  },
  itemName: { flex: 1 },
  itemAmount: { width: 85 },
  total: { fontSize: 28, fontWeight: '700', color: '#A75410' },
  review: { fontSize: 16, color: '#4A2B1A', lineHeight: 24 },
});
