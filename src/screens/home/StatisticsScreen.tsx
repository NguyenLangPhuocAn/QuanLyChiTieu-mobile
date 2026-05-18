import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import RNFS from 'react-native-fs';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Hash,
  Lock,
  Mail,
  PieChart,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import CategoryIcon from '../../components/CategoryIcon';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import type { TransactionItem } from '../../data/mockTransactions';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { statisticsService, type StatisticsPeriod, type StatisticsResponse } from '../../services/statistics';
import { formatCompactCurrency, formatCurrency } from '../../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Statistics'>;
type PeriodMode = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
type StatisticsTab = 'overview' | 'trend' | 'category' | 'budget';
type ChartPoint = { label: string; income: number; expense: number };
type PeriodRange = { selectedDate?: string; dateFrom?: string; dateTo?: string };

const periodLabels: Record<PeriodMode, string> = {
  day: 'Ngày',
  week: 'Tuần',
  month: 'Tháng',
  quarter: 'Quý',
  year: 'Năm',
  custom: 'Tùy chọn',
};

const tabLabels: Record<StatisticsTab, string> = {
  overview: 'Tổng quan',
  trend: 'Xu hướng',
  category: 'Danh mục',
  budget: 'Ngân sách',
};

const now = new Date();
const startOfWeek = (date: Date) => {
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

const formatDateInput = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseInputDate = (value?: string) => {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
};

const startOfQuarter = (date: Date) => new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);

const endOfDay = (date: Date) => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
};

const filterByPeriod = (transactions: TransactionItem[], period: PeriodMode, range: PeriodRange = {}) =>
  transactions.filter(transaction => {
    const date = new Date(transaction.date);

    if (period === 'day') {
      const selectedDate = parseInputDate(range.selectedDate) ?? now;
      return date.getFullYear() === selectedDate.getFullYear() && date.getMonth() === selectedDate.getMonth() && date.getDate() === selectedDate.getDate();
    }

    if (period === 'week') {
      const start = startOfWeek(now);
      const end = addDays(start, 7);
      return date >= start && date < end;
    }

    if (period === 'month') {
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }

    if (period === 'quarter') {
      const start = startOfQuarter(now);
      const end = new Date(start.getFullYear(), start.getMonth() + 3, 1);
      return date >= start && date < end;
    }

    if (period === 'custom') {
      const from = parseInputDate(range.dateFrom);
      const to = parseInputDate(range.dateTo);
      const start = from ?? new Date(now.getFullYear(), now.getMonth(), 1);
      const end = endOfDay(to ?? now);
      return date >= start && date <= end;
    }

    return date.getFullYear() === now.getFullYear();
  });

const filterPreviousPeriod = (transactions: TransactionItem[], period: PeriodMode, range: PeriodRange = {}) =>
  transactions.filter(transaction => {
    const date = new Date(transaction.date);

    if (period === 'day') {
      const selectedDate = parseInputDate(range.selectedDate) ?? now;
      const previousDay = addDays(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()), -1);
      return date.getFullYear() === previousDay.getFullYear() && date.getMonth() === previousDay.getMonth() && date.getDate() === previousDay.getDate();
    }

    if (period === 'week') {
      const currentStart = startOfWeek(now);
      const previousStart = addDays(currentStart, -7);
      return date >= previousStart && date < currentStart;
    }

    if (period === 'month') {
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return date.getFullYear() === previousMonth.getFullYear() && date.getMonth() === previousMonth.getMonth();
    }

    if (period === 'quarter') {
      const currentStart = startOfQuarter(now);
      const previousStart = new Date(currentStart.getFullYear(), currentStart.getMonth() - 3, 1);
      return date >= previousStart && date < currentStart;
    }

    return date.getFullYear() === now.getFullYear() - 1;
  });

const sumByType = (transactions: TransactionItem[], type: 'income' | 'expense') =>
  transactions.filter(item => item.type === type).reduce((total, item) => total + item.displayAmount, 0);

const buildChartPoints = (transactions: TransactionItem[], period: PeriodMode, range: PeriodRange = {}): ChartPoint[] => {
  if (period === 'day') {
    const selectedDate = parseInputDate(range.selectedDate) ?? now;
    const dayTransactions = filterByPeriod(transactions, 'day', range);
    return [{ label: `${selectedDate.getDate()}/${selectedDate.getMonth() + 1}`, income: sumByType(dayTransactions, 'income'), expense: sumByType(dayTransactions, 'expense') }];
  }

  if (period === 'week') {
    const start = startOfWeek(now);
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index);
      const dayTransactions = transactions.filter(item => {
        const itemDate = new Date(item.date);
        return (
          itemDate.getFullYear() === date.getFullYear() &&
          itemDate.getMonth() === date.getMonth() &&
          itemDate.getDate() === date.getDate()
        );
      });

      return {
        label: `${date.getDate()}/${date.getMonth() + 1}`,
        income: sumByType(dayTransactions, 'income'),
        expense: sumByType(dayTransactions, 'expense'),
      };
    });
  }

  if (period === 'month') {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const bucketSize = Math.ceil(daysInMonth / 6);

    return Array.from({ length: 6 }, (_, index) => {
      const from = index * bucketSize + 1;
      const to = Math.min(daysInMonth, (index + 1) * bucketSize);
      const bucketTransactions = transactions.filter(item => {
        const date = new Date(item.date);
        return (
          date.getFullYear() === now.getFullYear() &&
          date.getMonth() === now.getMonth() &&
          date.getDate() >= from &&
          date.getDate() <= to
        );
      });

      return {
        label: `${from}-${to}`,
        income: sumByType(bucketTransactions, 'income'),
        expense: sumByType(bucketTransactions, 'expense'),
      };
    });
  }

  if (period === 'quarter') {
    const start = startOfQuarter(now);

    return Array.from({ length: 3 }, (_, index) => {
      const month = start.getMonth() + index;
      const monthTransactions = transactions.filter(item => {
        const date = new Date(item.date);
        return date.getFullYear() === start.getFullYear() && date.getMonth() === month;
      });

      return {
        label: `T${month + 1}`,
        income: sumByType(monthTransactions, 'income'),
        expense: sumByType(monthTransactions, 'expense'),
      };
    });
  }

  if (period === 'custom') {
    const from = parseInputDate(range.dateFrom) ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const to = parseInputDate(range.dateTo) ?? now;
    const days = Math.max(1, Math.min(31, Math.ceil((endOfDay(to).getTime() - from.getTime()) / 86400000) + 1));

    return Array.from({ length: days }, (_, index) => {
      const date = addDays(from, index);
      const dayTransactions = transactions.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate.getFullYear() === date.getFullYear() && itemDate.getMonth() === date.getMonth() && itemDate.getDate() === date.getDate();
      });

      return {
        label: `${date.getDate()}/${date.getMonth() + 1}`,
        income: sumByType(dayTransactions, 'income'),
        expense: sumByType(dayTransactions, 'expense'),
      };
    });
  }

  return Array.from({ length: 12 }, (_, month) => {
    const monthTransactions = transactions.filter(item => {
      const date = new Date(item.date);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === month;
    });

    return {
      label: `T${month + 1}`,
      income: sumByType(monthTransactions, 'income'),
      expense: sumByType(monthTransactions, 'expense'),
    };
  });
};

