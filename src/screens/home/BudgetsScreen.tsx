import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  CalendarDays,
  Pencil,
  Plus,
  Search,
  Trash2,
  WalletCards,
} from 'lucide-react-native';
import CategoryIcon from '../../components/CategoryIcon';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Colors } from '../../constants/Colors';
import { getWalletTypeMeta } from '../../constants/walletTypes';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { budgetsService } from '../../services/budgets';
import { categoriesService } from '../../services/categories';
import { walletsService } from '../../services/wallets';
import type {
  Budget,
  BudgetPeriod,
  BudgetScope,
  BudgetStatus,
} from '../../types/budget';
import type { Category } from '../../types/category';
import type { Wallet } from '../../types/wallet';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency } from '../../utils/format';
import {
  getBudgetDateEditPolicy,
  getBudgetPeriodRange,
  getBudgetSaveRange,
  toDateKey,
} from '../../utils/budgetPeriod';
import {
  budgetContainsDate,
  getBudgetRenewalButtonState,
  hasMatchingNextPeriodBudget,
  shouldShowBudgetRenewal,
} from '../../utils/budgetRenewal';
import {
  getBudgetExpenseCategories,
  type BudgetPeriodFilter,
} from '../../utils/budgetFilters';

type Props = NativeStackScreenProps<RootStackParamList, 'Budgets'>;
type DatePickerTarget =
  | 'filterStart'
  | 'filterEnd'
  | 'budgetStart'
  | 'budgetEnd';
const PAGE_SIZE = 10;

const PERIODS: Array<{ value: BudgetPeriod; label: string }> = [
  { value: 'DAY', label: 'Ngày' },
  { value: 'WEEK', label: 'Tuần' },
  { value: 'MONTH', label: 'Tháng' },
  { value: 'QUARTER', label: 'Quý' },
  { value: 'YEAR', label: 'Năm' },
  { value: 'CUSTOM', label: 'Tùy chọn' },
];

const PERIOD_LABELS: Record<BudgetPeriod, string> = {
  DAY: 'Ngày',
  WEEK: 'Tuần',
  MONTH: 'Tháng',
  QUARTER: 'Quý',
  YEAR: 'Năm',
  CUSTOM: 'Tùy chọn',
};

const PERIOD_FILTERS: Array<{ value: BudgetPeriodFilter; label: string }> = [
  { value: 'CURRENT', label: 'Đang áp dụng' },
  { value: 'PREVIOUS_MONTH', label: 'Tháng trước' },
  { value: 'PREVIOUS_QUARTER', label: 'Quý trước' },
  { value: 'PREVIOUS_YEAR', label: 'Năm trước' },
  { value: 'CUSTOM_RANGE', label: 'Tùy chọn' },
  { value: 'ALL', label: 'Tất cả' },
];

const SCOPES: Array<{ value: BudgetScope; label: string }> = [
  { value: 'WALLET', label: 'Toàn ví' },
  { value: 'CATEGORY', label: 'Theo danh mục' },
];

const statusMeta: Record<
  BudgetStatus,
  { label: string; color: string; background: string }
> = {
  NORMAL: { label: 'Ổn định', color: '#28724A', background: '#E8F7EE' },
  WARNING: { label: 'Cảnh báo', color: '#A15C00', background: '#FFF3D8' },
  EXCEEDED: { label: 'Vượt mức', color: '#B3261E', background: '#FFE4DF' },
};

const formatAmountInput = (value: string) => {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? new Intl.NumberFormat('en-US').format(Number(digits)) : '';
};

const normalizeAmountInput = (value: string) => value.replace(/[^\d]/g, '');
const parseDateKey = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) {
    return null;
  }

  return date;
};

