import React, { useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AlertTriangle, Wallet as WalletIcon } from 'lucide-react-native';
import CategoryIcon from '../../components/CategoryIcon';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, formatDisplayDate } from '../../utils/format';
import { buildWalletBudgetAlerts } from '../../utils/budgetAlerts';
import type { TransactionItem } from '../../data/mockTransactions';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { Wallet } from '../../types/wallet';

type Props = {
  wallets: Wallet[];
  refreshing: boolean;
  onRefresh: () => void;
};

type StatMode = 'all' | 'day' | 'week' | 'month' | 'quarter' | 'year' | 'category';
type ChartStat = {
  label: string;
  income: number;
  expense: number;
};
type PeriodOption = {
  key: string;
  label: string;
  caption?: string;
  date: Date;
};

const statModeLabels: Record<StatMode, string> = {
  all: 'Tất cả',
  day: 'Ngày',
  week: 'Tuần',
  month: 'Tháng',
  quarter: 'Quý',
  year: 'Năm',
  category: 'Danh mục',
};

const isSameDay = (first: Date, second: Date) =>
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate();

const getStartOfWeek = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  start.setHours(0, 0, 0, 0);

  return start;
};

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const getStartOfQuarter = (date: Date) =>
  new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);

const formatChipDate = (date: Date) =>
  `${`${date.getDate()}`.padStart(2, '0')}/${`${date.getMonth() + 1}`.padStart(2, '0')}`;

const getISOWeek = (date: Date) => {
  const current = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = current.getUTCDay() || 7;
  current.setUTCDate(current.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));

  return Math.ceil(((current.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

const getPeriodKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

const buildPeriodOptions = (mode: Exclude<StatMode, 'category'>): PeriodOption[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (mode === 'all') {
    return [
      {
        key: 'all',
        label: 'Tất cả',
        caption: 'Toàn bộ dữ liệu',
        date: today,
      },
    ];
  }

  if (mode === 'day') {
    return Array.from({ length: 30 }, (_, index) => {
      const date = addDays(today, -index);

      return {
        key: getPeriodKey(date),
        label: formatChipDate(date),
        caption: `${date.getFullYear()}`,
        date,
      };
    });
  }

  if (mode === 'week') {
    const currentStart = getStartOfWeek(today);

    return Array.from({ length: 20 }, (_, index) => {
      const start = addDays(currentStart, -index * 7);
      const end = addDays(start, 6);

      return {
        key: getPeriodKey(start),
        label: `Tuần ${getISOWeek(start)}`,
        caption: `${formatChipDate(start)} - ${formatChipDate(end)}`,
        date: start,
      };
    });
  }

  if (mode === 'month') {
    return Array.from({ length: 18 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth() - index, 1);

      return {
        key: getPeriodKey(date),
        label: `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`,
        date,
      };
    });
  }

  if (mode === 'quarter') {
    const currentStart = getStartOfQuarter(today);

    return Array.from({ length: 12 }, (_, index) => {
      const start = new Date(currentStart.getFullYear(), currentStart.getMonth() - index * 3, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);

      return {
        key: getPeriodKey(start),
        label: `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`,
        caption: `${formatChipDate(start)} - ${formatChipDate(end)}`,
        date: start,
      };
    });
  }

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear() - index, 0, 1);

    return {
      key: getPeriodKey(date),
      label: `${date.getFullYear()}`,
      date,
    };
  });
};

