import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, X } from 'lucide-react-native';
import { ActionButton, FormField } from '../../components/FormControls';
import BillReminderSettings from '../../components/BillReminderSettings';
import BillSuggestions from '../../components/BillSuggestions';
import BillUpcomingSummary from '../../components/BillUpcomingSummary';
import BillBookBackup from '../../components/BillBookBackup';
import PlanningSyncControls from '../../components/PlanningSyncControls';
import BillPaymentReview from '../../components/BillPaymentReview';
import { useBillPaymentChecks } from '../../hooks/useBillPaymentChecks';
import { refreshPaymentLink } from '../../services/billPaymentChecks';
import type { BillPaymentTarget } from '../../utils/billPaymentChecks';
import type { BillSuggestion } from '../../utils/billSuggestions';
import { useAuth } from '../../context/AuthContext';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { getApiBaseUrl } from '../../services/api';
import {
  recurringBillsService,
  type BillScope,
} from '../../services/recurringBills';
import { transactionsService } from '../../services/transactions';
import type { ApiTransaction } from '../../types/transaction';
import { formatCurrency } from '../../utils/format';
import { getTransactionDateKey } from '../../utils/mapTransactions';
import {
  formatMoneyInputForCurrency,
  normalizeMoneyInputForCurrency,
  parsePositiveMoneyInput,
} from '../../utils/moneyInput';
import { getCashFlowType } from '../../utils/transactionClassification';
import {
  billDateOffset,
  billOccurrences,
  validateBillInput,
  isBillDate,
  type BillBook,
  type BillCycle,
  type BillOccurrence,
  type BillPayment,
  type RecurringBill,
} from '../../utils/recurringBills';

type Props = NativeStackScreenProps<RootStackParamList, 'RecurringBills'>;
const cycleNames: Record<BillCycle, string> = {
  WEEKLY: 'Hằng tuần',
  MONTHLY: 'Hằng tháng',
  YEARLY: 'Hằng năm',
};
const dateLabel = (date: string) => date.split('-').reverse().join('/');
const amountLabel = (
  bill: Pick<RecurringBill, 'kind' | 'minAmount' | 'maxAmount' | 'currency'>,
) =>
  bill.kind === 'FIXED'
    ? formatCurrency(bill.minAmount, bill.currency)
    : `${formatCurrency(bill.minAmount, bill.currency)} – ${formatCurrency(
        bill.maxAmount,
        bill.currency,
      )}`;
type Editor = {
  id?: string;
  label: string;
  cycle: BillCycle;
  anchorDate: string;
  startDate?: string;
  reminderEnabled?: boolean;
  kind: 'FIXED' | 'VARIABLE';
  min: string;
  max: string;
  currency: string;
  note: string;
};
type Picker = {
  occurrence: BillOccurrence;
  rows: ApiTransaction[];
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
};

