import React, { useMemo, useState } from 'react';
import {
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Bell,
  ChartColumnBig,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Lightbulb,
  PiggyBank,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet as WalletIcon,
  WalletCards,
} from 'lucide-react-native';
import CategoryIcon from '../../components/CategoryIcon';
import { Colors } from '../../constants/Colors';
import { getWalletTypeMeta } from '../../constants/walletTypes';
import { useFinance } from '../../context/FinanceContext';
import type { TransactionItem } from '../../data/mockTransactions';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { Budget } from '../../types/budget';
import type { Wallet } from '../../types/wallet';
import { buildWalletBudgetAlerts } from '../../utils/budgetAlerts';
import { formatCurrency, formatDisplayDate } from '../../utils/format';
import {
  buildOverviewMonthExpenseTrendBuckets,
  estimateWalletBalanceAtDate,
  filterTransactionsByDateBounds,
  filterNormalTransactions,
  getOverviewMonthBounds,
  getPeriodBounds,
  getPreviousPeriodBounds,
  selectRecentOverviewTransactions,
  selectWalletsForPeriodPreview,
  sumNormalByType,
} from '../../utils/transactionPeriods';

type Props = {
  wallets: Wallet[];
  refreshing: boolean;
  onRefresh: () => void;
  onAddTransaction: () => void;
  notificationUnreadCount?: number;
};

type TopCategory = {
  name: string;
  total: number;
  icon?: string | null;
};

const MONTHS = Array.from({ length: 12 }, (_, index) => index);

const getTotalByType = (
  transactions: TransactionItem[],
  type: TransactionItem['type'],
) => sumNormalByType(transactions, type);

const formatChangePercent = (current: number, previous: number) => {
  if (previous <= 0) {
    return current > 0 ? '+100%' : '0%';
  }

  const value = Math.round(((current - previous) / previous) * 100);
  return `${value >= 0 ? '+' : ''}${value}%`;
};

const getWalletPeriodExpense = (
  walletId: number,
  transactions: TransactionItem[],
  bounds?: { start: Date; end: Date },
) =>
  transactions.reduce((total, item) => {
    const date = new Date(item.date);
    const isInPeriod = bounds
      ? date >= bounds.start && date <= bounds.end
      : true;

    return item.walletId === walletId &&
      item.type === 'expense' &&
      item.cashFlowType !== 'loan_debt' &&
      isInPeriod
      ? total + item.amount
      : total;
  }, 0);

const getCategoryPeriodExpense = (
  walletId: number,
  categoryId: number | null | undefined,
  transactions: TransactionItem[],
  bounds?: { start: Date; end: Date },
) =>
  transactions.reduce((total, item) => {
    const date = new Date(item.date);
    const isInPeriod = bounds
      ? date >= bounds.start && date <= bounds.end
      : true;

    return item.walletId === walletId &&
      item.categoryId === categoryId &&
      item.type === 'expense' &&
      item.cashFlowType !== 'loan_debt' &&
      isInPeriod
      ? total + item.amount
      : total;
  }, 0);
const getBudgetPriority = (status: Budget['status'], percent: number) => {
  if (status === 'EXCEEDED' || percent > 1) {
    return 3;
  }

  if (status === 'WARNING' || percent >= 0.8) {
    return 2;
  }

  return percent >= 0.7 ? 1 : 0;
};

const buildTopCategories = (transactions: TransactionItem[]): TopCategory[] => {
  const totals = new Map<string, TopCategory>();

  filterNormalTransactions(transactions)
    .filter(item => item.type === 'expense')
    .forEach(item => {
      const current = totals.get(item.category);
      totals.set(item.category, {
        name: item.category,
        total: (current?.total ?? 0) + item.displayAmount,
        icon: current?.icon ?? item.categoryIcon,
      });
    });

  return [...totals.values()]
    .sort((left, right) => right.total - left.total)
    .slice(0, 3);
};

