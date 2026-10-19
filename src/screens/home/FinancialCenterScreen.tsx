import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  HeartPulse,
  Inbox,
  Search,
  ShieldCheck,
  TrendingUp,
  Plus,
  Trash2,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { bankNotificationReader } from '../../native/bankNotificationReader';
import {
  dashboardCache,
  type DashboardCache,
} from '../../services/dashboardCache';
import { offlineTransactionQueue } from '../../services/offlineTransactionQueue';
import { financialCaptureInbox } from '../../services/financialCaptureInbox';
import {
  financialPlanningService,
  type ManualMoneyPlan,
  type RecurringDecision,
  type RecurringDecisionStatus,
} from '../../services/financialPlanning';
import { formatCurrency, formatShortDate } from '../../utils/format';
import {
  buildUpcomingMoneyCalendar,
  buildProjectedCashFlow,
  buildRecurringDueReminders,
  calculateEmergencyFund,
  calculateEmergencyIncomeShock,
  calculateIrregularIncome,
  calculateSafeToSpendToday,
  detectRecurringMoney,
  findDataQualityIssues,
} from '../../utils/financialInsights';
import {
  parseNaturalTransactionSearch,
  type NaturalTransactionFilters,
} from '../../utils/naturalTransactionSearch';
import { mapApiTransactions } from '../../utils/mapTransactions';
import type { DataQualityIssue } from '../../utils/financialInsights';

type Props = NativeStackScreenProps<RootStackParamList, 'FinancialCenter'>;

const issueLabels = {
  DUPLICATE: 'Nghi trùng',
  UNCATEGORIZED: 'Thiếu danh mục',
  RECEIPT_MISMATCH: 'Lệch tổng hóa đơn',
  MISSING_RATE: 'Thiếu tỷ giá',
};