const buildTimeStats = (
  transactions: TransactionItem[],
  mode: Exclude<StatMode, 'category'>,
  referenceDate: Date,
) => {
  const now = referenceDate;

  if (mode === 'all') {
    const years = new Map<number, ChartStat>();

    transactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const year = date.getFullYear();
      const stat = years.get(year) ?? {
        label: `${year}`,
        income: 0,
        expense: 0,
      };

      if (transaction.type === 'income') {
        stat.income += transaction.displayAmount;
      } else {
        stat.expense += transaction.displayAmount;
      }

      years.set(year, stat);
    });

    return years.size ? Array.from(years.values()).sort((left, right) => Number(left.label) - Number(right.label)) : [
      { label: `${now.getFullYear()}`, income: 0, expense: 0 },
    ];
  }

  if (mode === 'day') {
    const hours = Array.from({ length: 24 }, (_, hour) => ({
      label: `${`${hour}`.padStart(2, '0')}h`,
      income: 0,
      expense: 0,
    }));

    transactions.forEach(transaction => {
      const date = new Date(transaction.date);

      if (!isSameDay(now, date)) {
        return;
      }

      if (transaction.type === 'income') {
        hours[date.getHours()].income += transaction.displayAmount;
      } else {
        hours[date.getHours()].expense += transaction.displayAmount;
      }
    });

    const activeHours = hours.filter(item => item.income > 0 || item.expense > 0);

    return activeHours.length > 0 ? activeHours : hours.filter((_, index) => index % 4 === 0);
  }

  if (mode === 'week') {
    const startOfWeek = getStartOfWeek(now);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + index);

      return {
        date,
        label: `${date.getDate()}/${date.getMonth() + 1}`,
        income: 0,
        expense: 0,
      };
    });

    transactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const stat = days.find(item => isSameDay(item.date, date));

      if (!stat) {
        return;
      }

      if (transaction.type === 'income') {
        stat.income += transaction.displayAmount;
      } else {
        stat.expense += transaction.displayAmount;
      }
    });

    return days;
  }

  if (mode === 'month') {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, index) => ({
      label: `${index + 1}`,
      income: 0,
      expense: 0,
    }));

    transactions.forEach(transaction => {
      const date = new Date(transaction.date);

      if (date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth()) {
        return;
      }

      const stat = days[date.getDate() - 1];

      if (transaction.type === 'income') {
        stat.income += transaction.displayAmount;
      } else {
        stat.expense += transaction.displayAmount;
      }
    });

    return days;
  }

  if (mode === 'quarter') {
    const startMonth = Math.floor(now.getMonth() / 3) * 3;
    const months = Array.from({ length: 3 }, (_, index) => ({
      label: `T${startMonth + index + 1}`,
      income: 0,
      expense: 0,
    }));

    transactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const monthOffset = date.getMonth() - startMonth;

      if (date.getFullYear() !== now.getFullYear() || monthOffset < 0 || monthOffset > 2) {
        return;
      }

      if (transaction.type === 'income') {
        months[monthOffset].income += transaction.displayAmount;
      } else {
        months[monthOffset].expense += transaction.displayAmount;
      }
    });

    return months;
  }

  const months = Array.from({ length: 12 }, (_, index) => ({
    label: `T${index + 1}`,
    income: 0,
    expense: 0,
  }));

  transactions.forEach(transaction => {
    const date = new Date(transaction.date);

    if (date.getFullYear() !== now.getFullYear()) {
      return;
    }

    const stat = months[date.getMonth()];

    if (transaction.type === 'income') {
      stat.income += transaction.displayAmount;
    } else {
      stat.expense += transaction.displayAmount;
    }
  });

  return months;
};