export const buildOverviewBudgetRows = (
  budgets: Budget[],
  wallets: Wallet[],
  transactions: TransactionItem[],
  bounds?: { start: Date; end: Date },
) =>
  budgets
    .filter(budget => {
      if (!bounds) {
        return true;
      }

      const startDate = new Date(budget.start_date);
      const endDate = new Date(budget.end_date);

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return true;
      }

      return startDate <= bounds.end && endDate >= bounds.start;
    })
    .map(budget => {
      const wallet = wallets.find(item => item.id === budget.wallet_id);
      const budgetLimit = Number(budget.limit_amount ?? budget.amount ?? 0);
      const spent = Number(
        budget.spent ??
          (budget.scope === 'CATEGORY'
            ? getCategoryPeriodExpense(
                budget.wallet_id,
                budget.category_id,
                transactions,
                bounds,
              )
            : getWalletPeriodExpense(budget.wallet_id, transactions, bounds)),
      );
      const percent = budgetLimit > 0 ? spent / budgetLimit : 0;
      const priority = getBudgetPriority(budget.status, percent);

      return {
        key: `budget-${budget.id}`,
        name:
          budget.scope === 'CATEGORY'
            ? budget.category_name ?? budget.name
            : wallet?.name ?? budget.wallet_name,
        scopeLabel: budget.scope === 'CATEGORY' ? 'Danh mục' : 'Ví',
        spent,
        budgetLimit,
        currency: wallet?.currency ?? budget.wallet_currency,
        percent,
        priority,
        status:
          budget.status === 'EXCEEDED'
            ? 'Vượt ngân sách'
            : budget.status === 'WARNING'
            ? 'Gần hạn mức'
            : 'Ổn định',
      };
    })
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }

      if (right.percent !== left.percent) {
        return right.percent - left.percent;
      }

      return (
        Number(left.key.replace('budget-', '')) -
        Number(right.key.replace('budget-', ''))
      );
    })
    .slice(0, 3);