const FinancialCenterScreen = ({ navigation, route }: Props) => {
  const { user } = useAuth();
  const [cache, setCache] = useState<DashboardCache | null>(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [bankCount, setBankCount] = useState(0);
  const [captureCount, setCaptureCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [naturalQuery, setNaturalQuery] = useState('');
  const [naturalFilters, setNaturalFilters] =
    useState<NaturalTransactionFilters | null>(null);
  const [recurringDecisions, setRecurringDecisions] = useState<
    RecurringDecision[]
  >([]);
  const [manualPlans, setManualPlans] = useState<ManualMoneyPlan[]>([]);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planLabel, setPlanLabel] = useState('');
  const [planAmount, setPlanAmount] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [planType, setPlanType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [incomeHistoryMonths, setIncomeHistoryMonths] = useState(6);
  const [incomeReductionPercent, setIncomeReductionPercent] = useState(0);
  const [safeReserveMonths, setSafeReserveMonths] = useState(1);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!user?.id) {
        setLoading(false);
        return undefined;
      }
      setLoading(true);
      Promise.all([
        dashboardCache.read(user.id),
        offlineTransactionQueue.list(user.id),
        bankNotificationReader.isSupported
          ? bankNotificationReader.getPendingEvents(user.id).catch(() => [])
          : Promise.resolve([]),
        financialPlanningService.listRecurringDecisions(user.id),
        financialPlanningService.listManualPlans(user.id),
        financialCaptureInbox.list(user.id),
      ])
        .then(([nextCache, drafts, events, decisions, plans, captures]) => {
          if (!active) return;
          setCache(nextCache);
          setOfflineCount(drafts.length);
          setBankCount(events.length);
          setCaptureCount(captures.length);
          setRecurringDecisions(decisions);
          setManualPlans(plans);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [user?.id]),
  );

  const wallets = useMemo(
    () => cache?.wallets ?? route.params?.wallets ?? [],
    [cache?.wallets, route.params?.wallets],
  );
  const transactions = useMemo(
    () => cache?.transactions ?? [],
    [cache?.transactions],
  );
  const budgets = useMemo(() => cache?.budgets ?? [], [cache?.budgets]);
  const savingsGoals = useMemo(
    () => cache?.savingsGoals ?? [],
    [cache?.savingsGoals],
  );
  const currency = user?.currency_default ?? 'VND';
  const recurringDecisionMap = useMemo(
    () =>
      new Map(recurringDecisions.map(item => [item.patternKey, item.status])),
    [recurringDecisions],
  );
  const confirmedPatternKeys = useMemo(
    () =>
      new Set(
        recurringDecisions
          .filter(item => item.status === 'CONFIRMED')
          .map(item => item.patternKey),
      ),
    [recurringDecisions],
  );
  const safeSpend = useMemo(
    () =>
      calculateSafeToSpendToday(wallets, budgets, transactions, new Date(), {
        confirmedPatternKeys,
        manualPlans,
        savingsGoals,
        emergencyReserveMonths: safeReserveMonths,
        currency,
      }),
    [
      budgets,
      confirmedPatternKeys,
      currency,
      manualPlans,
      safeReserveMonths,
      savingsGoals,
      transactions,
      wallets,
    ],
  );
  const emergency = useMemo(
    () => calculateEmergencyFund(wallets, transactions),
    [transactions, wallets],
  );
  const irregularIncome = useMemo(
    () =>
      calculateIrregularIncome(transactions, new Date(), incomeHistoryMonths),
    [incomeHistoryMonths, transactions],
  );
  const emergencyShock = useMemo(
    () =>
      calculateEmergencyIncomeShock(
        wallets,
        transactions,
        incomeReductionPercent,
        new Date(),
        incomeHistoryMonths,
      ),
    [incomeHistoryMonths, incomeReductionPercent, transactions, wallets],
  );
  const recurring = useMemo(
    () => detectRecurringMoney(transactions),
    [transactions],
  );
  const upcoming = useMemo(
    () =>
      buildUpcomingMoneyCalendar(
        transactions,
        new Date(),
        60,
        confirmedPatternKeys,
      ),
    [confirmedPatternKeys, transactions],
  );
  const dueReminders = useMemo(
    () =>
      buildRecurringDueReminders(
        transactions,
        confirmedPatternKeys,
        new Date(),
        7,
      ),
    [confirmedPatternKeys, transactions],
  );
  const recurringProposals = useMemo(
    () => recurring.filter(item => !recurringDecisionMap.has(item.key)),
    [recurring, recurringDecisionMap],
  );
  const upcomingManualPlans = useMemo(() => {
    const now = Date.now() - 86_400_000;
    const end = Date.now() + 60 * 86_400_000;
    return manualPlans
      .filter(plan => {
        const time = new Date(`${plan.date}T00:00:00.000Z`).getTime();
        return time >= now && time <= end;
      })
      .sort((left, right) => left.date.localeCompare(right.date));
  }, [manualPlans]);
  const cashFlowProjection = useMemo(
    () =>
      buildProjectedCashFlow(
        wallets,
        upcoming,
        upcomingManualPlans.filter(
          item => item.currency.toUpperCase() === currency.toUpperCase(),
        ),
      ),
    [currency, upcoming, upcomingManualPlans, wallets],
  );
  const issues = useMemo(
    () => findDataQualityIssues(transactions, currency),
    [currency, transactions],
  );

  const parseNaturalQuery = () => {
    setNaturalFilters(
      parseNaturalTransactionSearch(naturalQuery, {
        wallets,
        categories: cache?.categories ?? [],
      }),
    );
  };

  const openNaturalSearch = () => {
    if (!naturalFilters) return;
    navigation.navigate('TransactionSearch', {
      wallets,
      initialDateMode:
        naturalFilters.from || naturalFilters.to ? 'range' : undefined,
      initialFromDate: naturalFilters.from,
      initialToDate: naturalFilters.to,
      initialQuery: naturalFilters.q,
      initialType: naturalFilters.type,
      initialWalletId: naturalFilters.walletId,
      initialCategoryId: naturalFilters.categoryId,
      initialMinAmount: naturalFilters.minAmount,
      initialMaxAmount: naturalFilters.maxAmount,
    });
  };

  const openDataQualityIssue = (issue: DataQualityIssue) => {
    const related = mapApiTransactions(
      transactions.filter(item => issue.transactionIds.includes(item.id)),
      wallets,
    );
    if (!related.length) {
      Alert.alert(
        'Chưa mở được giao dịch',
        'Dữ liệu gần nhất đã thay đổi. Hãy quay lại Tổng quan và làm mới.',
      );
      return;
    }
    if (issue.type === 'DUPLICATE') {
      Alert.alert(
        'So sánh giao dịch nghi trùng',
        related
          .map(
            item =>
              `#${item.id} · ${formatShortDate(item.date)} · ${formatCurrency(
                item.amount,
                item.currency,
              )} · ${item.note}`,
          )
          .join('\n'),
        [
          { text: 'Đóng', style: 'cancel' },
          ...related.slice(0, 2).map(item => ({
            text: `Sửa #${item.id}`,
            onPress: () =>
              navigation.navigate('Main', { editTransaction: item }),
          })),
        ],
      );
      return;
    }
    navigation.navigate('Main', { editTransaction: related[0] });
  };

  const setRecurringDecision = async (
    patternKey: string,
    status: RecurringDecisionStatus,
  ) => {
    if (!user?.id) return;
    await financialPlanningService.setRecurringDecision(
      user.id,
      patternKey,
      status,
    );
    setRecurringDecisions(
      await financialPlanningService.listRecurringDecisions(user.id),
    );
  };

  const addManualPlan = async () => {
    if (!user?.id) return;
    const amount = Number(planAmount.replace(/[^\d]/g, ''));
    try {
      await financialPlanningService.addManualPlan(user.id, {
        label: planLabel,
        type: planType,
        amount,
        currency,
        date: planDate,
      });
      setManualPlans(await financialPlanningService.listManualPlans(user.id));
      setPlanLabel('');
      setPlanAmount('');
      setPlanDate('');
      setShowPlanForm(false);
    } catch (error) {
      Alert.alert(
        'Chưa thêm được khoản dự kiến',
        error instanceof Error ? error.message : 'Vui lòng kiểm tra dữ liệu.',
      );
    }
  };

  const removeManualPlan = (plan: ManualMoneyPlan) => {
    if (!user?.id) return;
    Alert.alert(
      'Bỏ khoản dự kiến?',
      'Thao tác này chỉ xóa khỏi lịch dự kiến, không xóa giao dịch thật.',
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Bỏ khỏi lịch',
          style: 'destructive',
          onPress: () => {
            financialPlanningService
              .removeManualPlan(user.id, plan.id)
              .then(() => financialPlanningService.listManualPlans(user.id))
              .then(setManualPlans)
              .catch(() => undefined);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>
        <Text style={styles.title}>Trung tâm tài chính</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.muted}>
              Đang đọc dữ liệu gần nhất trên máy…
            </Text>
          </View>
        ) : !cache ? (
          <View style={styles.warningCard}>
            <AlertTriangle size={21} color="#9A5A00" />
            <Text style={styles.warningText}>
              Chưa có dữ liệu gần nhất. Quay lại Tổng quan và làm mới một lần.
            </Text>
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <HeartPulse size={23} color={Colors.white} />
          </View>
          <Text style={styles.heroLabel}>Có thể chi hôm nay</Text>
          <Text style={styles.heroValue}>
            {formatCurrency(safeSpend.amount, currency)}
          </Text>
          <Text style={styles.heroText}>
            {safeSpend.source === 'BUDGET'
              ? 'Ngân sách còn lại'
              : 'Số dư dương'}{' '}
            {formatCurrency(safeSpend.sourceAmount, currency)} − khoản định kỳ{' '}
            {formatCurrency(safeSpend.upcomingExpenses, currency)} − lịch nhập
            tay {formatCurrency(safeSpend.manualExpenses, currency)} − mục tiêu{' '}
            {formatCurrency(safeSpend.goalCommitment, currency)} − quỹ an toàn{' '}
            {formatCurrency(safeSpend.emergencyReserve, currency)}, chia{' '}
            {safeSpend.daysRemaining} ngày còn lại.
          </Text>
          {safeSpend.shortfall > 0 ? (
            <Text style={styles.heroWarning}>
              Các khoản cần giữ đang cao hơn nguồn có thể dùng{' '}
              {formatCurrency(safeSpend.shortfall, currency)} nên kết quả được
              chặn ở 0đ.
            </Text>
          ) : null}
          {safeSpend.missingInputs.map(message => (
            <Text key={message} style={styles.heroWarning}>
              {message}
            </Text>
          ))}
          <Text style={styles.heroOptionLabel}>Mức quỹ an toàn muốn giữ</Text>
          <View style={styles.heroOptionRow}>
            {[0, 1, 3].map(months => (
              <TouchableOpacity
                key={months}
                style={[
                  styles.heroOption,
                  safeReserveMonths === months && styles.heroOptionActive,
                ]}
                onPress={() => setSafeReserveMonths(months)}
              >
                <Text style={styles.heroOptionText}>
                  {months === 0 ? 'Không giữ' : `${months} tháng`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <TrendingUp size={20} color="#6C63A8" />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Thu nhập không đều</Text>
              <Text style={styles.sectionMeta}>
                Chọn khoảng lịch sử dùng để tính mức chi thận trọng
              </Text>
            </View>
          </View>
          <View style={styles.optionRow}>
            {[3, 6, 12].map(months => (
              <TouchableOpacity
                key={months}
                style={[
                  styles.optionButton,
                  incomeHistoryMonths === months && styles.optionButtonActive,
                ]}
                onPress={() => setIncomeHistoryMonths(months)}
              >
                <Text
                  style={[
                    styles.optionText,
                    incomeHistoryMonths === months && styles.optionTextActive,
                  ]}
                >
                  {months} tháng
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.metricGrid}>
            <MetricValue
              label="Mức thu thận trọng"
              value={formatCurrency(
                irregularIncome.conservativeIncome,
                currency,
              )}
            />
            <MetricValue
              label="Chi cơ bản đề xuất"
              value={formatCurrency(
                irregularIncome.recommendedMonthlySpend,
                currency,
              )}
            />
          </View>
          <Text style={styles.helperText}>
            Có thu nhập ở {irregularIncome.dataMonths}/{incomeHistoryMonths}{' '}
            tháng · trung vị thu{' '}
            {formatCurrency(irregularIncome.medianIncome, currency)} · trung vị
            chi {formatCurrency(irregularIncome.medianExpense, currency)}.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <ShieldCheck size={20} color="#2F7D6B" />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Quỹ khẩn cấp</Text>
              <Text style={styles.sectionMeta}>
                Mô phỏng khi thu nhập giảm, không thay đổi dữ liệu thật
              </Text>
            </View>
          </View>
          <View style={styles.optionRow}>
            {[0, 25, 50, 100].map(percent => (
              <TouchableOpacity
                key={percent}
                style={[
                  styles.optionButton,
                  incomeReductionPercent === percent &&
                    styles.optionButtonActive,
                ]}
                onPress={() => setIncomeReductionPercent(percent)}
              >
                <Text
                  style={[
                    styles.optionText,
                    incomeReductionPercent === percent &&
                      styles.optionTextActive,
                  ]}
                >
                  {percent === 0 ? 'Hiện tại' : `Giảm ${percent}%`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.metricValue}>
            {incomeReductionPercent === 0
              ? `${emergency.monthsCovered.toFixed(1)} tháng chi thiết yếu`
              : emergencyShock.monthsCovered === null
              ? 'Không phát sinh thiếu hụt hàng tháng'
              : `${emergencyShock.monthsCovered.toFixed(1)} tháng bù thiếu hụt`}
          </Text>
          <Text style={styles.metricMeta}>
            Tiền sẵn có {formatCurrency(emergency.liquidBalance, currency)} ·
            chi thiết yếu{' '}
            {formatCurrency(emergency.essentialMonthlyExpense, currency)}
            /tháng · thu sau mô phỏng{' '}
            {formatCurrency(emergencyShock.incomeAfterReduction, currency)}.
          </Text>
          <Text style={styles.helperText}>
            {incomeReductionPercent === 0
              ? emergency.essentialMonthlyExpense <= 0
                ? 'Chưa đủ lịch sử chi để đánh giá quỹ khẩn cấp.'
                : emergency.gap > 0
                ? `Còn thiếu ${formatCurrency(emergency.gap, currency)} để đủ ${
                    emergency.targetMonths
                  } tháng chi thiết yếu.`
                : `Đã đạt mốc ${emergency.targetMonths} tháng chi thiết yếu.`
              : emergencyShock.monthlyShortfall > 0
              ? `Thiếu ${formatCurrency(
                  emergencyShock.monthlyShortfall,
                  currency,
                )} mỗi tháng sau cú sốc thu nhập.`
              : 'Thu nhập thận trọng sau mô phỏng vẫn đủ bù mức chi thiết yếu.'}
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Inbox size={20} color={Colors.primary} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Hộp thư tài chính</Text>
              <Text style={styles.sectionMeta}>
                {captureCount + offlineCount + bankCount} mục chờ từ hóa đơn,
                giọng nói, Excel, ngoại tuyến và ngân hàng
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.primaryInboxButton}
            onPress={() => navigation.navigate('FinancialInbox')}
          >
            <Inbox size={18} color={Colors.white} />
            <Text style={styles.primaryInboxButtonText}>
              Mở danh sách duyệt chung
            </Text>
          </TouchableOpacity>
          <Text style={styles.helperText}>
            Bản nháp chưa duyệt không làm thay đổi số dư. Bước ghép hóa đơn sẽ
            dựa trên tiền, thời gian và người bán.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <CalendarDays size={20} color={Colors.primary} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Lịch tiền sắp tới</Text>
              <Text style={styles.sectionMeta}>
                {upcoming.length + upcomingManualPlans.length} khoản đã xác nhận
                trong 60 ngày
              </Text>
            </View>
          </View>
          {dueReminders.length > 0 ? (
            <View style={styles.reminderBox}>
              <Text style={styles.filterTitle}>Nhắc trước kỳ tới</Text>
              {dueReminders.map(item => (
                <View key={`reminder-${item.key}`} style={styles.reminderRow}>
                  <View style={styles.sectionCopy}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text style={styles.listMeta}>
                      {item.dueStatus === 'OVERDUE'
                        ? `Đã qua ${Math.abs(item.daysUntil)} ngày`
                        : item.dueStatus === 'TODAY'
                        ? 'Dự kiến hôm nay'
                        : `Còn ${item.daysUntil} ngày`}{' '}
                      · {item.occurrences} kỳ đã nhận diện ·{' '}
                      {formatCurrency(item.averageAmount, currency)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Bỏ theo dõi ${item.label}`}
                    style={styles.rejectButton}
                    onPress={() => setRecurringDecision(item.key, 'IGNORED')}
                  >
                    <Text style={styles.rejectButtonText}>Bỏ theo dõi</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <Text style={styles.helperText}>
                Đây chỉ là lời nhắc từ lịch sử. Ứng dụng không tự tạo giao dịch
                hoặc trừ tiền.
              </Text>
            </View>
          ) : null}
          {upcoming.slice(0, 4).map(item => (
            <View key={item.key} style={styles.listRow}>
              <View style={styles.sectionCopy}>
                <Text style={styles.listTitle} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.listMeta}>
                  Dự kiến {formatShortDate(item.nextDate)} · lặp khoảng{' '}
                  {item.intervalDays} ngày
                </Text>
              </View>
              <Text
                style={
                  item.type === 'INCOME'
                    ? styles.incomeAmount
                    : styles.expenseAmount
                }
              >
                {item.type === 'INCOME' ? '+' : '-'}
                {formatCurrency(item.averageAmount, currency)}
              </Text>
            </View>
          ))}
          {upcomingManualPlans.slice(0, 4).map(item => (
            <View key={item.id} style={styles.listRow}>
              <View style={styles.sectionCopy}>
                <Text style={styles.listTitle} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.listMeta}>
                  Nhập tay · dự kiến {formatShortDate(item.date)}
                </Text>
              </View>
              <Text
                style={
                  item.type === 'INCOME'
                    ? styles.incomeAmount
                    : styles.expenseAmount
                }
              >
                {item.type === 'INCOME' ? '+' : '-'}
                {formatCurrency(item.amount, item.currency)}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Bỏ ${item.label} khỏi lịch`}
                style={styles.iconButton}
                onPress={() => removeManualPlan(item)}
              >
                <Trash2 size={16} color="#C9483D" />
              </TouchableOpacity>
            </View>
          ))}
          {upcoming.length === 0 && upcomingManualPlans.length === 0 ? (
            <Text style={styles.emptyText}>
              Chưa có khoản dự kiến đã xác nhận trong 60 ngày tới.
            </Text>
          ) : null}
          {cashFlowProjection.days.length > 0 ? (
            <View style={styles.projectionBox}>
              <Text style={styles.filterTitle}>Số dư dự kiến theo ngày</Text>
              <Text style={styles.helperText}>
                Bắt đầu từ{' '}
                {formatCurrency(cashFlowProjection.openingBalance, currency)}.
              </Text>
              {cashFlowProjection.days.slice(0, 6).map(day => (
                <View key={day.date} style={styles.projectionRow}>
                  <View style={styles.sectionCopy}>
                    <Text style={styles.listTitle}>
                      {formatShortDate(day.date)}
                    </Text>
                    <Text style={styles.listMeta} numberOfLines={1}>
                      {day.labels.join(' · ')}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.projectionChange}>
                      +{formatCurrency(day.income, currency)} · -
                      {formatCurrency(day.expense, currency)}
                    </Text>
                    <Text
                      style={
                        day.projectedBalance < 0
                          ? styles.riskBalance
                          : styles.projectedBalance
                      }
                    >
                      Còn {formatCurrency(day.projectedBalance, currency)}
                    </Text>
                  </View>
                </View>
              ))}
              {cashFlowProjection.firstRiskDate ? (
                <View style={styles.riskNotice}>
                  <AlertTriangle size={17} color="#A34819" />
                  <Text style={styles.riskNoticeText}>
                    Có nguy cơ thiếu tiền từ{' '}
                    {formatShortDate(cashFlowProjection.firstRiskDate)}; mức
                    thấp nhất{' '}
                    {formatCurrency(cashFlowProjection.lowestBalance, currency)}
                    .
                  </Text>
                </View>
              ) : (
                <Text style={styles.safeProjectionText}>
                  Chưa thấy ngày âm tiền trong các khoản đã xác nhận.
                </Text>
              )}
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.addPlanButton}
            onPress={() => setShowPlanForm(current => !current)}
          >
            <Plus size={17} color={Colors.primary} />
            <Text style={styles.secondaryButtonText}>Thêm khoản dự kiến</Text>
          </TouchableOpacity>
          {showPlanForm ? (
            <View style={styles.planForm}>
              <View style={styles.typeRow}>
                {(['EXPENSE', 'INCOME'] as const).map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      planType === type && styles.typeButtonActive,
                    ]}
                    onPress={() => setPlanType(type)}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        planType === type && styles.typeButtonTextActive,
                      ]}
                    >
                      {type === 'EXPENSE' ? 'Tiền ra' : 'Tiền vào'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.planInput}
                value={planLabel}
                onChangeText={setPlanLabel}
                placeholder="Tên khoản, ví dụ: Tiền nhà"
                placeholderTextColor="#A26B48"
              />
              <TextInput
                style={styles.planInput}
                value={planAmount}
                onChangeText={setPlanAmount}
                keyboardType="numeric"
                placeholder="Số tiền"
                placeholderTextColor="#A26B48"
              />
              <TextInput
                style={styles.planInput}
                value={planDate}
                onChangeText={setPlanDate}
                placeholder="Ngày YYYY-MM-DD"
                placeholderTextColor="#A26B48"
              />
              <TouchableOpacity
                style={styles.confirmPlanButton}
                onPress={addManualPlan}
              >
                <Text style={styles.openButtonText}>Lưu vào lịch dự kiến</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {recurringProposals.length > 0 ? (
            <View style={styles.proposalBox}>
              <Text style={styles.filterTitle}>Đề xuất khoản định kỳ</Text>
              {recurringProposals.slice(0, 4).map(item => (
                <View key={item.key} style={styles.proposalRow}>
                  <View style={styles.sectionCopy}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text style={styles.listMeta}>
                      {item.occurrences} lần · khoảng {item.intervalDays} ngày ·{' '}
                      {formatCurrency(item.averageAmount, currency)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() =>
                      setRecurringDecision(item.key, 'IGNORED').catch(
                        () => undefined,
                      )
                    }
                  >
                    <Text style={styles.rejectButtonText}>Bỏ qua</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() =>
                      setRecurringDecision(item.key, 'CONFIRMED').catch(
                        () => undefined,
                      )
                    }
                  >
                    <Text style={styles.acceptButtonText}>Xác nhận</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={styles.helperText}>
            Khoản định kỳ chỉ vào lịch sau khi xác nhận. Lịch dự kiến không tự
            tạo giao dịch và không đổi số dư.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <AlertTriangle size={20} color="#B85C16" />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Chất lượng dữ liệu</Text>
              <Text style={styles.sectionMeta}>
                {issues.length} mục cần xem
              </Text>
            </View>
          </View>
          {issues.slice(0, 4).map(issue => (
            <View key={issue.id} style={styles.qualityRow}>
              <View style={styles.sectionCopy}>
                <Text style={styles.listTitle}>{issueLabels[issue.type]}</Text>
                <Text style={styles.listMeta}>{issue.message}</Text>
                <Text style={styles.confidenceText}>
                  Độ tin cậy {Math.round(issue.confidence * 100)}% · liên quan{' '}
                  {issue.transactionIds.length} giao dịch
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`${issue.actionLabel}: ${issue.message}`}
                style={styles.qualityAction}
                onPress={() => openDataQualityIssue(issue)}
              >
                <Text style={styles.qualityActionText}>
                  {issue.actionLabel}
                </Text>
                <ChevronRight size={16} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          ))}
          {issues.length === 0 ? (
            <Text style={styles.emptyText}>
              Chưa phát hiện giao dịch trùng, thiếu danh mục hoặc lệch tổng hóa
              đơn trong dữ liệu gần nhất.
            </Text>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Search size={20} color={Colors.primary} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Tìm bằng câu tự nhiên</Text>
              <Text style={styles.sectionMeta}>
                Xử lý trên máy và cho xem bộ lọc trước khi mở kết quả
              </Text>
            </View>
          </View>
          <TextInput
            style={styles.searchInput}
            value={naturalQuery}
            onChangeText={value => {
              setNaturalQuery(value);
              setNaturalFilters(null);
            }}
            placeholder="Ví dụ: ăn uống tháng trước trên 200 nghìn"
            placeholderTextColor="#A26B48"
            multiline
          />
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={parseNaturalQuery}
            disabled={!naturalQuery.trim()}
          >
            <Text style={styles.primaryButtonText}>Hiểu câu tìm kiếm</Text>
          </TouchableOpacity>
          {naturalFilters ? (
            <View style={styles.filterPreview}>
              <Text style={styles.filterTitle}>Bộ lọc đã hiểu</Text>
              {naturalFilters.understood.map(item => (
                <Text key={item} style={styles.filterLine}>
                  • {item}
                </Text>
              ))}
              {naturalFilters.q ? (
                <Text style={styles.filterLine}>
                  • Từ khóa: {naturalFilters.q}
                </Text>
              ) : null}
              <TouchableOpacity
                style={styles.openButton}
                onPress={openNaturalSearch}
              >
                <Text style={styles.openButtonText}>
                  Mở kết quả và chỉnh bộ lọc
                </Text>
                <ChevronRight size={18} color={Colors.white} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Cách hiểu các con số</Text>
          <Text style={styles.noteText}>
            Quỹ khẩn cấp tạm dùng toàn bộ chi tiêu ba tháng gần nhất làm mức
            thiết yếu. Thu nhập không đều dùng trung vị và tứ phân vị thấp để
            tránh một tháng thu cao làm mức chi đề xuất tăng quá mức.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const MetricValue = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metricBlock}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF9F4' },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1D8C1',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#4A2B1A', fontSize: 19, fontWeight: '900' },
  content: { padding: 16, gap: 12, paddingBottom: 44 },
  loadingCard: {
    minHeight: 76,
    borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  muted: { color: '#8B6B55', fontSize: 12, fontWeight: '700' },
  warningCard: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 18,
    backgroundColor: '#FFF3D8',
    padding: 14,
  },
  warningText: { flex: 1, color: '#7A4B00', fontWeight: '700', lineHeight: 19 },
  heroCard: { borderRadius: 24, backgroundColor: '#5A321F', padding: 18 },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#81503A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: { color: '#FFDAB8', fontWeight: '800', marginTop: 16 },
  heroValue: {
    color: '#FF9D32',
    fontSize: 30,
    fontWeight: '900',
    marginTop: 4,
  },
  heroText: { color: '#FFE9D5', lineHeight: 20, marginTop: 8, fontSize: 12 },
  heroWarning: {
    color: '#FFD08C',
    lineHeight: 18,
    marginTop: 7,
    fontSize: 11,
    fontWeight: '800',
  },
  heroOptionLabel: {
    color: '#FFDAB8',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 12,
  },
  heroOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 7,
  },
  heroOption: {
    minHeight: 34,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#A97961',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  heroOptionActive: { backgroundColor: '#E8751A', borderColor: '#FF9D32' },
  heroOptionText: { color: Colors.white, fontSize: 11, fontWeight: '900' },
  metricLabel: {
    color: '#7A5438',
    fontWeight: '800',
    fontSize: 12,
    marginTop: 10,
  },
  metricValue: {
    color: '#4A2B1A',
    fontWeight: '900',
    fontSize: 18,
    marginTop: 4,
  },
  metricMeta: { color: '#8B6B55', fontSize: 11, lineHeight: 16, marginTop: 7 },
  metricGrid: { flexDirection: 'row', gap: 10 },
  metricBlock: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    backgroundColor: '#FFF8F0',
    padding: 12,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionButton: {
    minHeight: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8B680',
    backgroundColor: '#FFF9F4',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  optionButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  optionText: { color: '#8B6B55', fontSize: 11, fontWeight: '900' },
  optionTextActive: { color: Colors.white },
  sectionCard: {
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#F0C49B',
    padding: 14,
    gap: 10,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  sectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { color: '#4A2B1A', fontWeight: '900' },
  sectionMeta: { color: '#8B6B55', fontSize: 11, lineHeight: 16, marginTop: 3 },
  actionRow: { flexDirection: 'row', gap: 9 },
  secondaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  secondaryButtonText: { color: Colors.primary, fontWeight: '900' },
  primaryInboxButton: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  primaryInboxButtonText: { color: Colors.white, fontWeight: '900' },
  helperText: { color: '#8B6B55', fontSize: 11, lineHeight: 17 },
  listRow: {
    minHeight: 54,
    borderTopWidth: 1,
    borderTopColor: '#F5E3D3',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 9,
  },
  listTitle: { color: '#4A2B1A', fontWeight: '900' },
  listMeta: { color: '#8B6B55', fontSize: 11, lineHeight: 16, marginTop: 3 },
  qualityRow: {
    borderTopWidth: 1,
    borderTopColor: '#F5E3D3',
    paddingTop: 10,
    gap: 9,
  },
  confidenceText: {
    color: '#2F7D6B',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 5,
  },
  qualityAction: {
    alignSelf: 'flex-start',
    minHeight: 36,
    borderRadius: 12,
    backgroundColor: '#FFF0DF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
  },
  qualityActionText: { color: Colors.primary, fontSize: 11, fontWeight: '900' },
  incomeAmount: { color: '#188F5A', fontWeight: '900', textAlign: 'right' },
  expenseAmount: { color: '#D4621D', fontWeight: '900', textAlign: 'right' },
  emptyText: { color: '#8B6B55', fontSize: 12, lineHeight: 18 },
  searchInput: {
    minHeight: 74,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8B680',
    backgroundColor: '#FFF9F4',
    padding: 12,
    color: '#4A2B1A',
    fontWeight: '700',
    textAlignVertical: 'top',
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: Colors.primary, fontWeight: '900' },
  filterPreview: { borderRadius: 16, backgroundColor: '#F7F2FF', padding: 12 },
  filterTitle: { color: '#4A2B1A', fontWeight: '900', marginBottom: 5 },
  filterLine: { color: '#625B83', fontSize: 12, lineHeight: 19 },
  openButton: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 10,
  },
  openButtonText: { color: Colors.white, fontWeight: '900' },
  noteCard: { borderRadius: 18, backgroundColor: '#FFF3D8', padding: 14 },
  noteTitle: { color: '#7A4B00', fontWeight: '900' },
  noteText: { color: '#8B5700', fontSize: 12, lineHeight: 18, marginTop: 5 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#FFF0EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlanButton: {
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  planForm: {
    borderRadius: 16,
    backgroundColor: '#FFF8F0',
    padding: 12,
    gap: 9,
  },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8B680',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeButtonText: { color: '#8B6B55', fontWeight: '900', fontSize: 12 },
  typeButtonTextActive: { color: Colors.white },
  planInput: {
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E8B680',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    color: '#4A2B1A',
    fontWeight: '700',
  },
  confirmPlanButton: {
    minHeight: 43,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proposalBox: {
    borderRadius: 16,
    backgroundColor: '#F7F2FF',
    padding: 12,
    gap: 9,
  },
  proposalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: '#E7DFF7',
    paddingTop: 9,
  },
  rejectButton: { paddingHorizontal: 9, paddingVertical: 8 },
  rejectButtonText: { color: '#7B668B', fontWeight: '900', fontSize: 11 },
  acceptButton: {
    borderRadius: 11,
    backgroundColor: '#E7F5EE',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  acceptButtonText: { color: '#28745C', fontWeight: '900', fontSize: 11 },
  projectionBox: {
    borderRadius: 16,
    backgroundColor: '#F3FAF7',
    padding: 12,
    gap: 8,
  },
  reminderBox: {
    borderRadius: 16,
    backgroundColor: '#FFF3D8',
    padding: 12,
    gap: 9,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F2D7A3',
    paddingTop: 9,
  },
  projectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#DCEFE7',
    paddingTop: 8,
  },
  projectionChange: {
    color: '#71827A',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
  },
  projectedBalance: {
    color: '#28745C',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
    marginTop: 2,
  },
  riskBalance: {
    color: '#B54837',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
    marginTop: 2,
  },
  riskNotice: {
    borderRadius: 13,
    backgroundColor: '#FFF0E8',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  riskNoticeText: { flex: 1, color: '#8B451D', fontSize: 11, lineHeight: 16 },
  safeProjectionText: { color: '#28745C', fontSize: 11, fontWeight: '800' },
});

export default FinancialCenterScreen;
