import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
  Tag,
  X,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import CategoryIcon from '../../components/CategoryIcon';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import type { TransactionItem } from '../../data/mockTransactions';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { categoriesService } from '../../services/categories';
import {
  transactionsService,
  type TransactionQuery,
} from '../../services/transactions';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import { normalizeTagName } from '../../utils/hashtags';
import {
  getSearchMonthWeeks,
  resolveSearchWeek,
} from '../../utils/searchWeeks';
import {
  formatCurrency,
  formatDisplayDate,
  formatShortDate,
} from '../../utils/format';
import { mapApiTransactions } from '../../utils/mapTransactions';
import {
  filterNormalCashFlowCategories,
  isLoanDebtCategory,
} from '../../utils/transactionClassification';

type Props = NativeStackScreenProps<RootStackParamList, 'TransactionSearch'>;
type DateMode =
  | 'all'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'after'
  | 'before'
  | 'range';
type TypeMode = 'all' | 'income' | 'expense' | 'loan_debt';
type CategoryMode = 'income' | 'expense' | 'loan_debt';
type PickerTarget = 'after' | 'before' | 'from' | 'to' | 'day' | null;

const PAGE_SIZE = 10;
const today = new Date();
const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(
    2,
    '0',
  )}-${`${date.getDate()}`.padStart(2, '0')}`;
const defaultDay = toDateKey(today);
const currentYear = today.getFullYear();
const currentMonth = today.getMonth();
const parseDateKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : today;
};
const clampDate = (date: Date) => (date > today ? today : date);
const startOfWeek = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  return start;
};
const getWeeksOfMonth = (year: number, month: number) => {
  return getSearchMonthWeeks(year, month, today);
};

const isNormalCashFlowTransaction = (transaction: TransactionItem) =>
  transaction.cashFlowType !== 'loan_debt';

const TransactionSearchScreen = ({ navigation, route }: Props) => {
  const { token } = useAuth();
  const { categories, preferredCurrency, setCategories } = useFinance();
  const wallets = useMemo(
    () => route.params.wallets ?? [],
    [route.params.wallets],
  );
  const initialDateMode = route.params.initialDateMode;
  const initialFromDate = route.params.initialFromDate ?? defaultDay;
  const initialToDate = route.params.initialToDate ?? initialFromDate;
  const cashFlow = route.params.cashFlow;
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [query, setQuery] = useState('');
  const [noteQuery, setNoteQuery] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [walletId, setWalletId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [categoryMode, setCategoryMode] = useState<CategoryMode>('expense');
  const [typeMode, setTypeMode] = useState<TypeMode>('all');
  const [dateMode, setDateMode] = useState<DateMode>(initialDateMode ?? 'all');
  const [quarter, setQuarter] = useState(
    `Q${Math.floor(currentMonth / 3) + 1}`,
  );
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedWeekStart, setSelectedWeekStart] = useState(
    toDateKey(startOfWeek(today)),
  );
  const [afterDate, setAfterDate] = useState(defaultDay);
  const [beforeDate, setBeforeDate] = useState(defaultDay);
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);
  const [dayDate, setDayDate] = useState(initialFromDate);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({
    total: 0,
    totalPages: 1,
    income: 0,
    expense: 0,
    net: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const selectedCategory = useMemo(
    () => categories.find(category => category.id === categoryId) ?? null,
    [categories, categoryId],
  );
  const effectiveCashFlow =
    typeMode === 'loan_debt'
      ? 'loan_debt'
      : typeMode === 'all'
      ? cashFlow
      : 'normal';
  const categoryOptions = useMemo(() => {
    if (categoryMode === 'loan_debt') {
      return categories.filter(isLoanDebtCategory);
    }

    const typedCategories = categories.filter(
      category =>
        category.type === (categoryMode === 'income' ? 'INCOME' : 'EXPENSE'),
    );
    return filterNormalCashFlowCategories(typedCategories);
  }, [categories, categoryMode]);
  const weekOptions = useMemo(
    () => getWeeksOfMonth(selectedYear, selectedMonth),
    [selectedMonth, selectedYear],
  );
  const selectedWeek = resolveSearchWeek(weekOptions, selectedWeekStart, today);

  useEffect(() => {
    if (!token) {
      return;
    }

    categoriesService
      .getAll(token)
      .then(setCategories)
      .catch(() => undefined);
  }, [setCategories, token]);

  const selectMonth = useCallback(
    (month: number) => {
      setSelectedMonth(month);
      const firstWeek = getWeeksOfMonth(selectedYear, month)[0];
      if (firstWeek) {
        setSelectedWeekStart(toDateKey(firstWeek.start));
      }
    },
    [selectedYear],
  );

  const pickerValue = useMemo(() => {
    if (pickerTarget === 'after') {
      return parseDateKey(afterDate);
    }
    if (pickerTarget === 'before') {
      return parseDateKey(beforeDate);
    }
    if (pickerTarget === 'from') {
      return parseDateKey(fromDate);
    }
    if (pickerTarget === 'to') {
      return parseDateKey(toDate);
    }
    return parseDateKey(dayDate);
  }, [afterDate, beforeDate, dayDate, fromDate, pickerTarget, toDate]);

  const serverQuery = useMemo<TransactionQuery>(() => {
    const rangeStart = fromDate <= toDate ? fromDate : toDate;
    const rangeEnd = fromDate <= toDate ? toDate : fromDate;
    const nextQuery: TransactionQuery = {
      page,
      limit: PAGE_SIZE,
      wallet_id: walletId ?? undefined,
      category_id: categoryId ?? undefined,
      type:
        typeMode === 'income'
          ? 'INCOME'
          : typeMode === 'expense'
          ? 'EXPENSE'
          : undefined,
      cash_flow: effectiveCashFlow,
      tag: normalizeTagName(tagQuery) || undefined,
      q: query.trim() || undefined,
      note: noteQuery.trim() || undefined,
    };

    if (dateMode === 'after') {
      nextQuery.from = afterDate;
    }

    if (dateMode === 'before') {
      nextQuery.to = beforeDate;
    }

    if (dateMode === 'range') {
      nextQuery.from = rangeStart;
      nextQuery.to = rangeEnd;
    }

    if (dateMode === 'day') {
      nextQuery.from = dayDate;
      nextQuery.to = dayDate;
    }

    if (dateMode === 'week' && selectedWeek) {
      nextQuery.from = toDateKey(selectedWeek.start);
      nextQuery.to = toDateKey(selectedWeek.end);
    }

    if (dateMode === 'month') {
      nextQuery.from = toDateKey(new Date(selectedYear, selectedMonth, 1));
      nextQuery.to = toDateKey(
        clampDate(new Date(selectedYear, selectedMonth + 1, 0)),
      );
    }

    if (dateMode === 'quarter') {
      const quarterIndex = Number(quarter.replace('Q', '')) - 1;
      const startMonth = quarterIndex * 3;
      nextQuery.from = toDateKey(new Date(selectedYear, startMonth, 1));
      nextQuery.to = toDateKey(
        clampDate(new Date(selectedYear, startMonth + 3, 0)),
      );
    }

    if (dateMode === 'year') {
      nextQuery.from = toDateKey(new Date(selectedYear, 0, 1));
      nextQuery.to = toDateKey(clampDate(new Date(selectedYear, 11, 31)));
    }

    return nextQuery;
  }, [
    afterDate,
    beforeDate,
    categoryId,
    dateMode,
    dayDate,
    effectiveCashFlow,
    fromDate,
    noteQuery,
    page,
    query,
    quarter,
    selectedMonth,
    selectedWeek,
    selectedYear,
    tagQuery,
    toDate,
    typeMode,
    walletId,
  ]);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      setTransactions([]);
      setMeta({ total: 0, totalPages: 1, income: 0, expense: 0, net: 0 });
      setSearchError(null);
      return;
    }
    let active = true;
    setIsLoading(true);
    setSearchError(null);
    setTransactions([]);
    setMeta({ total: 0, totalPages: 1, income: 0, expense: 0, net: 0 });
    const timer = setTimeout(async () => {
      try {
        const response = await transactionsService.getPage(token, serverQuery);
        if (!active) return;
        if ((serverQuery.page ?? 1) > response.meta.totalPages) {
          setPage(Math.max(1, response.meta.totalPages));
          return;
        }
        setTransactions(mapApiTransactions(response.data, wallets));
        setMeta({
          total: response.meta.total,
          totalPages: response.meta.totalPages,
          income: response.meta.income ?? 0,
          expense: response.meta.expense ?? 0,
          net: response.meta.net ?? 0,
        });
      } catch (error) {
        if (active)
          setSearchError(
            getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.'),
          );
      } finally {
        if (active) setIsLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [serverQuery, token, wallets, retryCount]);

  useEffect(() => {
    if (selectedYear === currentYear && selectedMonth > currentMonth) {
      selectMonth(currentMonth);
    }

    const quarterIndex = Number(quarter.replace('Q', '')) - 1;
    if (
      selectedYear === currentYear &&
      quarterIndex > Math.floor(currentMonth / 3)
    ) {
      setQuarter(`Q${Math.floor(currentMonth / 3) + 1}`);
    }
  }, [quarter, selectMonth, selectedMonth, selectedYear]);

  useEffect(() => {
    setPage(1);
  }, [
    afterDate,
    beforeDate,
    categoryId,
    dateMode,
    dayDate,
    fromDate,
    noteQuery,
    query,
    quarter,
    selectedMonth,
    selectedWeekStart,
    selectedYear,
    tagQuery,
    toDate,
    typeMode,
    walletId,
  ]);

  const handlePickerChange = (
    _event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    const target = pickerTarget;
    setPickerTarget(null);

    if (!selectedDate || !target) {
      return;
    }

    const value = toDateKey(selectedDate);

    if (target === 'after') {
      setAfterDate(value);
      return;
    }
    if (target === 'before') {
      setBeforeDate(value);
      return;
    }
    if (target === 'from') {
      setFromDate(value);
      return;
    }
    if (target === 'to') {
      setToDate(value);
      return;
    }
    setDayDate(value);
  };

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, TransactionItem[]>();

    transactions.forEach(transaction => {
      const key = transaction.date.slice(0, 10);
      groups.set(key, [...(groups.get(key) ?? []), transaction]);
    });

    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  const displayMeta = useMemo(() => {
    const summarizedTransactions = transactions.filter(transaction =>
      typeMode === 'loan_debt'
        ? transaction.cashFlowType === 'loan_debt'
        : isNormalCashFlowTransaction(transaction),
    );

    return summarizedTransactions.reduce(
      (total, transaction) => {
        if (transaction.type === 'income') {
          total.income += transaction.displayAmount;
        } else {
          total.expense += transaction.displayAmount;
        }

        total.net = total.income - total.expense;
        return total;
      },
      { income: 0, expense: 0, net: 0 },
    );
  }, [transactions, typeMode]);
  const clearFilters = () => {
    setQuery('');
    setNoteQuery('');
    setTagQuery('');
    setWalletId(null);
    setCategoryId(null);
    setTypeMode('all');
    setDateMode('all');
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
    setSelectedWeekStart(toDateKey(startOfWeek(today)));
    setPage(1);
  };

  const renderDateButton = (
    label: string,
    value: string,
    target: PickerTarget,
  ) => (
    <TouchableOpacity
      style={styles.dateButton}
      onPress={() => setPickerTarget(target)}
    >
      <CalendarDays size={16} color="#A06B42" />
      <View>
        <Text style={styles.dateButtonLabel}>{label}</Text>
        <Text style={styles.dateButtonValue}>{formatShortDate(value)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>
        <Text style={styles.title}>Tìm giao dịch</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchBox}>
          <Search size={18} color="#A26B48" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm theo ghi chú"
            placeholderTextColor="#A26B48"
          />
        </View>

        <View style={styles.summaryGrid}>
          <View
            style={[
              styles.summaryCard,
              typeMode === 'loan_debt' && styles.summaryCardFull,
            ]}
          >
            <Text style={styles.summaryLabel}>Kết quả</Text>
            <Text style={styles.summaryValue}>{meta.total}</Text>
          </View>
          {typeMode !== 'loan_debt' ? (
            <>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Thu trên trang</Text>
                <Text style={styles.incomeText}>
                  {formatCurrency(displayMeta.income, preferredCurrency)}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Chi trên trang</Text>
                <Text style={styles.expenseText}>
                  {formatCurrency(displayMeta.expense, preferredCurrency)}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Chênh lệch trên trang</Text>
                <Text
                  style={
                    displayMeta.net >= 0
                      ? styles.incomeText
                      : styles.expenseText
                  }
                >
                  {formatCurrency(displayMeta.net, preferredCurrency)}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Bộ lọc</Text>

          <Text style={styles.label}>Ví</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <TouchableOpacity
              style={[styles.chip, walletId === null && styles.chipActive]}
              onPress={() => setWalletId(null)}
            >
              <Text
                style={[
                  styles.chipText,
                  walletId === null && styles.chipTextActive,
                ]}
              >
                Tất cả ví
              </Text>
            </TouchableOpacity>
            {wallets.map(wallet => (
              <TouchableOpacity
                key={wallet.id}
                style={[
                  styles.chip,
                  walletId === wallet.id && styles.chipActive,
                ]}
                onPress={() => setWalletId(wallet.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    walletId === wallet.id && styles.chipTextActive,
                  ]}
                >
                  {wallet.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Nhóm</Text>
          <View style={styles.segmentRow}>
            {(['all', 'income', 'expense', 'loan_debt'] as TypeMode[]).map(
              item => (
                <TouchableOpacity
                  key={item}
                  accessibilityRole="button"
                  accessibilityLabel={`Lọc ${
                    item === 'income'
                      ? 'thu nhập'
                      : item === 'expense'
                      ? 'chi tiêu'
                      : item === 'loan_debt'
                      ? 'vay nợ'
                      : 'tất cả giao dịch'
                  }`}
                  accessibilityState={{ selected: typeMode === item }}
                  style={[
                    styles.segmentChip,
                    typeMode === item && styles.segmentChipActive,
                  ]}
                  onPress={() => {
                    setTypeMode(item);

                    if (item !== 'all') {
                      setCategoryMode(item);
                    }

                    if (
                      item !== 'all' &&
                      selectedCategory &&
                      ((item === 'loan_debt') !==
                        isLoanDebtCategory(selectedCategory) ||
                        (item === 'income' &&
                          selectedCategory.type !== 'INCOME') ||
                        (item === 'expense' &&
                          selectedCategory.type !== 'EXPENSE'))
                    ) {
                      setCategoryId(null);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      typeMode === item && styles.segmentTextActive,
                    ]}
                  >
                    {item === 'all'
                      ? 'Tất cả'
                      : item === 'income'
                      ? 'Thu'
                      : item === 'expense'
                      ? 'Chi'
                      : 'Vay/Nợ'}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </View>

          <Text style={styles.label}>Thời gian</Text>
          <View style={styles.segmentRow}>
            {(
              [
                'all',
                'day',
                'week',
                'month',
                'quarter',
                'year',
                'after',
                'before',
                'range',
              ] as DateMode[]
            ).map(item => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.segmentChip,
                  dateMode === item && styles.segmentChipActive,
                ]}
                onPress={() => setDateMode(item)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    dateMode === item && styles.segmentTextActive,
                  ]}
                >
                  {item === 'all'
                    ? 'Tất cả'
                    : item === 'day'
                    ? 'Ngày'
                    : item === 'week'
                    ? 'Tuần'
                    : item === 'month'
                    ? 'Tháng'
                    : item === 'quarter'
                    ? 'Quý'
                    : item === 'year'
                    ? 'Năm'
                    : item === 'after'
                    ? 'Sau ngày'
                    : item === 'before'
                    ? 'Trước ngày'
                    : 'Trong khoảng ngày'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {dateMode === 'week' ||
          dateMode === 'month' ||
          dateMode === 'quarter' ||
          dateMode === 'year' ? (
            <View style={styles.yearControl}>
              <TouchableOpacity
                style={styles.yearButton}
                onPress={() => setSelectedYear(value => value - 1)}
              >
                <ChevronLeft size={16} color="#7A4A28" />
              </TouchableOpacity>
              <Text style={styles.yearValue}>{selectedYear}</Text>
              <TouchableOpacity
                style={[
                  styles.yearButton,
                  selectedYear >= currentYear && styles.yearButtonDisabled,
                ]}
                disabled={selectedYear >= currentYear}
                onPress={() =>
                  setSelectedYear(value => Math.min(currentYear, value + 1))
                }
              >
                <ChevronRight size={16} color="#7A4A28" />
              </TouchableOpacity>
            </View>
          ) : null}
          {dateMode === 'week' || dateMode === 'month' ? (
            <View style={styles.monthGrid}>
              {Array.from(
                {
                  length: selectedYear === currentYear ? currentMonth + 1 : 12,
                },
                (_, index) => (
                  <TouchableOpacity
                    key={`search-month-${index}`}
                    style={[
                      styles.monthChip,
                      selectedMonth === index && styles.segmentChipActive,
                    ]}
                    onPress={() => selectMonth(index)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        selectedMonth === index && styles.segmentTextActive,
                      ]}
                    >
                      T{index + 1}
                    </Text>
                  </TouchableOpacity>
                ),
              )}
            </View>
          ) : null}
          {dateMode === 'week' ? (
            <View style={styles.segmentRow}>
              {weekOptions.map((item, index) => {
                const value = toDateKey(item.start);
                const active =
                  selectedWeek && toDateKey(selectedWeek.start) === value;

                return (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.segmentChip,
                      active && styles.segmentChipActive,
                    ]}
                    onPress={() => setSelectedWeekStart(value)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        active && styles.segmentTextActive,
                      ]}
                    >
                      Tuần {index + 1}
                      {` · ${item.start.getDate()}–${item.end.getDate()}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
          {dateMode === 'quarter' ? (
            <>
              <View style={styles.segmentRow}>
                {['Q1', 'Q2', 'Q3', 'Q4']
                  .filter(
                    (_, index) =>
                      selectedYear < currentYear ||
                      index <= Math.floor(currentMonth / 3),
                  )
                  .map(item => (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.segmentChip,
                        quarter === item && styles.segmentChipActive,
                      ]}
                      onPress={() => setQuarter(item)}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          quarter === item && styles.segmentTextActive,
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </>
          ) : null}
          {dateMode === 'after'
            ? renderDateButton('Sau ngày', afterDate, 'after')
            : null}
          {dateMode === 'before'
            ? renderDateButton('Trước ngày', beforeDate, 'before')
            : null}
          {dateMode === 'day'
            ? renderDateButton('Ngày giao dịch', dayDate, 'day')
            : null}
          {dateMode === 'range' ? (
            <View style={styles.dateRow}>
              {renderDateButton('Từ ngày', fromDate, 'from')}
              {renderDateButton('Đến ngày', toDate, 'to')}
            </View>
          ) : null}
          {pickerTarget ? (
            <DateTimePicker
              value={pickerValue}
              mode="date"
              maximumDate={today}
              onChange={handlePickerChange}
            />
          ) : null}

          <Text style={styles.label}>Danh mục</Text>
          <TouchableOpacity
            style={styles.categorySelectCard}
            onPress={() => setIsCategoryModalVisible(true)}
          >
            <View style={styles.categorySelectIcon}>
              <CategoryIcon icon={selectedCategory?.icon ?? null} size={18} />
            </View>
            <View style={styles.categorySelectCopy}>
              <Text style={styles.categorySelectName}>
                {selectedCategory?.name ?? 'Tất cả danh mục'}
              </Text>
              <Text style={styles.categorySelectMeta}>
                {selectedCategory
                  ? isLoanDebtCategory(selectedCategory)
                    ? 'Khoản vay/nợ'
                    : selectedCategory.type === 'INCOME'
                    ? 'Khoản thu'
                    : 'Khoản chi'
                  : 'Chọn riêng theo Thu/Chi/Vay nợ'}
              </Text>
            </View>
            <ChevronRight size={18} color="#A06B42" />
          </TouchableOpacity>

          <Text style={styles.label}>Ghi chú</Text>
          <TextInput
            style={styles.input}
            value={noteQuery}
            onChangeText={setNoteQuery}
            placeholder="Có ghi chú chứa..."
            placeholderTextColor="#A26B48"
          />

          <Text style={styles.label}>Hashtag</Text>
          <View style={styles.tagInputBox}>
            <Tag size={17} color="#A26B48" />
            <TextInput
              style={styles.tagInput}
              value={tagQuery}
              onChangeText={setTagQuery}
              placeholder="Ví dụ: ăntrưa"
              placeholderTextColor="#A26B48"
              autoCapitalize="none"
            />
          </View>
          <TouchableOpacity
            style={styles.resetFilterButton}
            onPress={clearFilters}
          >
            <Text style={styles.resetFilterText}>Xóa bộ lọc</Text>
          </TouchableOpacity>
        </View>

        {isLoading && groupedTransactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.emptyText}>Đang tìm giao dịch...</Text>
          </View>
        ) : searchError ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Chưa tải được kết quả</Text>
            <Text style={styles.emptyText}>{searchError}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Thử tìm lại"
              style={styles.retryButton}
              onPress={() => setRetryCount(count => count + 1)}
            >
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : groupedTransactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Không có kết quả phù hợp</Text>
            <Text style={styles.emptyText}>
              Thử đổi từ khóa hoặc nới bộ lọc thời gian.
            </Text>
          </View>
        ) : (
          groupedTransactions.map(([dateKey, items]) => {
            const daySummary = items.reduce(
              (total, item) => {
                const shouldSummarize =
                  typeMode === 'loan_debt'
                    ? item.cashFlowType === 'loan_debt'
                    : isNormalCashFlowTransaction(item);

                if (!shouldSummarize) {
                  return total;
                }

                if (item.type === 'income') {
                  total.income += item.displayAmount;
                } else {
                  total.expense += item.displayAmount;
                }
                return total;
              },
              { income: 0, expense: 0 },
            );

            return (
              <View key={dateKey} style={styles.dayGroup}>
                <View style={styles.dayHeader}>
                  <View>
                    <Text style={styles.dayTitle}>
                      {formatDisplayDate(dateKey)}
                    </Text>
                    <Text style={styles.dayMeta}>
                      {items.length} giao dịch · Thu{' '}
                      {formatCurrency(daySummary.income, preferredCurrency)} ·
                      Chi{' '}
                      {formatCurrency(daySummary.expense, preferredCurrency)}
                    </Text>
                  </View>
                </View>

                {items.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.card}
                    activeOpacity={0.86}
                    onPress={() =>
                      navigation.navigate('TransactionDetail', {
                        transaction: item,
                      })
                    }
                  >
                    <View style={styles.iconBox}>
                      <CategoryIcon icon={item.categoryIcon} size={18} />
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.note}
                      </Text>
                      <Text style={styles.meta}>
                        {item.category} · {item.wallet}
                      </Text>
                      {(item.tags ?? []).length > 0 ? (
                        <View style={styles.tagRow}>
                          {(item.tags ?? []).slice(0, 3).map(tag => (
                            <View key={tag} style={styles.tagBadge}>
                              <Text
                                style={styles.tagText}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                #{tag}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={
                        item.type === 'income'
                          ? styles.incomeAmount
                          : styles.expenseAmount
                      }
                      numberOfLines={2}
                    >
                      {item.type === 'income' ? '+' : '-'}
                      {formatCurrency(item.amount, item.currency)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })
        )}

        {meta.total > PAGE_SIZE ? (
          <View style={styles.paginationRow}>
            <TouchableOpacity
              style={[
                styles.pageButton,
                page === 1 && styles.pageButtonDisabled,
              ]}
              disabled={page === 1}
              onPress={() => setPage(current => Math.max(1, current - 1))}
            >
              <ChevronLeft
                size={20}
                color={page === 1 ? '#9C7255' : Colors.white}
              />
            </TouchableOpacity>
            <Text style={styles.pageMeta}>
              Trang {page}/{meta.totalPages}
            </Text>
            <TouchableOpacity
              style={[
                styles.pageButton,
                page === meta.totalPages && styles.pageButtonDisabled,
              ]}
              disabled={page === meta.totalPages}
              onPress={() =>
                setPage(current => Math.min(meta.totalPages, current + 1))
              }
            >
              <ChevronRight
                size={20}
                color={page === meta.totalPages ? '#9C7255' : Colors.white}
              />
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        transparent
        visible={isCategoryModalVisible}
        animationType="slide"
        onRequestClose={() => setIsCategoryModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.backdropPressable}
            activeOpacity={1}
            onPress={() => setIsCategoryModalVisible(false)}
          />
          <View style={styles.categoryModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn danh mục</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsCategoryModalVisible(false)}
              >
                <X size={18} color="#7A4A28" />
              </TouchableOpacity>
            </View>
            <View style={styles.segmentRow}>
              {(['expense', 'income', 'loan_debt'] as CategoryMode[]).map(
                item => (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.segmentChip,
                      categoryMode === item && styles.segmentChipActive,
                    ]}
                    onPress={() => setCategoryMode(item)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        categoryMode === item && styles.segmentTextActive,
                      ]}
                    >
                      {item === 'income'
                        ? 'Thu'
                        : item === 'expense'
                        ? 'Chi'
                        : 'Vay/Nợ'}
                    </Text>
                  </TouchableOpacity>
                ),
              )}
            </View>
            <TouchableOpacity
              style={[
                styles.categoryOption,
                categoryId === null && styles.categoryOptionActive,
              ]}
              onPress={() => {
                setCategoryId(null);
                setIsCategoryModalVisible(false);
              }}
            >
              <Text
                style={[
                  styles.categoryOptionText,
                  categoryId === null && styles.categoryOptionTextActive,
                ]}
              >
                Tất cả danh mục
              </Text>
            </TouchableOpacity>
            <ScrollView
              style={styles.categoryOptionList}
              showsVerticalScrollIndicator={false}
            >
              {categoryOptions.map(category => {
                const active = categoryId === category.id;

                return (
                  <TouchableOpacity
                    key={category.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Chọn danh mục ${category.name}`}
                    style={[
                      styles.categoryOption,
                      active && styles.categoryOptionActive,
                    ]}
                    onPress={() => {
                      setCategoryId(category.id);
                      setTypeMode(
                        isLoanDebtCategory(category)
                          ? 'loan_debt'
                          : category.type === 'INCOME'
                          ? 'income'
                          : 'expense',
                      );
                      setIsCategoryModalVisible(false);
                    }}
                  >
                    <CategoryIcon icon={category.icon ?? null} size={18} />
                    <Text
                      style={[
                        styles.categoryOptionText,
                        active && styles.categoryOptionTextActive,
                      ]}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  retryButton: {
    minHeight: 44,
    paddingHorizontal: 20,
    marginTop: 12,
    alignSelf: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  retryText: { color: Colors.white, fontWeight: '600' },
  container: { flex: 1, backgroundColor: '#FFF3E8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 12,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF0E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: '#4A2B1A',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  headerSpacer: { width: 42 },
  clearButton: { width: 42, alignItems: 'flex-end' },
  clearButtonText: { color: Colors.primary, fontWeight: '900' },
  content: { padding: 16, paddingBottom: 36 },
  searchBox: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#4C2A18',
    fontWeight: '700',
    paddingVertical: 13,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 14,
  },
  summaryCardFull: { width: '100%' },
  summaryLabel: { color: '#8A623F', fontSize: 12, fontWeight: '800' },
  summaryValue: {
    color: '#4A2B1A',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 7,
  },
  incomeText: {
    color: '#188F5A',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 7,
  },
  expenseText: {
    color: '#D4621D',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 7,
  },
  panel: {
    marginTop: 16,
    backgroundColor: '#FFF9F3',
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 14,
  },
  panelTitle: { color: '#4A2B1A', fontSize: 17, fontWeight: '900' },
  label: {
    color: '#7B573C',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 14,
    marginBottom: 8,
  },
  chipRow: { gap: 9, paddingRight: 18 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E8B680',
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: '#7A4A28', fontWeight: '800' },
  chipTextActive: { color: Colors.white },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segmentChip: {
    backgroundColor: '#FFF1E3',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  segmentChipActive: { backgroundColor: Colors.primary },
  segmentText: { color: '#8A623F', fontWeight: '800', fontSize: 12 },
  segmentTextActive: { color: Colors.white },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  monthChip: {
    minWidth: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8B680',
    backgroundColor: Colors.white,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  yearControl: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginTop: 10,
  },
  yearButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearButtonDisabled: { opacity: 0.45 },
  yearValue: { color: '#4A2B1A', fontSize: 17, fontWeight: '900' },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 10,
  },
  dateButtonLabel: { color: '#A06B42', fontSize: 12, fontWeight: '800' },
  dateButtonValue: { color: '#4C2A18', fontWeight: '900', marginTop: 2 },
  categorySelectCard: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categorySelectIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categorySelectCopy: { flex: 1 },
  categorySelectName: { color: '#4C2A18', fontWeight: '900' },
  categorySelectMeta: {
    color: '#8A623F',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  input: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    color: '#4C2A18',
    fontWeight: '700',
  },
  quarterYearInput: { marginTop: 10 },
  tagInputBox: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  tagInput: { flex: 1, color: '#4C2A18', fontWeight: '700' },
  resetFilterButton: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetFilterText: { color: Colors.primary, fontWeight: '900' },
  emptyCard: {
    marginTop: 16,
    backgroundColor: Colors.white,
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 18,
    alignItems: 'center',
  },
  emptyTitle: { color: '#4C2A18', fontSize: 18, fontWeight: '900' },
  emptyText: { color: '#8A623F', marginTop: 8, textAlign: 'center' },
  dayGroup: { marginTop: 16 },
  dayHeader: { marginBottom: 8, paddingHorizontal: 4 },
  dayTitle: { color: '#4C2A18', fontSize: 16, fontWeight: '900' },
  dayMeta: { color: '#8A623F', fontSize: 12, fontWeight: '800', marginTop: 4 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.2,
    borderColor: '#E8B680',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: { flex: 1, minWidth: 0, paddingRight: 6 },
  itemTitle: { color: '#4C2A18', fontWeight: '800', fontSize: 15 },
  meta: { color: '#8A623F', marginTop: 5 },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  tagBadge: {
    maxWidth: '100%',
    flexShrink: 0,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    backgroundColor: '#FFE3C8',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  tagText: {
    includeFontPadding: false,
    textAlignVertical: 'center',
    color: '#A94F18',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
  },
  incomeAmount: {
    color: '#188F5A',
    fontWeight: '900',
    maxWidth: 112,
    textAlign: 'right',
  },
  expenseAmount: {
    color: '#D4621D',
    fontWeight: '900',
    maxWidth: 112,
    textAlign: 'right',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
    marginBottom: 12,
  },
  pageButton: {
    minWidth: 86,
    borderRadius: 14,
    backgroundColor: '#4A2B1A',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pageButtonDisabled: { backgroundColor: '#F0D6C1' },
  pageButtonText: { color: Colors.white, fontWeight: '900' },
  pageButtonTextDisabled: { color: '#9C7255' },
  pageMeta: { color: '#7A4A28', fontWeight: '900' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(36, 22, 12, 0.38)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  backdropPressable: { ...StyleSheet.absoluteFill },
  categoryModalCard: {
    maxHeight: '78%',
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: '#FFF9F3',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: { color: '#4C2A18', fontSize: 20, fontWeight: '900' },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryOptionList: { marginTop: 10 },
  categoryOption: {
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E8B680',
    paddingHorizontal: 12,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryOptionText: { color: '#4C2A18', fontWeight: '900' },
  categoryOptionTextActive: { color: Colors.white },
});

export default TransactionSearchScreen;