const buildCategoryStats = (transactions: TransactionItem[]) => {
  const totals = new Map<string, { total: number; icon?: string | null }>();

  transactions
    .filter(item => item.type === 'expense')
    .forEach(item => {
      const current = totals.get(item.category);
      totals.set(item.category, {
        total: (current?.total ?? 0) + item.displayAmount,
        icon: current?.icon ?? item.categoryIcon,
      });
    });

  return [...totals.entries()]
    .map(([category, value]) => ({ category, total: value.total, icon: value.icon }))
    .sort((left, right) => right.total - left.total)
    .slice(0, 6);
};

const buildTagStats = (transactions: TransactionItem[]) => {
  const totals = new Map<string, { total: number; count: number }>();

  transactions.forEach(item => {
    (item.tags ?? []).forEach(tag => {
      const current = totals.get(tag);
      totals.set(tag, { total: (current?.total ?? 0) + item.displayAmount, count: (current?.count ?? 0) + 1 });
    });
  });

  return [...totals.entries()]
    .map(([tag, value]) => ({ tag, total: value.total, count: value.count }))
    .sort((left, right) => right.total - left.total)
    .slice(0, 6);
};

const buildLinePath = (points: ChartPoint[], maxValue: number, key: 'income' | 'expense') =>
  points
    .map((point, index) => {
      const x = 24 + (index * 272) / Math.max(points.length - 1, 1);
      const y = 142 - (point[key] / maxValue) * 102;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

const buildLastSevenDays = (transactions: TransactionItem[]) => {
  const start = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), -6);

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    const dayTransactions = transactions.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate.getFullYear() === date.getFullYear() && itemDate.getMonth() === date.getMonth() && itemDate.getDate() === date.getDate();
    });

    return {
      label: `${date.getDate()}/${date.getMonth() + 1}`,
      income: sumByType(dayTransactions, 'income'),
      expense: sumByType(dayTransactions, 'expense'),
    };
  });
};

const buildCurrentMonthDailyPoints = (transactions: TransactionItem[]) => {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const dayTransactions = transactions.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate.getFullYear() === now.getFullYear() && itemDate.getMonth() === now.getMonth() && itemDate.getDate() === day;
    });

    return {
      label: `${day}`,
      income: sumByType(dayTransactions, 'income'),
      expense: sumByType(dayTransactions, 'expense'),
    };
  });
};

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
};

const donutColors = ['#FF8C00', '#188F5A', '#0EA5E9', '#8B5CF6', '#F0AA24', '#D85F3F'];

type CategoryBudgetStat = {
  category: string;
  icon?: string | null;
  spentAmount: number;
  limitAmount: number;
};