const buildCategoryStats = (transactions: TransactionItem[]) => {
  const expenseMap = new Map<string, number>();

  transactions
    .filter(transaction => transaction.type === 'expense')
    .forEach(transaction => {
      expenseMap.set(
        transaction.category,
        (expenseMap.get(transaction.category) ?? 0) + transaction.displayAmount,
      );
    });

  return [...expenseMap.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
};

const filterTransactionsByPeriod = (
  transactions: TransactionItem[],
  mode: Exclude<StatMode, 'category'>,
  referenceDate: Date,
) =>
  transactions.filter(transaction => {
    const date = new Date(transaction.date);

    if (mode === 'day') {
      return isSameDay(date, referenceDate);
    }

    if (mode === 'week') {
      const start = getStartOfWeek(referenceDate);
      const end = addDays(start, 7);

      return date >= start && date < end;
    }

    if (mode === 'month') {
      return (
        date.getFullYear() === referenceDate.getFullYear() &&
        date.getMonth() === referenceDate.getMonth()
      );
    }

    if (mode === 'quarter') {
      const startMonth = Math.floor(referenceDate.getMonth() / 3) * 3;
      const monthOffset = date.getMonth() - startMonth;

      return date.getFullYear() === referenceDate.getFullYear() && monthOffset >= 0 && monthOffset < 3;
    }

    if (mode === 'year') {
      return date.getFullYear() === referenceDate.getFullYear();
    }

    return true;
  });

const getCurrentMonthExpense = (walletId: number, transactions: TransactionItem[]) => {
  const now = new Date();

  return transactions.reduce((total, transaction) => {
    const date = new Date(transaction.date);
    const isCurrentMonth =
      date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();

    if (transaction.walletId !== walletId || transaction.type !== 'expense' || !isCurrentMonth) {
      return total;
    }

    return total + transaction.amount;
  }, 0);
};

const OverviewScreen = ({ wallets, refreshing, onRefresh }: Props) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { transactions, preferredCurrency } = useFinance();
  const [statMode, setStatMode] = useState<StatMode>('month');
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const walletCurrencyMap = useMemo(
    () => new Map(wallets.map(wallet => [wallet.id, wallet.currency])),
    [wallets],
  );

  const totalBalance = useMemo(
    () =>
      wallets.reduce(
        (sum, wallet) => sum + Number(wallet.display_balance ?? wallet.balance ?? 0),
        0,
      ),
    [wallets],
  );
  const timeStats = useMemo(
    () => buildTimeStats(transactions, statMode === 'category' ? 'month' : statMode, referenceDate),
    [referenceDate, statMode, transactions],
  );
  const periodMode = statMode === 'category' ? 'month' : statMode;
  const periodOptions = useMemo(() => buildPeriodOptions(periodMode), [periodMode]);
  const selectedPeriodKey = getPeriodKey(referenceDate);
  const selectedPeriodTransactions = useMemo(
    () => filterTransactionsByPeriod(transactions, periodMode, referenceDate),
    [periodMode, referenceDate, transactions],
  );
  const categoryStats = useMemo(
    () => buildCategoryStats(selectedPeriodTransactions),
    [selectedPeriodTransactions],
  );
  const budgetAlerts = useMemo(
    () => buildWalletBudgetAlerts(wallets, transactions),
    [transactions, wallets],
  );
  const budgetProgress = useMemo(
    () =>
      wallets
        .filter(wallet => Number(wallet.budget_limit || 0) > 0)
        .map(wallet => {
          const budgetLimit = Number(wallet.budget_limit || 0);
          const monthExpense = getCurrentMonthExpense(wallet.id, transactions);
          const percent = budgetLimit > 0 ? monthExpense / budgetLimit : 0;

          return {
            walletId: wallet.id,
            walletName: wallet.name,
            budgetLimit,
            monthExpense,
            percent,
          };
        }),
    [transactions, wallets],
  );
  const maxChartValue = Math.max(1, ...timeStats.flatMap(item => [item.income, item.expense]));
  const isPremiumStatsEnabled = user?.role === 'PREMIUM' || user?.role === 'ADMIN';
  const selectedPeriod = periodOptions.find(option => option.key === selectedPeriodKey);
  const periodTitle = selectedPeriod?.caption
    ? `${selectedPeriod.label} · ${selectedPeriod.caption}`
    : selectedPeriod?.label ?? `${statModeLabels[statMode]} ${formatChipDate(referenceDate)}`;
  const handleModeChange = (mode: StatMode) => {
    setStatMode(mode);

    if (mode !== 'category') {
      setReferenceDate(buildPeriodOptions(mode)[0]?.date ?? new Date());
    }
  };

  const renderChart = (stats: ChartStat[]) => (
    <>
      <Svg width="100%" height={200} viewBox="0 0 320 200">
        <Line x1="24" y1="168" x2="300" y2="168" stroke="#F1DED0" strokeWidth="1" />
        {stats.map((item, index) => {
          const gap = stats.length > 7 ? 23 : 40;
          const x = 28 + index * gap;
          const incomeHeight = Math.max(3, (item.income / maxChartValue) * 120);
          const expenseHeight = Math.max(3, (item.expense / maxChartValue) * 120);

          return (
            <React.Fragment key={`${item.label}-${index}`}>
              <Rect
                x={x}
                y={168 - incomeHeight}
                width="10"
                height={incomeHeight}
                rx="4"
                fill="#E6842D"
              />
              <Rect
                x={x + 13}
                y={168 - expenseHeight}
                width="10"
                height={expenseHeight}
                rx="4"
                fill="#F4C79F"
              />
              {stats.length <= 7 && (
                <SvgText x={x + 11} y="188" fontSize="10" fill="#95715A" textAnchor="middle">
                  {item.label}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
      </Svg>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.incomeLegendDot]} />
          <Text style={styles.legendText}>Thu</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.expenseLegendDot]} />
          <Text style={styles.legendText}>Chi</Text>
        </View>
      </View>
    </>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.walletSection}>
        <View style={styles.walletHeader}>
          <View style={styles.walletHeaderText}>
            <Text style={styles.sectionEyebrow}>Ví của tôi</Text>
            <Text style={styles.walletCount}>
              {wallets.length > 0 ? `${wallets.length} ví đang hoạt động` : 'Chưa có ví'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.walletButton}
            onPress={() => navigation.navigate('Wallets')}>
            <Text style={styles.walletButtonText}>Tất cả ví</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.totalBalanceRow}>
          <Text style={styles.totalBalanceLabel}>Tổng số dư tất cả ví</Text>
          <Text style={styles.totalBalanceValue}>
            {formatCurrency(totalBalance, preferredCurrency)}
          </Text>
        </View>

        {wallets.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyWalletRow}
            onPress={() => navigation.navigate('Wallets')}>
            <Text style={styles.emptyWalletText}>Tạo ví đầu tiên để bắt đầu quản lý thu chi.</Text>
          </TouchableOpacity>
        ) : (
          wallets.slice(0, 3).map(wallet => (
            <TouchableOpacity
              key={wallet.id}
              style={styles.walletRow}
              onPress={() =>
                navigation.navigate('WalletTransactions', {
                  walletId: wallet.id,
                  walletName: wallet.name,
                })
              }>
              <View style={styles.walletIconBox}>
                <WalletIcon size={20} color="#D9791F" />
              </View>
              <Text style={styles.walletName} numberOfLines={1}>
                {wallet.name}
              </Text>
              <Text style={styles.walletAmount} numberOfLines={1}>
                {formatCurrency(Number(wallet.balance || 0), wallet.currency)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {budgetAlerts.length > 0 && (
        <View style={styles.warningCard}>
          <View style={styles.warningHeader}>
            <AlertTriangle size={20} color="#B94C16" />
            <Text style={styles.warningTitle}>Cảnh báo ngân sách</Text>
          </View>

          {budgetAlerts.map(alert => (
            <View key={alert.walletId} style={styles.warningItem}>
              <Text style={styles.warningWallet}>{alert.walletName}</Text>
              <Text style={styles.warningText}>{alert.reasons.join(' · ')}</Text>
              {alert.budgetLimit ? (
                <Text style={styles.warningMeta}>
                  Đã chi {formatCurrency(alert.monthExpense, walletCurrencyMap.get(alert.walletId) ?? preferredCurrency)} /{' '}
                  {formatCurrency(alert.budgetLimit, walletCurrencyMap.get(alert.walletId) ?? preferredCurrency)} tháng này.
                </Text>
              ) : (
                <Text style={styles.warningMeta}>
                  Số dư hiện tại: {formatCurrency(alert.balance, walletCurrencyMap.get(alert.walletId) ?? preferredCurrency)}.
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {budgetProgress.length > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Ngân Sách</Text>
          {budgetProgress.map(item => {
            const cappedPercent = Math.min(item.percent, 1);
            const isOverBudget = item.percent > 1;
            const isNearBudget = item.percent >= 0.8;

            return (
              <View key={item.walletId} style={styles.budgetRow}>
                <View style={styles.budgetHeader}>
                  <Text style={styles.budgetWallet}>{item.walletName}</Text>
                  <Text style={[styles.budgetPercent, isOverBudget && styles.budgetPercentDanger]}>
                    {Math.round(item.percent * 100)}%
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      isNearBudget && styles.progressFillWarning,
                      isOverBudget && styles.progressFillDanger,
                      { width: `${cappedPercent * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.budgetMeta}>
                  {formatCurrency(item.monthExpense, walletCurrencyMap.get(item.walletId) ?? preferredCurrency)} /{' '}
                  {formatCurrency(item.budgetLimit, walletCurrencyMap.get(item.walletId) ?? preferredCurrency)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Thống kê</Text>
        </View>

        <View style={styles.modeRow}>
          {(['all', 'day', 'week', 'month', 'quarter', 'year', 'category'] as StatMode[]).map(mode => {
            const isLocked = mode === 'category' && !isPremiumStatsEnabled;

            return (
              <TouchableOpacity
                key={mode}
                style={[styles.modeChip, statMode === mode && styles.modeChipActive, isLocked && styles.modeChipLocked]}
                onPress={() => !isLocked && handleModeChange(mode)}>
                <Text style={[styles.modeChipText, statMode === mode && styles.modeChipTextActive]}>
                  {statModeLabels[mode]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.periodTitle}>{periodTitle}</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodChipRow}>
          {periodOptions.map(option => {
            const isActive = option.key === selectedPeriodKey;

            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.periodChip, isActive && styles.periodChipActive]}
                onPress={() => setReferenceDate(option.date)}>
                <Text style={[styles.periodChipText, isActive && styles.periodChipTextActive]}>
                  {option.label}
                </Text>
                {option.caption ? (
                  <Text style={[styles.periodChipCaption, isActive && styles.periodChipCaptionActive]}>
                    {option.caption}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {statMode === 'category' ? (
          categoryStats.length === 0 ? (
            <Text style={styles.emptyStatText}>Chưa có dữ liệu chi theo danh mục.</Text>
          ) : (
            categoryStats.map(item => (
              <View key={item.category} style={styles.categoryStatRow}>
                <Text style={styles.categoryStatName}>{item.category}</Text>
                <Text style={styles.categoryStatAmount}>
                  {formatCurrency(item.total, preferredCurrency)}
                </Text>
              </View>
            ))
          )
        ) : (
          renderChart(timeStats)
        )}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Giao dịch gần đây</Text>
        </View>

        {transactions.slice(0, 5).map(item => (
          <View key={item.id} style={styles.transactionItem}>
            <View style={styles.transactionIcon}>
              <CategoryIcon icon={item.categoryIcon} size={18} />
            </View>
            <View style={styles.transactionMeta}>
              <Text style={styles.transactionTitle}>{item.note}</Text>
              <Text style={styles.transactionSubtext}>
                {item.category} • {item.wallet} • {formatDisplayDate(item.date)}
              </Text>
            </View>
            <Text style={item.type === 'income' ? styles.incomeAmount : styles.expenseAmount}>
              {item.type === 'income' ? '+' : '-'}
              {formatCurrency(item.amount, item.currency)}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFE8D4',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 136,
    gap: 16,
  },
  walletSection: {
    backgroundColor: '#FFF9F3',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#DFA77A',
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  walletHeaderText: {
    flex: 1,
  },
  sectionEyebrow: {
    color: '#A26B48',
    fontSize: 13,
    fontWeight: '700',
  },
  walletCount: {
    color: '#4A2B1A',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  walletButton: {
    backgroundColor: '#FFE3C8',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  walletButtonText: {
    color: '#D87219',
    fontWeight: '700',
  },
  totalBalanceRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E7B991',
    marginBottom: 4,
  },
  totalBalanceLabel: {
    color: '#9A7255',
    fontSize: 13,
  },
  totalBalanceValue: {
    color: '#4A2B1A',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
  },
  emptyWalletRow: {
    backgroundColor: '#FFEAD8',
    borderRadius: 8,
    padding: 14,
    marginTop: 10,
  },
  emptyWalletText: {
    color: '#8B6548',
    lineHeight: 20,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  walletIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FFE3C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletName: {
    flex: 1,
    color: '#4A2B1A',
    fontSize: 15,
    fontWeight: '700',
  },
  walletAmount: {
    maxWidth: 132,
    color: '#4A2B1A',
    fontWeight: '800',
    textAlign: 'right',
  },
  warningCard: {
    backgroundColor: '#FFF1E5',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#DC7D4A',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  warningTitle: {
    color: '#733216',
    fontSize: 18,
    fontWeight: '800',
  },
  warningItem: {
    borderTopWidth: 1,
    borderTopColor: '#F0B990',
    paddingTop: 12,
    marginTop: 10,
  },
  warningWallet: {
    color: '#4A2B1A',
    fontWeight: '800',
  },
  warningText: {
    color: '#A94F18',
    fontWeight: '700',
    marginTop: 4,
  },
  warningMeta: {
    color: '#8B6548',
    marginTop: 6,
    lineHeight: 20,
  },
  budgetRow: {
    marginTop: 14,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetWallet: {
    color: '#4A2B1A',
    fontWeight: '800',
  },
  budgetPercent: {
    color: '#D87219',
    fontWeight: '900',
  },
  budgetPercentDanger: {
    color: '#B94C16',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#FFE3C8',
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#F2A64C',
  },
  progressFillWarning: {
    backgroundColor: '#E6842D',
  },
  progressFillDanger: {
    backgroundColor: '#B94C16',
  },
  budgetMeta: {
    color: '#8B6548',
    marginTop: 8,
    fontSize: 13,
  },
  sectionCard: {
    backgroundColor: '#FFF9F3',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#DFA77A',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#4A2B1A',
    fontWeight: '800',
    fontSize: 18,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  modeChip: {
    backgroundColor: '#FFF1E3',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  modeChipActive: {
    backgroundColor: '#F28C28',
  },
  modeChipLocked: {
    opacity: 0.42,
  },
  modeChipText: {
    color: '#8A623F',
    fontWeight: '800',
    fontSize: 12,
  },
  modeChipTextActive: {
    color: '#FFFFFF',
  },
  periodTitle: {
    color: '#4A2B1A',
    fontWeight: '800',
    marginBottom: 10,
  },
  periodChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingRight: 8,
  },
  periodChip: {
    backgroundColor: '#FFE3C8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0B990',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 78,
  },
  periodChipActive: {
    backgroundColor: '#F28C28',
    borderColor: '#D87219',
  },
  periodChipText: {
    color: '#4A2B1A',
    fontWeight: '800',
    fontSize: 12,
  },
  periodChipTextActive: {
    color: '#FFFFFF',
  },
  periodChipCaption: {
    color: '#8B6548',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  periodChipCaptionActive: {
    color: '#FFF7EF',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 6,
  },
  incomeLegendDot: {
    backgroundColor: '#E6842D',
  },
  expenseLegendDot: {
    backgroundColor: '#F4C79F',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: '#95715A',
  },
  emptyStatText: {
    color: '#8B6548',
    lineHeight: 22,
  },
  categoryStatRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E7B991',
    paddingBottom: 10,
  },
  categoryStatName: {
    color: '#4A2B1A',
    fontWeight: '700',
  },
  categoryStatAmount: {
    color: '#A94F18',
    fontWeight: '800',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E7B991',
    gap: 10,
  },
  transactionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFE3C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionMeta: {
    flex: 1,
    paddingRight: 10,
  },
  transactionTitle: {
    color: '#4A2B1A',
    fontWeight: '700',
    fontSize: 15,
  },
  transactionSubtext: {
    color: '#8B6548',
    marginTop: 6,
    fontSize: 13,
  },
  incomeAmount: {
    color: '#D87219',
    fontWeight: '800',
  },
  expenseAmount: {
    color: '#A94F18',
    fontWeight: '800',
  },
});

export default OverviewScreen;
