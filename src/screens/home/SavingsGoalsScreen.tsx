import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { useSingleFlight } from '../../hooks/useSingleFlight';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Pencil,
  PiggyBank,
  Plus,
  RefreshCcw,
  Trash2,
} from 'lucide-react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import SavingsRoadmapDetails from '../../components/SavingsRoadmapDetails';
import { Colors } from '../../constants/Colors';
import { getWalletTypeMeta } from '../../constants/walletTypes';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { savingsService } from '../../services/savings';
import { walletsService } from '../../services/wallets';
import type { SavingsGoal } from '../../types/savings';
import type { Wallet } from '../../types/wallet';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency, formatShortDate } from '../../utils/format';
import {
  parsePositiveMoneyInput,
  parseNonNegativeMoneyInput,
} from '../../utils/moneyInput';

const screenAccent = '#A95514';

type Props = NativeStackScreenProps<RootStackParamList, 'SavingsGoals'>;
type EntryMode = 'CONTRIBUTION' | 'WITHDRAWAL';
type GoalFilter = 'ACTIVE' | 'COMPLETED';

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));
const toDateInput = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const SavingsGoalsScreen = ({ navigation }: Props) => {
  const { token } = useAuth();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [goalName, setGoalName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [goalNote, setGoalNote] = useState('');
  const [sourceWalletId, setSourceWalletId] = useState<number | null>(null);
  const [entryGoal, setEntryGoal] = useState<SavingsGoal | null>(null);
  const [entryMode, setEntryMode] = useState<EntryMode>('CONTRIBUTION');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [entryWalletId, setEntryWalletId] = useState<number | null>(null);
  const [goalFilter, setGoalFilter] = useState<GoalFilter>('ACTIVE');
  const [completionGoal, setCompletionGoal] = useState<SavingsGoal | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const { run: runSavingsMutation } = useSingleFlight();
  const [showTargetDatePicker, setShowTargetDatePicker] = useState(false);
  const loadRevision = useRef(0);

  const regularWallets = useMemo(
    () =>
      wallets
        .filter(wallet => wallet.wallet_type !== 'SAVINGS')
        .sort((left, right) => left.id - right.id),
    [wallets],
  );
  const vndWallets = useMemo(
    () => regularWallets.filter(wallet => wallet.currency === 'VND'),
    [regularWallets],
  );
  const entryWallets = useMemo(
    () =>
      entryGoal
        ? regularWallets.filter(
            wallet => wallet.currency === entryGoal.wallet_currency,
          )
        : regularWallets,
    [entryGoal, regularWallets],
  );

  const loadData = useCallback(
    async (refresh = false) => {
      const revision = ++loadRevision.current;
      if (!token) {
        setLoading(false);
        return;
      }
      refresh ? setRefreshing(true) : setLoading(true);
      try {
        const [nextGoals, nextWallets] = await Promise.all([
          savingsService.getAll(token),
          walletsService.getAll(token),
        ]);
        if (revision !== loadRevision.current) return;
        setGoals(nextGoals);
        setWallets(nextWallets);
        setLoadError(null);
      } catch (error) {
        if (revision !== loadRevision.current) return;
        setLoadError(
          getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.'),
        );
      } finally {
        if (revision === loadRevision.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => {
        loadRevision.current += 1;
      };
    }, [loadData]),
  );

  const activeGoals = goals.filter(goal => goal.status === 'ACTIVE');
  const completedGoals = goals.filter(goal => goal.status === 'COMPLETED');
  const visibleGoals = goalFilter === 'ACTIVE' ? activeGoals : completedGoals;
  const currencySummaries = Array.from(
    activeGoals.reduce((summaries, goal) => {
      const current = summaries.get(goal.wallet_currency) ?? {
        currency: goal.wallet_currency,
        saved: 0,
        target: 0,
      };
      current.saved += goal.current_amount;
      current.target += goal.target_amount;
      summaries.set(goal.wallet_currency, current);
      return summaries;
    }, new Map<string, { currency: string; saved: number; target: number }>()),
  ).map(([, summary]) => summary);
  const totalPercent =
    activeGoals.length > 0
      ? Math.round(
          activeGoals.reduce((sum, goal) => sum + goal.progress_percent, 0) /
            activeGoals.length,
        )
      : 0;
  const initialContributionValue = Number(
    parseNonNegativeMoneyInput(initialAmount.trim() || '0') ?? 0,
  );

  const resetGoalForm = () => {
    setEditingGoal(null);
    setGoalName('');
    setTargetAmount('');
    setInitialAmount('');
    setTargetDate('');
    setGoalNote('');
    setSourceWalletId(vndWallets[0]?.id ?? null);
    setShowTargetDatePicker(false);
  };

  const openCreate = () => {
    resetGoalForm();
    setGoalModalVisible(true);
  };

  const openEdit = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setGoalName(goal.name);
    setTargetAmount(String(goal.target_amount));
    setInitialAmount('');
    setTargetDate(goal.target_date?.slice(0, 10) ?? '');
    setGoalNote(goal.note ?? '');
    setSourceWalletId(vndWallets[0]?.id ?? null);
    setGoalModalVisible(true);
  };

  const saveGoal = () =>
    runSavingsMutation(async () => {
      const normalizedTarget = parsePositiveMoneyInput(targetAmount);
      const normalizedInitial = parseNonNegativeMoneyInput(
        initialAmount.trim() || '0',
      );
      if (!token || !goalName.trim() || !normalizedTarget) {
        Alert.alert(
          'Thiếu thông tin',
          'Nhập tên và số tiền mục tiêu lớn hơn 0, tối đa 2 số thập phân; không dùng dấu phân cách hàng nghìn.',
        );
        return;
      }
      if (normalizedInitial === null) {
        Alert.alert(
          'Số tiền chưa hợp lệ',
          'Khoản góp ban đầu phải là số không âm, tối đa 2 số thập phân.',
        );
        return;
      }
      if (!editingGoal && initialContributionValue > 0 && !sourceWalletId) {
        Alert.alert(
          'Chưa có ví để trích tiền',
          'Hãy tạo hoặc chọn một ví thường dùng VND.',
        );
        return;
      }
      if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        Alert.alert('Ngày chưa hợp lệ', 'Ngày cần có định dạng YYYY-MM-DD.');
        return;
      }

      const source = vndWallets.find(wallet => wallet.id === sourceWalletId);
      if (
        !editingGoal &&
        source &&
        initialContributionValue > 0 &&
        initialContributionValue > Number(source.balance)
      ) {
        Alert.alert('Số dư không đủ', `Ví “${source.name}” không đủ tiền.`);
        return;
      }

      setSaving(true);
      try {
        let savedGoal: SavingsGoal;
        if (editingGoal) {
          savedGoal = await savingsService.update(token, editingGoal.id, {
            name: goalName.trim(),
            target_amount: normalizedTarget,
            target_date: targetDate || null,
            note: goalNote.trim(),
          });
        } else {
          savedGoal = await savingsService.create(token, {
            name: goalName.trim(),
            target_amount: normalizedTarget,
            ...(initialContributionValue > 0
              ? {
                  source_wallet_id: sourceWalletId as number,
                  initial_amount: normalizedInitial,
                }
              : {}),
            target_date: targetDate || null,
            note: goalNote.trim() || undefined,
            currency: 'VND',
          });
        }
        setGoalModalVisible(false);
        resetGoalForm();
        await loadData();
        if (
          savedGoal.status === 'COMPLETED' &&
          editingGoal?.status !== 'COMPLETED'
        ) {
          setCompletionGoal(savedGoal);
        } else if (editingGoal?.status === 'COMPLETED') {
          setGoalFilter('ACTIVE');
        }
      } catch (error) {
        Alert.alert(
          'Chưa lưu được mục tiêu',
          getUserFriendlyErrorMessage(
            error,
            'Vui lòng kiểm tra lại thông tin.',
          ),
        );
      } finally {
        setSaving(false);
      }
    });

  const openEntry = (goal: SavingsGoal, mode: EntryMode) => {
    const compatibleWallets = regularWallets.filter(
      wallet => wallet.currency === goal.wallet_currency,
    );
    if (compatibleWallets.length === 0) {
      Alert.alert(
        'Chưa có ví phù hợp',
        `Cần một ví thường dùng ${goal.wallet_currency} để đóng góp hoặc nhận tiền.`,
      );
      return;
    }
    setEntryGoal(goal);
    setEntryMode(mode);
    setEntryAmount('');
    setEntryNote('');
    setEntryWalletId(compatibleWallets[0]?.id ?? null);
  };

  const saveEntry = () =>
    runSavingsMutation(async () => {
      const normalizedEntry = parsePositiveMoneyInput(entryAmount);
      if (!token || !entryGoal || !entryWalletId || !normalizedEntry) {
        Alert.alert('Thiếu thông tin', 'Vui lòng chọn ví và nhập số tiền.');
        return;
      }
      const selectedWallet = entryWallets.find(
        wallet => wallet.id === entryWalletId,
      );
      const entryValue = Number(normalizedEntry);
      if (!Number.isFinite(entryValue) || entryValue <= 0) {
        Alert.alert('Số tiền chưa hợp lệ', 'Vui lòng nhập số tiền lớn hơn 0.');
        return;
      }
      if (
        entryMode === 'CONTRIBUTION' &&
        selectedWallet &&
        entryValue > Number(selectedWallet.balance)
      ) {
        Alert.alert(
          'Số dư không đủ',
          `Ví “${selectedWallet.name}” không đủ tiền.`,
        );
        return;
      }
      if (entryMode === 'WITHDRAWAL' && entryValue > entryGoal.current_amount) {
        Alert.alert(
          'Số tiền chưa hợp lệ',
          'Không thể rút nhiều hơn số tiền đang có trong mục tiêu.',
        );
        return;
      }
      setSaving(true);
      try {
        let updatedGoal: SavingsGoal;
        if (entryMode === 'CONTRIBUTION') {
          updatedGoal = await savingsService.contribute(token, entryGoal.id, {
            source_wallet_id: entryWalletId,
            amount: normalizedEntry,
            note: entryNote.trim() || undefined,
          });
        } else {
          updatedGoal = await savingsService.withdraw(token, entryGoal.id, {
            destination_wallet_id: entryWalletId,
            amount: normalizedEntry,
            note: entryNote.trim() || undefined,
          });
        }
        setEntryGoal(null);
        await loadData();
        if (
          entryMode === 'CONTRIBUTION' &&
          entryGoal.status === 'ACTIVE' &&
          updatedGoal.status === 'COMPLETED'
        ) {
          setCompletionGoal(updatedGoal);
        }
      } catch (error) {
        Alert.alert(
          entryMode === 'CONTRIBUTION'
            ? 'Chưa đóng góp được'
            : 'Chưa rút được tiền',
          getUserFriendlyErrorMessage(
            error,
            'Vui lòng kiểm tra số dư và thử lại.',
          ),
        );
      } finally {
        setSaving(false);
      }
    });

  const removeGoal = (goal: SavingsGoal) => {
    Alert.alert(
      'Xóa mục tiêu?',
      goal.current_amount > 0
        ? 'Bạn cần rút hết tiền trước khi xóa mục tiêu.'
        : `Mục tiêu “${goal.name}” sẽ bị xóa.`,
      goal.current_amount > 0
        ? [{ text: 'Đã hiểu' }]
        : [
            { text: 'Hủy', style: 'cancel' },
            {
              text: 'Xóa',
              style: 'destructive',
              onPress: async () => {
                if (!token) return;
                try {
                  await savingsService.remove(token, goal.id);
                  await loadData();
                } catch (error) {
                  Alert.alert(
                    'Chưa xóa được',
                    getUserFriendlyErrorMessage(error, 'Vui lòng thử lại.'),
                  );
                }
              },
            },
          ],
    );
  };

  const walletSelector = (
    items: Wallet[],
    selectedId: number | null,
    onSelect: (id: number) => void,
  ) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.walletCardRow}
    >
      {items.map(wallet => {
        const typeMeta = getWalletTypeMeta(wallet.wallet_type);
        const WalletTypeIcon = typeMeta.Icon;
        const active = selectedId === wallet.id;

        return (
          <TouchableOpacity
            key={wallet.id}
            style={[
              styles.walletPickerCard,
              active && styles.walletPickerCardActive,
            ]}
            onPress={() => onSelect(wallet.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${wallet.name}, ${formatCurrency(
              Number(wallet.balance),
              wallet.currency,
            )}`}
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
            <Text style={styles.walletPickerBalance} numberOfLines={1}>
              {formatCurrency(Number(wallet.balance), wallet.currency)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const handleTargetDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === 'android') setShowTargetDatePicker(false);
    if (event.type === 'dismissed' || !selectedDate) return;
    setTargetDate(toDateInput(selectedDate));
  };

  const selectedEntryWallet = entryWallets.find(
    wallet => wallet.id === entryWalletId,
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Kế hoạch tiết kiệm</Text>
          <Text style={styles.subtitle}>
            Tiền dành riêng, không tính là chi tiêu
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerAdd}
          onPress={openCreate}
          accessibilityRole="button"
          accessibilityLabel="Tạo mục tiêu tiết kiệm"
        >
          <Plus size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={screenAccent} />
          <Text style={styles.loadingText}>Đang tải mục tiêu...</Text>
        </View>
      ) : loadError && goals.length === 0 ? (
        <View style={styles.errorState}>
          <CircleAlert size={34} color="#B3261E" />
          <Text style={styles.errorTitle}>Chưa tải được mục tiêu</Text>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadData().catch(() => undefined)}
          >
            <RefreshCcw size={17} color={Colors.white} />
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              tintColor={screenAccent}
              colors={[screenAccent]}
            />
          }
          contentContainerStyle={styles.content}
        >
          {loadError ? (
            <TouchableOpacity
              style={styles.inlineError}
              onPress={() => loadData(true).catch(() => undefined)}
            >
              <CircleAlert size={18} color="#B3261E" />
              <Text style={styles.inlineErrorText}>
                Dữ liệu mới chưa tải được. Chạm để thử lại.
              </Text>
              <RefreshCcw size={16} color="#B3261E" />
            </TouchableOpacity>
          ) : null}
          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <PiggyBank size={28} color="#A95514" />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>Đã dành cho mục tiêu</Text>
              {currencySummaries.length === 0 ? (
                <Text style={styles.summaryValue}>Chưa có mục tiêu</Text>
              ) : (
                currencySummaries.map(summary => (
                  <Text key={summary.currency} style={styles.summaryValue}>
                    {formatCurrency(summary.saved, summary.currency)} /{' '}
                    {formatCurrency(summary.target, summary.currency)}
                  </Text>
                ))
              )}
              <Text style={styles.summaryMeta}>
                Tiến độ trung bình · {clampPercent(totalPercent)}%
              </Text>
            </View>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>
                {activeGoals.length} mục tiêu
              </Text>
            </View>
          </View>

          {activeGoals.length > 0 ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => navigation.navigate('FinancialPlan')}
              style={styles.affordabilityLink}
            >
              <Text style={styles.affordabilityText}>
                So lịch góp với thu chi dự kiến
              </Text>
              <ArrowRight size={18} color="#A95514" />
            </TouchableOpacity>
          ) : null}
          {goals.length > 0 ? (
            <View style={styles.goalTabs}>
              <TouchableOpacity
                style={[
                  styles.goalTab,
                  goalFilter === 'ACTIVE' && styles.goalTabActive,
                ]}
                onPress={() => setGoalFilter('ACTIVE')}
              >
                <Text
                  style={[
                    styles.goalTabText,
                    goalFilter === 'ACTIVE' && styles.goalTabTextActive,
                  ]}
                >
                  Đang thực hiện ({activeGoals.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.goalTab,
                  goalFilter === 'COMPLETED' && styles.goalTabActive,
                ]}
                onPress={() => setGoalFilter('COMPLETED')}
              >
                <Text
                  style={[
                    styles.goalTabText,
                    goalFilter === 'COMPLETED' && styles.goalTabTextActive,
                  ]}
                >
                  Đã hoàn thành ({completedGoals.length})
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {goals.length === 0 ? (
            <View style={styles.emptyCard}>
              <PiggyBank size={42} color={screenAccent} />
              <Text style={styles.emptyTitle}>
                Bắt đầu bằng một mục tiêu rõ ràng
              </Text>
              <Text style={styles.emptyText}>
                Ví dụ: mua laptop, học phí hoặc một khoản dự phòng. Chọn số tiền
                và ngày cần dùng để xem lịch góp.
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={openCreate}
              >
                <Plus size={18} color={Colors.white} />
                <Text style={styles.primaryButtonText}>
                  Tạo mục tiêu đầu tiên
                </Text>
              </TouchableOpacity>
            </View>
          ) : visibleGoals.length === 0 ? (
            <View style={styles.filteredEmptyCard}>
              {goalFilter === 'ACTIVE' ? (
                <PiggyBank size={34} color={screenAccent} />
              ) : (
                <CheckCircle2 size={34} color="#218358" />
              )}
              <Text style={styles.filteredEmptyTitle}>
                {goalFilter === 'ACTIVE'
                  ? 'Không có mục tiêu đang thực hiện'
                  : 'Chưa có mục tiêu hoàn thành'}
              </Text>
              <Text style={styles.filteredEmptyText}>
                {goalFilter === 'ACTIVE'
                  ? 'Tạo mục tiêu mới để bắt đầu kế hoạch tiết kiệm tiếp theo.'
                  : 'Mục tiêu đạt 100% sẽ được lưu tại đây.'}
              </Text>
            </View>
          ) : (
            visibleGoals.map(goal => (
              <View key={goal.id} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <View
                    style={[
                      styles.goalIcon,
                      goal.status === 'COMPLETED' && styles.goalIconDone,
                    ]}
                  >
                    {goal.status === 'COMPLETED' ? (
                      <CheckCircle2 size={22} color="#218358" />
                    ) : (
                      <PiggyBank size={22} color={screenAccent} />
                    )}
                  </View>
                  <View style={styles.goalCopy}>
                    <Text style={styles.goalName}>{goal.name}</Text>
                    <Text style={styles.goalMeta}>{goal.wallet_name}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => openEdit(goal)}
                  >
                    <Pencil size={17} color="#8B5D3B" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => removeGoal(goal)}
                  >
                    <Trash2 size={17} color="#B84A3A" />
                  </TouchableOpacity>
                </View>

                <View style={styles.amountRow}>
                  <Text style={styles.savedAmount}>
                    {goal.status === 'COMPLETED'
                      ? `Còn trong ví ${formatCurrency(
                          goal.current_amount,
                          goal.wallet_currency,
                        )}`
                      : formatCurrency(
                          goal.current_amount,
                          goal.wallet_currency,
                        )}
                  </Text>
                  <Text style={styles.targetAmount}>
                    {goal.status === 'COMPLETED' ? '· Đã đạt ' : '/ '}
                    {formatCurrency(goal.target_amount, goal.wallet_currency)}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${clampPercent(goal.progress_percent)}%`,
                      },
                    ]}
                  />
                </View>
                <View style={styles.goalInfoRow}>
                  {goal.status === 'COMPLETED' ? (
                    <View style={styles.completedPill}>
                      <CheckCircle2 size={14} color="#218358" />
                      <Text style={styles.completedPillText}>
                        Đã đạt mục tiêu
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.infoPill}>
                      <CalendarDays size={14} color={screenAccent} />
                      <Text style={styles.infoText}>
                        {goal.roadmap?.status === 'OVERDUE'
                          ? 'Cần cập nhật ngày hạn'
                          : goal.target_date
                          ? `Kỳ tới: ${formatCurrency(
                              goal.roadmap?.next_contribution ??
                                goal.suggested_monthly,
                              goal.wallet_currency,
                            )}`
                          : 'Chưa đặt ngày hoàn thành'}
                      </Text>
                    </View>
                  )}
                  {goal.target_date ? (
                    <View style={styles.infoPill}>
                      <CalendarDays size={14} color={screenAccent} />
                      <Text style={styles.infoText}>
                        {formatShortDate(goal.target_date)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <SavingsRoadmapDetails
                  roadmap={goal.roadmap}
                  currency={goal.wallet_currency}
                />

                <View style={styles.actions}>
                  {goal.status === 'COMPLETED' ? (
                    <>
                      <TouchableOpacity
                        style={styles.contributeButton}
                        onPress={() => openEdit(goal)}
                      >
                        <Pencil size={17} color={Colors.white} />
                        <Text style={styles.contributeText}>Tăng mục tiêu</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.withdrawButton,
                          goal.current_amount <= 0 && styles.disabledButton,
                        ]}
                        onPress={() => openEntry(goal, 'WITHDRAWAL')}
                        disabled={goal.current_amount <= 0}
                      >
                        <ArrowUpFromLine size={17} color={screenAccent} />
                        <Text style={styles.withdrawText}>
                          {goal.current_amount > 0
                            ? 'Sử dụng tiền'
                            : 'Đã sử dụng hết'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.contributeButton}
                        onPress={() => openEntry(goal, 'CONTRIBUTION')}
                      >
                        <ArrowDownToLine size={17} color={Colors.white} />
                        <Text style={styles.contributeText}>Đóng góp</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.withdrawButton}
                        onPress={() => openEntry(goal, 'WITHDRAWAL')}
                      >
                        <ArrowUpFromLine size={17} color={screenAccent} />
                        <Text style={styles.withdrawText}>Rút tiền</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                {goal.entries.length > 0 ? (
                  <View style={styles.entryList}>
                    <Text style={styles.entryTitle}>Hoạt động gần đây</Text>
                    {goal.entries.slice(0, 3).map(entry => (
                      <View key={entry.id} style={styles.entryRow}>
                        <Text style={styles.entryLabel}>
                          {entry.type === 'WITHDRAWAL'
                            ? 'Rút khỏi mục tiêu'
                            : 'Đóng góp'}
                        </Text>
                        <Text
                          style={[
                            styles.entryAmount,
                            entry.type === 'WITHDRAWAL' &&
                              styles.entryAmountOut,
                          ]}
                        >
                          {entry.type === 'WITHDRAWAL' ? '−' : '+'}
                          {formatCurrency(entry.amount, goal.wallet_currency)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal
        transparent
        visible={Boolean(completionGoal)}
        animationType="fade"
        onRequestClose={() => setCompletionGoal(null)}
      >
        <View style={styles.completionBackdrop}>
          <View style={styles.completionCard}>
            <View style={styles.completionIcon}>
              <CheckCircle2 size={38} color="#218358" />
            </View>
            <Text style={styles.completionTitle}>Bạn đã đạt mục tiêu!</Text>
            <Text style={styles.completionName}>{completionGoal?.name}</Text>
            <Text style={styles.completionAmount}>
              {completionGoal
                ? formatCurrency(
                    completionGoal.target_amount,
                    completionGoal.wallet_currency,
                  )
                : ''}
            </Text>
            <Text style={styles.completionText}>
              Tiền vẫn được giữ trong ví tiết kiệm. Bạn muốn làm gì tiếp theo?
            </Text>

            <TouchableOpacity
              style={styles.completionPrimaryButton}
              onPress={() => {
                if (!completionGoal) return;
                const goal = completionGoal;
                setCompletionGoal(null);
                openEntry(goal, 'WITHDRAWAL');
              }}
            >
              <ArrowUpFromLine size={18} color={Colors.white} />
              <Text style={styles.completionPrimaryText}>Sử dụng tiền</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.completionSecondaryButton}
              onPress={() => {
                if (!completionGoal) return;
                const goal = completionGoal;
                setCompletionGoal(null);
                openEdit(goal);
              }}
            >
              <Pencil size={17} color={screenAccent} />
              <Text style={styles.completionSecondaryText}>Tăng mục tiêu</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.completionKeepButton}
              onPress={() => {
                setCompletionGoal(null);
                setGoalFilter('COMPLETED');
              }}
            >
              <Text style={styles.completionKeepText}>Giữ tiền trong ví</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={goalModalVisible}
        animationType="slide"
        onRequestClose={() => setGoalModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.modalDismiss}
            onPress={() => setGoalModalVisible(false)}
          />
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>
                {editingGoal ? 'Sửa mục tiêu' : 'Tạo mục tiêu tiết kiệm'}
              </Text>
              <Text style={styles.label}>Tên mục tiêu</Text>
              <TextInput
                style={styles.input}
                value={goalName}
                onChangeText={setGoalName}
                placeholder="Quỹ khẩn cấp"
              />
              <Text style={styles.label}>Số tiền cần đạt (VND)</Text>
              <TextInput
                style={styles.input}
                value={targetAmount}
                onChangeText={setTargetAmount}
                keyboardType="decimal-pad"
                placeholder="30.000.000"
              />
              {!editingGoal ? (
                <>
                  <Text style={styles.label}>
                    Đóng góp ban đầu (không bắt buộc)
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={initialAmount}
                    onChangeText={setInitialAmount}
                    keyboardType="decimal-pad"
                    placeholder="0"
                  />
                  {initialContributionValue > 0 ? (
                    <>
                      <Text style={styles.label}>Trích từ ví</Text>
                      <Text style={styles.sourceHint}>
                        Khoản này được chuyển nội bộ sang mục tiêu, không tính
                        là chi tiêu.
                      </Text>
                      {vndWallets.length ? (
                        walletSelector(
                          vndWallets,
                          sourceWalletId,
                          setSourceWalletId,
                        )
                      ) : (
                        <TouchableOpacity
                          style={styles.missingSourceButton}
                          onPress={() => {
                            setGoalModalVisible(false);
                            navigation.navigate('Wallets');
                          }}
                        >
                          <Text style={styles.missingSourceText}>
                            Tạo ví VND để đóng góp ban đầu
                          </Text>
                          <ArrowRight size={16} color={screenAccent} />
                        </TouchableOpacity>
                      )}
                    </>
                  ) : null}
                </>
              ) : null}
              <Text style={styles.label}>Ngày hoàn thành</Text>
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowTargetDatePicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Chọn ngày hoàn thành"
                >
                  <CalendarDays size={18} color={screenAccent} />
                  <Text
                    style={
                      targetDate ? styles.dateText : styles.datePlaceholder
                    }
                  >
                    {targetDate
                      ? formatShortDate(targetDate)
                      : 'Chọn ngày (không bắt buộc)'}
                  </Text>
                </TouchableOpacity>
                {targetDate ? (
                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={() => setTargetDate('')}
                  >
                    <Text style={styles.clearDateText}>Bỏ ngày</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {showTargetDatePicker ? (
                <DateTimePicker
                  value={
                    targetDate ? new Date(`${targetDate}T00:00:00`) : new Date()
                  }
                  mode="date"
                  minimumDate={new Date()}
                  onChange={handleTargetDateChange}
                />
              ) : null}
              <Text style={styles.label}>Ghi chú</Text>
              <TextInput
                style={[styles.input, styles.noteInput]}
                value={goalNote}
                onChangeText={setGoalNote}
                multiline
                placeholder="Mục đích và ưu tiên của bạn"
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setGoalModalVisible(false)}
                >
                  <Text style={styles.cancelText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.buttonDisabled]}
                  disabled={saving}
                  onPress={saveGoal}
                >
                  {saving ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <Text style={styles.saveText}>Lưu mục tiêu</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        transparent
        visible={Boolean(entryGoal)}
        animationType="slide"
        onRequestClose={() => setEntryGoal(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.modalDismiss}
            onPress={() => setEntryGoal(null)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {entryMode === 'CONTRIBUTION'
                ? 'Đóng góp tiết kiệm'
                : 'Rút khỏi mục tiêu'}
            </Text>
            <Text style={styles.modalSubtitle}>{entryGoal?.name}</Text>
            <Text style={styles.label}>
              {entryMode === 'CONTRIBUTION'
                ? 'Lấy tiền từ ví'
                : 'Chuyển tiền về ví'}
            </Text>
            {walletSelector(entryWallets, entryWalletId, setEntryWalletId)}
            {entryGoal && selectedEntryWallet ? (
              <View style={styles.transferRoute}>
                <Text style={styles.transferRouteText} numberOfLines={1}>
                  {entryMode === 'CONTRIBUTION'
                    ? selectedEntryWallet.name
                    : entryGoal.wallet_name}
                </Text>
                <ArrowRight size={15} color="#9C7255" />
                <Text style={styles.transferRouteText} numberOfLines={1}>
                  {entryMode === 'CONTRIBUTION'
                    ? entryGoal.wallet_name
                    : selectedEntryWallet.name}
                </Text>
              </View>
            ) : null}
            <Text style={styles.label}>Số tiền</Text>
            <TextInput
              style={styles.input}
              value={entryAmount}
              onChangeText={setEntryAmount}
              keyboardType="decimal-pad"
              placeholder="500.000"
            />
            <Text style={styles.label}>Ghi chú</Text>
            <TextInput
              style={styles.input}
              value={entryNote}
              onChangeText={setEntryNote}
              placeholder="Không bắt buộc"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEntryGoal(null)}
              >
                <Text style={styles.cancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.buttonDisabled]}
                disabled={saving}
                onPress={saveEntry}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.saveText}>Xác nhận</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  affordabilityLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  affordabilityText: { color: '#A95514', fontWeight: '600', fontSize: 13 },
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAdd: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: screenAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  title: { color: '#20262D', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#667085', fontSize: 12, fontWeight: '700', marginTop: 3 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#667085', fontWeight: '700' },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  errorTitle: {
    color: '#20262D',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
  },
  errorText: {
    color: '#667085',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 7,
  },
  retryButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: screenAccent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
    marginTop: 18,
  },
  retryText: { color: Colors.white, fontWeight: '700' },
  content: { padding: 18, paddingBottom: 40, gap: 16 },
  inlineError: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#FFE9E5',
    borderWidth: 1,
    borderColor: '#F2B8B0',
  },
  inlineErrorText: { flex: 1, color: '#8D2B23', fontWeight: '600' },
  summaryCard: {
    minHeight: 132,
    borderRadius: 12,
    padding: 18,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  summaryIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: '#F5EEE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCopy: { flex: 1 },
  summaryLabel: { color: '#667085', fontWeight: '700', fontSize: 12 },
  summaryValue: {
    color: '#20262D',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 5,
  },
  summaryMeta: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  summaryBadge: {
    backgroundColor: '#FFF3E6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  summaryBadgeText: { color: '#A94700', fontSize: 11, fontWeight: '700' },
  goalTabs: {
    flexDirection: 'row',
    borderRadius: 17,
    backgroundColor: '#F7E4D2',
    padding: 4,
    gap: 4,
  },
  goalTab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  goalTabActive: { backgroundColor: Colors.white },
  goalTabText: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  goalTabTextActive: { color: screenAccent },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 28,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTitle: {
    color: '#20262D',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 13,
  },
  emptyText: {
    color: '#667085',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  filteredEmptyCard: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E5BD9B',
    backgroundColor: '#FFF9F3',
    padding: 24,
  },
  filteredEmptyTitle: {
    color: '#20262D',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
  },
  filteredEmptyText: {
    color: '#667085',
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: screenAccent,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 13,
    marginTop: 18,
  },
  primaryButtonText: { color: '#FFF', fontWeight: '700' },
  goalCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goalIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalIconDone: { backgroundColor: '#E8F6EF' },
  goalCopy: { flex: 1 },
  goalName: { color: '#20262D', fontSize: 17, fontWeight: '700' },
  goalMeta: { color: '#9A765B', fontSize: 12, marginTop: 3 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#FFF6EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    marginTop: 16,
  },
  savedAmount: { color: screenAccent, fontSize: 20, fontWeight: '700' },
  targetAmount: { color: '#9A765B', fontWeight: '600', marginLeft: 5 },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#FFE4CE',
    overflow: 'hidden',
    marginTop: 9,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: screenAccent,
  },
  goalInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: '#FFF5EA',
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  infoText: { color: '#805337', fontSize: 11, fontWeight: '600' },
  completedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: '#E8F6EF',
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  completedPillText: { color: '#218358', fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 9, marginTop: 14 },
  contributeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 15,
    backgroundColor: screenAccent,
    paddingVertical: 12,
  },
  contributeText: { color: '#FFF', fontWeight: '700' },
  withdrawButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 15,
    backgroundColor: '#F5F6F8',
    borderWidth: 1,
    borderColor: '#E9B98F',
    paddingVertical: 12,
  },
  withdrawText: { color: screenAccent, fontWeight: '700' },
  disabledButton: { opacity: 0.5 },
  entryList: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3E0D0',
  },
  entryTitle: {
    color: '#6E4931',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  entryLabel: { color: '#667085', fontSize: 12, fontWeight: '700' },
  entryAmount: { color: '#218358', fontSize: 12, fontWeight: '700' },
  entryAmountOut: { color: '#B84A3A' },
  completionBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(45,25,12,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  completionCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    backgroundColor: '#FFF9F3',
    padding: 24,
    alignItems: 'center',
  },
  completionIcon: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#E8F6EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionTitle: {
    color: '#20262D',
    fontSize: 23,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
  },
  completionName: {
    color: '#74472E',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 7,
  },
  completionAmount: {
    color: screenAccent,
    fontSize: 25,
    fontWeight: '700',
    marginTop: 6,
  },
  completionText: {
    color: '#667085',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 18,
  },
  completionPrimaryButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: screenAccent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completionPrimaryText: { color: Colors.white, fontWeight: '700' },
  completionSecondaryButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9B98F',
    backgroundColor: '#F5F6F8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  completionSecondaryText: { color: screenAccent, fontWeight: '700' },
  completionKeepButton: { paddingHorizontal: 16, paddingTop: 17 },
  completionKeepText: { color: '#805337', fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(45,25,12,0.38)',
    justifyContent: 'flex-end',
  },
  modalDismiss: { flex: 1 },
  modalCard: {
    maxHeight: '88%',
    backgroundColor: '#FFF9F3',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 30,
  },
  modalTitle: { color: '#20262D', fontSize: 21, fontWeight: '700' },
  modalSubtitle: { color: '#667085', fontWeight: '700', marginTop: 5 },
  label: {
    color: '#74472E',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 15,
    marginBottom: 7,
  },
  input: {
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E5BD9B',
    backgroundColor: '#FFF',
    paddingHorizontal: 13,
    color: '#20262D',
    fontWeight: '600',
  },
  noteInput: { minHeight: 78, paddingTop: 13, textAlignVertical: 'top' },
  sourceHint: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: -2,
    marginBottom: 8,
  },
  missingSourceButton: {
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E5BD9B',
    backgroundColor: '#FFF6EF',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  missingSourceText: { color: screenAccent, fontSize: 12, fontWeight: '700' },
  walletCardRow: { gap: 10, paddingRight: 10 },
  walletPickerCard: {
    width: 138,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F2D9C0',
    backgroundColor: '#FFF6EF',
    padding: 12,
  },
  walletPickerCardActive: {
    borderColor: screenAccent,
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
  walletPickerIconActive: { backgroundColor: screenAccent },
  walletPickerName: { color: '#20262D', fontWeight: '700' },
  walletPickerBalance: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
  },
  dateRow: { gap: 8 },
  dateButton: {
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E5BD9B',
    backgroundColor: Colors.white,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  dateText: { color: '#20262D', fontWeight: '600' },
  datePlaceholder: { color: '#9A765B', fontWeight: '700' },
  clearDateButton: { alignSelf: 'flex-start', paddingVertical: 4 },
  clearDateText: { color: '#B84A3A', fontSize: 12, fontWeight: '600' },
  transferRoute: {
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  transferRouteText: {
    color: '#6F4B32',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelButton: {
    flex: 1,
    borderRadius: 15,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelText: { color: '#805337', fontWeight: '700' },
  saveButton: {
    flex: 1,
    borderRadius: 15,
    backgroundColor: screenAccent,
    alignItems: 'center',
    paddingVertical: 14,
  },
  buttonDisabled: { opacity: 0.55 },
  saveText: { color: '#FFF', fontWeight: '700' },
});

export default SavingsGoalsScreen;
