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
  TextInput,
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
import BillUpcomingSummary from '../../components/BillUpcomingSummary';
import BillPaidTransactionLink from '../../components/BillPaidTransactionLink';
import BillPaymentReview from '../../components/BillPaymentReview';
import { useBillPaymentChecks } from '../../hooks/useBillPaymentChecks';
import { refreshPaymentLink } from '../../services/billPaymentChecks';
import type { BillPaymentTarget } from '../../utils/billPaymentChecks';
import { categoriesService } from '../../services/categories';
import type { Category } from '../../types/category';
import { useAuth } from '../../context/AuthContext';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { getApiStorageBaseUrl } from '../../services/api';
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
import {
  filterNormalCashFlowCategories,
  getCashFlowType,
} from '../../utils/transactionClassification';
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
  QUARTERLY: 'Hằng quý',
  YEARLY: 'Hằng năm',
};
const cycleShortNames: Record<BillCycle, string> = {
  WEEKLY: 'Tuần',
  MONTHLY: 'Tháng',
  QUARTERLY: 'Quý',
  YEARLY: 'Năm',
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
  categoryId?: number;
  note: string;
};
type Picker = {
  occurrence: BillOccurrence;
  scope: 'RECENT' | 'ALL';
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryError, setCategoryError] = useState(false);
  const [categoryRetry, setCategoryRetry] = useState(0);
  const expenseCategories = useMemo(
    () =>
      filterNormalCashFlowCategories(categories).filter(
        item => item.type === 'EXPENSE',
      ),
    [categories],
  );
  useEffect(() => {
    let live = true;
    setCategoryLoading(true);
    categoriesService
      .getAll(token)
      .then(rows => {
        if (live) {
          setCategories(rows);
          setCategoryError(false);
        }
      })
      .catch(() => {
        if (live) setCategoryError(true);
      })
      .finally(() => {
        if (live) setCategoryLoading(false);
      });
    return () => {
      live = false;
    };
  }, [token, categoryRetry]);
  const [showDate, setShowDate] = useState(false);
  const [tab, setTab] = useState<'PENDING' | 'DONE' | 'BILLS'>('PENDING');
  const [search, setSearch] = useState('');
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90 | 365 | 'ALL'>(90);
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
        ? billOccurrences(book, '2000-01-01', billDateOffset(today, 364), today)
        : [],
    [book, today],
  );
  const nextByBill = useMemo(() => {
    const result = new Map<string, BillOccurrence>();
    if (book) {
      for (const item of billOccurrences(
        book,
        '2000-01-01',
        billDateOffset(today, 730),
        today,
      )) {
        if (
          !item.bill.archived &&
          !item.bill.paused &&
          ['PENDING', 'OVERDUE'].includes(item.status) &&
          !result.has(item.bill.id)
        )
          result.set(item.bill.id, item);
      }
    }
    return result;
  }, [book, today]);
  const matchesSearch = (label: string) =>
    label
      .toLocaleLowerCase('vi')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .includes(
        search
          .trim()
          .toLocaleLowerCase('vi')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd'),
      );
  const displayed = occurrences
    .filter(item =>
      tab === 'DONE'
        ? item.status === 'PAID'
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
    )
    .filter(item => {
      if (reminderFilter && tab === 'PENDING') return true;
      if (tab === 'PENDING')
        return (
          item.status === 'OVERDUE' ||
          (item.dueDate >= today &&
            item.dueDate <= billDateOffset(today, Number(rangeDays) - 1))
        );
      if (rangeDays === 'ALL') return true;
      const paidDate = item.payment?.date;
      return (
        !!paidDate &&
        paidDate >= billDateOffset(today, 1 - rangeDays) &&
        paidDate <= today
      );
    });
  if (tab === 'DONE') displayed.reverse();
  const searched = displayed.filter(item => matchesSearch(item.bill.label));
  const closePicker = () => {
    pickerRevision.current += 1;
    setPicker(null);
  };
  const openPayment = (item: BillOccurrence) =>
    navigation.push('Main', { billPayment: item });
  const fetchPayments = async (
    occurrence: BillOccurrence,
    page = 1,
    pickerScope: Picker['scope'] = 'RECENT',
  ) => {
    const revision = ++pickerRevision.current;
    setPicker(previous => ({
      occurrence,
      scope: pickerScope,
      rows: page === 1 || previous?.scope !== pickerScope ? [] : previous.rows,
      page,
      totalPages: page === 1 ? 1 : previous?.totalPages ?? 1,
      loading: true,
      error: null,
    }));
    try {
      const from = billDateOffset(today, -30);
      const result = await transactionsService.getPage(token, {
        type: 'EXPENSE',
        cash_flow: 'normal',
        ...(pickerScope === 'RECENT'
          ? {
              from,
              min_amount: occurrence.bill.minAmount,
              max_amount: occurrence.bill.maxAmount,
            }
          : {}),
        to: today,
        page,
        limit: 40,
      });
      if (!active.current || revision !== pickerRevision.current) return;
      setPicker(previous => ({
        occurrence,
        scope: pickerScope,
        rows: [
          ...(page === 1 ? [] : previous?.rows ?? []),
          ...result.data.filter(item => {
            const date = getTransactionDateKey(item.transaction_date);
            const amount = Math.abs(Number(item.amount));
            return (
              item.currency === occurrence.bill.currency &&
              item.type === 'EXPENSE' &&
              getCashFlowType(item.category) === 'normal' &&
              date <= today &&
              (pickerScope === 'ALL' ||
                (date >= from &&
                  amount >= occurrence.bill.minAmount &&
                  amount <= occurrence.bill.maxAmount)) &&
              !book?.periods.some(
                period =>
                  period.status === 'PAID' && period.payment.id === item.id,
              )
            );
          }),
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
                page,
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
      if (
        editor.categoryId &&
        (categoryLoading ||
          categoryError ||
          !expenseCategories.some(item => item.id === editor.categoryId))
      )
        throw new Error('Danh mục đã chọn chưa tải được. Hãy thử lại.');
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
        categoryId: editor.categoryId,
        note: editor.note,
      });
      execute(
        () => recurringBillsService.save(scope, input, editor.id),
        () => {
          setEditor(null);
          setShowDate(false);
          setTab('BILLS');
        },
      );
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
            ...(patch.cycle && patch.cycle !== value.cycle
              ? {
                  anchorDate: value.startDate ?? value.anchorDate,
                  startDate: undefined,
                }
              : patch.anchorDate && patch.anchorDate !== value.anchorDate
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
  const closeEditor = () => {
    if (busy) return;
    setEditor(null);
    setShowDate(false);
  };
  useEffect(() => {
    const billId = route.params?.editBillId;
    if (!billId || !book) return;
    navigation.setParams({ editBillId: undefined });
    const bill = book.bills.find(item => item.id === billId && !item.archived);
    if (bill) editBill(bill);
    // Consumes a navigation request once after the local book has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.editBillId, book]);

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
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
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
            {reminderFilter ? (
              <View style={styles.card}>
                <Text style={styles.muted}>
                  Các khoản từ lời nhắc ngày {dateLabel(reminderFilter)}. Kỳ đã
                  trả được giữ trong Đã trả.
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
            {!editor && !reminderFilter ? (
              <ActionButton
                label="Thêm lịch hóa đơn"
                onPress={() => editBill()}
              />
            ) : null}
            {editor ? (
              <Modal
                visible
                transparent
                animationType="fade"
                onRequestClose={closeEditor}
              >
                <SafeAreaView style={styles.editorOverlay}>
                  <View style={styles.editorSheet}>
                    <View style={styles.editorHeader}>
                      <Text style={[styles.heading, styles.grow]}>
                        {editor.id ? 'Sửa lịch' : 'Lịch mới'}
                      </Text>
                      <TouchableOpacity
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityLabel="Đóng form lịch hóa đơn"
                        style={styles.smallButton}
                        onPress={closeEditor}
                      >
                        <X size={22} color="#79563D" />
                      </TouchableOpacity>
                    </View>
                    <ScrollView
                      style={styles.editorScroll}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={styles.editorContent}
                    >
                      <View
                        pointerEvents={busy ? 'none' : 'auto'}
                        style={styles.editorFields}
                      >
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
                          {(Object.keys(cycleNames) as BillCycle[]).map(
                            cycle => (
                              <TouchableOpacity
                                key={cycle}
                                accessibilityRole="button"
                                accessibilityLabel={cycleNames[cycle]}
                                accessibilityState={{
                                  selected: editor.cycle === cycle,
                                }}
                                style={[
                                  styles.option,
                                  styles.cycleOption,
                                  editor.cycle === cycle && styles.selected,
                                ]}
                                onPress={() => change({ cycle })}
                              >
                                <Text style={styles.label}>
                                  {cycleShortNames[cycle]}
                                </Text>
                              </TouchableOpacity>
                            ),
                          )}
                        </View>
                        <Text style={styles.label}>Ngày đến hạn đầu tiên</Text>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel="Chọn ngày đến hạn đầu tiên"
                          style={styles.date}
                          onPress={() => setShowDate(true)}
                        >
                          <Text style={styles.label}>
                            {dateLabel(editor.startDate ?? editor.anchorDate)}
                          </Text>
                        </TouchableOpacity>
                        {showDate ? (
                          <DateTimePicker
                            value={
                              new Date(
                                `${
                                  editor.startDate ?? editor.anchorDate
                                }T12:00:00`,
                              )
                            }
                            mode="date"
                            minimumDate={new Date(2000, 0, 1)}
                            maximumDate={new Date(2199, 11, 31)}
                            onChange={(_event, date) => {
                              setShowDate(false);
                              if (date)
                                change({
                                  anchorDate: `${date.getFullYear()}-${String(
                                    date.getMonth() + 1,
                                  ).padStart(2, '0')}-${String(
                                    date.getDate(),
                                  ).padStart(2, '0')}`,
                                  ...(editor.startDate
                                    ? {
                                        startDate: `${date.getFullYear()}-${String(
                                          date.getMonth() + 1,
                                        ).padStart(2, '0')}-${String(
                                          date.getDate(),
                                        ).padStart(2, '0')}`,
                                      }
                                    : {}),
                                });
                            }}
                          />
                        ) : null}
                        <View style={styles.row}>
                          {(['FIXED', 'VARIABLE'] as const).map(kind => (
                            <TouchableOpacity
                              key={kind}
                              accessibilityRole="button"
                              accessibilityLabel={
                                kind === 'FIXED'
                                  ? 'Tiền cố định'
                                  : 'Tiền biến thiên'
                              }
                              accessibilityState={{
                                selected: editor.kind === kind,
                              }}
                              style={[
                                styles.option,
                                editor.kind === kind && styles.selected,
                              ]}
                              onPress={() => change({ kind })}
                            >
                              <Text style={styles.label}>
                                {kind === 'FIXED'
                                  ? 'Cố định'
                                  : 'Khoảng dự kiến'}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
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
                                onChangeText={value =>
                                  updateMoney('max', value)
                                }
                              />
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.label}>Danh mục</Text>
                        {categoryLoading ? (
                          <ActivityIndicator color="#FF8C00" />
                        ) : null}
                        {categoryError ? (
                          <View style={styles.row}>
                            <Text style={styles.muted}>
                              {editor.categoryId
                                ? 'Danh mục đã chọn chưa tải được. Hãy thử lại.'
                                : 'Chưa tải được danh mục. Có thể lưu lịch chưa phân loại.'}
                            </Text>
                            <TouchableOpacity
                              accessibilityRole="button"
                              accessibilityLabel="Tải lại danh mục lịch"
                              onPress={() =>
                                setCategoryRetry(value => value + 1)
                              }
                            >
                              <Text style={styles.retryText}>Thử lại</Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                        {!categoryLoading && !categoryError ? (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.categoryRow}
                          >
                            <TouchableOpacity
                              accessibilityRole="button"
                              accessibilityLabel="Danh mục lịch Chưa phân loại"
                              accessibilityState={{
                                selected: !editor.categoryId,
                              }}
                              style={[
                                styles.categoryChip,
                                !editor.categoryId && styles.selected,
                              ]}
                              onPress={() => change({ categoryId: undefined })}
                            >
                              <Text style={styles.label}>Chưa phân loại</Text>
                            </TouchableOpacity>
                            {expenseCategories.map(category => (
                              <TouchableOpacity
                                key={category.id}
                                accessibilityRole="button"
                                accessibilityLabel={`Danh mục lịch ${category.name}`}
                                accessibilityState={{
                                  selected: editor.categoryId === category.id,
                                }}
                                style={[
                                  styles.categoryChip,
                                  editor.categoryId === category.id &&
                                    styles.selected,
                                ]}
                                onPress={() =>
                                  change({ categoryId: category.id })
                                }
                              >
                                <Text style={styles.label}>
                                  {category.name}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        ) : null}
                        {!categoryLoading &&
                        !categoryError &&
                        !expenseCategories.length ? (
                          <Text style={styles.muted}>
                            Chưa có danh mục; lịch sẽ để chưa phân loại.
                          </Text>
                        ) : null}
                        <FormField
                          label="Ghi chú"
                          accessibilityLabel="Ghi chú hóa đơn"
                          value={editor.note}
                          onChangeText={note => change({ note })}
                          multiline
                          maxLength={500}
                        />
                      </View>
                    </ScrollView>
                    <View style={styles.editorFooter}>
                      <ActionButton
                        label="Lưu lịch"
                        loading={busy}
                        onPress={saveEditor}
                      />
                    </View>
                  </View>
                </SafeAreaView>
              </Modal>
            ) : null}
            <View style={styles.row}>
              {(['PENDING', 'DONE', 'BILLS'] as const).map(value => (
                <TouchableOpacity
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={
                    {
                      PENDING: 'Chưa trả',
                      DONE: 'Đã trả',
                      BILLS: 'Lịch đã tạo',
                    }[value]
                  }
                  accessibilityState={{ selected: value === tab }}
                  style={[styles.option, tab === value && styles.selected]}
                  onPress={() => {
                    setTab(value);
                    setVisible(20);
                    if (value !== tab)
                      setRangeDays(value === 'BILLS' ? 30 : 90);
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
                        DONE: 'Đã trả',
                        BILLS: 'Lịch đã tạo',
                      }[value]
                    }
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              accessibilityLabel="Tìm hóa đơn"
              placeholder="Tìm hóa đơn"
              placeholderTextColor="#9B7458"
              value={search}
              onChangeText={value => {
                setSearch(value);
                setVisible(20);
              }}
              style={styles.search}
            />
            {tab !== 'BILLS' ? (
              <>
                {!reminderFilter ? (
                  <View style={styles.rangeSection}>
                    <Text style={styles.rangeTitle}>
                      {tab === 'PENDING' ? 'Kỳ đến hạn' : 'Ngày đã trả'}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.rangeRow}
                    >
                      {(
                        [
                          7,
                          30,
                          90,
                          365,
                          ...(tab === 'DONE' ? ['ALL' as const] : []),
                        ] as const
                      ).map(days => (
                        <TouchableOpacity
                          key={days}
                          accessibilityRole="button"
                          accessibilityLabel={
                            days === 'ALL'
                              ? 'Lọc tất cả kỳ đã trả'
                              : `Lọc ${days} ngày ${
                                  tab === 'PENDING' ? 'tới' : 'qua'
                                }`
                          }
                          accessibilityState={{ selected: rangeDays === days }}
                          style={[
                            styles.rangeChip,
                            rangeDays === days && styles.selected,
                          ]}
                          onPress={() => {
                            setRangeDays(days);
                            setVisible(20);
                          }}
                        >
                          <Text style={styles.label}>
                            {days === 'ALL'
                              ? 'Tất cả'
                              : days === 365
                              ? '1 năm'
                              : `${days} ngày`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <Text style={styles.muted}>
                      {tab === 'PENDING'
                        ? `Đến ${dateLabel(
                            billDateOffset(today, Number(rangeDays) - 1),
                          )} · gồm cả kỳ quá hạn`
                        : rangeDays === 'ALL'
                        ? 'Mọi kỳ đã trả'
                        : `Từ ${dateLabel(
                            billDateOffset(today, 1 - rangeDays),
                          )} đến hôm nay`}
                    </Text>
                  </View>
                ) : null}
                {tab === 'DONE' &&
                (paymentChecks.loading || paymentChecks.error) ? (
                  <View style={styles.card}>
                    {paymentChecks.loading ? (
                      <Text style={styles.muted}>
                        Đang kiểm tra {paymentChecks.progress}/
                        {paymentChecks.targets.length} giao dịch đã trả…
                      </Text>
                    ) : null}
                    {paymentChecks.error ? (
                      <>
                        <Text style={styles.error}>{paymentChecks.error}</Text>
                        <ActionButton
                          label="Thử lại"
                          secondary
                          onPress={paymentChecks.check}
                        />
                      </>
                    ) : null}
                  </View>
                ) : null}
                {!searched.length ? (
                  <Text style={styles.empty}>
                    {search.trim()
                      ? 'Không tìm thấy hóa đơn phù hợp.'
                      : tab === 'PENDING'
                      ? reminderFilter
                        ? 'Không có kỳ cần nhắc ngày này.'
                        : 'Chưa có kỳ chưa trả trong mốc đã chọn.'
                      : 'Chưa có kỳ đã trả trong mốc đã chọn.'}
                  </Text>
                ) : null}
                {searched.slice(0, visible).map(item => (
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
                            PENDING: 'Chưa trả',
                            OVERDUE: 'Chưa trả · quá hạn',
                            PAID: 'Đã trả',
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
                      <BillPaidTransactionLink
                        payment={item.payment}
                        onOpen={transaction =>
                          navigation.navigate('TransactionDetail', {
                            transaction,
                          })
                        }
                      />
                    ) : null}
                    <BillPaymentReview
                      item={item}
                      results={paymentChecks.results}
                      busy={busy || paymentChecks.loading}
                      onRefresh={confirmPaymentRefresh}
                    />
                    {['PENDING', 'OVERDUE'].includes(item.status) ? (
                      <View style={styles.paymentActions}>
                        <ActionButton
                          label="Tạo giao dịch"
                          accessibilityLabel={`Tạo giao dịch từ ${item.bill.label} kỳ ${item.dueDate}`}
                          disabled={busy}
                          onPress={() => openPayment(item)}
                        />
                        <View style={styles.row}>
                          <View style={styles.grow}>
                            <ActionButton
                              label="Chọn giao dịch đã trả"
                              secondary
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
                {searched.length > visible ? (
                  <ActionButton
                    label="Xem thêm kỳ"
                    secondary
                    onPress={() => setVisible(value => value + 20)}
                  />
                ) : null}
              </>
            ) : (
              <>
                <View style={styles.rangeSection}>
                  <Text style={styles.rangeTitle}>Dự kiến đến hạn</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.rangeRow}
                  >
                    {([7, 30, 90, 365] as const).map(days => (
                      <TouchableOpacity
                        key={days}
                        accessibilityRole="button"
                        accessibilityLabel={`Lọc dự kiến ${days} ngày tới`}
                        accessibilityState={{ selected: rangeDays === days }}
                        style={[
                          styles.rangeChip,
                          rangeDays === days && styles.selected,
                        ]}
                        onPress={() => setRangeDays(days)}
                      >
                        <Text style={styles.label}>
                          {days === 365 ? '1 năm' : `${days} ngày`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <BillUpcomingSummary
                  book={{
                    ...book,
                    bills: book.bills.filter(bill => matchesSearch(bill.label)),
                  }}
                  today={today}
                  days={rangeDays === 'ALL' ? 30 : rangeDays}
                />
                {!book.bills.some(
                  bill => !bill.archived && matchesSearch(bill.label),
                ) ? (
                  <Text style={styles.empty}>
                    {search.trim()
                      ? 'Không tìm thấy hóa đơn phù hợp.'
                      : 'Thêm tiền nhà, điện, nước hoặc thuê bao để theo dõi kỳ tới.'}
                  </Text>
                ) : null}
                {book.bills
                  .filter(bill => !bill.archived && matchesSearch(bill.label))
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
                      {nextByBill.get(bill.id) ? (
                        <Text style={styles.muted}>
                          Chưa trả · kỳ{' '}
                          {dateLabel(nextByBill.get(bill.id)!.dueDate)}
                        </Text>
                      ) : null}
                      <View style={styles.row}>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={`Chi tiết lịch ${bill.label}`}
                          style={styles.linkButton}
                          onPress={() =>
                            navigation.navigate('RecurringBillDetail', {
                              billId: bill.id,
                            })
                          }
                        >
                          <Text style={styles.link}>Chi tiết</Text>
                        </TouchableOpacity>
                        {nextByBill.get(bill.id) ? (
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Tạo giao dịch từ lịch ${bill.label}`}
                            style={styles.primarySmallButton}
                            onPress={() =>
                              openPayment(nextByBill.get(bill.id)!)
                            }
                          >
                            <Text style={styles.primarySmallText}>
                              Tạo giao dịch
                            </Text>
                          </TouchableOpacity>
                        ) : null}
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
                  {picker.scope === 'RECENT'
                    ? 'Chưa có giao dịch chi phù hợp gần đây.'
                    : 'Chưa có giao dịch chi để chọn.'}
                </Text>
              ) : null}
              {picker &&
              !picker.loading &&
              !picker.error &&
              picker.scope === 'RECENT' ? (
                <ActionButton
                  label="Xem giao dịch khác"
                  secondary
                  onPress={() => fetchPayments(picker.occurrence, 1, 'ALL')}
                />
              ) : null}
              {picker?.error ? (
                <>
                  <Text style={styles.error}>{picker.error}</Text>
                  <ActionButton
                    label="Thử tải giao dịch"
                    secondary
                    onPress={() =>
                      fetchPayments(
                        picker.occurrence,
                        picker.page,
                        picker.scope,
                      )
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
                    fetchPayments(
                      picker.occurrence,
                      picker.page + 1,
                      picker.scope,
                    )
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
  const server = getApiStorageBaseUrl();
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
  editorOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00000066',
  },
  editorSheet: {
    width: '92%',
    maxWidth: 520,
    height: '72%',
    borderRadius: 22,
    backgroundColor: '#FFF9F3',
    overflow: 'hidden',
  },
  editorScroll: { flex: 1 },
  editorHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editorContent: { padding: 20, paddingBottom: 12 },
  editorFields: { gap: 12 },
  categoryRow: { gap: 8, paddingVertical: 4 },
  retryText: { color: '#B65C11', fontSize: 13, fontWeight: '700' },
  categoryChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8D8CA',
    backgroundColor: '#FFFFFF',
  },
  editorFooter: {
    padding: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0DCCB',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  paymentActions: { gap: 8 },
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
  search: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#E8D8CA',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    color: '#4A2B1A',
    fontSize: 15,
  },
  rangeSection: { gap: 8 },
  rangeTitle: { fontSize: 13, fontWeight: '700', color: '#593420' },
  rangeRow: { gap: 8, paddingRight: 20 },
  rangeChip: {
    minHeight: 40,
    minWidth: 78,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8D8CA',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  linkButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  link: { color: '#A95514', fontSize: 13, fontWeight: '700' },
  primarySmallButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#A95514',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  primarySmallText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
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
  cycleOption: { flexBasis: '22%' },
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
