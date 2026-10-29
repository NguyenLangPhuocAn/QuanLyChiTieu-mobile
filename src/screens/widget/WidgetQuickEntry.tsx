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
import WidgetCategoryPicker from '../../components/WidgetCategoryPicker';
import CategoryIcon from '../../components/CategoryIcon';
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
import {
  formatMoneyInputForCurrency,
  normalizeMoneyInputForCurrency,
  parsePositiveMoneyInput,
} from '../../utils/moneyInput';
import {
  widgetLoanPayload,
  saveWidgetLoanEntry,
  type WidgetLoanPayload,
} from '../../services/widgetLoanEntry';
import type { LoanDebtType } from '../../types/loanDebt';

type Props = { entryUrl: string };
type ItemDraft = Omit<ReceiptItem, 'amount'> & { amount: string };
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
  const [type, setType] = useState<'INCOME' | 'EXPENSE' | 'LOAN_DEBT'>(
    'EXPENSE',
  );
  const [loanType, setLoanType] = useState<LoanDebtType>('BORROWED');
  const [personName, setPersonName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const loanRequestId = useRef<string | null>(null);
  const [categoryId, setCategory] = useState<number | null>(null);
  const [walletId, setWallet] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(toDateKey(new Date()));
  const [currency, setCurrency] = useState<string | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [picker, setPicker] = useState<'wallet' | 'category' | null>(null);
  const [review, setReview] = useState<
    CreateTransactionPayload | WidgetLoanPayload | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [transcript, setTranscript] = useState('');
  const voice = useVoiceInput(setTranscript);
  const alive = useRef(true);
  const operation = useRef(0);
  const saving = useRef(false);
  const scanning = useRef(false);
  const initialized = useRef(false);
  const initializedFor = useRef<string | null>(null);
  const [loadRevision, setLoadRevision] = useState(0);
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
    initialized.current = false;
    setReady(false);
    setError('');
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
      const source = `${widgetScope(scope)}|${entryUrl}`;
      if (initializedFor.current !== source) {
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
        initialAction.current = params.get('widgetAction');
        initializedFor.current = source;
      }
      setData(cached);
      initialized.current = true;
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
    loadRevision,
  ]);
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    const userId = user.id;
    const refresh = () => {
      dashboardCache
        .read(userId)
        .then(cached => {
          if (
            active &&
            cached &&
            latest.current.userId === userId &&
            latest.current.server === server
          ) {
            if (
              !initialized.current &&
              cached.wallets.length &&
              cached.categories.length
            )
              setLoadRevision(value => value + 1);
            else if (initialized.current) setData(cached);
          }
        })
        .catch(() => undefined);
    };
    const unsubscribe = dashboardCache.subscribe(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user?.id, server]);

  const scan = async () => {
    if (!token || scanning.current || saving.current) return;
    scanning.current = true;
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
    setVoiceVisible(false);
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
      setCurrency(result.currency || null);
      if (result.transaction_date)
        setDate(result.transaction_date.slice(0, 10));
      setItems(
        (result.receipt_items ?? []).map(item => ({
          ...item,
          amount: String(item.amount),
        })),
      );
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
      if (current()) {
        scanning.current = false;
        setOcrBusy(false);
      }
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
  const moneyCurrency =
    currency || wallet?.currency || user?.currency_default || 'VND';
  const category = data?.categories.find(
    c => c.id === categoryId && c.type === type,
  );
  const voicePreview = parseVoiceTransactionDraft(transcript);
  const loanReview = review && 'principal_amount' in review ? review : null;
  const transactionReview = review && 'amount' in review ? review : null;
  const prepare = () => {
    if (!data || busy || ocrBusy) return;
    try {
      if (type === 'LOAN_DEBT') {
        loanRequestId.current ??= createClientRequestId();
        setReview(
          widgetLoanPayload(
            data,
            {
              type: loanType,
              personName,
              dueDate,
              walletId,
              amount,
              note,
              date,
              currency,
            },
            loanRequestId.current,
          ),
        );
      } else
        setReview(
          widgetEntryPayload(
            data,
            {
              type,
              categoryId,
              walletId,
              amount,
              note,
              date,
              currency,
              items: items.map(item => ({
                ...item,
                amount: Number(parsePositiveMoneyInput(item.amount)),
              })),
            },
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
      const isCurrent = () =>
        alive.current &&
        latest.current.userId === owner &&
        latest.current.server === server;
      const result = loanReview
        ? await saveWidgetLoanEntry(
            token,
            owner,
            loanReview,
            isOfflineSession,
            isCurrent,
          )
        : await saveWidgetEntry(
            token,
            owner,
            transactionReview!,
            isOfflineSession,
            () =>
              alive.current &&
              latest.current.userId === owner &&
              latest.current.server === server,
          );
      if (
        alive.current &&
        latest.current.userId === owner &&
        latest.current.server === server
      )
        await homeWidget.closeQuickEntry(result);
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
    <KeyboardAvoidingView
      style={s.backdrop}
      behavior="height"
      onLayout={() => homeWidget.entryReady().catch(() => undefined)}
    >
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
                button('Thử lại', () => setLoadRevision(value => value + 1))}
              {!!error &&
                button('Mở app', () => {
                  homeWidget.closeQuickEntry('OPEN').catch(() => undefined);
                })}
            </>
          ) : review ? (
            <>
              <Text style={s.total}>
                {loanReview
                  ? loanReview.type === 'BORROWED'
                    ? '+'
                    : '−'
                  : review.type === 'INCOME'
                  ? '+'
                  : '−'}
                {Number(
                  loanReview?.principal_amount ?? transactionReview?.amount,
                ).toLocaleString('vi-VN')}{' '}
                {wallet?.currency}
              </Text>
              <Text style={s.review}>
                {wallet?.name} ·{' '}
                {loanReview
                  ? `${loanReview.type === 'BORROWED' ? 'Vay từ' : 'Cho vay'} ${
                      loanReview.person_name
                    }`
                  : category?.name}
              </Text>
              <Text style={s.muted}>{review.transaction_date}</Text>
              <Text style={s.review}>{review.note || 'Không có ghi chú'}</Text>
              {loanReview && (
                <Text style={s.muted}>
                  {loanReview.due_date
                    ? `Hẹn trả: ${loanReview.due_date}`
                    : 'Chưa hẹn ngày trả'}
                </Text>
              )}
              {!!transactionReview?.receipt_items?.length && (
                <Text style={s.muted}>
                  {transactionReview.receipt_items.length} món · không đính kèm
                  ảnh quét
                </Text>
              )}
              {isOfflineSession && (
                <Text style={s.muted}>
                  {loanReview
                    ? 'Vay/Nợ cần kết nối mạng để lưu.'
                    : 'Đang ngoại tuyến: giữ trên máy, có mạng sẽ đồng bộ.'}
                </Text>
              )}
            </>
          ) : picker ? (
            <>
              {picker === 'category' ? (
                <WidgetCategoryPicker
                  categories={data?.categories ?? []}
                  type={type === 'INCOME' ? 'INCOME' : 'EXPENSE'}
                  selectedId={categoryId}
                  onSelect={selected => {
                    setCategory(selected.id);
                    setPicker(null);
                  }}
                />
              ) : (
                <>
                  <Text style={s.label}>Chọn ví</Text>
                  {data?.wallets
                    .filter(
                      w => type !== 'LOAN_DEBT' || w.wallet_type !== 'SAVINGS',
                    )
                    .map(w =>
                      button(`${w.name} · ${w.currency}`, () => {
                        setWallet(w.id);
                        setPicker(null);
                      }),
                    )}
                </>
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
                {button(
                  'Vay/Nợ',
                  () => {
                    setType('LOAN_DEBT');
                    setVoiceVisible(false);
                    voice.cancel();
                  },
                  type === 'LOAN_DEBT',
                  ocrBusy,
                )}
              </View>
              <TextInput
                accessibilityLabel="Số tiền widget"
                placeholder="Số tiền"
                value={formatMoneyInputForCurrency(amount, moneyCurrency)}
                onChangeText={value =>
                  setAmount(
                    normalizeMoneyInputForCurrency(value, moneyCurrency),
                  )
                }
                keyboardType="decimal-pad"
                style={s.amount}
                editable={!ocrBusy}
              />
              {type === 'LOAN_DEBT' ? (
                <>
                  <View style={s.row}>
                    {button(
                      'Vay',
                      () => setLoanType('BORROWED'),
                      loanType === 'BORROWED',
                    )}
                    {button(
                      'Cho vay',
                      () => setLoanType('LENT'),
                      loanType === 'LENT',
                    )}
                  </View>
                  <TextInput
                    accessibilityLabel="Tên người vay nợ widget"
                    placeholder={
                      loanType === 'BORROWED' ? 'Vay từ ai?' : 'Cho ai vay?'
                    }
                    value={personName}
                    onChangeText={setPersonName}
                    maxLength={100}
                    style={s.input}
                    editable={!ocrBusy}
                  />
                  <TextInput
                    accessibilityLabel="Ngày hẹn trả widget"
                    placeholder="Hẹn trả YYYY-MM-DD (không bắt buộc)"
                    value={dueDate}
                    onChangeText={setDueDate}
                    style={s.input}
                    editable={!ocrBusy}
                  />
                  <Text style={s.muted}>Vay/Nợ cần kết nối mạng để lưu.</Text>
                </>
              ) : (
                <>
                  <Text style={s.label}>Danh mục</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={category?.name || 'Chọn danh mục'}
                    disabled={ocrBusy}
                    style={s.categoryCard}
                    onPress={() => setPicker('category')}
                  >
                    <View style={s.categoryIcon}>
                      <CategoryIcon icon={category?.icon} size={24} />
                    </View>
                    <View style={s.categoryCopy}>
                      <Text style={s.categoryName}>
                        {category?.name || 'Chọn danh mục'}
                      </Text>
                      <Text style={s.muted}>
                        {type === 'INCOME' ? 'Khoản thu' : 'Khoản chi'}
                      </Text>
                    </View>
                    <Text style={s.buttonText}>Đổi</Text>
                  </TouchableOpacity>
                </>
              )}
              <Text style={s.label}>Ví</Text>
              {button(
                wallet ? `${wallet.name} · ${wallet.currency}` : 'Chọn ví',
                () => setPicker('wallet'),
                false,
                ocrBusy,
              )}
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
                          type === 'LOAN_DEBT'
                            ? loanType === 'BORROWED'
                              ? 'Vay'
                              : 'Cho vay'
                            : voicePreview.draft.type === 'INCOME'
                            ? 'Thu'
                            : 'Chi'
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
                      if (type !== 'LOAN_DEBT' && type !== draft.type) {
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
                    scanning.current = false;
                    setOcrBusy(false);
                  })}
                </View>
              )}
              {warnings.map((w, i) => (
                <Text key={i} style={s.muted}>
                  {w}
                </Text>
              ))}
              {type !== 'LOAN_DEBT' && !!items.length && (
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
                        value={formatMoneyInputForCurrency(
                          item.amount,
                          moneyCurrency,
                        )}
                        keyboardType="decimal-pad"
                        style={[s.input, s.itemAmount]}
                        onChangeText={value =>
                          setItems(previous =>
                            previous.map((r, i) =>
                              i === index
                                ? {
                                    ...r,
                                    amount: normalizeMoneyInputForCurrency(
                                      value,
                                      moneyCurrency,
                                    ),
                                  }
                                : r,
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
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#EBC4A4',
    borderRadius: 18,
    backgroundColor: '#FFFDFB',
  },
  categoryIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0E2',
    borderRadius: 12,
  },
  categoryCopy: { flex: 1 },
  categoryName: { fontWeight: '700', fontSize: 16, color: '#4A2B1A' },
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