function RecurringBillsContent({
  navigation,
  route,
  scope,
  token,
  currency,
}: Props & { scope: BillScope; token: string; currency: string }) {
  const [book, setBook] = useState<BillBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const scrollRef = useRef<ScrollView>(null);
  const editorIsOpen = Boolean(editor);
  useEffect(() => {
    if (editorIsOpen) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [editorIsOpen]);
  const [sourceSuggestion, setSourceSuggestion] =
    useState<BillSuggestion | null>(null);
  const [showDate, setShowDate] = useState(false);
  const [tab, setTab] = useState<'PENDING' | 'DONE' | 'BILLS'>('PENDING');
  const [visible, setVisible] = useState(20);
  const [reminderFilter, setReminderFilter] = useState(() => {
    const date = route.params?.reminderDate;
    return date && isBillDate(date) ? date : null;
  });
  useEffect(() => {
    const date = route.params?.reminderDate;
    setReminderFilter(date && isBillDate(date) ? date : null);
    if (date && isBillDate(date)) {
      setTab('PENDING');
      setVisible(20);
    }
  }, [route.params?.reminderDate]);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [today, setToday] = useState(() =>
    getTransactionDateKey(new Date().toISOString()),
  );
  const { run, busy } = useSingleFlight();
  const paymentChecks = useBillPaymentChecks(
    book,
    token,
    tab === 'DONE' && !editor,
  );
  const active = useRef(false);
  const pickerRevision = useRef(0);
  const loadRevision = useRef(0);
  const load = useCallback(async () => {
    const revision = ++loadRevision.current;
    try {
      const data = await recurringBillsService.load(scope);
      if (!active.current || revision !== loadRevision.current) return;
      setBook(data);
      setError(null);
    } catch (reason) {
      if (active.current && revision === loadRevision.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Chưa đọc được lịch hóa đơn.',
        );
    }
  }, [scope]);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      setToday(getTransactionDateKey(new Date().toISOString()));
      load();
      return () => {
        active.current = false;
        loadRevision.current += 1;
        pickerRevision.current += 1;
      };
    }, [load]),
  );
  const execute = (operation: () => Promise<unknown>, after?: () => void) =>
    run(async () => {
      if (!active.current) return;
      try {
        await operation();
        if (!active.current) return;
        after?.();
        await load();
      } catch (reason) {
        if (active.current)
          Alert.alert(
            'Chưa thực hiện được',
            reason instanceof Error ? reason.message : 'Vui lòng thử lại.',
          );
      }
    });
  const occurrences = useMemo(
    () =>
      book
        ? billOccurrences(book, '2000-01-01', billDateOffset(today, 90), today)
        : [],
    [book, today],
  );
  const displayed = occurrences
    .filter(item =>
      tab === 'DONE'
        ? ['PAID', 'SKIPPED'].includes(item.status)
        : ['PENDING', 'OVERDUE'].includes(item.status),
    )
    .filter(
      item =>
        !reminderFilter ||
        tab !== 'PENDING' ||
        (!item.bill.paused &&
          !item.bill.archived &&
          item.bill.reminderEnabled !== false &&
          [0, 1, 3].some(
            lead => item.dueDate === billDateOffset(reminderFilter, lead),
          )),
    );
  if (tab === 'DONE') displayed.reverse();
  const closePicker = () => {
    pickerRevision.current += 1;
    setPicker(null);
  };
  const fetchPayments = async (occurrence: BillOccurrence, page = 1) => {
    const revision = ++pickerRevision.current;
    setPicker(previous => ({
      occurrence,
      rows: page === 1 ? [] : previous?.rows ?? [],
      page,
      totalPages: previous?.totalPages ?? 1,
      loading: true,
      error: null,
    }));
    try {
      const result = await transactionsService.getPage(token, {
        type: 'EXPENSE',
        cash_flow: 'normal',
        from: billDateOffset(occurrence.dueDate, -31),
        to: billDateOffset(occurrence.dueDate, 31),
        page,
        limit: 40,
      });
      if (!active.current || revision !== pickerRevision.current) return;
      setPicker(previous => ({
        occurrence,
        rows: [
          ...(page === 1 ? [] : previous?.rows ?? []),
          ...result.data.filter(
            item =>
              item.currency === occurrence.bill.currency &&
              item.type === 'EXPENSE' &&
              getCashFlowType(item.category) === 'normal',
          ),
        ].filter(
          (item, index, rows) =>
            rows.findIndex(row => row.id === item.id) === index,
        ),
        page,
        totalPages: result.meta.totalPages,
        loading: false,
        error: null,
      }));
    } catch {
      if (active.current && revision === pickerRevision.current)
        setPicker(previous =>
          previous
            ? {
                ...previous,
                page: page - 1,
                loading: false,
                error: 'Chưa tải được giao dịch. Lịch hóa đơn được giữ nguyên.',
              }
            : null,
        );
    }
  };
  const confirmPayment = (
    occurrence: BillOccurrence,
    transaction: ApiTransaction,
  ) => {
    const revision = pickerRevision.current;
    const amount = Math.abs(Number(transaction.amount));
    const outside =
      amount < occurrence.bill.minAmount || amount > occurrence.bill.maxAmount;
    Alert.alert(
      'Liên kết giao dịch đã trả?',
      `${occurrence.bill.label} · kỳ ${dateLabel(
        occurrence.dueDate,
      )}\nDự kiến: ${amountLabel(occurrence.bill)}\nĐã ghi: ${formatCurrency(
        amount,
        transaction.currency,
      )} · ${dateLabel(getTransactionDateKey(transaction.transaction_date))}\n${
        transaction.note?.trim() || 'Không có ghi chú'
      }${
        outside
          ? '\nSố tiền thực tế khác dự kiến. Hãy kiểm tra trước khi xác nhận.'
          : ''
      }\nChỉ lưu liên kết trên máy, không trừ tiền hoặc tạo giao dịch mới.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: () => {
            if (active.current && revision === pickerRevision.current)
              execute(
                () =>
                  recurringBillsService.linkPayment(
                    scope,
                    occurrence.bill.id,
                    occurrence.dueDate,
                    transaction,
                  ),
                closePicker,
              );
          },
        },
      ],
    );
  };
  const confirmPeriod = (item: BillOccurrence) => {
    const reopen = ['PAID', 'SKIPPED'].includes(item.status);
    Alert.alert(
      reopen ? 'Mở lại kỳ hóa đơn?' : 'Bỏ qua kỳ này?',
      `${item.bill.label} · ${dateLabel(item.dueDate)}\n${
        reopen
          ? 'Chỉ gỡ trạng thái xử lý trên máy, không tạo, sửa hoặc xóa giao dịch. Kỳ chưa trả có thể được nhắc lại theo cài đặt.'
          : 'Chỉ bỏ qua kỳ này. Các kỳ tiếp theo vẫn giữ lịch.'
      }`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: () =>
            execute(() =>
              reopen
                ? recurringBillsService.reopen(
                    scope,
                    item.bill.id,
                    item.dueDate,
                    item.payment,
                  )
                : recurringBillsService.skip(scope, item.bill.id, item.dueDate),
            ),
        },
      ],
    );
  };
  const confirmPaymentRefresh = (
    target: BillPaymentTarget,
    current: BillPayment,
  ) => {
    const isCurrent = paymentChecks.capture();
    const old = target.period.payment;
    Alert.alert(
      'Cập nhật liên kết?',
      `${target.bill.label} · kỳ ${dateLabel(
        target.period.dueDate,
      )}\nĐã lưu: ${formatCurrency(old.amount, old.currency)} · ${dateLabel(
        old.date,
      )}\n${old.note || 'Không có ghi chú'}\nHiện tại: ${formatCurrency(
        current.amount,
        current.currency,
      )} · ${dateLabel(current.date)}\n${
        current.note || 'Không có ghi chú'
      }\nChỉ cập nhật thông tin liên kết trên máy; không tạo hoặc sửa giao dịch, không trừ tiền.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Cập nhật',
          onPress: () => {
            if (isCurrent())
              execute(() =>
                refreshPaymentLink(scope, token, target, current, isCurrent),
              );
          },
        },
      ],
    );
  };
  const editBill = (bill?: RecurringBill) => {
    setSourceSuggestion(null);
    setShowDate(false);
    setEditor(
      bill
        ? { ...bill, min: String(bill.minAmount), max: String(bill.maxAmount) }
        : {
            label: '',
            anchorDate: today,
            cycle: 'MONTHLY',
            kind: 'FIXED',
            min: '',
            max: '',
            currency,
            note: '',
          },
    );
  };
  const saveEditor = () => {
    if (!editor) return;
    try {
      const input = validateBillInput({
        label: editor.label,
        cycle: editor.cycle,
        anchorDate: editor.anchorDate,
        startDate: editor.startDate,
        reminderEnabled: editor.reminderEnabled,
        kind: editor.kind,
        minAmount: Number(parsePositiveMoneyInput(editor.min)),
        maxAmount: Number(
          parsePositiveMoneyInput(
            editor.kind === 'FIXED' ? editor.min : editor.max,
          ),
        ),
        currency: editor.currency,
        note: editor.note,
      });
      const persist = () =>
        execute(
          () =>
            recurringBillsService.save(
              scope,
              input,
              editor.id,
              sourceSuggestion?.key,
            ),
          () => {
            setEditor(null);
            setSourceSuggestion(null);
            setShowDate(false);
            setTab('BILLS');
          },
        );
      if (sourceSuggestion)
        Alert.alert(
          'Tạo lịch theo dõi?',
          `${input.label}\n${amountLabel(input)}\n${
            cycleNames[input.cycle]
          } · Theo dõi từ ${dateLabel(
            input.startDate ?? input.anchorDate,
          )}\nChỉ tạo lịch dự kiến, không tạo giao dịch hoặc đánh dấu các khoản cũ đã trả. Áp dụng cài đặt nhắc hóa đơn hiện tại.`,
          [
            { text: 'Hủy', style: 'cancel' },
            {
              text: 'Tạo lịch',
              onPress: () => {
                if (editorRef.current === editor) persist();
              },
            },
          ],
        );
      else persist();
    } catch (reason) {
      Alert.alert(
        'Kiểm tra lịch hóa đơn',
        reason instanceof Error ? reason.message : 'Dữ liệu chưa hợp lệ.',
      );
    }
  };
  const change = (patch: Partial<Editor>) =>
    setEditor(value =>
      value
        ? {
            ...value,
            ...((patch.anchorDate && patch.anchorDate !== value.anchorDate) ||
            (patch.cycle && patch.cycle !== value.cycle)
              ? { startDate: undefined }
              : {}),
            ...patch,
          }
        : null,
    );
  const updateMoney = (field: 'min' | 'max', value: string) =>
    change({
      [field]: normalizeMoneyInputForCurrency(value, editor?.currency),
    });

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>
        <View style={styles.grow}>
          <Text style={styles.title}>Hóa đơn định kỳ</Text>
          <Text style={styles.muted}>Lịch chi tiêu của bạn</Text>
        </View>
      </View>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.muted}>
          Lưu riêng trên máy theo tài khoản. Lịch dự kiến không thay đổi số dư.
        </Text>
        {error ? (
          <View style={styles.card}>
            <Text style={styles.error}>{error}</Text>
            <ActionButton
              label="Thử tải lại lịch"
              secondary
              onPress={() => load()}
            />
          </View>
        ) : null}
        {!book && !error ? (
          <ActivityIndicator
            color="#FF8C00"
            accessibilityLabel="Đang tải lịch hóa đơn"
          />
        ) : null}
        {book && !error ? (
          <>
            {!editor && !reminderFilter ? (
              <BillReminderSettings scope={scope} book={book} />
            ) : null}
            {!editor && !reminderFilter ? (
              <BillBookBackup scope={scope} onRestored={load} />
            ) : null}
            {!editor && !reminderFilter ? (
              <PlanningSyncControls scope={scope} />
            ) : null}
            {reminderFilter ? (
              <View style={styles.card}>
                <Text style={styles.muted}>
                  Các khoản từ lời nhắc ngày {dateLabel(reminderFilter)}. Kỳ đã
                  xử lý được giữ trong Đã xử lý.
                </Text>
                <ActionButton
                  label="Xem tất cả kỳ"
                  secondary
                  onPress={() => {
                    setReminderFilter(null);
                    navigation.setParams({ reminderDate: undefined });
                  }}
                />
              </View>
            ) : null}
            {!editor ? (
              !reminderFilter ? (
                <ActionButton
                  label="Thêm lịch hóa đơn"
                  onPress={() => editBill()}
                />
              ) : null
            ) : (
              <View style={styles.card} pointerEvents={busy ? 'none' : 'auto'}>
                <View style={styles.row}>
                  <Text style={[styles.heading, styles.grow]}>
                    {editor.id ? 'Sửa lịch' : 'Lịch mới'}
                  </Text>
                  <TouchableOpacity
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Đóng form lịch hóa đơn"
                    style={styles.smallButton}
                    onPress={() => {
                      setEditor(null);
                      setSourceSuggestion(null);
                      setShowDate(false);
                    }}
                  >
                    <X size={22} color="#79563D" />
                  </TouchableOpacity>
                </View>
                {sourceSuggestion ? (
                  <Text style={styles.muted}>
                    Gợi ý từ {sourceSuggestion.evidence.length} lần chi đã tải.
                    Hãy kiểm tra tên, chu kỳ và khoảng tiền trước khi tạo lịch.
                  </Text>
                ) : null}
                <FormField
                  label="Tên hóa đơn"
                  accessibilityLabel="Tên hóa đơn"
                  value={editor.label}
                  onChangeText={label => change({ label })}
                  maxLength={100}
                  placeholder="Ví dụ: Tiền nhà"
                />
                <Text style={styles.label}>Lặp lại</Text>
                <View style={styles.row}>
                  {(Object.keys(cycleNames) as BillCycle[]).map(cycle => (
                    <TouchableOpacity
                      key={cycle}
                      accessibilityRole="button"
                      accessibilityLabel={cycleNames[cycle]}
                      accessibilityState={{ selected: editor.cycle === cycle }}
                      style={[
                        styles.option,
                        editor.cycle === cycle && styles.selected,
                      ]}
                      onPress={() => change({ cycle })}
                    >
                      <Text style={styles.label}>{cycleNames[cycle]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.label}>
                  {editor.startDate
                    ? 'Ngày gốc của chu kỳ'
                    : 'Ngày đến hạn đầu tiên'}
                </Text>
                {editor.startDate ? (
                  <Text style={styles.muted}>
                    Theo dõi từ {dateLabel(editor.startDate)}. Không thêm các kỳ
                    cũ trước ngày này.
                  </Text>
                ) : null}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Chọn ngày đến hạn đầu tiên"
                  style={styles.date}
                  onPress={() => setShowDate(true)}
                >
                  <Text style={styles.label}>
                    {dateLabel(editor.anchorDate)}
                  </Text>
                </TouchableOpacity>
                {showDate ? (
                  <DateTimePicker
                    value={new Date(`${editor.anchorDate}T12:00:00`)}
                    mode="date"
                    minimumDate={new Date(2000, 0, 1)}
                    maximumDate={new Date(2199, 11, 31)}
                    onChange={(_event, date) => {
                      setShowDate(false);
                      if (date)
                        change({
                          anchorDate: `${date.getFullYear()}-${String(
                            date.getMonth() + 1,
                          ).padStart(2, '0')}-${String(date.getDate()).padStart(
                            2,
                            '0',
                          )}`,
                        });
                    }}
                  />
                ) : null}
                <Text style={styles.muted}>
                  Tháng thiếu ngày đã chọn sẽ dùng ngày cuối tháng, giữ nguyên
                  ngày gốc cho các tháng sau.
                </Text>
                <View style={styles.row}>
                  {(['FIXED', 'VARIABLE'] as const).map(kind => (
                    <TouchableOpacity
                      key={kind}
                      accessibilityRole="button"
                      accessibilityLabel={
                        kind === 'FIXED' ? 'Tiền cố định' : 'Tiền biến thiên'
                      }
                      accessibilityState={{ selected: editor.kind === kind }}
                      style={[
                        styles.option,
                        editor.kind === kind && styles.selected,
                      ]}
                      onPress={() => change({ kind })}
                    >
                      <Text style={styles.label}>
                        {kind === 'FIXED' ? 'Cố định' : 'Khoảng dự kiến'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <FormField
                  label="Tiền tệ"
                  accessibilityLabel="Tiền tệ hóa đơn"
                  autoCapitalize="characters"
                  maxLength={3}
                  value={editor.currency}
                  onChangeText={value =>
                    change({ currency: value.toUpperCase(), min: '', max: '' })
                  }
                />
                <View style={styles.row}>
                  <View style={styles.grow}>
                    <FormField
                      label={editor.kind === 'FIXED' ? 'Số tiền' : 'Từ'}
                      accessibilityLabel="Số tiền hóa đơn"
                      keyboardType="decimal-pad"
                      value={formatMoneyInputForCurrency(
                        editor.min,
                        editor.currency,
                      )}
                      onChangeText={value => updateMoney('min', value)}
                    />
                  </View>
                  {editor.kind === 'VARIABLE' ? (
                    <View style={styles.grow}>
                      <FormField
                        label="Đến"
                        accessibilityLabel="Số tiền tối đa"
                        keyboardType="decimal-pad"
                        value={formatMoneyInputForCurrency(
                          editor.max,
                          editor.currency,
                        )}
                        onChangeText={value => updateMoney('max', value)}
                      />
                    </View>
                  ) : null}
                </View>
                <FormField
                  label="Ghi chú"
                  accessibilityLabel="Ghi chú hóa đơn"
                  value={editor.note}
                  onChangeText={note => change({ note })}
                  multiline
                  maxLength={500}
                />
                <ActionButton
                  label="Lưu lịch"
                  loading={busy}
                  onPress={saveEditor}
                />
              </View>
            )}
            {!reminderFilter ? (
              <BillSuggestions
                scope={scope}
                token={token}
                today={today}
                book={book}
                hidden={Boolean(editor)}
                onBookChange={load}
                onFollow={candidate => {
                  setSourceSuggestion(candidate);
                  setShowDate(false);
                  setEditor({
                    ...candidate.input,
                    min: String(candidate.input.minAmount),
                    max: String(candidate.input.maxAmount),
                  });
                }}
              />
            ) : null}
            <View style={styles.row}>
              {(['PENDING', 'DONE', 'BILLS'] as const).map(value => (
                <TouchableOpacity
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={
                    {
                      PENDING: 'Chưa trả',
                      DONE: 'Đã xử lý',
                      BILLS: 'Lịch đã tạo',
                    }[value]
                  }
                  accessibilityState={{ selected: value === tab }}
                  style={[styles.option, tab === value && styles.selected]}
                  onPress={() => {
                    setTab(value);
                    setVisible(20);
                    if (reminderFilter && value !== 'PENDING') {
                      setReminderFilter(null);
                      navigation.setParams({ reminderDate: undefined });
                    }
                  }}
                >
                  <Text style={styles.label}>
                    {
                      {
                        PENDING: 'Chưa trả',
                        DONE: 'Đã xử lý',
                        BILLS: 'Lịch đã tạo',
                      }[value]
                    }
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {tab !== 'BILLS' ? (
              <>
                <Text style={styles.muted}>
                  Đến {dateLabel(billDateOffset(today, 90))}, gồm các kỳ cũ chưa
                  xử lý. Lịch tạm dừng ẩn các kỳ chưa trả; khi bật lại, các kỳ
                  này xuất hiện lại.
                </Text>
                {tab === 'DONE' && paymentChecks.targets.length ? (
                  <View style={styles.card}>
                    <Text style={styles.heading}>Đối chiếu thanh toán</Text>
                    <Text style={styles.muted}>
                      {paymentChecks.loading
                        ? `Đang kiểm tra ${paymentChecks.progress}/${paymentChecks.targets.length} liên kết…`
                        : 'Kiểm tra giao dịch gốc đã sửa hoặc không còn truy cập được. Không tự gỡ liên kết hay ghi tiền.'}
                    </Text>
                    <ActionButton
                      label={
                        paymentChecks.loading
                          ? 'Dừng kiểm tra liên kết'
                          : 'Kiểm tra liên kết'
                      }
                      secondary
                      disabled={busy}
                      onPress={
                        paymentChecks.loading
                          ? paymentChecks.cancel
                          : paymentChecks.check
                      }
                    />
                    {paymentChecks.error ? (
                      <Text style={styles.error}>{paymentChecks.error}</Text>
                    ) : null}
                  </View>
                ) : null}
                {!displayed.length ? (
                  <Text style={styles.empty}>
                    {tab === 'PENDING'
                      ? 'Chưa có hóa đơn chờ thanh toán.'
                      : 'Chưa có kỳ được xử lý.'}
                  </Text>
                ) : null}
                {displayed.slice(0, visible).map(item => (
                  <View
                    key={`${item.bill.id}:${item.dueDate}`}
                    style={styles.card}
                  >
                    <View style={styles.row}>
                      <Text style={[styles.heading, styles.grow]}>
                        {item.bill.label}
                      </Text>
                      <Text
                        style={
                          item.status === 'OVERDUE'
                            ? styles.error
                            : styles.muted
                        }
                      >
                        {
                          {
                            PENDING:
                              item.dueDate === today ? 'Hôm nay' : 'Sắp tới',
                            OVERDUE: 'Quá hạn',
                            PAID: 'Đã liên kết',
                            SKIPPED: 'Đã bỏ qua',
                          }[item.status]
                        }
                      </Text>
                    </View>
                    <Text style={styles.amount}>{amountLabel(item.bill)}</Text>
                    <Text style={styles.muted}>
                      Đến hạn {dateLabel(item.dueDate)} ·{' '}
                      {cycleNames[item.bill.cycle]}
                    </Text>
                    {item.bill.archived ? (
                      <Text style={styles.muted}>
                        Lịch đã xóa · giữ lịch sử kỳ
                      </Text>
                    ) : null}
                    {item.payment ? (
                      <Text style={styles.muted}>
                        Giao dịch #{item.payment.id}:{' '}
                        {formatCurrency(
                          item.payment.amount,
                          item.payment.currency,
                        )}{' '}
                        · {dateLabel(item.payment.date)}
                      </Text>
                    ) : null}
                    <BillPaymentReview
                      item={item}
                      results={paymentChecks.results}
                      busy={busy || paymentChecks.loading}
                      onRefresh={confirmPaymentRefresh}
                    />
                    {['PENDING', 'OVERDUE'].includes(item.status) ? (
                      <View style={styles.row}>
                        <View style={styles.grow}>
                          <ActionButton
                            label="Chọn giao dịch đã trả"
                            disabled={busy}
                            onPress={() => fetchPayments(item)}
                          />
                        </View>
                        <TouchableOpacity
                          disabled={busy}
                          accessibilityRole="button"
                          accessibilityLabel={`Bỏ qua ${item.bill.label} kỳ ${item.dueDate}`}
                          onPress={() => confirmPeriod(item)}
                          style={styles.smallButton}
                        >
                          <Text style={styles.label}>Bỏ qua</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <ActionButton
                        label="Mở lại kỳ"
                        secondary
                        disabled={busy}
                        onPress={() => confirmPeriod(item)}
                      />
                    )}
                  </View>
                ))}
                {displayed.length > visible ? (
                  <ActionButton
                    label="Xem thêm kỳ"
                    secondary
                    onPress={() => setVisible(value => value + 20)}
                  />
                ) : null}
              </>
            ) : (
              <>
                <BillUpcomingSummary book={book} today={today} />
                {!book.bills.some(bill => !bill.archived) ? (
                  <Text style={styles.empty}>
                    Thêm tiền nhà, điện, nước hoặc thuê bao để theo dõi kỳ tới.
                  </Text>
                ) : null}
                {book.bills
                  .filter(bill => !bill.archived)
                  .map(bill => (
                    <View key={bill.id} style={styles.card}>
                      <View style={styles.row}>
                        <Text style={[styles.heading, styles.grow]}>
                          {bill.label}
                        </Text>
                        <Text style={styles.muted}>
                          {bill.paused ? 'Tạm dừng' : 'Đang theo dõi'}
                        </Text>
                      </View>
                      <Text style={styles.amount}>{amountLabel(bill)}</Text>
                      <Text style={styles.muted}>
                        {cycleNames[bill.cycle]} · từ{' '}
                        {dateLabel(bill.startDate ?? bill.anchorDate)}
                      </Text>
                      {bill.startDate ? (
                        <Text style={styles.muted}>
                          Ngày gốc chu kỳ: {dateLabel(bill.anchorDate)}
                        </Text>
                      ) : null}
                      {bill.note ? (
                        <Text style={styles.muted}>{bill.note}</Text>
                      ) : null}
                      <ActionButton
                        label={
                          bill.reminderEnabled === false
                            ? 'Bật nhắc lịch này'
                            : 'Tắt nhắc lịch này'
                        }
                        secondary
                        disabled={busy}
                        onPress={() =>
                          execute(() =>
                            recurringBillsService.setReminder(
                              scope,
                              bill.id,
                              bill.reminderEnabled === false,
                            ),
                          )
                        }
                      />
                      <View style={styles.row}>
                        <ActionButton
                          label="Sửa lịch"
                          secondary
                          disabled={busy}
                          onPress={() => editBill(bill)}
                        />
                        <ActionButton
                          label={bill.paused ? 'Tiếp tục lịch' : 'Tạm dừng'}
                          secondary
                          disabled={busy}
                          onPress={() =>
                            execute(() =>
                              recurringBillsService.setPaused(
                                scope,
                                bill.id,
                                !bill.paused,
                              ),
                            )
                          }
                        />
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={`Xóa lịch ${bill.label}`}
                          disabled={busy}
                          style={styles.smallButton}
                          onPress={() =>
                            Alert.alert(
                              'Xóa lịch hóa đơn?',
                              `${bill.label}\nNgừng theo dõi lịch. Giao dịch gốc được giữ nguyên; liên kết đã trả vẫn được giữ để chống dùng trùng.`,
                              [
                                { text: 'Hủy', style: 'cancel' },
                                {
                                  text: 'Xóa lịch',
                                  style: 'destructive',
                                  onPress: () =>
                                    execute(() =>
                                      recurringBillsService.archive(
                                        scope,
                                        bill.id,
                                      ),
                                    ),
                                },
                              ],
                            )
                          }
                        >
                          <Text style={styles.error}>Xóa</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
              </>
            )}
          </>
        ) : null}
      </ScrollView>
      <Modal
        visible={!!picker}
        transparent
        animationType="slide"
        onRequestClose={closePicker}
      >
        <SafeAreaView style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.row}>
              <Text style={[styles.heading, styles.grow]}>
                Giao dịch đã trả
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Đóng chọn giao dịch"
                onPress={closePicker}
                style={styles.smallButton}
              >
                <X size={22} color="#593420" />
              </TouchableOpacity>
            </View>
            <Text style={styles.muted}>
              Khoản chi {picker?.occurrence.bill.currency} trong 31 ngày
              trước/sau kỳ {picker ? dateLabel(picker.occurrence.dueDate) : ''}.
              Chọn giao dịch rồi xác nhận liên kết.
            </Text>
            <ScrollView contentContainerStyle={styles.pickerRows}>
              {picker?.rows.map(transaction => (
                <TouchableOpacity
                  key={transaction.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Liên kết giao dịch ${transaction.id}`}
                  disabled={busy}
                  onPress={() => confirmPayment(picker.occurrence, transaction)}
                  style={styles.card}
                >
                  <Text style={styles.heading}>
                    {formatCurrency(
                      Math.abs(Number(transaction.amount)),
                      transaction.currency,
                    )}
                  </Text>
                  <Text style={styles.muted}>
                    {getTransactionDateKey(transaction.transaction_date)
                      .split('-')
                      .reverse()
                      .join('/')}{' '}
                    · {transaction.note?.trim() || 'Không có ghi chú'}
                  </Text>
                </TouchableOpacity>
              ))}
              {picker &&
              !picker.loading &&
              !picker.error &&
              !picker.rows.length ? (
                <Text style={styles.empty}>
                  Chưa có khoản chi phù hợp trong khoảng ngày này. Hãy ghi giao
                  dịch trước, rồi quay lại liên kết.
                </Text>
              ) : null}
              {picker?.error ? (
                <>
                  <Text style={styles.error}>{picker.error}</Text>
                  <ActionButton
                    label="Thử tải giao dịch"
                    secondary
                    onPress={() =>
                      fetchPayments(picker.occurrence, picker.page + 1)
                    }
                  />
                </>
              ) : null}
              {picker?.loading ? (
                <ActivityIndicator color="#FF8C00" />
              ) : picker && !picker.error && picker.page < picker.totalPages ? (
                <ActionButton
                  label="Tải thêm giao dịch"
                  secondary
                  onPress={() =>
                    fetchPayments(picker.occurrence, picker.page + 1)
                  }
                />
              ) : null}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

export default function RecurringBillsScreen(props: Props) {
  const { user, token } = useAuth();
  const server = getApiBaseUrl();
  const scope = useMemo(
    () => ({ userId: user?.id ?? 0, server }),
    [user?.id, server],
  );
  if (!user || !token) return null;
  return (
    <RecurringBillsContent
      key={`${server}:${user.id}`}
      {...props}
      scope={scope}
      token={token}
      currency={user.currency_default || 'VND'}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF9F3' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0DF',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#4A2B1A' },
  content: { padding: 20, paddingTop: 0, paddingBottom: 40, gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  grow: { flex: 1, minWidth: 0 },
  muted: { fontSize: 13, color: '#886449', lineHeight: 20 },
  card: {
    borderWidth: 1,
    borderColor: '#F1D4B9',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  heading: { fontSize: 16, fontWeight: '700', color: '#4A2B1A' },
  amount: { fontSize: 18, fontWeight: '700', color: '#A95514' },
  label: { fontSize: 13, fontWeight: '600', color: '#593420' },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E8D8CA',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  selected: { backgroundColor: '#FFF0DF', borderColor: '#FF8C00' },
  date: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCC9B8',
  },
  smallButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  error: { color: '#B3261E', fontSize: 13, lineHeight: 20 },
  empty: { paddingVertical: 18, color: '#886449', lineHeight: 22 },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#00000055',
  },
  sheet: {
    maxHeight: '85%',
    backgroundColor: '#FFF9F3',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
  },
  pickerRows: { gap: 12, paddingVertical: 12 },
});