const formatDateText = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${`${date.getDate()}`.padStart(2, '0')}/${`${
    date.getMonth() + 1
  }`.padStart(2, '0')}/${date.getFullYear()}`;
};

const getDefaultRange = (period: BudgetPeriod) =>
  getBudgetPeriodRange(period, new Date());
const getPeriodLabel = (period: BudgetPeriod) =>
  PERIOD_LABELS[period] ?? period;
const getBudgetLimit = (budget: Budget) =>
  Number(budget.limit_amount ?? budget.amount ?? 0);
const isExpiredFixedBudget = (budget: Budget) =>
  new Date(budget.end_date).getTime() < Date.now();
const BudgetsScreen = ({ navigation }: Props) => {
  const { token } = useAuth();
  const { selectedBudgetCategory, setSelectedBudgetCategory } = useFinance();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [localBudgets, setLocalBudgets] = useState<Budget[]>([]);
  const [allBudgets, setAllBudgets] = useState<Budget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [renewingBudgetId, setRenewingBudgetId] = useState<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<BudgetScope>('WALLET');
  const [selectedWalletId, setSelectedWalletId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<BudgetPeriod>('MONTH');
  const [startDate, setStartDate] = useState(getDefaultRange('MONTH').start);
  const [endDate, setEndDate] = useState(getDefaultRange('MONTH').end);
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] =
    useState<BudgetPeriodFilter>('CURRENT');
  const [filterStartDate, setFilterStartDate] = useState(toDateKey(new Date()));
  const [filterEndDate, setFilterEndDate] = useState(toDateKey(new Date()));
  const [datePickerTarget, setDatePickerTarget] =
    useState<DatePickerTarget | null>(null);
  const [page, setPage] = useState(1);
  const [pageMeta, setPageMeta] = useState({ total: 0, totalPages: 1 });
  const shouldReopenBudgetForm = React.useRef(false);
  const currentBudgetDate = toDateKey(new Date());

  const expenseCategories = useMemo(
    () => getBudgetExpenseCategories(categories),
    [categories],
  );
  const warningCount = localBudgets.filter(
    item => item.status === 'WARNING',
  ).length;
  const exceededCount = localBudgets.filter(
    item => item.status === 'EXCEEDED',
  ).length;
  const dateEditPolicy = getBudgetDateEditPolicy(period);
  const canEditBudgetDates =
    dateEditPolicy.canEditStartDate && dateEditPolicy.canEditEndDate;
  const periodDateRangeLabel = `${formatDateText(startDate)} - ${formatDateText(
    endDate,
  )}`;
  const selectedWallet = useMemo(
    () => wallets.find(wallet => wallet.id === selectedWalletId) ?? null,
    [selectedWalletId, wallets],
  );
  const selectedCategory = useMemo(
    () =>
      categories.find(category => category.id === selectedCategoryId) ??
      selectedBudgetCategory,
    [categories, selectedBudgetCategory, selectedCategoryId],
  );
  const fetchData = useCallback(
    async (refreshing = false) => {
      if (!token) {
        return;
      }

      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const [nextWallets, budgetPage, nextCategories, nextAllBudgets] =
          await Promise.all([
            walletsService.getAll(token),
            budgetsService.getPage(token, {
              page,
              limit: PAGE_SIZE,
              q: searchQuery.trim() || undefined,
              period_filter: periodFilter,
              custom_start_date:
                periodFilter === 'CUSTOM_RANGE' ? filterStartDate : undefined,
              custom_end_date:
                periodFilter === 'CUSTOM_RANGE' ? filterEndDate : undefined,
              current_date: currentBudgetDate,
            }),
            categoriesService.getAll(token),
            budgetsService.getAll(token),
          ]);
        setWallets(nextWallets);
        setLocalBudgets(budgetPage.data);
        setPageMeta({
          total: budgetPage.meta.total,
          totalPages: budgetPage.meta.totalPages,
        });
        setCategories(nextCategories);
        setAllBudgets(nextAllBudgets);
      } catch (error) {
        const message =
          getUserFriendlyErrorMessage(error, 'Không thể tải ngân sách.');
        Alert.alert('Lỗi tải ngân sách', message);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      currentBudgetDate,
      filterEndDate,
      filterStartDate,
      page,
      periodFilter,
      searchQuery,
      token,
    ],
  );

  useEffect(() => {
    setPage(1);
  }, [filterEndDate, filterStartDate, periodFilter, searchQuery]);

  useFocusEffect(
    useCallback(() => {
      fetchData();

      if (shouldReopenBudgetForm.current) {
        shouldReopenBudgetForm.current = false;
        setModalVisible(true);
      }
    }, [fetchData]),
  );

  useEffect(() => {
    if (selectedBudgetCategory?.type === 'EXPENSE') {
      setSelectedCategoryId(selectedBudgetCategory.id);
    }
  }, [selectedBudgetCategory]);

  const resetForm = (budget?: Budget) => {
    if (budget) {
      setEditingBudget(budget);
      setName(budget.name);
      setScope(budget.scope);
      setSelectedWalletId(budget.wallet_id);
      setSelectedCategoryId(budget.category_id ?? null);
      setSelectedBudgetCategory(
        categories.find(category => category.id === budget.category_id) ?? null,
      );
      setAmount(formatAmountInput(String(getBudgetLimit(budget))));
      setPeriod(budget.period);
      setStartDate(toDateKey(new Date(budget.start_date)));
      setEndDate(toDateKey(new Date(budget.end_date)));
      setModalVisible(true);
      return;
    }

    const range = getDefaultRange('MONTH');
    setEditingBudget(null);
    setName('');
    setScope('WALLET');
    setSelectedWalletId(wallets[0]?.id ?? null);
    setSelectedCategoryId(expenseCategories[0]?.id ?? null);
    setSelectedBudgetCategory(expenseCategories[0] ?? null);
    setAmount('');
    setPeriod('MONTH');
    setStartDate(range.start);
    setEndDate(range.end);
    setModalVisible(true);
  };

  const handleChangePeriod = (nextPeriod: BudgetPeriod) => {
    setPeriod(nextPeriod);
    const range = getBudgetPeriodRange(nextPeriod, new Date());
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const handleChangeStartDate = (value: string) => {
    setStartDate(value);

    if (period === 'CUSTOM') {
      return;
    }

    const anchor = parseDateKey(value);
    if (anchor) {
      const range = getBudgetPeriodRange(period, anchor);
      setStartDate(range.start);
      setEndDate(range.end);
    }
  };

  const handleChangeEndDate = (value: string) => {
    setEndDate(value);
  };

  const openBudgetCategoryPicker = () => {
    const currentCategory =
      categories.find(category => category.id === selectedCategoryId) ??
      expenseCategories[0] ??
      null;

    setSelectedBudgetCategory(currentCategory);
    shouldReopenBudgetForm.current = true;
    setModalVisible(false);
    navigation.navigate('Categories', {
      selectMode: true,
      selectTarget: 'budget',
      categoryType: 'EXPENSE',
    });
  };

  const getDatePickerValue = () => {
    const value =
      datePickerTarget === 'filterStart'
        ? filterStartDate
        : datePickerTarget === 'filterEnd'
        ? filterEndDate
        : datePickerTarget === 'budgetStart'
        ? startDate
        : endDate;

    return parseDateKey(value) ?? new Date();
  };

  const handleDatePickerChange = (
    _event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    const target = datePickerTarget;
    setDatePickerTarget(null);

    if (!target || !selectedDate) {
      return;
    }

    const value = toDateKey(selectedDate);

    if (target === 'filterStart') {
      setFilterStartDate(value);
      if (
        parseDateKey(value) &&
        parseDateKey(filterEndDate) &&
        value > filterEndDate
      ) {
        setFilterEndDate(value);
      }
      return;
    }

    if (target === 'filterEnd') {
      setFilterEndDate(value);
      if (
        parseDateKey(value) &&
        parseDateKey(filterStartDate) &&
        value < filterStartDate
      ) {
        setFilterStartDate(value);
      }
      return;
    }

    if (target === 'budgetStart') {
      handleChangeStartDate(value);
      if (
        period === 'CUSTOM' &&
        parseDateKey(value) &&
        parseDateKey(endDate) &&
        value > endDate
      ) {
        setEndDate(value);
      }
      return;
    }

    handleChangeEndDate(value);
    if (
      period === 'CUSTOM' &&
      parseDateKey(value) &&
      parseDateKey(startDate) &&
      value < startDate
    ) {
      setStartDate(value);
    }
  };

  const handleSaveBudget = async () => {
    if (!token) {
      return;
    }

    const normalizedAmount = normalizeAmountInput(amount);
    const trimmedName = name.trim();

    if (!trimmedName) {
      Alert.alert('Thiếu tên ngân sách', 'Vui lòng nhập tên ngân sách.');
      return;
    }

    if (!selectedWalletId) {
      Alert.alert('Thiếu ví', 'Vui lòng chọn ví cho ngân sách.');
      return;
    }

    if (scope === 'CATEGORY' && !selectedCategoryId) {
      Alert.alert(
        'Thiếu danh mục',
        'Vui lòng chọn danh mục cho ngân sách danh mục.',
      );
      return;
    }

    if (!normalizedAmount || Number(normalizedAmount) <= 0) {
      Alert.alert(
        'Thiếu hạn mức',
        'Vui lòng nhập hạn mức ngân sách lớn hơn 0.',
      );
      return;
    }

    const saveRange = getBudgetSaveRange(period, startDate, endDate);

    if (
      !saveRange.start ||
      !saveRange.end ||
      new Date(saveRange.start) > new Date(saveRange.end)
    ) {
      Alert.alert(
        'Sai khoảng thời gian',
        'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',
      );
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        name: trimmedName,
        scope,
        wallet_id: selectedWalletId,
        category_id: scope === 'CATEGORY' ? selectedCategoryId : null,
        limit_amount: normalizedAmount,
        period,
        start_date: saveRange.start,
        end_date: saveRange.end,
      };
      const saved = editingBudget
        ? await budgetsService.update(token, editingBudget.id, payload)
        : await budgetsService.create(token, payload);

      if (saved.warning?.message) {
        Alert.alert('Cảnh báo ngân sách', getUserFriendlyErrorMessage(saved.warning.message, saved.warning.message));
      }

      await fetchData(true);
      setModalVisible(false);
    } catch (error) {
      const message =
        getUserFriendlyErrorMessage(error, 'Không thể lưu ngân sách.');
      Alert.alert('Lưu ngân sách thất bại', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBudget = () => {
    if (!token || !editingBudget) {
      return;
    }

    Alert.alert('Xóa ngân sách', 'Bạn chắc chắn muốn xóa ngân sách này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsSaving(true);
            await budgetsService.remove(token, editingBudget.id);
            await fetchData(true);
            setModalVisible(false);
          } catch (error) {
            const message =
              error instanceof Error
                ? getUserFriendlyErrorMessage(error, 'Không thể xóa ngân sách.')
                : 'Không thể xóa ngân sách.';
            Alert.alert('Xóa ngân sách thất bại', message);
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
  };

  const handleCreateNextPeriod = async (budget: Budget) => {
    if (
      !token ||
      renewingBudgetId !== null ||
      hasMatchingNextPeriodBudget(budget, allBudgets)
    ) {
      return;
    }

    try {
      setRenewingBudgetId(budget.id);
      const result = await budgetsService.createNextPeriod(token, budget.id);
      setAllBudgets(current => {
        const withoutCreated = current.filter(
          item => item.id !== result.budget.id,
        );
        return [...withoutCreated, result.budget];
      });
      if (result.budget.warning?.message) {
        Alert.alert('Cảnh báo ngân sách', getUserFriendlyErrorMessage(result.budget.warning.message, result.budget.warning.message));
      }
      if (budgetContainsDate(result.budget)) {
        if (periodFilter === 'CURRENT' && page === 1) {
          await fetchData(true);
        } else {
          setPage(1);
          setPeriodFilter('CURRENT');
        }
      } else {
        await fetchData(true);
      }
      if (result.creation_state === 'created') {
        Alert.alert('Đã tạo kỳ mới', 'Ngân sách kỳ mới đã được tạo.');
      }
    } catch (error) {
      const message =
        getUserFriendlyErrorMessage(error, 'Không thể tạo kỳ mới.');
      Alert.alert('Tạo kỳ mới thất bại', message);
    } finally {
      setRenewingBudgetId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ngân sách</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => resetForm()}
        >
          <Plus size={22} color="#593420" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchData(true)}
            colors={[Colors.primary]}
          />
        }
      >
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{pageMeta.total}</Text>
            <Text style={styles.statLabel}>Ngân sách</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{warningCount}</Text>
            <Text style={styles.statLabel}>Cảnh báo chi tiêu</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{exceededCount}</Text>
            <Text style={styles.statLabel}>Vượt mức chi tiêu</Text>
          </View>
        </View>

        <View style={styles.filterCard}>
          <Text style={styles.filterTitle}>Kỳ xem ngân sách</Text>
          <View style={styles.searchBox}>
            <Search size={18} color="#9A765B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo tên, ví, danh mục"
              placeholderTextColor="#B6967C"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipRow}
          >
            {PERIOD_FILTERS.map(item => {
              const active = periodFilter === item.value;

              return (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setPeriodFilter(item.value)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {periodFilter === 'CUSTOM_RANGE' ? (
            <View style={styles.datePickerPanel}>
              <Text style={styles.datePickerPanelTitle}>
                Xem ngân sách theo khoảng ngày
              </Text>
              <Text style={styles.datePickerPanelHint}>
                Dùng để xem tháng cũ hoặc một khoảng tùy chọn, ví dụ 01/05/2026
                - 31/05/2026.
              </Text>
              <View style={styles.customFilterRow}>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setDatePickerTarget('filterStart')}
                >
                  <View>
                    <Text style={styles.customDateLabel}>Bắt đầu</Text>
                    <Text style={styles.datePickerValue}>
                      {formatDateText(filterStartDate)}
                    </Text>
                  </View>
                  <CalendarDays size={18} color="#D87219" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setDatePickerTarget('filterEnd')}
                >
                  <View>
                    <Text style={styles.customDateLabel}>Kết thúc</Text>
                    <Text style={styles.datePickerValue}>
                      {formatDateText(filterEndDate)}
                    </Text>
                  </View>
                  <CalendarDays size={18} color="#D87219" />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>

        {isLoading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : localBudgets.length === 0 ? (
          <View style={styles.emptyState}>
            <WalletCards size={28} color="#D87219" />
            <Text style={styles.emptyTitle}>Chưa có ngân sách</Text>
            <Text style={styles.emptyText}>
              Tạo ngân sách cho toàn ví hoặc từng danh mục để theo dõi chi tiêu
              theo kỳ.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, styles.emptyCreateButton]}
              onPress={() => resetForm()}
            >
              <Text style={styles.primaryButtonText}>Tạo ngân sách</Text>
            </TouchableOpacity>
          </View>
        ) : localBudgets.length === 0 ? (
          <View style={styles.emptyState}>
            <Search size={28} color="#D87219" />
            <Text style={styles.emptyTitle}>Không tìm thấy ngân sách</Text>
            <Text style={styles.emptyText}>
              Thử đổi từ khóa hoặc chọn bộ lọc thời gian khác.
            </Text>
          </View>
        ) : (
          localBudgets.map(budget => {
            const meta = statusMeta[budget.status];
            const wallet = wallets.find(item => item.id === budget.wallet_id);
            const currency = wallet?.currency ?? budget.wallet_currency;
            const carryOver = Number(budget.carry_over_overspent ?? 0);
            const limit = getBudgetLimit(budget);
            const availableLimit = Number(
              budget.available_limit_amount ?? limit,
            );
            const remaining = Number(
              budget.effective_remaining ?? budget.remaining,
            );
            const percentage = Math.min(
              100,
              Number(
                budget.effective_percent ??
                  budget.percent ??
                  budget.percentage ??
                  0,
              ),
            );
            const renewalState = getBudgetRenewalButtonState(
              hasMatchingNextPeriodBudget(budget, allBudgets),
              renewingBudgetId === budget.id,
            );

            return (
              <TouchableOpacity
                key={budget.id}
                style={styles.budgetCard}
                onPress={() =>
                  navigation.navigate('BudgetDetail', { budgetId: budget.id })
                }
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleGroup}>
                    <Text style={styles.walletName}>{budget.name}</Text>
                    <Text style={styles.periodText}>
                      {budget.scope === 'WALLET'
                        ? wallet?.name ?? budget.wallet_name
                        : `${wallet?.name ?? budget.wallet_name} · ${
                            budget.category_name ?? 'Danh mục'
                          }`}
                    </Text>
                    <Text style={styles.periodText}>
                      {getPeriodLabel(budget.period)} ·{' '}
                      {formatDateText(budget.start_date)} -{' '}
                      {formatDateText(budget.end_date)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: meta.background },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: meta.color }]}>
                      {meta.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.amountRow}>
                  <Text style={styles.spentText}>
                    {formatCurrency(budget.spent, currency)}
                  </Text>
                  <Text style={styles.amountText}>
                    / {formatCurrency(availableLimit, currency)}
                  </Text>
                </View>
                {carryOver > 0 ? (
                  <Text style={styles.periodText}>
                    Original {formatCurrency(limit, currency)} - over previous{' '}
                    {formatCurrency(carryOver, currency)}
                  </Text>
                ) : null}

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      budget.status === 'WARNING' && styles.progressWarning,
                      budget.status === 'EXCEEDED' && styles.progressDanger,
                      { width: `${Math.max(4, percentage)}%` },
                    ]}
                  />
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.remainingText}>
                    Còn lại {formatCurrency(remaining, currency)}
                  </Text>
                  <TouchableOpacity
                    style={styles.editHint}
                    onPress={() => resetForm(budget)}
                  >
                    <Pencil size={14} color="#9A765B" />
                    <Text style={styles.editHintText}>Sửa</Text>
                  </TouchableOpacity>
                </View>

                {budget.period !== 'CUSTOM' &&
                shouldShowBudgetRenewal(
                  periodFilter,
                  isExpiredFixedBudget(budget),
                ) ? (
                  <TouchableOpacity
                    style={[
                      styles.secondaryButton,
                      renewalState.disabled && styles.secondaryButtonDisabled,
                    ]}
                    disabled={renewalState.disabled}
                    onPress={event => {
                      event.stopPropagation();
                      handleCreateNextPeriod(budget);
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {renewalState.label}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
        {pageMeta.total > PAGE_SIZE ? (
          <View style={styles.paginationRow}>
            <TouchableOpacity
              style={[
                styles.pageButton,
                page === 1 && styles.pageButtonDisabled,
              ]}
              disabled={page === 1}
              onPress={() => setPage(current => Math.max(1, current - 1))}
            >
              <Text
                style={[
                  styles.pageButtonText,
                  page === 1 && styles.pageButtonTextDisabled,
                ]}
              >
                Trước
              </Text>
            </TouchableOpacity>
            <Text style={styles.pageMeta}>
              Trang {page}/{pageMeta.totalPages}
            </Text>
            <TouchableOpacity
              style={[
                styles.pageButton,
                page === pageMeta.totalPages && styles.pageButtonDisabled,
              ]}
              disabled={page === pageMeta.totalPages}
              onPress={() =>
                setPage(current => Math.min(pageMeta.totalPages, current + 1))
              }
            >
              <Text
                style={[
                  styles.pageButtonText,
                  page === pageMeta.totalPages && styles.pageButtonTextDisabled,
                ]}
              >
                Sau
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <Modal transparent visible={modalVisible} animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable
            style={styles.backdropPressable}
            onPress={() => setModalVisible(false)}
          />
          <Pressable style={styles.modalCard}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingBudget ? 'Sửa ngân sách' : 'Tạo ngân sách'}
                </Text>
                {editingBudget ? (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={handleDeleteBudget}
                  >
                    <Trash2 size={18} color="#B3261E" />
                  </TouchableOpacity>
                ) : null}
              </View>

              <Text style={styles.inputLabel}>Tên ngân sách</Text>
              <TextInput
                style={styles.input}
                placeholder="Ví dụ: Ăn uống tháng này"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.inputLabel}>Loại ngân sách</Text>
              <View style={styles.segmentRow}>
                {SCOPES.map(item => {
                  const active = scope === item.value;
                  return (
                    <TouchableOpacity
                      key={item.value}
                      style={[
                        styles.segmentButton,
                        active && styles.segmentButtonActive,
                      ]}
                      onPress={() => setScope(item.value)}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          active && styles.segmentTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Ví</Text>
              {selectedWallet ? (
                <Text style={styles.walletCurrencyHint}>
                  Ngân sách này sẽ dùng tiền tệ của ví:{' '}
                  {selectedWallet.currency}
                </Text>
              ) : null}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.walletCardRow}
              >
                {wallets.map(wallet => {
                  const typeMeta = getWalletTypeMeta(wallet.wallet_type);
                  const WalletTypeIcon = typeMeta.Icon;
                  const active = selectedWalletId === wallet.id;
                  return (
                    <TouchableOpacity
                      key={wallet.id}
                      style={[
                        styles.walletPickerCard,
                        active && styles.walletPickerCardActive,
                      ]}
                      onPress={() => setSelectedWalletId(wallet.id)}
                    >
                      <View
                        style={[
                          styles.walletPickerIcon,
                          active && styles.walletPickerIconActive,
                        ]}
                      >
                        <WalletTypeIcon
                          size={18}
                          color={active ? Colors.white : '#D87219'}
                        />
                      </View>
                      <Text style={styles.walletPickerName} numberOfLines={1}>
                        {wallet.name}
                      </Text>
                      <Text
                        style={styles.walletPickerBalance}
                        numberOfLines={1}
                      >
                        {formatCurrency(
                          Number(wallet.balance || 0),
                          wallet.currency,
                        )}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {wallets.length === 0 ? (
                <Text style={styles.emptyWalletText}>
                  Bạn cần tạo ví trước khi lập ngân sách.
                </Text>
              ) : null}

              {scope === 'CATEGORY' ? (
                <>
                  <Text style={styles.inputLabel}>Danh mục</Text>
                  <TouchableOpacity
                    style={styles.categorySelectCard}
                    onPress={openBudgetCategoryPicker}
                  >
                    <View style={styles.categorySelectIcon}>
                      <CategoryIcon
                        icon={selectedCategory?.icon ?? null}
                        size={20}
                      />
                    </View>
                    <View style={styles.categorySelectCopy}>
                      <Text style={styles.categorySelectName}>
                        {selectedCategory?.name ?? 'Chọn danh mục'}
                      </Text>
                      <Text style={styles.categorySelectMeta}>Khoản chi</Text>
                    </View>
                    <Text style={styles.selectorHint}>Đổi</Text>
                  </TouchableOpacity>
                </>
              ) : null}

              <Text style={styles.inputLabel}>Hạn mức</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="0"
                value={amount}
                onChangeText={value => setAmount(formatAmountInput(value))}
              />

              <Text style={styles.inputLabel}>Kỳ ngân sách</Text>
              <View style={styles.periodGrid}>
                {PERIODS.map(item => {
                  const active = period === item.value;
                  return (
                    <TouchableOpacity
                      key={item.value}
                      style={[
                        styles.periodChip,
                        active && styles.periodChipActive,
                      ]}
                      onPress={() => handleChangePeriod(item.value)}
                    >
                      <Text
                        style={[
                          styles.periodChipText,
                          active && styles.periodChipTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {canEditBudgetDates ? (
                <View style={styles.dateRow}>
                  <View style={styles.dateField}>
                    <Text style={styles.inputLabel}>Bắt đầu</Text>
                    <TouchableOpacity
                      style={styles.dateInputWrap}
                      onPress={() => setDatePickerTarget('budgetStart')}
                    >
                      <CalendarDays size={17} color="#9A765B" />
                      <Text style={styles.dateInputText}>
                        {formatDateText(startDate)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.dateField}>
                    <Text style={styles.inputLabel}>Kết thúc</Text>
                    <TouchableOpacity
                      style={styles.dateInputWrap}
                      onPress={() => setDatePickerTarget('budgetEnd')}
                    >
                      <CalendarDays size={17} color="#9A765B" />
                      <Text style={styles.dateInputText}>
                        {formatDateText(endDate)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.readOnlyRangeCard}>
                  <CalendarDays size={18} color="#9A765B" />
                  <View style={styles.readOnlyRangeCopy}>
                    <Text style={styles.readOnlyRangeLabel}>
                      Thời gian tự tính
                    </Text>
                    <Text style={styles.readOnlyRangeValue}>
                      {periodDateRangeLabel}
                    </Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSaveBudget}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {editingBudget ? 'Lưu thay đổi' : 'Tạo ngân sách'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
      {datePickerTarget ? (
        <DateTimePicker
          value={getDatePickerValue()}
          mode="date"
          onChange={handleDatePickerChange}
        />
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF7EF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF0E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#4A2B1A', fontSize: 20, fontWeight: '900' },
  content: { padding: 16, paddingBottom: 44, gap: 14 },
  statRow: { flexDirection: 'row', gap: 10 },
  statItem: {
    flex: 1,
    minHeight: 76,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    backgroundColor: '#FFFDFC',
    padding: 12,
    justifyContent: 'center',
  },
  statValue: { color: '#4A2B1A', fontSize: 20, fontWeight: '900' },
  statLabel: {
    color: '#8B6548',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  filterCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    backgroundColor: '#FFFDFC',
    padding: 12,
    gap: 10,
  },
  filterTitle: { color: '#4A2B1A', fontSize: 16, fontWeight: '900' },
  filterHint: {
    color: '#8B6548',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  searchBox: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    backgroundColor: '#FFF8F2',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: '#4A2B1A',
    fontSize: 14,
    fontWeight: '800',
    paddingVertical: 0,
  },
  filterChipRow: { gap: 8, paddingRight: 8 },
  filterChip: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    backgroundColor: '#FFF8F2',
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: { color: '#7B573C', fontSize: 13, fontWeight: '900' },
  filterChipTextActive: { color: Colors.white },
  datePickerPanel: {
    borderRadius: 14,
    backgroundColor: '#FFF8F2',
    borderWidth: 1,
    borderColor: '#F4D8C0',
    padding: 12,
    gap: 10,
  },
  datePickerPanelTitle: { color: '#4A2B1A', fontSize: 13, fontWeight: '900' },
  datePickerPanelHint: {
    color: '#8B6548',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  customFilterRow: { flexDirection: 'row', gap: 10 },
  customDateLabel: {
    color: '#7B573C',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 6,
  },
  datePickerButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    backgroundColor: '#FFFDFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  datePickerValue: { color: '#4A2B1A', fontSize: 14, fontWeight: '900' },
  loadingBlock: { paddingVertical: 36 },
  emptyState: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    backgroundColor: '#FFFDFC',
    padding: 18,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    color: '#4A2B1A',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 12,
  },
  emptyText: { color: '#8B6548', lineHeight: 22, marginTop: 8 },
  emptyCreateButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  budgetCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    backgroundColor: '#FFFDFC',
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitleGroup: { flex: 1 },
  walletName: { color: '#4A2B1A', fontSize: 16, fontWeight: '900' },
  periodText: {
    color: '#8B6548',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 5,
  },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 11, fontWeight: '900' },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 16 },
  spentText: { color: '#4A2B1A', fontSize: 20, fontWeight: '900' },
  amountText: {
    color: '#8B6548',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 5,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#F2E2D4',
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#2F8F5B',
  },
  progressWarning: { backgroundColor: '#F1A208' },
  progressDanger: { backgroundColor: '#D64535' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 10,
  },
  remainingText: { flex: 1, color: '#8B6548', fontSize: 12, fontWeight: '800' },
  editHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editHintText: { color: '#9A765B', fontSize: 12, fontWeight: '900' },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  pageButton: {
    minWidth: 88,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: '#5B4636',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageButtonDisabled: { backgroundColor: '#EFE1D5' },
  pageButtonText: { color: Colors.white, fontSize: 13, fontWeight: '900' },
  pageButtonTextDisabled: { color: '#9C7255' },
  pageMeta: { color: '#6E4B35', fontSize: 13, fontWeight: '900' },
  secondaryButton: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D87219',
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryButtonDisabled: { opacity: 0.55 },
  secondaryButtonText: { color: '#B85F00', fontSize: 13, fontWeight: '900' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(36, 22, 12, 0.38)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  backdropPressable: { ...StyleSheet.absoluteFill },
  modalCard: {
    backgroundColor: '#FFFDFC',
    borderRadius: 24,
    padding: 20,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: '#F0D6C1',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitle: { color: '#4A2B1A', fontSize: 22, fontWeight: '900' },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFE4DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    color: '#7B573C',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF8F2',
    borderWidth: 1,
    borderColor: '#F0D6C1',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#4A2B1A',
    fontSize: 16,
  },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    backgroundColor: '#FFF8F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: { backgroundColor: '#4A2B1A', borderColor: '#4A2B1A' },
  segmentText: { color: '#7B573C', fontSize: 13, fontWeight: '900' },
  segmentTextActive: { color: '#FFFFFF' },
  categorySelectCard: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F2D9C0',
    backgroundColor: '#FFF6EF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
  },
  categorySelectIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categorySelectCopy: { flex: 1 },
  categorySelectName: { color: '#4C2A18', fontSize: 15, fontWeight: '900' },
  categorySelectMeta: {
    color: '#8B6548',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  selectorHint: {
    color: '#F28C28',
    fontWeight: '800',
  },
  walletCardRow: {
    gap: 10,
    paddingRight: 10,
  },
  walletPickerCard: {
    width: 138,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F2D9C0',
    backgroundColor: '#FFF6EF',
    padding: 12,
  },
  walletPickerCardActive: {
    borderColor: '#FF8C00',
    backgroundColor: '#FFF0DF',
  },
  walletPickerIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  walletPickerIconActive: {
    backgroundColor: '#FF8C00',
  },
  walletPickerName: {
    color: '#4C2A18',
    fontWeight: '900',
  },
  walletPickerBalance: {
    color: '#8A623F',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 5,
  },
  walletCurrencyHint: {
    color: '#8A623F',
    marginBottom: 8,
    lineHeight: 20,
  },
  emptyWalletText: {
    color: '#C75A1B',
    marginTop: 10,
    lineHeight: 20,
  },
  periodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  periodChip: {
    minWidth: 78,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    backgroundColor: '#FFF8F2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  periodChipActive: { backgroundColor: '#4A2B1A', borderColor: '#4A2B1A' },
  periodChipText: { color: '#7B573C', fontSize: 13, fontWeight: '900' },
  periodChipTextActive: { color: '#FFFFFF' },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateField: { flex: 1 },
  dateInputWrap: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    backgroundColor: '#FFF8F2',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInputText: { flex: 1, color: '#4A2B1A', fontSize: 14, fontWeight: '900' },
  readOnlyRangeCard: {
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    backgroundColor: '#FFF8F2',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  readOnlyRangeCopy: { flex: 1 },
  readOnlyRangeLabel: { color: '#7B573C', fontSize: 12, fontWeight: '800' },
  readOnlyRangeValue: {
    color: '#4A2B1A',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 4,
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: '#FF8C00',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 16,
  },
  primaryButtonText: { color: Colors.white, fontSize: 16, fontWeight: '900' },
});

export default BudgetsScreen;