const StatisticsScreen = ({ navigation }: Props) => {
  const { token, user } = useAuth();
  const { transactions, preferredCurrency } = useFinance();
  const [period, setPeriod] = useState<PeriodMode>('month');
  const [activeTab, setActiveTab] = useState<StatisticsTab>('overview');
  const [selectedDate, setSelectedDate] = useState(formatDateInput(now));
  const [dateFrom, setDateFrom] = useState(formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [dateTo, setDateTo] = useState(formatDateInput(now));
  const [apiStats, setApiStats] = useState<StatisticsResponse | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [exportingFormat, setExportingFormat] = useState<'excel' | 'pdf' | null>(null);
  const [isEmailModalVisible, setIsEmailModalVisible] = useState(false);
  const [reportEmail, setReportEmail] = useState(user?.email ?? '');
  const hasFullStats = user?.role === 'PREMIUM' || user?.role === 'ADMIN';
  const visibleTabs: StatisticsTab[] = hasFullStats ? ['overview', 'trend', 'category', 'budget'] : ['overview', 'trend'];
  const shouldShowPeriodFilter = activeTab === 'trend';
  const periodRange = useMemo(() => ({ selectedDate, dateFrom, dateTo }), [dateFrom, dateTo, selectedDate]);
  const canUseApiStats = period === 'day' || period === 'week' || period === 'month' || period === 'year';

  useEffect(() => {
    if (!token || !canUseApiStats) {
      setApiStats(null);
      return;
    }

    setIsLoadingStats(true);
    setStatsError('');
    statisticsService
      .get(token, period)
      .then(setApiStats)
      .catch(error => {
        setApiStats(null);
        setStatsError(error instanceof Error ? error.message : 'Không thể tải thống kê.');
      })
      .finally(() => setIsLoadingStats(false));
  }, [canUseApiStats, period, token]);

  const periodTransactions = useMemo(() => filterByPeriod(transactions, period, periodRange), [period, periodRange, transactions]);
  const previousTransactions = useMemo(() => filterPreviousPeriod(transactions, period, periodRange), [period, periodRange, transactions]);
  const monthTransactions = useMemo(() => filterByPeriod(transactions, 'month'), [transactions]);
  const previousMonthTransactions = useMemo(() => filterPreviousPeriod(transactions, 'month'), [transactions]);
  const chartPoints = useMemo(
    () => (canUseApiStats ? apiStats?.chart : undefined) ?? buildChartPoints(transactions, period, periodRange),
    [apiStats, canUseApiStats, period, periodRange, transactions],
  );
  const categoryStats = useMemo(
    () =>
      canUseApiStats && apiStats
        ? apiStats.categories.map(item => ({ category: item.name, total: item.total, icon: item.icon }))
        : buildCategoryStats(periodTransactions),
    [apiStats, canUseApiStats, periodTransactions],
  );
  const tagStats = useMemo(
    () => (canUseApiStats ? apiStats?.hot_hashtags ?? apiStats?.tags : undefined) ?? buildTagStats(periodTransactions),
    [apiStats, canUseApiStats, periodTransactions],
  );
  const monthTagStats = useMemo(() => buildTagStats(monthTransactions), [monthTransactions]);
  const monthlyTrend = useMemo(
    () =>
      (canUseApiStats ? apiStats?.monthly_trend : undefined) ??
      buildChartPoints(transactions, 'year').map(item => ({ ...item, net: item.income - item.expense })),
    [apiStats, canUseApiStats, transactions],
  );
  const recentSevenDays = useMemo(() => buildLastSevenDays(transactions), [transactions]);
  const monthDailyPoints = useMemo(() => buildCurrentMonthDailyPoints(transactions), [transactions]);
  const categoryBudgets = useMemo<CategoryBudgetStat[]>(() => {
    const statsWithBudgets = apiStats as
      | (StatisticsResponse & {
          category_budgets?: Array<{
            name?: string;
            category?: string;
            icon?: string | null;
            spent?: number;
            spentAmount?: number;
            total?: number;
            limit?: number;
            limitAmount?: number;
            budget?: number;
          }>;
          categoryBudgets?: Array<{
            name?: string;
            category?: string;
            icon?: string | null;
            spent?: number;
            spentAmount?: number;
            total?: number;
            limit?: number;
            limitAmount?: number;
            budget?: number;
          }>;
        })
      | null;
    const rawBudgets = statsWithBudgets?.category_budgets ?? statsWithBudgets?.categoryBudgets ?? [];

    return rawBudgets
      .map(item => ({
        category: item.name ?? item.category ?? 'Danh mục',
        icon: item.icon ?? null,
        spentAmount: Number(item.spentAmount ?? item.spent ?? item.total ?? 0),
        limitAmount: Number(item.limitAmount ?? item.limit ?? item.budget ?? 0),
      }))
      .filter(item => item.limitAmount > 0);
  }, [apiStats]);

  const income = (canUseApiStats ? apiStats?.summary.income : undefined) ?? sumByType(periodTransactions, 'income');
  const expense = (canUseApiStats ? apiStats?.summary.expense : undefined) ?? sumByType(periodTransactions, 'expense');
  const net = (canUseApiStats ? apiStats?.summary.net : undefined) ?? income - expense;
  const monthIncome = sumByType(monthTransactions, 'income');
  const monthExpense = sumByType(monthTransactions, 'expense');
  const monthNet = monthIncome - monthExpense;
  const transactionCount = (canUseApiStats ? apiStats?.summary.transactionCount : undefined) ?? periodTransactions.length;
  const previousExpense = sumByType(previousTransactions, 'expense');
  const previousMonthExpense = sumByType(previousMonthTransactions, 'expense');
  const expenseChangePercent =
    (canUseApiStats ? apiStats?.comparison.expense_change_percent : undefined) ??
    (previousExpense > 0 ? Math.round(((expense - previousExpense) / previousExpense) * 100) : null);
  const monthExpenseChangePercent =
    previousMonthExpense > 0 ? Math.round(((monthExpense - previousMonthExpense) / previousMonthExpense) * 100) : null;
  const averageExpense =
    (canUseApiStats ? apiStats?.summary.averageExpense : undefined) ??
    (periodTransactions.filter(item => item.type === 'expense').length > 0
      ? expense / periodTransactions.filter(item => item.type === 'expense').length
      : 0);
  const monthAverageExpense =
    monthTransactions.filter(item => item.type === 'expense').length > 0
      ? monthExpense / monthTransactions.filter(item => item.type === 'expense').length
      : 0;
  const topCategory = categoryStats[0];
  const displayCurrency = apiStats?.display_currency ?? preferredCurrency;
  const maxChartValue = Math.max(1, ...chartPoints.flatMap(item => [item.income, item.expense]));
  const incomePath = buildLinePath(chartPoints, maxChartValue, 'income');
  const expensePath = buildLinePath(chartPoints, maxChartValue, 'expense');
  const maxTrendValue = Math.max(1, ...monthlyTrend.flatMap(item => [item.income, item.expense]));
  const maxRecentExpense = Math.max(1, ...recentSevenDays.map(item => item.expense));
  const maxMonthDailyExpense = Math.max(1, ...monthDailyPoints.map(item => item.expense));
  const totalCategoryExpense = categoryStats.reduce((total, item) => total + item.total, 0);
  const recentTransactions = transactions.slice(0, 5);
  const recordedDaysCount = new Set(
    monthTransactions.map(item => new Date(item.date)).map(date => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`),
  ).size;
  const daysElapsedInMonth = Math.max(1, now.getDate());
  const monthAverageDailyExpense = monthExpense / daysElapsedInMonth;
  const selectedDayTransactions = useMemo(
    () => filterByPeriod(transactions, 'day', { selectedDate }),
    [selectedDate, transactions],
  );
  const selectedDayIncome = sumByType(selectedDayTransactions, 'income');
  const selectedDayExpense = sumByType(selectedDayTransactions, 'expense');
  let donutStartAngle = 0;

  const showPremiumPrompt = () => {
    Alert.alert(
      'Tính năng dành cho Premium',
      'Nâng cấp Premium để mở khóa thống kê danh mục, ngân sách chi tiêu và báo cáo nâng cao.',
    );
  };

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (!token) {
      Alert.alert('Phiên đăng nhập', 'Vui lòng đăng nhập lại để xuất báo cáo.');
      return;
    }

    if (!hasFullStats) {
      showPremiumPrompt();
      return;
    }

    if (!canUseApiStats) {
      Alert.alert('Chưa hỗ trợ xuất báo cáo', 'Xuất báo cáo hiện hỗ trợ Ngày, Tuần, Tháng và Năm.');
      return;
    }

    if (format === 'excel') {
      setReportEmail(user?.email ?? reportEmail);
      setIsEmailModalVisible(true);
      return;
    }

    try {
      setExportingFormat(format);
      const report = await statisticsService.exportReport(token, period as StatisticsPeriod, format);
      const targetDirectory = RNFS.DownloadDirectoryPath || RNFS.DocumentDirectoryPath;
      const targetPath = `${targetDirectory}/${report.filename}`;

      await RNFS.writeFile(targetPath, report.base64, 'base64');
      Alert.alert('Đã xuất báo cáo', `File đã được lưu tại:\n${targetPath}`);
    } catch (error) {
      Alert.alert('Không thể xuất báo cáo', error instanceof Error ? error.message : 'Vui lòng thử lại sau.');
    } finally {
      setExportingFormat(null);
    }
  };

  const handleSendExcelReport = async () => {
    if (!token) {
      Alert.alert('Phiên đăng nhập', 'Vui lòng đăng nhập lại để gửi báo cáo.');
      return;
    }

    const email = reportEmail.trim();

    if (!email) {
      Alert.alert('Thiếu email', 'Vui lòng nhập email nhận báo cáo.');
      return;
    }

    try {
      setExportingFormat('excel');
      if (!canUseApiStats) {
        Alert.alert('Chưa hỗ trợ gửi báo cáo', 'Gửi báo cáo hiện hỗ trợ Ngày, Tuần, Tháng và Năm.');
        return;
      }
      const response = await statisticsService.sendExcelReport(token, period as StatisticsPeriod, email);
      setIsEmailModalVisible(false);
      Alert.alert('Đã gửi báo cáo', response.message);
    } catch (error) {
      Alert.alert('Không thể gửi báo cáo', error instanceof Error ? error.message : 'Vui lòng thử lại sau.');
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#4A2B1A" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Thống kê</Text>
          <Text style={styles.headerMeta}>{hasFullStats ? 'Phân tích nâng cao' : 'Chế độ cơ bản'}</Text>
        </View>
        {hasFullStats ? (
          <TouchableOpacity style={styles.mailButton} onPress={() => handleExport('excel')}>
            <Mail size={19} color={Colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.tabRow}>
          {visibleTabs.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabChip, activeTab === tab && styles.tabChipActive]}
              onPress={() => setActiveTab(tab)}>
              {tab === 'overview' ? <Sparkles size={14} color={activeTab === tab ? Colors.white : '#8B6548'} /> : null}
              {tab === 'trend' ? <BarChart3 size={14} color={activeTab === tab ? Colors.white : '#8B6548'} /> : null}
              {tab === 'category' ? <PieChart size={14} color={activeTab === tab ? Colors.white : '#8B6548'} /> : null}
              {tab === 'budget' ? <Target size={14} color={activeTab === tab ? Colors.white : '#8B6548'} /> : null}
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tabLabels[tab]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!hasFullStats ? (
          <TouchableOpacity style={styles.upgradeCard} onPress={showPremiumPrompt}>
            <View style={styles.upgradeIcon}>
              <Lock size={18} color={Colors.primary} />
            </View>
            <View style={styles.upgradeCopy}>
              <Text style={styles.upgradeTitle}>Thống kê nâng cao dành cho Premium</Text>
              <Text style={styles.upgradeText}>Mở Danh mục, Ngân sách, donut chart và insight tự động.</Text>
            </View>
            <ChevronRight size={19} color="#9A7255" />
          </TouchableOpacity>
        ) : null}

        {shouldShowPeriodFilter ? (
          <>
            <View style={styles.periodRow}>
              {(['day', 'week', 'month', 'quarter', 'year', 'custom'] as PeriodMode[]).map(item => (
                <TouchableOpacity
                  key={item}
                  style={[styles.periodChip, period === item && styles.periodChipActive]}
                  onPress={() => setPeriod(item)}>
                  <Text style={[styles.periodText, period === item && styles.periodTextActive]}>{periodLabels[item]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {period === 'custom' ? (
              <View style={styles.dateRangeRow}>
                <View style={styles.dateInputWrap}>
                  <Text style={styles.dateInputLabel}>Từ ngày</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={dateFrom}
                    onChangeText={setDateFrom}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#B58A6A"
                  />
                </View>
                <View style={styles.dateInputWrap}>
                  <Text style={styles.dateInputLabel}>Đến ngày</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={dateTo}
                    onChangeText={setDateTo}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#B58A6A"
                  />
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {activeTab === 'overview' ? (
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Số dư còn lại tháng này</Text>
            {isLoadingStats ? <ActivityIndicator color={Colors.white} /> : null}
          </View>
          <Text style={[styles.balanceAmount, monthNet < 0 && styles.balanceNegative]}>
            {formatCurrency(monthNet, displayCurrency)}
          </Text>
          <Text style={styles.balanceNote}>Tính bằng tổng thu trong tháng trừ tổng chi trong tháng.</Text>
          {statsError ? <Text style={styles.statsError}>{statsError}</Text> : null}

          <View style={styles.cashFlowRow}>
            <View style={styles.cashFlowItem}>
              <View style={styles.incomeIcon}>
                <TrendingUp size={17} color="#188F5A" />
              </View>
              <Text style={styles.cashFlowLabel}>Thu</Text>
              <Text style={styles.cashFlowValue}>{formatCompactCurrency(monthIncome, displayCurrency)}</Text>
            </View>
            <View style={styles.cashFlowDivider} />
            <View style={styles.cashFlowItem}>
              <View style={styles.expenseIcon}>
                <TrendingDown size={17} color="#D4621D" />
              </View>
              <Text style={styles.cashFlowLabel}>Chi</Text>
              <Text style={styles.cashFlowValue}>{formatCompactCurrency(monthExpense, displayCurrency)}</Text>
            </View>
            <View style={styles.cashFlowDivider} />
            <View style={styles.cashFlowItem}>
              <View style={styles.walletIcon}>
                <WalletCards size={17} color={Colors.primary} />
              </View>
              <Text style={styles.cashFlowLabel}>Giao dịch</Text>
              <Text style={styles.cashFlowValue}>{monthTransactions.length}</Text>
            </View>
          </View>
        </View>
        ) : null}

        {activeTab === 'overview' ? (
          <View style={styles.statGrid}>
            <View style={styles.statCard}>
              <View style={styles.incomeIcon}>
                <TrendingUp size={16} color="#188F5A" />
              </View>
              <Text style={styles.statLabel}>Tổng thu tháng này</Text>
              <Text style={styles.statValue}>{formatCompactCurrency(monthIncome, displayCurrency)}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.expenseIcon}>
                <TrendingDown size={16} color="#D4621D" />
              </View>
              <Text style={styles.statLabel}>Tổng chi tháng này</Text>
              <Text style={styles.statValue}>{formatCompactCurrency(monthExpense, displayCurrency)}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.walletIcon}>
                <WalletCards size={16} color={Colors.primary} />
              </View>
              <Text style={styles.statLabel}>Số giao dịch tháng này</Text>
              <Text style={styles.statValue}>{monthTransactions.length}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.expenseIcon}>
                <BarChart3 size={16} color="#D4621D" />
              </View>
              <Text style={styles.statLabel}>Chi tiêu trung bình/ngày</Text>
              <Text style={styles.statValue}>{formatCompactCurrency(monthAverageDailyExpense, displayCurrency)}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.walletIcon}>
                <Sparkles size={16} color={Colors.primary} />
              </View>
              <Text style={styles.statLabel}>Số ngày đã ghi chép</Text>
              <Text style={styles.statValue}>{recordedDaysCount}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.walletIcon}>
                <WalletCards size={16} color={Colors.primary} />
              </View>
              <Text style={styles.statLabel}>Số dư còn lại tháng này</Text>
              <Text style={styles.statValue}>{formatCompactCurrency(monthNet, displayCurrency)}</Text>
            </View>
          </View>
        ) : null}

        {activeTab === 'overview' ? (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.cardTitle}>Giao dịch gần đây</Text>
              <Text style={styles.sectionMeta}>5 mới nhất</Text>
            </View>
            {recentTransactions.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có giao dịch gần đây.</Text>
            ) : (
              <View style={styles.recentList}>
                {recentTransactions.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.recentRow}
                    onPress={() => navigation.navigate('TransactionDetail', { transaction: item })}>
                    <View style={[styles.recentIcon, item.type === 'income' ? styles.incomeIcon : styles.expenseIcon]}>
                      <CategoryIcon icon={item.categoryIcon ?? null} size={18} />
                    </View>
                    <View style={styles.recentCopy}>
                      <Text style={styles.recentTitle} numberOfLines={1}>{item.note || item.category}</Text>
                      <Text style={styles.recentMeta} numberOfLines={1}>{item.category} · {item.wallet}</Text>
                    </View>
                    <Text style={[styles.recentAmount, item.type === 'income' ? styles.incomeAmount : styles.expenseAmount]}>
                      {item.type === 'income' ? '+' : '-'}{formatCurrency(item.displayAmount, displayCurrency)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {activeTab === 'trend' ? (
        <>
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Thống kê một ngày</Text>
            <Text style={styles.sectionMeta}>Chi tiết</Text>
          </View>
          <View style={styles.singleDateRow}>
            <TextInput
              style={styles.singleDateInput}
              value={selectedDate}
              onChangeText={setSelectedDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#B58A6A"
            />
            <View style={styles.singleDateSummary}>
              <Text style={styles.singleDateLabel}>Thu</Text>
              <Text style={styles.singleDateIncome}>{formatCompactCurrency(selectedDayIncome, displayCurrency)}</Text>
            </View>
            <View style={styles.singleDateSummary}>
              <Text style={styles.singleDateLabel}>Chi</Text>
              <Text style={styles.singleDateExpense}>{formatCompactCurrency(selectedDayExpense, displayCurrency)}</Text>
            </View>
          </View>
          {selectedDayTransactions.length === 0 ? (
            <Text style={styles.emptyText}>Ngày này chưa có giao dịch.</Text>
          ) : (
            <View style={styles.recentList}>
              {selectedDayTransactions.slice(0, 5).map(item => (
                <TouchableOpacity
                  key={`selected-day-${item.id}`}
                  style={styles.recentRow}
                  onPress={() => navigation.navigate('TransactionDetail', { transaction: item })}>
                  <View style={[styles.recentIcon, item.type === 'income' ? styles.incomeIcon : styles.expenseIcon]}>
                    <CategoryIcon icon={item.categoryIcon ?? null} size={18} />
                  </View>
                  <View style={styles.recentCopy}>
                    <Text style={styles.recentTitle} numberOfLines={1}>{item.note || item.category}</Text>
                    <Text style={styles.recentMeta} numberOfLines={1}>{item.category} · {item.wallet}</Text>
                  </View>
                  <Text style={[styles.recentAmount, item.type === 'income' ? styles.incomeAmount : styles.expenseAmount]}>
                    {item.type === 'income' ? '+' : '-'}{formatCurrency(item.displayAmount, displayCurrency)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Chi tiêu theo ngày</Text>
            <Text style={styles.sectionMeta}>Tháng này</Text>
          </View>
          <Svg width="100%" height={170} viewBox="0 0 320 170">
            <Rect x="18" y="18" width="284" height="108" rx="18" fill="#FFF3E7" />
            {monthDailyPoints.map((point, index) => {
              const height = Math.max(3, (point.expense / maxMonthDailyExpense) * 86);
              const x = 26 + index * (268 / Math.max(monthDailyPoints.length - 1, 1));

              return (
                <React.Fragment key={`month-day-${point.label}`}>
                  <Rect x={x} y={116 - height} width={5} height={height} rx="3" fill={point.expense > 0 ? Colors.primary : '#F4C99E'} />
                  {(index + 1 === 1 || (index + 1) % 5 === 0 || index + 1 === monthDailyPoints.length) ? (
                    <SvgText x={x + 2.5} y="150" fontSize="9" fill="#8B6548" textAnchor="middle">
                      {point.label}
                    </SvgText>
                  ) : null}
                </React.Fragment>
              );
            })}
          </Svg>
          <Text style={styles.chartHint}>Mỗi cột là tổng chi của một ngày trong tháng hiện tại.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Dòng tiền</Text>
            <Text style={styles.sectionMeta}>{periodLabels[period]}</Text>
          </View>
          <Svg width="100%" height={190} viewBox="0 0 320 190">
            <Rect x="18" y="26" width="284" height="124" rx="18" fill="#FFF3E7" />
            <Path d={incomePath} stroke="#188F5A" strokeWidth="4" fill="none" strokeLinecap="round" />
            <Path d={expensePath} stroke="#D87219" strokeWidth="4" fill="none" strokeLinecap="round" />
            {chartPoints.map((point, index) => {
              const x = 24 + (index * 272) / Math.max(chartPoints.length - 1, 1);
              const incomeY = 142 - (point.income / maxChartValue) * 102;
              const expenseY = 142 - (point.expense / maxChartValue) * 102;

              return (
                <React.Fragment key={`${point.label}-${index}`}>
                  <Circle cx={x} cy={incomeY} r="4" fill="#188F5A" />
                  <Circle cx={x} cy={expenseY} r="4" fill="#D87219" />
                  {(chartPoints.length <= 7 || index % 2 === 0) && (
                    <SvgText x={x} y="176" fontSize="10" fill="#8B6548" textAnchor="middle">
                      {point.label}
                    </SvgText>
                  )}
                </React.Fragment>
              );
            })}
          </Svg>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.incomeDot]} />
              <Text style={styles.legendText}>Thu nhập</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.expenseDot]} />
              <Text style={styles.legendText}>Chi tiêu</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>7 ngày gần nhất</Text>
            <Text style={styles.sectionMeta}>Chi tiêu</Text>
          </View>
          <Svg width="100%" height={160} viewBox="0 0 320 160">
            <Rect x="18" y="18" width="284" height="104" rx="18" fill="#FFF3E7" />
            {recentSevenDays.map((point, index) => {
              const height = Math.max(4, (point.expense / maxRecentExpense) * 82);
              const x = 34 + index * 39;

              return (
                <React.Fragment key={`recent-${point.label}`}>
                  <Rect x={x} y={112 - height} width={20} height={height} rx="8" fill={index === recentSevenDays.length - 1 ? Colors.primary : '#F2B36D'} />
                  <SvgText x={x + 10} y="144" fontSize="10" fill="#8B6548" textAnchor="middle">
                    {point.label}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        </View>
        </>
        ) : null}

        {hasFullStats && activeTab === 'category' ? (
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Chi tiêu theo danh mục</Text>
            <View style={styles.lockPill}>
              <PieChart size={12} color="#9A7255" />
              <Text style={styles.lockText}>Premium</Text>
            </View>
          </View>
          {categoryStats.length === 0 ? (
            <Text style={styles.emptyText}>Chưa có dữ liệu chi trong kỳ này.</Text>
          ) : (
            <>
              {hasFullStats && totalCategoryExpense > 0 ? (
                <View style={styles.donutRow}>
                  <Svg width={142} height={142} viewBox="0 0 142 142">
                    <Circle cx="71" cy="71" r="48" stroke="#FFE3C8" strokeWidth="18" fill="none" />
                    {categoryStats.slice(0, 6).map((item, index) => {
                      const angle = (item.total / totalCategoryExpense) * 360;
                      const path = describeArc(71, 71, 48, donutStartAngle, donutStartAngle + angle);
                      donutStartAngle += angle;

                      return (
                        <Path
                          key={`donut-${item.category}`}
                          d={path}
                          stroke={donutColors[index % donutColors.length]}
                          strokeWidth="18"
                          fill="none"
                          strokeLinecap="round"
                        />
                      );
                    })}
                    <SvgText x="71" y="67" fontSize="12" fill="#8B6548" textAnchor="middle" fontWeight="700">
                      Tổng chi
                    </SvgText>
                    <SvgText x="71" y="86" fontSize="13" fill="#4A2B1A" textAnchor="middle" fontWeight="900">
                      {formatCompactCurrency(totalCategoryExpense, displayCurrency)}
                    </SvgText>
                  </Svg>
                  <View style={styles.donutLegend}>
                    {categoryStats.slice(0, 4).map((item, index) => (
                      <View key={`legend-${item.category}`} style={styles.donutLegendRow}>
                        <View style={[styles.donutLegendDot, { backgroundColor: donutColors[index % donutColors.length] }]} />
                        <Text style={styles.donutLegendText} numberOfLines={1}>{item.category}</Text>
                        <Text style={styles.donutLegendAmount}>{Math.round((item.total / totalCategoryExpense) * 100)}%</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {categoryStats.slice(0, 6).map(item => {
                const width = `${Math.max(8, (item.total / Math.max(topCategory?.total ?? 1, 1)) * 100)}%` as const;

                return (
                  <View key={item.category} style={styles.categoryRow}>
                    <View style={styles.categoryHeader}>
                      <View style={styles.categoryNameWrap}>
                        <CategoryIcon icon={item.icon ?? null} size={20} />
                        <Text style={styles.categoryName}>{item.category}</Text>
                      </View>
                      <Text style={styles.categoryAmount}>{formatCurrency(item.total, displayCurrency)}</Text>
                    </View>
                    <View style={styles.categoryTrack}>
                      <View style={[styles.categoryFill, { width }]} />
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>
        ) : null}

        {hasFullStats && activeTab === 'trend' ? (
          <>
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.cardTitle}>Xu hướng theo tháng</Text>
                <Text style={styles.sectionMeta}>Năm nay</Text>
              </View>
              <Svg width="100%" height={190} viewBox="0 0 320 190">
                <Rect x="18" y="22" width="284" height="124" rx="18" fill="#FFF3E7" />
                {monthlyTrend.map((point, index) => {
                  const x = 25 + index * 23;
                  const incomeHeight = Math.max(2, (point.income / maxTrendValue) * 100);
                  const expenseHeight = Math.max(2, (point.expense / maxTrendValue) * 100);

                  return (
                    <React.Fragment key={`trend-${point.label}`}>
                      <Rect x={x} y={136 - incomeHeight} width={9} height={incomeHeight} rx="3" fill="#188F5A" />
                      <Rect x={x + 10} y={136 - expenseHeight} width={9} height={expenseHeight} rx="3" fill="#D87219" />
                      {(index + 1) % 2 === 0 ? (
                        <SvgText x={x + 10} y="168" fontSize="9" fill="#8B6548" textAnchor="middle">
                          {point.label}
                        </SvgText>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </Svg>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Hashtag nổi bật</Text>
              {tagStats.length === 0 ? (
                <Text style={styles.emptyText}>Chưa có hashtag trong kỳ này.</Text>
              ) : (
                <View style={styles.tagList}>
                  {tagStats.map((item, index) => (
                    <View key={item.tag} style={styles.tagRow}>
                      <View style={styles.rankBadge}>
                        <Text style={styles.rankText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.tagName}>#{item.tag}</Text>
                      <Text style={styles.tagAmount}>
                        {item.count ? `${item.count} lần · ` : ''}
                        {formatCompactCurrency(item.total, displayCurrency)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : null}

        {((!hasFullStats && (activeTab === 'overview' || activeTab === 'trend')) || (hasFullStats && activeTab === 'overview')) ? (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.cardTitle}>Thống kê theo hashtag</Text>
              <Hash size={18} color={Colors.primary} />
            </View>
            {monthTagStats.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có hashtag trong giao dịch tháng này.</Text>
            ) : (
              <View style={styles.tagList}>
                {monthTagStats.map((item, index) => (
                  <View key={`month-${item.tag}`} style={styles.tagRow}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.tagName}>#{item.tag}</Text>
                    <Text style={styles.tagAmount}>
                      {item.count ? `${item.count} lần · ` : ''}
                      {formatCompactCurrency(item.total, displayCurrency)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {hasFullStats && activeTab === 'budget' ? (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.cardTitle}>Ngân sách danh mục</Text>
              <Target size={18} color={Colors.primary} />
            </View>
            {categoryBudgets.length === 0 ? (
              <>
                <Text style={styles.emptyTitle}>Chưa có ngân sách danh mục</Text>
                <Text style={styles.emptyText}>Hãy tạo ngân sách cho từng danh mục để theo dõi phần trăm đã sử dụng và nhận cảnh báo khi sắp vượt hạn mức.</Text>
              </>
            ) : (
              <View style={styles.budgetList}>
                {categoryBudgets.map(item => {
                  const percent = (item.spentAmount / item.limitAmount) * 100;
                  const status =
                    percent >= 100 ? 'Đã vượt ngân sách' : percent >= 80 ? 'Sắp vượt ngân sách' : 'An toàn';
                  const progressWidth = `${Math.min(100, Math.max(3, percent))}%` as const;

                  return (
                    <View key={item.category} style={styles.budgetRow}>
                      <View style={styles.categoryHeader}>
                        <View style={styles.categoryNameWrap}>
                          <CategoryIcon icon={item.icon ?? null} size={20} />
                          <Text style={styles.categoryName}>{item.category}</Text>
                        </View>
                        <Text style={[styles.budgetStatus, percent >= 80 && styles.dangerText]}>{status}</Text>
                      </View>
                      <View style={styles.categoryTrack}>
                        <View style={[styles.categoryFill, percent >= 100 && styles.budgetDangerFill, { width: progressWidth }]} />
                      </View>
                      <View style={styles.budgetMetaRow}>
                        <Text style={styles.budgetMeta}>
                          {formatCurrency(item.spentAmount, displayCurrency)} / {formatCurrency(item.limitAmount, displayCurrency)}
                        </Text>
                        <Text style={styles.budgetPercent}>{Math.round(percent)}%</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {activeTab === 'overview' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nhận định nhanh</Text>
          <Text style={styles.insightText}>
            {monthTransactions.length === 0
              ? 'Bạn chưa có dữ liệu chi tiêu trong tháng này.'
              : monthExpense > monthIncome
                ? 'Tháng này bạn đang chi nhiều hơn thu nhập.'
                : 'Tháng này dòng tiền của bạn đang ổn định.'}
          </Text>
          <View style={styles.insightGrid}>
            <View style={styles.insightBox}>
              <Text style={styles.insightLabel}>Chi so với tháng trước</Text>
              <Text style={[styles.insightValue, (monthExpenseChangePercent ?? 0) > 0 && styles.dangerText]}>
                {monthExpenseChangePercent === null ? '-' : `${monthExpenseChangePercent > 0 ? '+' : ''}${monthExpenseChangePercent}%`}
              </Text>
            </View>
            <View style={styles.insightBox}>
              <Text style={styles.insightLabel}>Chi TB/giao dịch</Text>
              <Text style={styles.insightValue}>{formatCompactCurrency(monthAverageExpense, displayCurrency)}</Text>
            </View>
          </View>
          {hasFullStats && topCategory ? (
            <Text style={styles.insightMeta}>
              Danh mục chi nhiều nhất: {topCategory.category} · {formatCurrency(topCategory.total, displayCurrency)}
            </Text>
          ) : null}
        </View>
        ) : null}

        {hasFullStats && activeTab === 'overview' ? (
        <View style={styles.reportCard}>
          <View style={styles.reportCopy}>
            <Text style={styles.reportTitle}>Báo cáo</Text>
            <Text style={styles.reportText}>
              {hasFullStats ? 'Xuất PDF hoặc gửi Excel qua email.' : 'Premium được xuất PDF và Excel.'}
            </Text>
          </View>
          <View style={styles.reportActions}>
            <TouchableOpacity style={styles.reportButton} onPress={() => handleExport('excel')}>
              <FileSpreadsheet size={16} color={hasFullStats ? Colors.primary : '#9A7255'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.reportButton} onPress={() => handleExport('pdf')}>
              {exportingFormat === 'pdf' ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <FileText size={16} color={hasFullStats ? Colors.primary : '#9A7255'} />
              )}
            </TouchableOpacity>
          </View>
        </View>
        ) : null}
      </ScrollView>

      <Modal transparent visible={isEmailModalVisible} animationType="slide" onRequestClose={() => setIsEmailModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}>
          <Pressable style={styles.backdropPressable} onPress={() => setIsEmailModalVisible(false)} />
          <View style={styles.emailModalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.emailModalTitle}>Gửi báo cáo Excel</Text>
            <Text style={styles.emailModalText}>Nhập email bạn muốn nhận file báo cáo chi tiêu.</Text>
            <Text style={styles.emailLabel}>Email nhận báo cáo</Text>
            <TextInput
              style={styles.emailInput}
              value={reportEmail}
              onChangeText={setReportEmail}
              placeholder="ten@email.com"
              placeholderTextColor="#B58A6A"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.emailActions}>
              <TouchableOpacity
                style={styles.secondaryModalButton}
                onPress={() => setIsEmailModalVisible(false)}
                disabled={exportingFormat === 'excel'}>
                <Text style={styles.secondaryModalText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryModalButton}
                onPress={handleSendExcelReport}
                disabled={exportingFormat === 'excel'}>
                {exportingFormat === 'excel' ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.primaryModalText}>Gửi Excel</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF3E8' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: '#E8B680',
  },
  headerCopy: { flex: 1 },
  headerTitle: { color: '#4A2B1A', fontSize: 24, fontWeight: '900' },
  headerMeta: { color: '#8B6548', fontWeight: '700', marginTop: 2 },
  mailButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: '#E8B680',
  },
  headerSpacer: { width: 42, height: 42 },
  content: { padding: 16, paddingBottom: 34, gap: 14 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFE3C8',
    borderRadius: 18,
    padding: 4,
    gap: 4,
  },
  tabChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  tabChipActive: { backgroundColor: Colors.primary },
  tabText: { color: '#8B6548', fontSize: 12, fontWeight: '900' },
  tabTextActive: { color: Colors.white },
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 14,
  },
  upgradeIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeCopy: { flex: 1 },
  upgradeTitle: { color: '#4A2B1A', fontWeight: '900' },
  upgradeText: { color: '#8B6548', fontSize: 12, fontWeight: '700', marginTop: 3, lineHeight: 17 },
  periodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#FFE3C8',
    borderRadius: 18,
    padding: 4,
    gap: 4,
  },
  periodChip: {
    flexGrow: 1,
    flexBasis: '30%',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  periodChipActive: { backgroundColor: Colors.white },
  periodText: { color: '#8B6548', fontWeight: '900' },
  periodTextActive: { color: Colors.primary },
  dateRangeRow: { flexDirection: 'row', gap: 10 },
  dateInputWrap: { flex: 1 },
  dateInputLabel: { color: '#7A4A28', fontSize: 12, fontWeight: '900', marginBottom: 6 },
  dateInput: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8B680',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    color: '#4A2B1A',
    fontWeight: '800',
  },
  balanceCard: {
    backgroundColor: Colors.primary,
    borderRadius: 28,
    padding: 18,
    shadowColor: '#7A3E12',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  balanceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLabel: { color: '#FFF5EA', fontWeight: '800' },
  balanceAmount: { color: Colors.white, fontSize: 34, fontWeight: '900', marginTop: 8 },
  balanceNote: { color: '#FFF5EA', fontSize: 12, fontWeight: '700', marginTop: 6, lineHeight: 17 },
  balanceNegative: { color: '#FFE1D3' },
  statsError: { color: '#FFF5EA', fontSize: 12, fontWeight: '700', marginTop: 8 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '48%',
    minHeight: 124,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 12,
    justifyContent: 'space-between',
  },
  statLabel: { color: '#8B6548', fontSize: 12, fontWeight: '800', lineHeight: 17, marginTop: 8 },
  statValue: { color: '#4A2B1A', fontSize: 18, fontWeight: '900', marginTop: 6 },
  cashFlowRow: {
    flexDirection: 'row',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.94)',
    marginTop: 18,
    padding: 12,
  },
  cashFlowItem: { flex: 1, alignItems: 'center' },
  cashFlowDivider: { width: 1, backgroundColor: '#F0D6C1', marginHorizontal: 6 },
  incomeIcon: { width: 30, height: 30, borderRadius: 12, backgroundColor: '#E9F8EF', alignItems: 'center', justifyContent: 'center' },
  expenseIcon: { width: 30, height: 30, borderRadius: 12, backgroundColor: '#FFF0DF', alignItems: 'center', justifyContent: 'center' },
  walletIcon: { width: 30, height: 30, borderRadius: 12, backgroundColor: '#FFF0DF', alignItems: 'center', justifyContent: 'center' },
  cashFlowLabel: { color: '#8B6548', fontSize: 12, fontWeight: '800', marginTop: 7 },
  cashFlowValue: { color: '#4A2B1A', fontWeight: '900', marginTop: 3 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1.2,
    borderColor: '#E8B680',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardTitle: { color: '#4A2B1A', fontSize: 18, fontWeight: '900' },
  sectionMeta: { color: '#8B6548', fontWeight: '800' },
  legendRow: { flexDirection: 'row', gap: 18, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  incomeDot: { backgroundColor: '#188F5A' },
  expenseDot: { backgroundColor: '#D87219' },
  legendText: { color: '#8B6548', fontWeight: '800' },
  chartHint: { color: '#8B6548', fontSize: 12, fontWeight: '700', lineHeight: 18 },
  singleDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  singleDateInput: {
    flex: 1.2,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8B680',
    backgroundColor: '#FFFDFB',
    paddingHorizontal: 12,
    color: '#4A2B1A',
    fontWeight: '800',
  },
  singleDateSummary: { flex: 1, borderRadius: 16, backgroundColor: '#FFF0DF', padding: 10 },
  singleDateLabel: { color: '#8B6548', fontSize: 11, fontWeight: '800' },
  singleDateIncome: { color: '#188F5A', fontSize: 13, fontWeight: '900', marginTop: 4 },
  singleDateExpense: { color: '#D4621D', fontSize: 13, fontWeight: '900', marginTop: 4 },
  lockPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: '#FFF0DF', paddingHorizontal: 9, paddingVertical: 6 },
  lockText: { color: '#9A7255', fontSize: 12, fontWeight: '900' },
  emptyTitle: { color: '#4A2B1A', fontSize: 16, fontWeight: '900', marginTop: 14 },
  emptyText: { color: '#8B6548', marginTop: 12, fontWeight: '700' },
  categoryRow: { marginTop: 14 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  categoryNameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryName: { flex: 1, color: '#4A2B1A', fontWeight: '800' },
  categoryAmount: { color: '#A94F18', fontWeight: '900' },
  categoryTrack: { height: 10, borderRadius: 999, backgroundColor: '#FFE3C8', overflow: 'hidden', marginTop: 8 },
  categoryFill: { height: '100%', borderRadius: 999, backgroundColor: Colors.primary },
  budgetList: { marginTop: 14, gap: 14 },
  budgetRow: { borderRadius: 18, backgroundColor: '#FFF8F1', padding: 12 },
  budgetStatus: { color: '#188F5A', fontSize: 12, fontWeight: '900' },
  budgetDangerFill: { backgroundColor: '#D4621D' },
  budgetMetaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 8 },
  budgetMeta: { flex: 1, color: '#8B6548', fontSize: 12, fontWeight: '800' },
  budgetPercent: { color: '#4A2B1A', fontSize: 12, fontWeight: '900' },
  premiumHint: { color: '#8B6548', fontWeight: '700', lineHeight: 20, marginTop: 14 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 },
  donutLegend: { flex: 1, gap: 9 },
  donutLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  donutLegendDot: { width: 10, height: 10, borderRadius: 5 },
  donutLegendText: { flex: 1, color: '#4A2B1A', fontWeight: '800' },
  donutLegendAmount: { color: '#A94F18', fontSize: 12, fontWeight: '900' },
  tagList: { marginTop: 12, gap: 10 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: '#FFF0DF', padding: 10 },
  rankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  rankText: { color: Colors.white, fontWeight: '900' },
  tagName: { flex: 1, color: '#4A2B1A', fontWeight: '900' },
  tagAmount: { color: '#8B6548', fontSize: 12, fontWeight: '800' },
  recentList: { marginTop: 12, gap: 10 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: '#FFF8F1', padding: 10 },
  recentIcon: { width: 38, height: 38, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  recentCopy: { flex: 1 },
  recentTitle: { color: '#4A2B1A', fontWeight: '900' },
  recentMeta: { color: '#8B6548', fontSize: 12, fontWeight: '700', marginTop: 3 },
  recentAmount: { fontSize: 12, fontWeight: '900' },
  incomeAmount: { color: '#188F5A' },
  expenseAmount: { color: '#D4621D' },
  insightText: { color: '#4A2B1A', fontWeight: '800', lineHeight: 22, marginTop: 12 },
  insightGrid: { flexDirection: 'row', gap: 10, marginTop: 14 },
  insightBox: { flex: 1, borderRadius: 18, backgroundColor: '#FFF0DF', padding: 12 },
  insightLabel: { color: '#8B6548', fontSize: 12, fontWeight: '800' },
  insightValue: { color: '#4A2B1A', fontSize: 18, fontWeight: '900', marginTop: 6 },
  dangerText: { color: '#B94C16' },
  insightMeta: { color: '#8B6548', lineHeight: 21, marginTop: 12 },
  reportCard: {
    backgroundColor: '#4A2B1A',
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reportCopy: { flex: 1 },
  reportTitle: { color: Colors.white, fontSize: 18, fontWeight: '900' },
  reportText: { color: '#FFE3C8', fontWeight: '700', marginTop: 5, lineHeight: 19 },
  reportActions: { flexDirection: 'row', gap: 8 },
  reportButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(42, 24, 12, 0.36)', justifyContent: 'flex-end' },
  backdropPressable: { flex: 1 },
  emailModalCard: {
    backgroundColor: '#FFF9F3',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: '#E8B680',
  },
  modalHandle: { width: 44, height: 5, borderRadius: 999, backgroundColor: '#E5B98E', alignSelf: 'center', marginBottom: 14 },
  emailModalTitle: { color: '#4A2B1A', fontSize: 22, fontWeight: '900' },
  emailModalText: { color: '#8B6548', lineHeight: 21, marginTop: 8 },
  emailLabel: { color: '#7A4A28', fontWeight: '900', marginTop: 18, marginBottom: 8 },
  emailInput: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8B680',
    backgroundColor: '#FFFDFB',
    paddingHorizontal: 14,
    color: '#4A2B1A',
    fontWeight: '800',
  },
  emailActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  secondaryModalButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#FFF0DF',
    borderWidth: 1,
    borderColor: '#E8B680',
    alignItems: 'center',
    paddingVertical: 15,
  },
  secondaryModalText: { color: '#7A4A28', fontWeight: '900' },
  primaryModalButton: { flex: 1, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', paddingVertical: 15 },
  primaryModalText: { color: Colors.white, fontWeight: '900' },
});

export default StatisticsScreen;
