import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CalendarDays, Camera, Mic, X } from 'lucide-react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
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
import { getWalletTypeMeta } from '../../constants/walletTypes';
import { formatCurrency } from '../../utils/format';

type Props = { entryUrl: string };
type ItemDraft = Omit<ReceiptItem, 'amount'> & { amount: string };
const dateLabel = (value: string) => value.split('-').reverse().join('/');
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
  const transactionRequestId = useRef<string | null>(null);
  const completed = useRef<'SAVED' | 'PENDING' | null>(null);
  const [completedResult, setCompletedResult] = useState<
    'SAVED' | 'PENDING' | null
  >(null);
  const [categoryId, setCategory] = useState<number | null>(null);
  const [walletId, setWallet] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(toDateKey(new Date()));
  const [currency, setCurrency] = useState<string | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [picker, setPicker] = useState<'category' | null>(null);
  const [datePicker, setDatePicker] = useState<'date' | 'dueDate' | null>(null);
  const [review, setReview] = useState<
    CreateTransactionPayload | WidgetLoanPayload | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [voiceOnly, setVoiceOnly] = useState(false);
  const [transcript, setTranscript] = useState('');
  const voice = useVoiceInput(setTranscript);
  const voicePending = useRef(false);
  const voiceOwner = useRef({ userId: user?.id, server });
  const choosingImage = useRef(false);
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
    voicePending.current = false;
    voice.cancel();
    homeWidget.closeQuickEntry(completed.current ?? undefined).catch(() => {
      if (alive.current)
        setError('Chưa đóng được cửa sổ. Bạn có thể bấm Đóng để thử lại.');
    });
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
      if (completed.current) close();
      else if (picker) setPicker(null);
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
        params.get('widgetType') === 'LOAN_DEBT'
          ? 'LOAN_DEBT'
          : params.get('widgetType') === 'INCOME'
          ? 'INCOME'
          : 'EXPENSE';
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
        setVoiceOnly(params.get('widgetAction') === 'VOICE');
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

  const scan = async (source: 'camera' | 'library') => {
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
    voicePending.current = false;
    voice.cancel();
    setVoiceVisible(false);
    try {
      const options = {
        mediaType: 'photo' as const,
        quality: 0.8 as const,
        maxWidth: 1600,
        maxHeight: 1600,
      };
      const picked =
        source === 'camera'
          ? await launchCamera({
              ...options,
              saveToPhotos: false,
            })
          : await launchImageLibrary({ ...options, selectionLimit: 1 });
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
  const chooseImage = () => {
    if (choosingImage.current || scanning.current || saving.current) return;
    choosingImage.current = true;
    Keyboard.dismiss();
    const owner = user?.id;
    const select = (source: 'camera' | 'library') => {
      choosingImage.current = false;
      if (
        alive.current &&
        latest.current.userId === owner &&
        latest.current.server === server
      )
        scan(source).catch(() => undefined);
    };
    Alert.alert(
      'Ảnh hóa đơn',
      'Chọn ảnh để đọc nội dung hóa đơn.',
      [
        { text: 'Chụp ảnh', onPress: () => select('camera') },
        { text: 'Chọn từ thư viện', onPress: () => select('library') },
        {
          text: 'Hủy',
          style: 'cancel',
          onPress: () => {
            choosingImage.current = false;
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          choosingImage.current = false;
        },
      },
    );
  };
  const startVoice = () => {
    if (ocrBusy || saving.current || voice.status !== 'idle') return;
    Keyboard.dismiss();
    setTranscript('');
    setVoiceVisible(true);
    voiceOwner.current = { userId: user?.id, server };
    voicePending.current = true;
    voice.toggle('').catch(() => undefined);
  };
  useEffect(() => {
    if (!ready) return;
    const action = initialAction.current;
    initialAction.current = null;
    if (action === 'VOICE') {
      startVoice();
    }
    if (action === 'CAMERA') chooseImage();
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
  useEffect(() => {
    if (!voicePending.current || voice.status !== 'idle' || !transcript.trim())
      return;
    voicePending.current = false;
    if (
      voiceOwner.current.userId !== user?.id ||
      voiceOwner.current.server !== server
    )
      return;
    const draft = parseVoiceTransactionDraft(transcript).draft;
    if (!draft) return;
    setAmount(String(draft.amount));
    setNote(draft.note || '');
    setDate(draft.transaction_date || toDateKey(new Date()));
    setCurrency(draft.currency || null);
    if (type !== 'LOAN_DEBT' && type !== draft.type) {
      setType(draft.type);
      setCategory(null);
    }
    setVoiceVisible(false);
    setVoiceOnly(false);
  }, [voice.status, transcript, user?.id, server, type]);
  const loanReview = review && 'principal_amount' in review ? review : null;
  const transactionReview = review && 'amount' in review ? review : null;
  const changeDate = (event: DateTimePickerEvent, selected?: Date) => {
    const target = datePicker;
    setDatePicker(null);
    if (!alive.current || event.type !== 'set' || !selected || !target) return;
    if (target === 'date') setDate(toDateKey(selected));
    else setDueDate(toDateKey(selected));
  };
  const openDate = (target: 'date' | 'dueDate') => {
    Keyboard.dismiss();
    setDatePicker(target);
  };
  const prepare = () => {
    if (
      !data ||
      busy ||
      ocrBusy ||
      voice.status !== 'idle' ||
      completed.current
    )
      return;
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
      } else {
        transactionRequestId.current ??= createClientRequestId();
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
            transactionRequestId.current,
          ),
        );
      }
      setError('');
      voice.cancel();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const save = async () => {
    if (!review || !token || !user?.id || saving.current || completed.current)
      return;
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
      ) {
        completed.current = result;
        setCompletedResult(result);
        await homeWidget.closeQuickEntry(result);
      }
    } catch (e) {
      if (alive.current)
        setError(
          completed.current
            ? 'Giao dịch đã được tiếp nhận. Bấm Đóng để trở về màn hình chính.'
            : getUserFriendlyErrorMessage(
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
      style={[s.backdrop, voiceOnly && s.voiceBackdrop]}
      behavior="height"
      onLayout={() => homeWidget.entryReady().catch(() => undefined)}
    >
      <View style={s.card}>
        {!voiceOnly && (
          <View style={s.header}>
            <Text style={s.title}>
              {voiceOnly
                ? 'Nhập bằng giọng nói'
                : review
                ? 'Kiểm tra giao dịch'
                : 'Thêm giao dịch'}
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
        )}
        {ready && voiceVisible && (
          <View style={[s.voiceBar, voiceOnly && s.voiceOnlyBar]}>
            <View style={s.row}>
              {voice.status === 'starting' || voice.status === 'stopping' ? (
                <ActivityIndicator size="small" color="#D87219" />
              ) : (
                <View
                  style={[s.recordDot, voice.status === 'idle' && s.recordIdle]}
                />
              )}
              <Text accessibilityLiveRegion="polite" style={s.voiceTitle}>
                {voice.status === 'starting'
                  ? 'Đang bật micro…'
                  : voice.status === 'listening'
                  ? 'Đang thu âm…'
                  : voice.status === 'stopping'
                  ? 'Đang xử lý giọng nói…'
                  : 'Nhấn Nói lại để thử lại'}
              </Text>
            </View>
            <Text style={s.muted} numberOfLines={3}>
              {transcript || 'Ví dụ: chi 25 nghìn tiền đi lại.'}
            </Text>
            {voice.status === 'idle' && !!transcript && !voicePreview.draft && (
              <Text style={s.muted}>{voicePreview.issues.join(' ')}</Text>
            )}
            <View style={s.row}>
              {button('Hủy thu âm', () => {
                voicePending.current = false;
                voice.cancel();
                setVoiceVisible(false);
                if (voiceOnly) close();
              })}
              {button(
                voice.status === 'idle' ? 'Nói lại' : 'Dừng thu âm',
                () => {
                  if (voice.status === 'idle') startVoice();
                  else voice.toggle('').catch(() => undefined);
                },
                true,
                voice.status === 'starting' || voice.status === 'stopping',
              )}
            </View>
          </View>
        )}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.content, voiceOnly && s.voiceOnlyContent]}
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
          ) : voiceOnly ? null : review ? (
            <>
              {!!completedResult && (
                <Text accessibilityLiveRegion="polite" style={s.review}>
                  {completedResult === 'SAVED'
                    ? 'Đã lưu giao dịch.'
                    : 'Đã lưu trên máy, đang chờ đồng bộ.'}
                </Text>
              )}
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
              <WidgetCategoryPicker
                categories={data?.categories ?? []}
                type={type === 'INCOME' ? 'INCOME' : 'EXPENSE'}
                selectedId={categoryId}
                onSelect={selected => {
                  setCategory(selected.id);
                  setPicker(null);
                }}
              />
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
              <View style={s.amountField}>
                <Text style={s.label}>Số tiền</Text>
                <View style={s.amountBox}>
                  <TextInput
                    accessibilityLabel="Số tiền widget"
                    placeholder="0"
                    placeholderTextColor="#C99A72"
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
                  <Text style={s.amountCurrency}>{moneyCurrency}</Text>
                </View>
              </View>
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
                  <View style={s.row}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Ngày hẹn trả widget"
                      onPress={() => openDate('dueDate')}
                      disabled={ocrBusy}
                      style={[s.dateField, s.dueDateField]}
                    >
                      <CalendarDays size={19} color="#A75410" />
                      <Text style={s.dateCopy}>
                        {dueDate
                          ? `Hẹn trả: ${dateLabel(dueDate)}`
                          : 'Hẹn trả · không bắt buộc'}
                      </Text>
                    </TouchableOpacity>
                    {!!dueDate && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Bỏ ngày hẹn trả"
                        onPress={() => setDueDate('')}
                        disabled={ocrBusy}
                        style={s.clearDate}
                      >
                        <X size={18} color="#886449" />
                      </TouchableOpacity>
                    )}
                  </View>
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={s.walletStrip}
                contentContainerStyle={s.wallets}
              >
                {data?.wallets
                  .filter(
                    w => type !== 'LOAN_DEBT' || w.wallet_type !== 'SAVINGS',
                  )
                  .map(w => {
                    const selected = w.id === walletId;
                    const WalletIcon = getWalletTypeMeta(w.wallet_type).Icon;
                    return (
                      <TouchableOpacity
                        key={w.id}
                        accessibilityRole="radio"
                        accessibilityLabel={`${w.name} · ${w.currency}`}
                        accessibilityState={{ selected }}
                        disabled={ocrBusy}
                        onPress={() => setWallet(w.id)}
                        style={[s.walletCard, selected && s.walletSelected]}
                      >
                        <View
                          style={[
                            s.walletIcon,
                            selected && s.walletIconSelected,
                          ]}
                        >
                          <WalletIcon
                            size={19}
                            color={selected ? '#FFF' : '#D87219'}
                          />
                        </View>
                        <Text style={s.walletName} numberOfLines={1}>
                          {w.name}
                        </Text>
                        <Text style={s.walletCurrency} numberOfLines={1}>
                          {formatCurrency(Number(w.balance || 0), w.currency)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
              <TextInput
                accessibilityLabel="Ghi chú widget"
                placeholder="Ghi chú"
                value={note}
                onChangeText={setNote}
                style={s.input}
                editable={!ocrBusy}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Ngày giao dịch widget"
                onPress={() => openDate('date')}
                disabled={ocrBusy}
                style={s.dateField}
              >
                <CalendarDays size={19} color="#A75410" />
                <Text style={s.dateCopy}>Ngày giao dịch</Text>
                <Text style={s.dateValue}>{dateLabel(date)}</Text>
              </TouchableOpacity>
              <View style={s.row}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Nói để nhập"
                  disabled={ocrBusy}
                  onPress={() => {
                    if (voice.status === 'idle') startVoice();
                    else voice.toggle('').catch(() => undefined);
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
                  onPress={chooseImage}
                  style={s.tool}
                >
                  <Camera size={21} color="#A75410" />
                  <Text style={s.buttonText}>Ảnh hóa đơn</Text>
                </TouchableOpacity>
              </View>
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
        {ready && !review && !picker && datePicker && (
          <DateTimePicker
            value={
              new Date(
                `${datePicker === 'dueDate' ? dueDate || date : date}T12:00:00`,
              )
            }
            mode="date"
            onChange={changeDate}
          />
        )}
        {ready && !picker && !voiceOnly && !voiceVisible && (
          <View style={s.footer}>
            {completedResult ? (
              button('Đóng', close, true, busy)
            ) : review ? (
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
  voiceBackdrop: { justifyContent: 'flex-end', paddingVertical: 24 },
  voiceOnlyBar: { margin: 0, backgroundColor: '#FFF9F2', padding: 16 },
  voiceOnlyContent: { padding: 0 },
  voiceBar: {
    margin: 16,
    padding: 14,
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#FFF0DF',
  },
  voiceTitle: { flex: 1, fontWeight: '600', color: '#4A2B1A' },
  recordDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#CC4C33',
  },
  recordIdle: { backgroundColor: '#AE9279' },
  walletStrip: { flexGrow: 0 },
  wallets: { gap: 10, paddingRight: 10, paddingBottom: 2 },
  walletCard: {
    width: 138,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F2D9C0',
    backgroundColor: '#FFF6EF',
  },
  walletSelected: { backgroundColor: '#FFF0DF', borderColor: '#FF8800' },
  walletIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  walletIconSelected: { backgroundColor: '#FF8800' },
  walletName: { color: '#4A2B1A', fontWeight: '700', fontSize: 14 },
  walletCurrency: {
    color: '#8A623F',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECD6C1',
    backgroundColor: '#FFFDFB',
  },
  dateCopy: { flex: 1, color: '#886449', flexShrink: 1 },
  dateValue: { color: '#4A2B1A', fontWeight: '600' },
  clearDate: {
    width: 44,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueDateField: { flex: 1 },
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
  amountField: { gap: 6 },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    minHeight: 60,
    borderWidth: 1,
    borderColor: '#EBC4A4',
    borderRadius: 16,
    backgroundColor: '#FFF6EF',
  },
  amount: {
    flex: 1,
    minWidth: 0,
    fontSize: 28,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: '#4A2B1A',
    paddingVertical: 10,
    paddingHorizontal: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  amountCurrency: {
    color: '#8A623F',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 10,
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