const OverviewScreen = ({
  wallets,
  refreshing,
  onRefresh,
  onAddTransaction: _onAddTransaction,
  notificationUnreadCount = 0,
}: Props) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { budgets, transactions, preferredCurrency } = useFinance();
  const anchorDate = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState(
    () => new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1),
  );
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(anchorDate.getFullYear());

  const monthTransactions = useMemo(
    () =>
      filterTransactionsByDateBounds(
        transactions,
        getOverviewMonthBounds(selectedMonth, anchorDate),
      ),
    [anchorDate, selectedMonth, transactions],
  );
  const periodBounds = useMemo(
    () => getOverviewMonthBounds(selectedMonth, anchorDate),
    [anchorDate, selectedMonth],
  );
  const previousPeriodBounds = useMemo(
    () =>
      getPreviousPeriodBounds(
        'month',
        {
          selectedMonth: selectedMonth.getMonth(),
          selectedYear: selectedMonth.getFullYear(),
        },
        anchorDate,
      ),
    [anchorDate, selectedMonth],
  );
  const previousMonthTransactions = useMemo(
    () => filterTransactionsByDateBounds(transactions, previousPeriodBounds),
    [previousPeriodBounds, transactions],
  );
  const lastThreeMonthTransactions = useMemo(
    () =>
      [1, 2, 3].flatMap(offset =>
        filterTransactionsByDateBounds(
          transactions,
          getPeriodBounds(
            'month',
            {
              selectedMonth: periodBounds.start.getMonth() - offset,
              selectedYear: periodBounds.start.getFullYear(),
            },
            anchorDate,
          ),
        ),
      ),
    [anchorDate, periodBounds.start, transactions],
  );
  const walletBalances = useMemo(
    () =>
      new Map(
        wallets.map(wallet => [
          wallet.id,
          {
            display: estimateWalletBalanceAtDate(
              wallet,
              transactions,
              periodBounds.end,
              'display',
            ),
            native: estimateWalletBalanceAtDate(
              wallet,
              transactions,
              periodBounds.end,
              'native',
            ),
          },
        ]),
      ),
    [periodBounds.end, transactions, wallets],
  );
  const totalBalance = useMemo(
    () =>
      wallets.reduce(
        (sum, wallet) => sum + (walletBalances.get(wallet.id)?.display ?? 0),
        0,
      ),
    [walletBalances, wallets],
  );
  const income = getTotalByType(monthTransactions, 'income');
  const expense = getTotalByType(monthTransactions, 'expense');
  const previousIncome = getTotalByType(previousMonthTransactions, 'income');
  const previousExpense = getTotalByType(previousMonthTransactions, 'expense');
  const lastThreeAverageIncome =
    getTotalByType(lastThreeMonthTransactions, 'income') / 3;
  const lastThreeAverageExpense =
    getTotalByType(lastThreeMonthTransactions, 'expense') / 3;
  const saving = income - expense;
  const isViewingCurrentPeriod =
    anchorDate >= periodBounds.start && anchorDate <= periodBounds.end;
  const visibleWallets = selectWalletsForPeriodPreview(
    wallets,
    walletBalances,
    isViewingCurrentPeriod,
  );
  const topCategories = buildTopCategories(monthTransactions);
  const budgetAlerts = isViewingCurrentPeriod
    ? buildWalletBudgetAlerts(wallets, transactions, budgets)
    : [];
  const recentTransactions = selectRecentOverviewTransactions(
    monthTransactions,
    4,
  );
  const trendBuckets = useMemo(
    () =>
      buildOverviewMonthExpenseTrendBuckets(
        transactions,
        selectedMonth,
        anchorDate,
      ),
    [anchorDate, selectedMonth, transactions],
  );
  const trendExpense = trendBuckets.reduce(
    (total, item) => total + item.expense,
    0,
  );
  const maxTrendExpense = Math.max(
    1,
    ...trendBuckets.map(item => item.expense),
  );
  const trendAverage = trendExpense / Math.max(1, trendBuckets.length);
  const highestTrendBucket = trendBuckets.reduce(
    (highest, item) => (item.expense > highest.expense ? item : highest),
    trendBuckets[0] ?? {
      label: '',
      start: periodBounds.start,
      end: periodBounds.end,
      expense: 0,
    },
  );
  const monthLabel = `Tháng ${
    selectedMonth.getMonth() + 1
  }/${selectedMonth.getFullYear()}`;
  const canGoForward =
    selectedMonth.getFullYear() < anchorDate.getFullYear() ||
    selectedMonth.getMonth() < anchorDate.getMonth();
  const unreadBadgeLabel =
    notificationUnreadCount > 99 ? '99+' : String(notificationUnreadCount);

  const budgetRows = buildOverviewBudgetRows(
    budgets,
    wallets,
    transactions,
    periodBounds,
  );

  const moveMonth = (amount: number) => {
    setSelectedMonth(
      current =>
        new Date(current.getFullYear(), current.getMonth() + amount, 1),
    );
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.greeting}>Xin chào</Text>
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Bell size={19} color="#8B6548" />
            {notificationUnreadCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadBadgeLabel}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        <View style={styles.monthRow}>
          <Text style={styles.screenTitle}>Tổng quan</Text>
          <View style={styles.periodNav}>
            <TouchableOpacity
              style={styles.periodNavButton}
              onPress={() => moveMonth(-1)}
            >
              <ChevronLeft size={15} color="#A94F18" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.monthChip}
              onPress={() => {
                setPickerYear(selectedMonth.getFullYear());
                setMonthPickerVisible(true);
              }}
            >
              <Text style={styles.monthChipText}>{monthLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.periodNavButton,
                !canGoForward && styles.periodNavButtonDisabled,
              ]}
              disabled={!canGoForward}
              onPress={() => moveMonth(1)}
            >
              <ChevronRight
                size={15}
                color={canGoForward ? '#A94F18' : '#D7BCA4'}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.walletCard}>
          <View style={styles.walletTopRow}>
            <View>
              <Text style={styles.walletCardTitle}>Ví của tôi</Text>
              <Text style={styles.walletCount}>
                {wallets.length > 0
                  ? `${wallets.length} ví đang sử dụng`
                  : 'Chưa có ví'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.allWalletChip}
              onPress={() => navigation.navigate('Wallets')}
            >
              <Text style={styles.allWalletText}>Tất cả ví</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.balanceLabel}>
            {isViewingCurrentPeriod ? 'Tổng số dư' : 'Số dư cuối kỳ'}
          </Text>
          <Text style={styles.balanceValue}>
            {formatCurrency(totalBalance, preferredCurrency)}
          </Text>

          <View style={styles.walletPreview}>
            {visibleWallets.length === 0 ? (
              <Text style={styles.emptyOnDark}>
                Chưa có dữ liệu ví. Hãy tạo ví đầu tiên để bắt đầu.
              </Text>
            ) : (
              visibleWallets.map(wallet => {
                const typeMeta = getWalletTypeMeta(wallet.wallet_type);
                const WalletTypeIcon = typeMeta.Icon ?? WalletIcon;
                const amount =
                  walletBalances.get(wallet.id)?.native ??
                  Number(wallet.balance ?? 0);

                return (
                  <TouchableOpacity
                    key={wallet.id}
                    style={styles.walletPreviewRow}
                    onPress={() =>
                      navigation.navigate('WalletTransactions', {
                        walletId: wallet.id,
                        walletName: wallet.name,
                      })
                    }
                  >
                    <View style={styles.walletMiniIcon}>
                      <WalletTypeIcon size={16} color="#D87219" />
                    </View>
                    <Text style={styles.walletPreviewName} numberOfLines={1}>
                      {wallet.name}
                    </Text>
                    <Text style={styles.walletPreviewAmount} numberOfLines={1}>
                      {formatCurrency(amount, wallet.currency)}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>

        <View style={styles.statGrid}>
          <View style={styles.statCard}>
            <TrendingIcon type="income" />
            <Text style={styles.statLabel} numberOfLines={2}>
              Tổng thu
            </Text>
            <Text
              style={[styles.statValue, styles.incomeText]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {formatCurrency(income, preferredCurrency)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <TrendingIcon type="expense" />
            <Text style={styles.statLabel} numberOfLines={2}>
              Tổng chi
            </Text>
            <Text
              style={[styles.statValue, styles.expenseText]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {formatCurrency(expense, preferredCurrency)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.savingIcon}>
              <PiggyBank size={18} color="#C87900" />
            </View>
            <Text style={styles.statLabel} numberOfLines={2}>
              Thu - chi kỳ này
            </Text>
            <Text
              style={[styles.statValue, styles.savingText]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {formatCurrency(saving, preferredCurrency)}
            </Text>
          </View>
        </View>

        <View style={styles.quickGrid}>
          {[
            {
              label: 'Ví của tôi',
              icon: WalletCards,
              onPress: () => navigation.navigate('Wallets'),
            },
            {
              label: 'Ngân sách',
              icon: Target,
              onPress: () => navigation.navigate('Budgets'),
            },
            {
              label: 'Báo cáo',
              icon: ChartColumnBig,
              onPress: () => navigation.navigate('Statistics', { wallets }),
            },
          ].map(item => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.label}
                style={styles.quickButton}
                onPress={item.onPress}
              >
                <View style={styles.quickIcon}>
                  <Icon size={20} color={Colors.primary} />
                </View>
                <Text style={styles.quickLabel}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tiến độ ngân sách</Text>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('Budgets')}
            >
              <Text style={styles.linkText}>Xem tất cả</Text>
              <ChevronRight size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          {budgetRows.length === 0 ? (
            <Text style={styles.emptyText}>Chưa có ngân sách để theo dõi.</Text>
          ) : (
            budgetRows.map(row => (
              <View key={row.key} style={styles.budgetRow}>
                <View style={styles.budgetTop}>
                  <View style={styles.budgetNameBlock}>
                    <View style={styles.budgetScopeRow}>
                      <Text style={styles.budgetScopePill}>
                        {row.scopeLabel}
                      </Text>
                      <Text style={styles.budgetName} numberOfLines={1}>
                        {row.name}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.statusPill,
                      row.percent > 1
                        ? styles.statusDanger
                        : row.percent >= 0.8
                        ? styles.statusWarning
                        : styles.statusOk,
                    ]}
                  >
                    {row.status}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      row.percent > 1
                        ? styles.progressDanger
                        : row.percent >= 0.8
                        ? styles.progressWarning
                        : styles.progressNormal,
                      {
                        width: `${Math.min(
                          100,
                          Math.max(6, row.percent * 100),
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.budgetMeta}>
                  {formatCurrency(row.spent, row.currency)} /{' '}
                  {formatCurrency(row.budgetLimit, row.currency)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Thống kê</Text>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('Statistics', { wallets })}
            >
              <Text style={styles.linkText}>Xem</Text>
              <ChevronRight size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.monthCompareGrid}>
            <View style={[styles.monthCompareCard, styles.incomeCompareCard]}>
              <View style={styles.compareTopRow}>
                <View style={styles.compareIncomeBadge}>
                  <TrendingUp size={15} color="#16A34A" />
                </View>
                <Text style={styles.compareLabel}>Tổng thu kỳ này</Text>
              </View>
              <Text style={styles.compareIncome}>
                {formatCurrency(income, preferredCurrency)}
              </Text>
              <Text style={styles.compareMeta}>
                So với kỳ trước: {formatChangePercent(income, previousIncome)}
              </Text>
              <Text style={styles.compareMeta}>
                TB 3 tháng trước:{' '}
                {formatCurrency(lastThreeAverageIncome, preferredCurrency)}
              </Text>
            </View>
            <View style={[styles.monthCompareCard, styles.expenseCompareCard]}>
              <View style={styles.compareTopRow}>
                <View style={styles.compareExpenseBadge}>
                  <TrendingDown size={15} color="#EA580C" />
                </View>
                <Text style={styles.compareLabel}>Tổng chi kỳ này</Text>
              </View>
              <Text style={styles.compareExpense}>
                {formatCurrency(expense, preferredCurrency)}
              </Text>
              <Text style={styles.compareMeta}>
                So với kỳ trước: {formatChangePercent(expense, previousExpense)}
              </Text>
              <Text style={styles.compareMeta}>
                TB 3 tháng trước:{' '}
                {formatCurrency(lastThreeAverageExpense, preferredCurrency)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.weeklyExpenseCard}>
          <View style={styles.weeklyHeader}>
            <Text style={styles.chartTitle}>Xu hướng chi tiêu</Text>
            <View style={styles.trendBadge}>
              <Text style={styles.trendBadgeText}>Xu hướng</Text>
            </View>
          </View>
          <Text style={styles.weeklyTotal}>
            {formatCurrency(trendExpense, preferredCurrency)}
          </Text>
          <Text style={styles.compareMeta}>
            {previousExpense > 0
              ? `So với kỳ trước: ${formatChangePercent(
                  trendExpense,
                  previousExpense,
                )}`
              : 'Chưa có dữ liệu kỳ trước'}
          </Text>
          {trendBuckets.every(item => item.expense === 0) ? (
            <Text style={styles.emptyText}>Chưa có dữ liệu trong kỳ này.</Text>
          ) : (
            <>
              <View style={styles.weeklyChart}>
                {trendBuckets.map((item, index) => {
                  const height = Math.max(
                    12,
                    (item.expense / maxTrendExpense) * 86,
                  );
                  const isHighest =
                    item.expense === highestTrendBucket.expense &&
                    item.expense > 0;

                  return (
                    <View
                      key={`${item.label}-${index}`}
                      style={styles.weeklyBarItem}
                    >
                      <View style={styles.weeklyBarTrack}>
                        <View
                          style={[
                            styles.weeklyBar,
                            isHighest
                              ? styles.weeklyBarHighest
                              : styles.weeklyBarNormal,
                            { height },
                          ]}
                        />
                      </View>
                      <Text style={styles.weeklyBarLabel}>{item.label}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.weeklyFooter}>
                <Text style={styles.weeklyFooterText}>
                  Trung bình/mốc:{' '}
                  {formatCurrency(trendAverage, preferredCurrency)}
                </Text>
                <Text style={styles.weeklyFooterText}>
                  Cao nhất: {highestTrendBucket.label} -{' '}
                  {formatCurrency(
                    highestTrendBucket.expense,
                    preferredCurrency,
                  )}
                </Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.insightCard}>
          <View style={styles.insightIcon}>
            <Lightbulb size={21} color="#C87900" />
          </View>
          <View style={styles.insightCopy}>
            <Text style={styles.insightTitle}>Gợi ý kỳ này</Text>
            {budgetRows.length === 0 && topCategories.length === 0 ? (
              <Text style={styles.insightText}>
                Chưa có dữ liệu để tạo gợi ý. Hãy thêm giao dịch và ngân sách.
              </Text>
            ) : (
              <>
                {budgetRows[0] ? (
                  <Text style={styles.insightText}>
                    {budgetRows[0].name} đã dùng{' '}
                    {Math.round(budgetRows[0].percent * 100)}% ngân sách kỳ này
                  </Text>
                ) : null}
                {topCategories[0] ? (
                  <Text style={styles.insightText}>
                    Danh mục chi nhiều nhất: {topCategories[0].name}
                  </Text>
                ) : null}
                {budgetRows.find(item => item.percent >= 0.8) ? (
                  <Text style={styles.insightText}>
                    {budgetRows.find(item => item.percent >= 0.8)?.name} đang
                    gần đạt hạn mức
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </View>

        {budgetAlerts.length > 0 ? (
          <View style={styles.warningCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.warningTitle}>Cảnh báo ngân sách</Text>
              <ShieldAlert size={20} color="#C75A1B" />
            </View>
            {budgetAlerts.slice(0, 2).map(alert => (
              <View key={alert.walletId} style={styles.warningRow}>
                <View style={styles.warningDot} />
                <Text style={styles.warningText}>
                  {alert.walletName}: {alert.reasons[0]}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Giao dịch mới nhất</Text>
            <Text style={styles.mutedAction}>
              {recentTransactions.length} mới nhất
            </Text>
          </View>
          {recentTransactions.length === 0 ? (
            <Text style={styles.emptyText}>Chưa có giao dịch gần đây.</Text>
          ) : (
            recentTransactions.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.transactionRow}
                activeOpacity={0.86}
                onPress={() =>
                  navigation.navigate('TransactionDetail', {
                    transaction: item,
                  })
                }
              >
                <View style={styles.transactionIcon}>
                  <CategoryIcon icon={item.categoryIcon} size={18} />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionName}>{item.note}</Text>
                  <Text style={styles.transactionMeta}>
                    {item.category} · {formatDisplayDate(item.date)}
                  </Text>
                </View>
                <Text
                  style={
                    item.type === 'income'
                      ? styles.transactionIncome
                      : styles.transactionExpense
                  }
                  numberOfLines={2}
                >
                  {item.type === 'income' ? '+' : '-'}
                  {formatCurrency(item.amount, item.currency)}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.miniPanel}>
          <Text style={styles.panelTitle}>Top chi tiêu</Text>
          {topCategories.length === 0 ? (
            <Text style={styles.emptyText}>Chưa có dữ liệu chi tiêu.</Text>
          ) : (
            topCategories.map(row => (
              <View key={row.name} style={styles.panelLine}>
                <View style={styles.panelCategory}>
                  <View style={styles.panelCategoryIcon}>
                    <CategoryIcon icon={row.icon ?? null} size={16} />
                  </View>
                  <Text style={styles.panelLabel}>{row.name}</Text>
                </View>
                <Text style={styles.panelValue} numberOfLines={1}>
                  {formatCurrency(row.total, preferredCurrency)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <Modal
        transparent
        visible={monthPickerVisible}
        animationType="fade"
        onRequestClose={() => setMonthPickerVisible(false)}
      >
        <View style={styles.monthPickerOverlay}>
          <View style={styles.monthPickerCard}>
            <View style={styles.monthPickerHeader}>
              <TouchableOpacity
                style={styles.monthPickerYearButton}
                onPress={() => setPickerYear(year => year - 1)}
              >
                <ChevronLeft size={18} color="#A94F18" />
              </TouchableOpacity>
              <Text style={styles.monthPickerTitle}>
                Chọn tháng {pickerYear}
              </Text>
              <TouchableOpacity
                style={[
                  styles.monthPickerYearButton,
                  pickerYear >= anchorDate.getFullYear() &&
                    styles.periodNavButtonDisabled,
                ]}
                disabled={pickerYear >= anchorDate.getFullYear()}
                onPress={() => setPickerYear(year => year + 1)}
              >
                <ChevronRight
                  size={18}
                  color={
                    pickerYear < anchorDate.getFullYear()
                      ? '#A94F18'
                      : '#D7BCA4'
                  }
                />
              </TouchableOpacity>
            </View>
            <View style={styles.monthPickerGrid}>
              {MONTHS.map(month => {
                const isFuture =
                  pickerYear > anchorDate.getFullYear() ||
                  (pickerYear === anchorDate.getFullYear() &&
                    month > anchorDate.getMonth());
                const isSelected =
                  pickerYear === selectedMonth.getFullYear() &&
                  month === selectedMonth.getMonth();

                return (
                  <TouchableOpacity
                    key={month}
                    style={[
                      styles.monthPickerOption,
                      isSelected && styles.monthPickerOptionActive,
                      isFuture && styles.monthPickerOptionDisabled,
                    ]}
                    disabled={isFuture}
                    onPress={() => {
                      setSelectedMonth(new Date(pickerYear, month, 1));
                      setMonthPickerVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.monthPickerOptionText,
                        isSelected && styles.monthPickerOptionTextActive,
                        isFuture && styles.monthPickerOptionTextDisabled,
                      ]}
                    >
                      Tháng {month + 1}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={styles.monthPickerClose}
              onPress={() => setMonthPickerVisible(false)}
            >
              <Text style={styles.monthPickerCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const TrendingIcon = ({ type }: { type: 'income' | 'expense' }) => (
  <View
    style={type === 'income' ? styles.trendIncomeIcon : styles.trendExpenseIcon}
  >
    <CircleDollarSign
      size={18}
      color={type === 'income' ? '#188F5A' : '#D87219'}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF3E8' },
  content: { padding: 16, paddingBottom: 184, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerCopy: { flex: 1 },
  greeting: { color: '#4A2B1A', fontSize: 22, fontWeight: '900' },
  subtitle: { color: '#8B6548', fontSize: 13, fontWeight: '700', marginTop: 4 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#FFFDFB',
    borderWidth: 1,
    borderColor: '#F0C49B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    right: 7,
    top: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.white, fontWeight: '900', fontSize: 16 },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: { color: '#4A2B1A', fontSize: 28, fontWeight: '900' },
  periodNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '68%',
  },
  periodNavButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E7',
  },
  periodNavButtonDisabled: { opacity: 0.55 },
  monthChip: {
    backgroundColor: '#FFE3C8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  monthChipText: { color: '#A94F18', fontWeight: '900', fontSize: 12 },
  monthPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(57, 30, 13, 0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  monthPickerCard: {
    backgroundColor: '#FFFDFB',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F0C49B',
  },
  monthPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthPickerTitle: { color: '#4A2B1A', fontSize: 18, fontWeight: '900' },
  monthPickerYearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthPickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  monthPickerOption: {
    width: '30%',
    flexGrow: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  monthPickerOptionActive: { backgroundColor: Colors.primary },
  monthPickerOptionDisabled: { opacity: 0.42 },
  monthPickerOptionText: { color: '#8B6548', fontSize: 13, fontWeight: '900' },
  monthPickerOptionTextActive: { color: Colors.white },
  monthPickerOptionTextDisabled: { color: '#A98B73' },
  monthPickerClose: {
    alignSelf: 'flex-end',
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  monthPickerCloseText: { color: Colors.primary, fontWeight: '900' },
  walletCard: {
    backgroundColor: Colors.primary,
    borderRadius: 28,
    padding: 16,
    shadowColor: '#7A3E12',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  walletTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  walletCardTitle: { color: Colors.white, fontSize: 22, fontWeight: '900' },
  walletCount: { color: '#FFF4E7', fontWeight: '700', marginTop: 4 },
  allWalletChip: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  allWalletText: { color: '#A94F18', fontWeight: '900', fontSize: 12 },
  balanceLabel: { color: '#FFF4E7', fontWeight: '800', marginTop: 18 },
  balanceValue: {
    color: Colors.white,
    fontSize: 30,
    fontWeight: '900',
    marginTop: 4,
  },
  walletPreview: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 20,
    padding: 10,
    marginTop: 14,
    gap: 8,
  },
  walletPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  walletMiniIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletPreviewName: { flex: 1, color: '#4A2B1A', fontWeight: '800' },
  walletPreviewAmount: {
    color: '#4A2B1A',
    fontWeight: '900',
    maxWidth: '42%',
    textAlign: 'right',
  },
  emptyOnDark: { color: '#7A4A28', fontWeight: '800', lineHeight: 20 },
  quickGrid: { flexDirection: 'row', gap: 10 },
  quickButton: {
    flex: 1,
    minHeight: 86,
    backgroundColor: '#FFFDFB',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0C49B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickLabel: {
    color: '#4A2B1A',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 104,
    backgroundColor: '#FFFDFB',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0C49B',
    padding: 10,
    minHeight: 112,
    justifyContent: 'space-between',
  },
  trendIncomeIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: '#E9F8EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendExpenseIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    borderWidth: 1,
    borderColor: '#F0C49B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    color: '#8B6548',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 14,
    minHeight: 28,
    marginTop: 8,
  },
  statValue: { fontSize: 13, fontWeight: '900', lineHeight: 17, marginTop: 4 },
  incomeText: { color: '#188F5A' },
  expenseText: { color: '#D87219' },
  savingText: { color: '#C87900' },
  card: {
    backgroundColor: '#FFFDFB',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F0C49B',
    padding: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: { color: '#4A2B1A', fontSize: 18, fontWeight: '900' },
  emptyText: {
    color: '#8B6548',
    fontWeight: '800',
    lineHeight: 21,
    marginTop: 4,
  },
  budgetRow: { marginTop: 12 },
  budgetTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  budgetNameBlock: { flex: 1, minWidth: 0 },
  budgetScopeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  budgetScopePill: {
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: '#FFF0DF',
    color: '#A94F18',
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '900',
  },
  budgetName: { flex: 1, color: '#4A2B1A', fontWeight: '900' },
  statusPill: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '900',
  },
  statusOk: { color: '#188F5A', backgroundColor: '#E9F8EF' },
  statusWarning: { color: '#B26A00', backgroundColor: '#FFF1CF' },
  statusDanger: { color: '#C75A1B', backgroundColor: '#FFE4D8' },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#FFE3C8',
    overflow: 'hidden',
    marginTop: 9,
  },
  progressFill: { height: '100%', borderRadius: 999 },
  progressNormal: { backgroundColor: Colors.primary },
  progressWarning: { backgroundColor: '#F0AA24' },
  progressDanger: { backgroundColor: '#D85F3F' },
  budgetMeta: {
    color: '#8B6548',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 7,
  },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  linkText: { color: Colors.primary, fontWeight: '900' },
  monthCompareGrid: { gap: 10 },
  monthCompareCard: { borderRadius: 18, borderWidth: 1.2, padding: 12 },
  incomeCompareCard: { borderColor: '#BBF7D0', backgroundColor: '#F7FDF8' },
  expenseCompareCard: { borderColor: '#FED7AA', backgroundColor: '#FFF8F1' },
  compareTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compareIncomeBadge: {
    width: 28,
    height: 28,
    borderRadius: 11,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareExpenseBadge: {
    width: 28,
    height: 28,
    borderRadius: 11,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareLabel: { color: '#7A4A28', fontSize: 12, fontWeight: '900', flex: 1 },
  compareIncome: {
    color: '#16A34A',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 8,
  },
  compareExpense: {
    color: '#EA580C',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 8,
  },
  compareMeta: {
    color: '#8B735F',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    borderRadius: 999,
    backgroundColor: '#FFF0DF',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: { backgroundColor: Colors.primary },
  filterText: { color: '#8B6548', fontWeight: '900', fontSize: 12 },
  filterTextActive: { color: Colors.white },
  premiumChip: {
    borderRadius: 999,
    backgroundColor: '#4A2B1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  premiumText: { color: Colors.white, fontWeight: '900', fontSize: 12 },
  chartTitle: { color: '#4A2B1A', fontSize: 16, fontWeight: '900' },
  chartLoader: { marginVertical: 22 },
  chartSummary: { color: '#EA580C', fontWeight: '900', marginTop: 6 },
  weeklyExpenseCard: {
    backgroundColor: '#FFFDFB',
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: '#F0C49B',
    padding: 14,
  },
  weeklyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  trendBadge: {
    borderRadius: 999,
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trendBadgeText: { color: '#EA580C', fontSize: 11, fontWeight: '900' },
  weeklyTotal: {
    color: '#EA580C',
    fontSize: 23,
    fontWeight: '900',
    marginTop: 10,
  },
  weeklyChart: {
    minHeight: 132,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 14,
  },
  weeklyBarItem: { flex: 1, alignItems: 'center' },
  weeklyBarTrack: {
    height: 92,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  weeklyBar: { width: 18, borderRadius: 999 },
  weeklyBarNormal: { backgroundColor: '#FDBA74' },
  weeklyBarHighest: { backgroundColor: '#EA580C' },
  weeklyBarLabel: {
    color: '#8B6548',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
  },
  weeklyFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F4DDC8',
    marginTop: 12,
    paddingTop: 10,
    gap: 5,
  },
  weeklyFooterText: { color: '#7A4A28', fontSize: 12, fontWeight: '800' },
  insightCard: {
    backgroundColor: '#FFF1CF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F2C972',
    flexDirection: 'row',
    gap: 12,
  },
  insightIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#FFE4A3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightCopy: { flex: 1 },
  insightTitle: {
    color: '#4A2B1A',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  insightText: { color: '#7A4A28', fontWeight: '800', lineHeight: 21 },
  warningCard: {
    backgroundColor: '#FFF0EA',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1A58D',
  },
  warningTitle: { color: '#7A2B18', fontSize: 18, fontWeight: '900' },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 10,
  },
  warningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D85F3F',
  },
  warningText: { flex: 1, color: '#8F3F28', fontWeight: '800', lineHeight: 20 },
  mutedAction: { color: '#8B6548', fontWeight: '800', fontSize: 12 },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: '#F4DDC8',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionInfo: { flex: 1, minWidth: 0 },
  transactionName: { color: '#4A2B1A', fontWeight: '900' },
  transactionMeta: {
    color: '#8B6548',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  transactionIncome: {
    color: '#188F5A',
    fontWeight: '900',
    maxWidth: 112,
    textAlign: 'right',
  },
  transactionExpense: {
    color: '#D87219',
    fontWeight: '900',
    maxWidth: 112,
    textAlign: 'right',
  },
  panelRow: { gap: 14 },
  miniPanel: {
    backgroundColor: '#FFFDFB',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F0C49B',
    padding: 16,
  },
  panelTitle: {
    color: '#4A2B1A',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 8,
  },
  panelLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F4DDC8',
  },
  panelCategory: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelCategoryIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelLabel: { flex: 1, color: '#8B6548', fontWeight: '800' },
  panelValue: {
    color: '#4A2B1A',
    fontWeight: '900',
    maxWidth: '42%',
    textAlign: 'right',
  },
});

export default OverviewScreen;
