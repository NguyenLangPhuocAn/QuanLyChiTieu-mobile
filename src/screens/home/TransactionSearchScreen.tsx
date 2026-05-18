import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ArrowLeft, CalendarDays, Search, Tag } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import CategoryIcon from '../../components/CategoryIcon';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import type { TransactionItem } from '../../data/mockTransactions';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { transactionsService, type TransactionQuery } from '../../services/transactions';
import { formatCurrency, formatDisplayDate } from '../../utils/format';
import { mapApiTransactions } from '../../utils/mapTransactions';

type Props = NativeStackScreenProps<RootStackParamList, 'TransactionSearch'>;
type DateMode = 'all' | 'quarter' | 'after' | 'before' | 'range' | 'day';
type TypeMode = 'all' | 'income' | 'expense';
type PickerTarget = 'after' | 'before' | 'from' | 'to' | 'day' | null;

const PAGE_SIZE = 10;
const today = new Date();
const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
const defaultDay = toDateKey(today);
const parseDateKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : today;
};

const TransactionSearchScreen = ({ navigation, route }: Props) => {
  const { token } = useAuth();
  const { categories, preferredCurrency } = useFinance();
  const wallets = useMemo(() => route.params.wallets ?? [], [route.params.wallets]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [query, setQuery] = useState('');
  const [noteQuery, setNoteQuery] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [walletId, setWalletId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [typeMode, setTypeMode] = useState<TypeMode>('all');
  const [dateMode, setDateMode] = useState<DateMode>('all');
  const [quarter, setQuarter] = useState('Q1');
  const [quarterYear, setQuarterYear] = useState(String(today.getFullYear()));
  const [afterDate, setAfterDate] = useState(defaultDay);
  const [beforeDate, setBeforeDate] = useState(defaultDay);
  const [fromDate, setFromDate] = useState(defaultDay);
  const [toDate, setToDate] = useState(defaultDay);
  const [dayDate, setDayDate] = useState(defaultDay);
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
      type: typeMode === 'all' ? undefined : typeMode === 'income' ? 'INCOME' : 'EXPENSE',
      tag: tagQuery.trim().replace(/^#+/, '').toLowerCase() || undefined,
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

    if (dateMode === 'quarter') {
      const quarterIndex = Number(quarter.replace('Q', '')) - 1;
      const startMonth = quarterIndex * 3;
      const year = Number(quarterYear) || today.getFullYear();
      nextQuery.from = toDateKey(new Date(year, startMonth, 1));
      nextQuery.to = toDateKey(new Date(year, startMonth + 3, 0));
    }

    return nextQuery;
  }, [
    afterDate,
    beforeDate,
    categoryId,
    dateMode,
    dayDate,
    fromDate,
    noteQuery,
    page,
    query,
    quarter,
    quarterYear,
    tagQuery,
    toDate,
    typeMode,
    walletId,
  ]);

  const fetchTransactions = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await transactionsService.getPage(token, serverQuery);
      setTransactions(mapApiTransactions(response.data, wallets));
      setMeta({
        total: response.meta.total,
        totalPages: response.meta.totalPages,
        income: response.meta.income ?? 0,
        expense: response.meta.expense ?? 0,
        net: response.meta.net ?? 0,
      });
    } catch (error) {
      Alert.alert('Không tìm được giao dịch', error instanceof Error ? error.message : 'Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  }, [serverQuery, token, wallets]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

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
    quarterYear,
    tagQuery,
    toDate,
    typeMode,
    walletId,
  ]);

  const handlePickerChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
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

  const clearFilters = () => {
    setQuery('');
    setNoteQuery('');
    setTagQuery('');
    setWalletId(null);
    setCategoryId(null);
    setTypeMode('all');
    setDateMode('all');
    setPage(1);
  };

  const renderDateButton = (label: string, value: string, target: PickerTarget) => (
    <TouchableOpacity style={styles.dateButton} onPress={() => setPickerTarget(target)}>
      <CalendarDays size={16} color="#A06B42" />
      <View>
        <Text style={styles.dateButtonLabel}>{label}</Text>
        <Text style={styles.dateButtonValue}>{value}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>
        <Text style={styles.title}>Tìm giao dịch</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.searchBox}>
          <Search size={18} color="#A26B48" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm ghi chú hoặc tag"
            placeholderTextColor="#A26B48"
          />
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Kết quả</Text>
            <Text style={styles.summaryValue}>{meta.total}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Tổng thu</Text>
            <Text style={styles.incomeText}>{formatCurrency(meta.income, preferredCurrency)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Tổng chi</Text>
            <Text style={styles.expenseText}>{formatCurrency(meta.expense, preferredCurrency)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Dòng tiền</Text>
            <Text style={meta.net >= 0 ? styles.incomeText : styles.expenseText}>
              {formatCurrency(meta.net, preferredCurrency)}
            </Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Bộ lọc</Text>

          <Text style={styles.label}>Ví</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, walletId === null && styles.chipActive]}
              onPress={() => setWalletId(null)}>
              <Text style={[styles.chipText, walletId === null && styles.chipTextActive]}>Tất cả ví</Text>
            </TouchableOpacity>
            {wallets.map(wallet => (
              <TouchableOpacity
                key={wallet.id}
                style={[styles.chip, walletId === wallet.id && styles.chipActive]}
                onPress={() => setWalletId(wallet.id)}>
                <Text style={[styles.chipText, walletId === wallet.id && styles.chipTextActive]}>{wallet.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Nhóm</Text>
          <View style={styles.segmentRow}>
            {(['all', 'income', 'expense'] as TypeMode[]).map(item => (
              <TouchableOpacity
                key={item}
                style={[styles.segmentChip, typeMode === item && styles.segmentChipActive]}
                onPress={() => setTypeMode(item)}>
                <Text style={[styles.segmentText, typeMode === item && styles.segmentTextActive]}>
                  {item === 'all' ? 'Tất cả' : item === 'income' ? 'Thu' : 'Chi'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Thời gian</Text>
          <View style={styles.segmentRow}>
            {(['all', 'quarter', 'after', 'before', 'range', 'day'] as DateMode[]).map(item => (
              <TouchableOpacity
                key={item}
                style={[styles.segmentChip, dateMode === item && styles.segmentChipActive]}
                onPress={() => setDateMode(item)}>
                <Text style={[styles.segmentText, dateMode === item && styles.segmentTextActive]}>
                  {item === 'all'
                    ? 'Tất cả'
                    : item === 'quarter'
                      ? 'Theo quý'
                      : item === 'after'
                        ? 'Sau'
                        : item === 'before'
                          ? 'Trước'
                          : item === 'range'
                            ? 'Trong khoảng'
                            : 'Ngày'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {dateMode === 'quarter' ? (
            <>
              <View style={styles.segmentRow}>
                {['Q1', 'Q2', 'Q3', 'Q4'].map(item => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.segmentChip, quarter === item && styles.segmentChipActive]}
                    onPress={() => setQuarter(item)}>
                    <Text style={[styles.segmentText, quarter === item && styles.segmentTextActive]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.input, styles.quarterYearInput]}
                value={quarterYear}
                onChangeText={setQuarterYear}
                placeholder="Năm"
                keyboardType="numeric"
              />
            </>
          ) : null}
          {dateMode === 'after' ? renderDateButton('Sau ngày', afterDate, 'after') : null}
          {dateMode === 'before' ? renderDateButton('Trước ngày', beforeDate, 'before') : null}
          {dateMode === 'day' ? renderDateButton('Ngày giao dịch', dayDate, 'day') : null}
          {dateMode === 'range' ? (
            <View style={styles.dateRow}>
              {renderDateButton('Từ ngày', fromDate, 'from')}
              {renderDateButton('Đến ngày', toDate, 'to')}
            </View>
          ) : null}
          {pickerTarget ? <DateTimePicker value={pickerValue} mode="date" onChange={handlePickerChange} /> : null}

          <Text style={styles.label}>Danh mục</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, categoryId === null && styles.chipActive]}
              onPress={() => setCategoryId(null)}>
              <Text style={[styles.chipText, categoryId === null && styles.chipTextActive]}>Tất cả</Text>
            </TouchableOpacity>
            {categories.map(category => (
              <TouchableOpacity
                key={category.id}
                style={[styles.chip, categoryId === category.id && styles.chipActive]}
                onPress={() => setCategoryId(category.id)}>
                <Text style={[styles.chipText, categoryId === category.id && styles.chipTextActive]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Ghi chú</Text>
          <TextInput
            style={styles.input}
            value={noteQuery}
            onChangeText={setNoteQuery}
            placeholder="Có ghi chú chứa..."
            placeholderTextColor="#A26B48"
          />

          <Text style={styles.label}>Tags</Text>
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
          <TouchableOpacity style={styles.resetFilterButton} onPress={clearFilters}>
            <Text style={styles.resetFilterText}>Xóa bộ lọc</Text>
          </TouchableOpacity>
        </View>

        {isLoading && groupedTransactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.emptyText}>Đang tìm giao dịch...</Text>
          </View>
        ) : groupedTransactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Không có kết quả phù hợp</Text>
            <Text style={styles.emptyText}>Thử đổi từ khóa hoặc nới bộ lọc thời gian.</Text>
          </View>
        ) : (
          groupedTransactions.map(([dateKey, items]) => {
            const daySummary = items.reduce(
              (total, item) => {
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
                    <Text style={styles.dayTitle}>{formatDisplayDate(dateKey)}</Text>
                    <Text style={styles.dayMeta}>
                      {items.length} giao dịch · Thu {formatCurrency(daySummary.income, preferredCurrency)} · Chi{' '}
                      {formatCurrency(daySummary.expense, preferredCurrency)}
                    </Text>
                  </View>
                </View>

                {items.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.card}
                    activeOpacity={0.86}
                    onPress={() => navigation.navigate('TransactionDetail', { transaction: item })}>
                    <View style={styles.iconBox}>
                      <CategoryIcon icon={item.categoryIcon} size={18} />
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemTitle} numberOfLines={1}>{item.note}</Text>
                      <Text style={styles.meta}>{item.category} · {item.wallet}</Text>
                      {(item.tags ?? []).length > 0 ? (
                        <View style={styles.tagRow}>
                          {(item.tags ?? []).slice(0, 3).map(tag => (
                            <Text key={tag} style={styles.tagText}>#{tag}</Text>
                          ))}
                        </View>
                      ) : null}
                    </View>
                    <Text style={item.type === 'income' ? styles.incomeAmount : styles.expenseAmount}>
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
              style={[styles.pageButton, page === 1 && styles.pageButtonDisabled]}
              disabled={page === 1}
              onPress={() => setPage(current => Math.max(1, current - 1))}>
              <Text style={[styles.pageButtonText, page === 1 && styles.pageButtonTextDisabled]}>Trước</Text>
            </TouchableOpacity>
            <Text style={styles.pageMeta}>Trang {page}/{meta.totalPages}</Text>
            <TouchableOpacity
              style={[styles.pageButton, page === meta.totalPages && styles.pageButtonDisabled]}
              disabled={page === meta.totalPages}
              onPress={() => setPage(current => Math.min(meta.totalPages, current + 1))}>
              <Text style={[styles.pageButtonText, page === meta.totalPages && styles.pageButtonTextDisabled]}>Sau</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
  title: { flex: 1, color: '#4A2B1A', fontSize: 22, fontWeight: '900', textAlign: 'center' },
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
  searchInput: { flex: 1, color: '#4C2A18', fontWeight: '700', paddingVertical: 13 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  summaryCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 14,
  },
  summaryLabel: { color: '#8A623F', fontSize: 12, fontWeight: '800' },
  summaryValue: { color: '#4A2B1A', fontSize: 19, fontWeight: '900', marginTop: 7 },
  incomeText: { color: '#E77700', fontSize: 16, fontWeight: '900', marginTop: 7 },
  expenseText: { color: '#C75A1B', fontSize: 16, fontWeight: '900', marginTop: 7 },
  panel: {
    marginTop: 16,
    backgroundColor: '#FFF9F3',
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 14,
  },
  panelTitle: { color: '#4A2B1A', fontSize: 17, fontWeight: '900' },
  label: { color: '#7B573C', fontSize: 13, fontWeight: '900', marginTop: 14, marginBottom: 8 },
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
  segmentChip: { backgroundColor: '#FFF1E3', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  segmentChipActive: { backgroundColor: Colors.primary },
  segmentText: { color: '#8A623F', fontWeight: '800', fontSize: 12 },
  segmentTextActive: { color: Colors.white },
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
  itemInfo: { flex: 1, paddingRight: 6 },
  itemTitle: { color: '#4C2A18', fontWeight: '800', fontSize: 15 },
  meta: { color: '#8A623F', marginTop: 5 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tagText: {
    color: '#A94F18',
    backgroundColor: '#FFE3C8',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '800',
  },
  incomeAmount: { color: '#E77700', fontWeight: '900' },
  expenseAmount: { color: '#C75A1B', fontWeight: '900' },
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
});

export default TransactionSearchScreen;
