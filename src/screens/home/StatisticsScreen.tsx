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
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import RNFS from 'react-native-fs';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Lock,
  Mail,
  Sparkles,
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
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import { buildCategoryStats } from '../../utils/categoryStats';
import { formatCurrency, formatShortDate } from '../../utils/format';
import { filterNormalTransactions } from '../../utils/transactionPeriods';

type Props = NativeStackScreenProps<RootStackParamList, 'Statistics'>;
type PeriodMode = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
type StatisticsTab = 'overview' | 'trend';
type ChartPoint = { label: string; income: number; expense: number };
type BreakdownPoint = ChartPoint & { start: string; end: string; transactions: number };
type CustomDateMode = 'all' | 'after' | 'before' | 'range';
type PickerTarget = 'selectedDate' | 'dateFrom' | 'dateTo' | null;
type PeriodRange = {
  selectedDate?: string;
  selectedWeekStart?: string;
  selectedMonth?: number;
  selectedQuarter?: number;
  selectedYear?: number;
  customDateMode?: CustomDateMode;
  dateFrom?: string;
  dateTo?: string;
};

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
  trend: 'Chi tiết',
};

const now = new Date();
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

const formatDateDisplay = (value: string) => formatShortDate(value);
const formatDateRangeDisplay = (start: string, end: string) => `${formatDateDisplay(start)} - ${formatDateDisplay(end)}`;

const clampDateToToday = (date: Date) => (date > todayStart ? new Date(todayStart) : date);
const isAfterToday = (date: Date) => date > todayStart;
const sortDateRange = (start: Date, end: Date) => (start <= end ? { start, end } : { start: end, end: start });

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

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const getWeeksOfMonth = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1);
  const monthLastDay = new Date(year, month, getDaysInMonth(year, month));
  const lastDay = clampDateToToday(monthLastDay);
  if (firstDay > todayStart) {
    return [];
  }
  const weeks: Array<{ label: string; start: Date; end: Date }> = [];

  for (let index = 0; index < 4; index += 1) {
    const start = new Date(year, month, index * 7 + 1);
    if (start > lastDay) {
      break;
    }
    const rawEnd = index === 3 ? monthLastDay : new Date(year, month, index * 7 + 7);
    const end = clampDateToToday(rawEnd);
    weeks.push({ label: `${formatDateDisplay(formatDateInput(start))} - ${formatDateDisplay(formatDateInput(end))}`, start, end });
  }

  return weeks;
};

const endOfDay = (date: Date) => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
};

const filterByPeriod = (transactions: TransactionItem[], period: PeriodMode, range: PeriodRange = {}) =>
  transactions.filter(transaction => {
    const date = new Date(transaction.date);
    if (date > endOfDay(todayStart)) {
      return false;
    }

    if (period === 'day') {
      const selectedDate = parseInputDate(range.selectedDate) ?? now;
      return date.getFullYear() === selectedDate.getFullYear() && date.getMonth() === selectedDate.getMonth() && date.getDate() === selectedDate.getDate();
    }

    if (period === 'week') {
      const start = parseInputDate(range.selectedWeekStart) ?? startOfWeek(now);
      const end = addDays(clampDateToToday(addDays(start, 6)), 1);
      return date >= start && date < end;
    }

    if (period === 'month') {
      const year = range.selectedYear ?? now.getFullYear();
      const month = range.selectedMonth ?? now.getMonth();
      const monthStart = new Date(year, month, 1);
      const monthEnd = addDays(clampDateToToday(new Date(year, month + 1, 0)), 1);
      return date >= monthStart && date < monthEnd;
    }

    if (period === 'quarter') {
      const year = range.selectedYear ?? now.getFullYear();
      const quarter = range.selectedQuarter ?? Math.floor(now.getMonth() / 3);
      const start = new Date(year, quarter * 3, 1);
      const end = addDays(clampDateToToday(new Date(start.getFullYear(), start.getMonth() + 3, 0)), 1);
      return date >= start && date < end;
    }

    if (period === 'custom') {
      if (range.customDateMode === 'all') {
        return true;
      }
      const from = parseInputDate(range.dateFrom);
      const to = parseInputDate(range.dateTo);
      if (range.customDateMode === 'after') {
        return from ? date >= from : true;
      }
      if (range.customDateMode === 'before') {
        return to ? date <= endOfDay(to) : true;
      }
      const rangeDates = sortDateRange(
        from ?? new Date(now.getFullYear(), now.getMonth(), 1),
        clampDateToToday(to ?? now),
      );
      return date >= rangeDates.start && date <= endOfDay(rangeDates.end);
    }

    const year = range.selectedYear ?? now.getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = addDays(clampDateToToday(new Date(year, 11, 31)), 1);
    return date >= yearStart && date < yearEnd;
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
      const currentStart = parseInputDate(range.selectedWeekStart) ?? startOfWeek(now);
      const previousStart = addDays(currentStart, -7);
      return date >= previousStart && date < currentStart;
    }

    if (period === 'month') {
      const previousMonth = new Date(range.selectedYear ?? now.getFullYear(), (range.selectedMonth ?? now.getMonth()) - 1, 1);
      return date.getFullYear() === previousMonth.getFullYear() && date.getMonth() === previousMonth.getMonth();
    }

    if (period === 'quarter') {
      const currentStart = new Date(range.selectedYear ?? now.getFullYear(), (range.selectedQuarter ?? Math.floor(now.getMonth() / 3)) * 3, 1);
      const previousStart = new Date(currentStart.getFullYear(), currentStart.getMonth() - 3, 1);
      return date >= previousStart && date < currentStart;
    }

    return date.getFullYear() === (range.selectedYear ?? now.getFullYear()) - 1;
  });

const sumByType = (transactions: TransactionItem[], type: 'income' | 'expense') =>
  filterNormalTransactions(transactions)
    .filter(item => item.type === type)
    .reduce((total, item) => total + item.displayAmount, 0);

const countNormalTransactions = (transactions: TransactionItem[]) =>
  filterNormalTransactions(transactions).length;

const formatChangePercent = (value: number | null) => {
  if (value === null) {
    return 'Chưa có dữ liệu';
  }

  return `${value >= 0 ? '+' : ''}${value}%`;
};

const buildChartPoints = (transactions: TransactionItem[], period: PeriodMode, range: PeriodRange = {}): ChartPoint[] => {
  if (period === 'day') {
    const selectedDate = parseInputDate(range.selectedDate) ?? now;
    const dayTransactions = filterByPeriod(transactions, 'day', range);
    return [{ label: `${selectedDate.getDate()}/${selectedDate.getMonth() + 1}`, income: sumByType(dayTransactions, 'income'), expense: sumByType(dayTransactions, 'expense') }];
  }

  if (period === 'week') {
    const start = parseInputDate(range.selectedWeekStart) ?? startOfWeek(now);
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index);
      if (isAfterToday(date)) {
        return {
          label: `${date.getDate()}/${date.getMonth() + 1}`,
          income: 0,
          expense: 0,
        };
      }
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
    const year = range.selectedYear ?? now.getFullYear();
    const month = range.selectedMonth ?? now.getMonth();
    const weeks = getWeeksOfMonth(year, month);

    return weeks.map((week, index) => {
      const bucketTransactions = transactions.filter(item => {
        const date = new Date(item.date);
        return date >= week.start && date <= endOfDay(week.end);
      });

      return {
        label: `Tuần ${index + 1}`,
        income: sumByType(bucketTransactions, 'income'),
        expense: sumByType(bucketTransactions, 'expense'),
      };
    });
  }

  if (period === 'quarter') {
    const start = new Date(range.selectedYear ?? now.getFullYear(), (range.selectedQuarter ?? Math.floor(now.getMonth() / 3)) * 3, 1);

    return Array.from({ length: 3 }, (_, index) => {
      const month = start.getMonth() + index;
      const monthStart = new Date(start.getFullYear(), month, 1);
      if (monthStart > todayStart) {
        return { label: `T${month + 1}`, income: 0, expense: 0 };
      }
      const monthTransactions = transactions.filter(item => {
        const date = new Date(item.date);
        const monthEnd = endOfDay(clampDateToToday(new Date(start.getFullYear(), month + 1, 0)));
        return date >= monthStart && date <= monthEnd;
      });

      return {
        label: `T${month + 1}`,
        income: sumByType(monthTransactions, 'income'),
        expense: sumByType(monthTransactions, 'expense'),
      };
    });
  }

  if (period === 'custom') {
    if (range.customDateMode === 'all') {
      const safeTransactions = filterByPeriod(transactions, 'custom', range);
      const years = [...new Set(safeTransactions.map(item => new Date(item.date).getFullYear()))].sort((left, right) => left - right);

      return years.map(year => {
        const items = safeTransactions.filter(item => new Date(item.date).getFullYear() === year);
        return {
          label: `${year}`,
          income: sumByType(items, 'income'),
          expense: sumByType(items, 'expense'),
        };
      });
    }

    const safeTransactions = filterByPeriod(transactions, 'custom', range);
    const dates = safeTransactions.map(item => new Date(item.date)).sort((left, right) => left.getTime() - right.getTime());
    const rawStart =
      range.customDateMode === 'before'
        ? (dates[0] ?? parseInputDate(range.dateTo) ?? now)
        : (parseInputDate(range.dateFrom) ?? dates[0] ?? new Date(now.getFullYear(), now.getMonth(), 1));
    const rawEnd =
      range.customDateMode === 'after'
        ? (dates[dates.length - 1] ?? parseInputDate(range.dateFrom) ?? now)
        : (parseInputDate(range.dateTo) ?? dates[dates.length - 1] ?? now);
    const { start, end } = sortDateRange(clampDateToToday(rawStart), clampDateToToday(rawEnd));
    const days = Math.max(1, Math.min(31, Math.ceil((endOfDay(end).getTime() - start.getTime()) / 86400000) + 1));

    return Array.from({ length: days }, (_, index) => {
      const date = addDays(start, index);
      const dayTransactions = safeTransactions.filter(item => {
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

  const year = range.selectedYear ?? now.getFullYear();
  const lastMonth = year === now.getFullYear() ? now.getMonth() : 11;
  return Array.from({ length: lastMonth + 1 }, (_, month) => {
    const monthTransactions = transactions.filter(item => {
      const date = new Date(item.date);
      return date.getFullYear() === (range.selectedYear ?? now.getFullYear()) && date.getMonth() === month;
    });

    return {
      label: `T${month + 1}`,
      income: sumByType(monthTransactions, 'income'),
      expense: sumByType(monthTransactions, 'expense'),
    };
  });
};

const buildTagStats = (transactions: TransactionItem[]) => {
  const totals = new Map<string, { total: number; count: number }>();

  filterNormalTransactions(transactions).forEach(item => {
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
      date,
      income: sumByType(dayTransactions, 'income'),
      expense: sumByType(dayTransactions, 'expense'),
    };
  });
};

const getPreviousSevenDayExpense = (transactions: TransactionItem[]) => {
  const start = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), -13);
  const end = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), -6);

  return transactions.reduce((total, item) => {
    const date = new Date(item.date);

    return item.cashFlowType !== 'loan_debt' && item.type === 'expense' && date >= start && date < end ? total + item.displayAmount : total;
  }, 0);
};

const buildBreakdownPoints = (transactions: TransactionItem[], period: PeriodMode, range: PeriodRange = {}): BreakdownPoint[] => {
  if (period === 'day') {
    const date = clampDateToToday(parseInputDate(range.selectedDate) ?? now);
    const items = filterByPeriod(transactions, 'day', { ...range, selectedDate: formatDateInput(date) });
    return [{
      label: formatDateDisplay(formatDateInput(date)),
      start: formatDateInput(date),
      end: formatDateInput(date),
      income: sumByType(items, 'income'),
      expense: sumByType(items, 'expense'),
      transactions: countNormalTransactions(items),
    }];
  }

  if (period === 'week') {
    const start = parseInputDate(range.selectedWeekStart) ?? startOfWeek(now);
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index);
      const value = formatDateInput(date);
      const items = isAfterToday(date) ? [] : filterByPeriod(transactions, 'day', { selectedDate: value });
      return {
        label: formatDateDisplay(value),
        start: value,
        end: value,
        income: sumByType(items, 'income'),
        expense: sumByType(items, 'expense'),
        transactions: countNormalTransactions(items),
      };
    });
  }

  if (period === 'month') {
    const year = range.selectedYear ?? now.getFullYear();
    const month = range.selectedMonth ?? now.getMonth();
    return getWeeksOfMonth(year, month).map((week, index) => {
      const items = transactions.filter(item => {
        const date = new Date(item.date);
        return date >= week.start && date <= endOfDay(week.end);
      });
      return {
        label: `Tuần ${index + 1}: ${formatDateRangeDisplay(formatDateInput(week.start), formatDateInput(week.end))}`,
        start: formatDateInput(week.start),
        end: formatDateInput(week.end),
        income: sumByType(items, 'income'),
        expense: sumByType(items, 'expense'),
        transactions: countNormalTransactions(items),
      };
    });
  }

  if (period === 'quarter') {
    const start = new Date(range.selectedYear ?? now.getFullYear(), (range.selectedQuarter ?? Math.floor(now.getMonth() / 3)) * 3, 1);
    return Array.from({ length: 3 }, (_, index) => {
      const monthStart = new Date(start.getFullYear(), start.getMonth() + index, 1);
      const monthEnd = clampDateToToday(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0));
      const items = monthStart > todayStart ? [] : transactions.filter(item => {
        const date = new Date(item.date);
        return date >= monthStart && date <= endOfDay(monthEnd);
      });
      return {
        label: `Tháng ${monthStart.getMonth() + 1}/${monthStart.getFullYear()}`,
        start: formatDateInput(monthStart),
        end: formatDateInput(monthEnd),
        income: sumByType(items, 'income'),
        expense: sumByType(items, 'expense'),
        transactions: countNormalTransactions(items),
      };
    });
  }

  if (period === 'year') {
    const year = range.selectedYear ?? now.getFullYear();
    const lastMonth = year === now.getFullYear() ? now.getMonth() : 11;
    return Array.from({ length: lastMonth + 1 }, (_, month) => {
      const monthStart = new Date(year, month, 1);
      const monthEnd = clampDateToToday(new Date(year, month + 1, 0));
      const items = transactions.filter(item => {
        const date = new Date(item.date);
        return date >= monthStart && date <= endOfDay(monthEnd);
      });
      return {
        label: `Tháng ${month + 1}/${year}`,
        start: formatDateInput(monthStart),
        end: formatDateInput(monthEnd),
        income: sumByType(items, 'income'),
        expense: sumByType(items, 'expense'),
        transactions: countNormalTransactions(items),
      };
    });
  }

  if (period === 'custom') {
    const items = filterByPeriod(transactions, 'custom', range);

    if (range.customDateMode === 'all') {
      const years = [...new Set(items.map(item => new Date(item.date).getFullYear()))].sort((left, right) => left - right);

      return years.map(year => {
        const yearStart = new Date(year, 0, 1);
        const yearEnd = clampDateToToday(new Date(year, 11, 31));
        const yearItems = items.filter(item => new Date(item.date).getFullYear() === year);

        return {
          label: `${year}`,
          start: formatDateInput(yearStart),
          end: formatDateInput(yearEnd),
          income: sumByType(yearItems, 'income'),
          expense: sumByType(yearItems, 'expense'),
          transactions: countNormalTransactions(yearItems),
        };
      });
    }

    const from = parseInputDate(range.customDateMode === 'before' ? undefined : range.dateFrom);
    const to = parseInputDate(range.customDateMode === 'after' ? undefined : range.dateTo);
    const rawStart = from ?? items.reduce((min, item) => {
      const date = new Date(item.date);
      return date < min ? date : min;
    }, now);
    const rawEnd = to ?? items.reduce((max, item) => {
      const date = new Date(item.date);
      return date > max ? date : max;
    }, rawStart);
    const { start, end } = sortDateRange(clampDateToToday(rawStart), clampDateToToday(rawEnd));
    const dayCount = Math.max(1, Math.min(31, Math.ceil((endOfDay(end).getTime() - start.getTime()) / 86400000) + 1));

    return Array.from({ length: dayCount }, (_, index) => {
      const date = addDays(start, index);
      const value = formatDateInput(date);
      const dayItems = filterByPeriod(items, 'day', { selectedDate: value });

      return {
        label: formatDateDisplay(value),
        start: value,
        end: value,
        income: sumByType(dayItems, 'income'),
        expense: sumByType(dayItems, 'expense'),
        transactions: countNormalTransactions(dayItems),
      };
    });
  }

  return [];
};

const getCoveredDayCount = (period: PeriodMode, range: PeriodRange = {}) => {
  let start: Date;
  let end: Date;

  if (period === 'day') {
    start = clampDateToToday(parseInputDate(range.selectedDate) ?? now);
    end = start;
  } else if (period === 'week') {
    start = parseInputDate(range.selectedWeekStart) ?? startOfWeek(now);
    end = clampDateToToday(addDays(start, 6));
  } else if (period === 'month') {
    start = new Date(range.selectedYear ?? now.getFullYear(), range.selectedMonth ?? now.getMonth(), 1);
    end = clampDateToToday(new Date(start.getFullYear(), start.getMonth() + 1, 0));
  } else if (period === 'quarter') {
    start = new Date(range.selectedYear ?? now.getFullYear(), (range.selectedQuarter ?? Math.floor(now.getMonth() / 3)) * 3, 1);
    end = clampDateToToday(new Date(start.getFullYear(), start.getMonth() + 3, 0));
  } else if (period === 'year') {
    start = new Date(range.selectedYear ?? now.getFullYear(), 0, 1);
    end = clampDateToToday(new Date(start.getFullYear(), 11, 31));
  } else {
    const rangeDates = sortDateRange(
      parseInputDate(range.dateFrom) ?? new Date(now.getFullYear(), now.getMonth(), 1),
      clampDateToToday(parseInputDate(range.dateTo) ?? now),
    );
    start = rangeDates.start;
    end = rangeDates.end;
  }

  if (start > todayStart) {
    return 1;
  }

  return Math.max(1, Math.floor((endOfDay(end).getTime() - start.getTime()) / 86400000) + 1);
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
const incomeDonutColors = ['#188F5A', '#2FA86D', '#67C58E', '#A2DDB9', '#0EA5E9', '#4FB3E7'];

const StatisticsScreen = ({ navigation, route }: Props) => {
  const { token, user } = useAuth();
  const { transactions, preferredCurrency } = useFinance();
  const [period, setPeriod] = useState<PeriodMode>('month');
  const [activeTab, setActiveTab] = useState<StatisticsTab>('overview');
  const [selectedDate, setSelectedDate] = useState(formatDateInput(now));
  const [selectedWeekStart, setSelectedWeekStart] = useState(formatDateInput(startOfWeek(now)));
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(now.getMonth() / 3));
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [customDateMode, setCustomDateMode] = useState<CustomDateMode>('range');
  const [dateFrom, setDateFrom] = useState(formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [dateTo, setDateTo] = useState(formatDateInput(now));
  const [walletId, setWalletId] = useState<number | null>(null);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [apiStats, setApiStats] = useState<StatisticsResponse | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [exportingFormat, setExportingFormat] = useState<'excel' | 'pdf' | null>(null);
  const [isEmailModalVisible, setIsEmailModalVisible] = useState(false);
  const [reportEmail, setReportEmail] = useState(user?.email ?? '');
  const hasFullStats = user?.role === 'PREMIUM' || user?.role === 'ADMIN';
  const visibleTabs: StatisticsTab[] = hasFullStats ? ['overview', 'trend'] : ['overview'];
  const shouldShowPeriodFilter = hasFullStats && activeTab === 'trend';
  const wallets = route.params?.wallets ?? [];
  const periodRange = useMemo(
    () => ({
      selectedDate,
      selectedWeekStart,
      selectedMonth,
      selectedQuarter,
      selectedYear,
      customDateMode,
      dateFrom,
      dateTo,
    }),
    [customDateMode, dateFrom, dateTo, selectedDate, selectedMonth, selectedQuarter, selectedWeekStart, selectedYear],
  );
  const filteredTransactions = useMemo(
    () => (walletId ? transactions.filter(item => item.walletId === walletId) : transactions),
    [transactions, walletId],
  );
  const weekOptions = useMemo(() => getWeeksOfMonth(selectedYear, selectedMonth), [selectedMonth, selectedYear]);
  const currentWeekStart = formatDateInput(startOfWeek(now));
  const apiStatsPeriod: StatisticsPeriod | null =
    period === 'day' || period === 'week' || period === 'month' || period === 'year'
      ? period
      : null;
  const isCurrentApiStatsPeriod =
    period === 'day'
      ? selectedDate === formatDateInput(now)
      : period === 'week'
        ? selectedWeekStart === currentWeekStart
        : period === 'month'
          ? selectedYear === now.getFullYear() && selectedMonth === now.getMonth()
          : period === 'year'
            ? selectedYear === now.getFullYear()
            : false;
  const canUseApiStats =
    hasFullStats && walletId === null && apiStatsPeriod !== null && isCurrentApiStatsPeriod;
  const exportPeriod: StatisticsPeriod | null =
    period === 'custom' && customDateMode === 'all'
      ? 'all'
      : period === 'day' || period === 'week' || period === 'month' || period === 'year'
        ? period
        : null;
  const canExportPeriod = exportPeriod !== null;

  useEffect(() => {
    if (!token || !canUseApiStats || !apiStatsPeriod) {
      setApiStats(null);
      return;
    }

    setIsLoadingStats(true);
    setStatsError('');
    statisticsService
      .get(token, apiStatsPeriod)
      .then(setApiStats)
      .catch(error => {
        setApiStats(null);
        setStatsError(getUserFriendlyErrorMessage(error, 'Không thể tải thống kê.'));
      })
      .finally(() => setIsLoadingStats(false));
  }, [apiStatsPeriod, canUseApiStats, token]);

  useEffect(() => {
    if (!hasFullStats && activeTab !== 'overview') {
      setActiveTab('overview');
    }
  }, [activeTab, hasFullStats]);

  const periodTransactions = useMemo(() => filterByPeriod(filteredTransactions, period, periodRange), [filteredTransactions, period, periodRange]);
  const currentMonthTransactions = useMemo(
    () => filterByPeriod(filteredTransactions, 'month', { selectedMonth: now.getMonth(), selectedYear: now.getFullYear() }),
    [filteredTransactions],
  );
  const normalCurrentMonthTransactions = useMemo(
    () => filterNormalTransactions(currentMonthTransactions),
    [currentMonthTransactions],
  );
  const currentPreviousMonthTransactions = useMemo(
    () => filterPreviousPeriod(filteredTransactions, 'month', { selectedMonth: now.getMonth(), selectedYear: now.getFullYear() }),
    [filteredTransactions],
  );
  const lastThreeMonthTransactions = useMemo(
    () =>
      filteredTransactions.filter(item => {
        const date = new Date(item.date);
        const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 1);
        return date >= start && date < end;
      }),
    [filteredTransactions],
  );
  const chartPoints = useMemo(
    () => (canUseApiStats ? apiStats?.chart : undefined) ?? buildChartPoints(filteredTransactions, period, periodRange),
    [apiStats, canUseApiStats, filteredTransactions, period, periodRange],
  );
  const breakdownPoints = useMemo(
    () => buildBreakdownPoints(filteredTransactions, period, periodRange),
    [filteredTransactions, period, periodRange],
  );
  const expenseCategoryStats = useMemo(
    () =>
      canUseApiStats && apiStats
        ? apiStats.categories.map(item => ({ category: item.name, total: item.total, icon: item.icon }))
        : buildCategoryStats(periodTransactions, 'expense'),
    [apiStats, canUseApiStats, periodTransactions],
  );
  const incomeCategoryStats = useMemo(
    () => buildCategoryStats(periodTransactions, 'income'),
    [periodTransactions],
  );
  const tagStats = useMemo(
    () => (canUseApiStats ? apiStats?.hot_hashtags ?? apiStats?.tags : undefined) ?? buildTagStats(periodTransactions),
    [apiStats, canUseApiStats, periodTransactions],
  );
  const monthlyTrend = useMemo(
    () =>
      (canUseApiStats ? apiStats?.monthly_trend : undefined) ??
      buildChartPoints(filteredTransactions, 'year', { selectedYear }).map(item => ({ ...item, net: item.income - item.expense })),
    [apiStats, canUseApiStats, filteredTransactions, selectedYear],
  );
  const recentSevenDays = useMemo(() => buildLastSevenDays(filteredTransactions), [filteredTransactions]);

  const income = (canUseApiStats ? apiStats?.summary.income : undefined) ?? sumByType(periodTransactions, 'income');
  const expense = (canUseApiStats ? apiStats?.summary.expense : undefined) ?? sumByType(periodTransactions, 'expense');
  const currentMonthIncome = sumByType(currentMonthTransactions, 'income');
  const currentMonthExpense = sumByType(currentMonthTransactions, 'expense');
  const transactionCount = (canUseApiStats ? apiStats?.summary.transactionCount : undefined) ?? countNormalTransactions(periodTransactions);
  const currentPreviousMonthExpense = sumByType(currentPreviousMonthTransactions, 'expense');
  const currentPreviousMonthIncome = sumByType(currentPreviousMonthTransactions, 'income');
  const lastThreeMonthAverageIncome = sumByType(lastThreeMonthTransactions, 'income') / 3;
  const lastThreeMonthAverageExpense = sumByType(lastThreeMonthTransactions, 'expense') / 3;
  const currentIncomeChangePercent =
    currentPreviousMonthIncome > 0 ? Math.round(((currentMonthIncome - currentPreviousMonthIncome) / currentPreviousMonthIncome) * 100) : null;
  const currentExpenseChangePercent =
    currentPreviousMonthExpense > 0 ? Math.round(((currentMonthExpense - currentPreviousMonthExpense) / currentPreviousMonthExpense) * 100) : null;
  const topExpenseCategory = expenseCategoryStats[0];
  const topIncomeCategory = incomeCategoryStats[0];
  const displayCurrency = apiStats?.display_currency ?? preferredCurrency;
  const maxIncomeChartValue = Math.max(1, ...chartPoints.map(item => item.income));
  const maxExpenseChartValue = Math.max(1, ...chartPoints.map(item => item.expense));
  const hasChartData = chartPoints.some(item => item.income > 0 || item.expense > 0);
  const incomePath = buildLinePath(chartPoints, maxIncomeChartValue, 'income');
  const expensePath = buildLinePath(chartPoints, maxExpenseChartValue, 'expense');
  const maxTrendValue = Math.max(1, ...monthlyTrend.flatMap(item => [item.income, item.expense]));
  const maxRecentExpense = Math.max(1, ...recentSevenDays.map(item => item.expense));
  const recentSevenExpense = recentSevenDays.reduce((total, item) => total + item.expense, 0);
  const recentSevenIncome = recentSevenDays.reduce((total, item) => total + item.income, 0);
  const recentSevenNet = recentSevenIncome - recentSevenExpense;
  const recentSevenAverageExpense = recentSevenExpense / 7;
  const previousSevenExpense = useMemo(() => getPreviousSevenDayExpense(filteredTransactions), [filteredTransactions]);
  const highestRecentExpenseDay = recentSevenDays.reduce(
    (highest, item) => (item.expense > highest.expense ? item : highest),
    recentSevenDays[0],
  );
  const recentRecordedDaysCount = recentSevenDays.filter(item => item.income > 0 || item.expense > 0).length;
  const totalCategoryExpense = expenseCategoryStats.reduce((total, item) => total + item.total, 0);
  const totalCategoryIncome = incomeCategoryStats.reduce((total, item) => total + item.total, 0);
  const recentTransactions = filterNormalTransactions(filteredTransactions).slice(0, 5);
  const currentRecordedDaysCount = new Set(
    normalCurrentMonthTransactions.map(item => new Date(item.date)).map(date => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`),
  ).size;
  const averageExpenseByPeriod = expense / getCoveredDayCount(period, periodRange);
  const currentMonthAverageDailyExpense = currentMonthExpense / Math.max(1, now.getDate());
  let expenseDonutStartAngle = 0;
  let incomeDonutStartAngle = 0;

  useEffect(() => {
    const date = clampDateToToday(parseInputDate(selectedDate) ?? now);
    if (formatDateInput(date) !== selectedDate) {
      setSelectedDate(formatDateInput(date));
    }
    if (period === 'week') {
      const firstWeek = weekOptions[0];
      if (firstWeek && !weekOptions.some(item => formatDateInput(item.start) === selectedWeekStart)) {
        setSelectedWeekStart(formatDateInput(firstWeek.start));
      }
    }
  }, [period, selectedDate, selectedWeekStart, weekOptions]);

  useEffect(() => {
    if (selectedYear >= now.getFullYear()) {
      setSelectedMonth(value => Math.min(value, now.getMonth()));
      setSelectedQuarter(value => Math.min(value, Math.floor(now.getMonth() / 3)));
    }
  }, [selectedYear]);

  const pickerValue = useMemo(() => {
    if (pickerTarget === 'dateFrom') {
      return parseInputDate(dateFrom) ?? now;
    }
    if (pickerTarget === 'dateTo') {
      return parseInputDate(dateTo) ?? now;
    }
    return parseInputDate(selectedDate) ?? now;
  }, [dateFrom, dateTo, pickerTarget, selectedDate]);

  const handlePickerChange = (_event: DateTimePickerEvent, value?: Date) => {
    const target = pickerTarget;
    setPickerTarget(null);

    if (!target || !value) {
      return;
    }

    const safeDate = clampDateToToday(value);
    const nextValue = formatDateInput(safeDate);
    if (target === 'dateFrom') {
      setDateFrom(nextValue);
      return;
    }
    if (target === 'dateTo') {
      setDateTo(nextValue);
      return;
    }
    setSelectedDate(nextValue);
    if (period === 'week') {
      setSelectedWeekStart(formatDateInput(startOfWeek(safeDate)));
      setSelectedYear(safeDate.getFullYear());
    }
  };

  const renderDateSelector = (label: string, value: string, target: PickerTarget) => (
    <TouchableOpacity style={styles.dateSelectCard} onPress={() => setPickerTarget(target)}>
      <Text style={styles.dateInputLabel}>{label}</Text>
      <Text style={styles.dateSelectValue}>{formatDateDisplay(value)}</Text>
    </TouchableOpacity>
  );

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

    if (!canExportPeriod) {
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
      const report = await statisticsService.exportReport(token, exportPeriod!, format);
      const targetDirectory = RNFS.DownloadDirectoryPath || RNFS.DocumentDirectoryPath;
      const targetPath = `${targetDirectory}/${report.filename}`;

      await RNFS.writeFile(targetPath, report.base64, 'base64');
      Alert.alert('Đã xuất báo cáo', `File đã được lưu tại:\n${targetPath}`);
    } catch (error) {
      Alert.alert('Không thể xuất báo cáo', getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.'));
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
      if (!canExportPeriod) {
        Alert.alert('Chưa hỗ trợ gửi báo cáo', 'Gửi báo cáo hiện hỗ trợ Ngày, Tuần, Tháng và Năm.');
        return;
      }
      const response = await statisticsService.sendExcelReport(token, exportPeriod!, email);
      setIsEmailModalVisible(false);
      Alert.alert('Đã gửi báo cáo', getUserFriendlyErrorMessage(response.message, response.message));
    } catch (error) {
      Alert.alert('Không thể gửi báo cáo', getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.'));
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
              <Text style={styles.upgradeText}>Mở phân tích chi tiết, danh mục, hashtag và báo cáo xuất file.</Text>
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
            {wallets.length > 0 ? (
              <View style={styles.filterCard}>
                <Text style={styles.dateInputLabel}>Ví</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.optionRow, styles.weekOptionRow]}>
                  <TouchableOpacity
                    style={[styles.optionChip, walletId === null && styles.optionChipActive]}
                    onPress={() => setWalletId(null)}>
                    <Text style={[styles.optionText, walletId === null && styles.optionTextActive]}>Tất cả ví</Text>
                  </TouchableOpacity>
                  {wallets.map(wallet => (
                    <TouchableOpacity
                      key={wallet.id}
                      style={[styles.optionChip, walletId === wallet.id && styles.optionChipActive]}
                      onPress={() => setWalletId(wallet.id)}>
                      <Text style={[styles.optionText, walletId === wallet.id && styles.optionTextActive]}>{wallet.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}
            {period === 'day' ? renderDateSelector('Ngày thống kê', selectedDate, 'selectedDate') : null}
            {period === 'week' ? (
              <View style={styles.filterCard}>
                <Text style={styles.dateInputLabel}>Tháng trong năm {selectedYear}</Text>
                <View style={styles.monthGrid}>
                  {Array.from({ length: selectedYear === now.getFullYear() ? now.getMonth() + 1 : 12 }, (_, index) => (
                    <TouchableOpacity
                      key={`week-month-${index}`}
                      style={[styles.monthChip, selectedMonth === index && styles.monthChipActive]}
                      onPress={() => {
                        setSelectedMonth(index);
                        const firstWeek = getWeeksOfMonth(selectedYear, index)[0];
                        if (firstWeek) {
                          setSelectedWeekStart(formatDateInput(firstWeek.start));
                        }
                      }}>
                      <Text style={[styles.monthText, selectedMonth === index && styles.monthTextActive]}>T{index + 1}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                  {weekOptions.map((item, index) => {
                    const value = formatDateInput(item.start);
                    const active = selectedWeekStart === value;
                    return (
                      <TouchableOpacity
                        key={value}
                        style={[styles.optionChip, active && styles.optionChipActive]}
                        onPress={() => setSelectedWeekStart(value)}>
                        <Text style={[styles.optionText, active && styles.optionTextActive]}>Tuần {index + 1}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
            {period === 'month' ? (
              <View style={styles.filterCard}>
                <Text style={styles.dateInputLabel}>Tháng trong năm {selectedYear}</Text>
                <View style={styles.monthGrid}>
                  {Array.from({ length: selectedYear === now.getFullYear() ? now.getMonth() + 1 : 12 }, (_, index) => (
                    <TouchableOpacity
                      key={`month-${index}`}
                      style={[styles.monthChip, selectedMonth === index && styles.monthChipActive]}
                      onPress={() => setSelectedMonth(index)}>
                      <Text style={[styles.monthText, selectedMonth === index && styles.monthTextActive]}>T{index + 1}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}
            {period === 'quarter' ? (
              <View style={styles.filterCard}>
                <Text style={styles.dateInputLabel}>Quý trong năm {selectedYear}</Text>
                <View style={styles.segmentRow}>
                  {[0, 1, 2, 3].filter(item => selectedYear < now.getFullYear() || item <= Math.floor(now.getMonth() / 3)).map(item => (
                    <TouchableOpacity
                      key={`quarter-${item}`}
                      style={[styles.optionChip, selectedQuarter === item && styles.optionChipActive]}
                      onPress={() => setSelectedQuarter(item)}>
                      <Text style={[styles.optionText, selectedQuarter === item && styles.optionTextActive]}>Quý {item + 1}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}
            {period === 'month' || period === 'quarter' || period === 'year' || period === 'week' ? (
              <View style={styles.yearControl}>
                <TouchableOpacity style={styles.yearButton} onPress={() => setSelectedYear(value => value - 1)}>
                  <ArrowLeft size={16} color="#7A4A28" />
                </TouchableOpacity>
                <Text style={styles.yearValue}>{selectedYear}</Text>
                <TouchableOpacity style={[styles.yearButton, selectedYear >= now.getFullYear() && styles.yearButtonDisabled]} disabled={selectedYear >= now.getFullYear()} onPress={() => setSelectedYear(value => Math.min(now.getFullYear(), value + 1))}>
                  <ChevronRight size={16} color="#7A4A28" />
                </TouchableOpacity>
              </View>
            ) : null}
            {period === 'custom' ? (
              <View style={styles.filterCard}>
                <Text style={styles.dateInputLabel}>Tùy chọn</Text>
                <View style={styles.segmentRow}>
                  {(['all', 'after', 'before', 'range'] as CustomDateMode[]).map(item => (
                    <TouchableOpacity
                      key={item}
                      style={[styles.optionChip, customDateMode === item && styles.optionChipActive]}
                      onPress={() => setCustomDateMode(item)}>
                      <Text style={[styles.optionText, customDateMode === item && styles.optionTextActive]}>
                        {item === 'all' ? 'Tất cả' : item === 'after' ? 'Sau ngày' : item === 'before' ? 'Trước ngày' : 'Trong khoảng ngày'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {customDateMode === 'after' ? renderDateSelector('Sau ngày', dateFrom, 'dateFrom') : null}
                {customDateMode === 'before' ? renderDateSelector('Trước ngày', dateTo, 'dateTo') : null}
                {customDateMode === 'range' ? (
                  <View style={styles.dateRangeRow}>
                    {renderDateSelector('Từ ngày', dateFrom, 'dateFrom')}
                    {renderDateSelector('Đến ngày', dateTo, 'dateTo')}
                  </View>
                ) : null}
              </View>
            ) : null}
            {pickerTarget ? <DateTimePicker value={pickerValue} mode="date" maximumDate={todayStart} onChange={handlePickerChange} /> : null}
          </>
        ) : null}

        {activeTab === 'overview' ? (
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Số dư còn lại tháng này</Text>
            {isLoadingStats ? <ActivityIndicator color={Colors.white} /> : null}
          </View>
          <Text
            style={[styles.balanceAmount, currentMonthIncome - currentMonthExpense < 0 && styles.balanceNegative]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.62}>
            {formatCurrency(currentMonthIncome - currentMonthExpense, displayCurrency)}
          </Text>
          <Text style={styles.balanceNote}>Tính bằng tổng thu trong tháng trừ tổng chi trong tháng.</Text>
          {statsError ? <Text style={styles.statsError}>{statsError}</Text> : null}

          <View style={styles.cashFlowRow}>
            <View style={styles.cashFlowItem}>
              <View style={styles.incomeIcon}>
                <TrendingUp size={17} color="#188F5A" />
              </View>
              <Text style={styles.cashFlowLabel}>Thu</Text>
              <Text style={styles.cashFlowValue}>{formatCurrency(currentMonthIncome, displayCurrency)}</Text>
            </View>
            <View style={styles.cashFlowDivider} />
            <View style={styles.cashFlowItem}>
              <View style={styles.expenseIcon}>
                <TrendingDown size={17} color="#D4621D" />
              </View>
              <Text style={styles.cashFlowLabel}>Chi</Text>
              <Text style={styles.cashFlowValue}>{formatCurrency(currentMonthExpense, displayCurrency)}</Text>
            </View>
            <View style={styles.cashFlowDivider} />
            <View style={styles.cashFlowItem}>
              <View style={styles.walletIcon}>
                <WalletCards size={17} color={Colors.primary} />
              </View>
              <Text style={styles.cashFlowLabel}>Giao dịch</Text>
              <Text style={styles.cashFlowValue}>{normalCurrentMonthTransactions.length}</Text>
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
              <Text style={styles.statValue}>{formatCurrency(currentMonthIncome, displayCurrency)}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.expenseIcon}>
                <TrendingDown size={16} color="#D4621D" />
              </View>
              <Text style={styles.statLabel}>Tổng chi tháng này</Text>
              <Text style={styles.statValue}>{formatCurrency(currentMonthExpense, displayCurrency)}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.walletIcon}>
                <WalletCards size={16} color={Colors.primary} />
              </View>
              <Text style={styles.statLabel}>Số giao dịch tháng này</Text>
              <Text style={styles.statValue}>{normalCurrentMonthTransactions.length}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.expenseIcon}>
                <BarChart3 size={16} color="#D4621D" />
              </View>
              <Text style={styles.statLabel}>Chi tiêu trung bình/ngày</Text>
              <Text style={styles.statValue}>{formatCurrency(currentMonthAverageDailyExpense, displayCurrency)}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.walletIcon}>
                <Sparkles size={16} color={Colors.primary} />
              </View>
              <Text style={styles.statLabel}>Số ngày đã ghi chép</Text>
              <Text style={styles.statValue}>{currentRecordedDaysCount}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.walletIcon}>
                <WalletCards size={16} color={Colors.primary} />
              </View>
              <Text style={styles.statLabel}>Số dư còn lại tháng này</Text>
              <Text style={styles.statValue}>{formatCurrency(currentMonthIncome - currentMonthExpense, displayCurrency)}</Text>
            </View>
          </View>
        ) : null}

        {activeTab === 'overview' ? (
          <View style={styles.recentSevenCard}>
            <View style={styles.recentSevenHeader}>
              <View>
                <Text style={styles.cardTitle}>7 ngày gần nhất</Text>
                <Text style={styles.recentSevenSubtitle}>Chi tiết chi tiêu theo từng ngày</Text>
              </View>
              <View style={styles.recentSevenBadge}>
                <Text style={styles.recentSevenBadgeText}>Xu hướng</Text>
              </View>
            </View>

            <Text style={styles.recentSevenTotal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {formatCurrency(recentSevenExpense, displayCurrency)}
            </Text>
            <Text style={styles.recentSevenMeta}>
              {previousSevenExpense > 0
                ? `So với 7 ngày trước: ${formatChangePercent(Math.round(((recentSevenExpense - previousSevenExpense) / previousSevenExpense) * 100))}`
                : 'Chưa có dữ liệu 7 ngày trước để so sánh'}
            </Text>

            {recentSevenDays.every(item => item.expense === 0) ? (
              <Text style={styles.emptyText}>Chưa có chi tiêu trong 7 ngày gần nhất.</Text>
            ) : (
              <View style={styles.recentSevenChart}>
                {recentSevenDays.map(point => {
                  const height = Math.max(14, (point.expense / maxRecentExpense) * 92);
                  const isHighest = point.expense === highestRecentExpenseDay.expense && point.expense > 0;

                  return (
                    <View key={`overview-recent-${point.label}`} style={styles.recentSevenBarItem}>
                      <View style={styles.recentSevenBarTrack}>
                        <View
                          style={[
                            styles.recentSevenBar,
                            isHighest ? styles.recentSevenBarHighest : styles.recentSevenBarNormal,
                            { height },
                          ]}
                        />
                      </View>
                      <Text style={styles.recentSevenBarLabel}>{point.label}</Text>
                      <Text style={styles.recentSevenBarAmount}>{formatCurrency(point.expense, displayCurrency)}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.recentSevenSummaryGrid}>
              <View style={styles.recentSevenSummaryItem}>
                <Text style={styles.recentSevenSummaryLabel}>Trung bình/ngày</Text>
                <Text style={styles.recentSevenSummaryValue}>{formatCurrency(recentSevenAverageExpense, displayCurrency)}</Text>
              </View>
              <View style={styles.recentSevenSummaryItem}>
                <Text style={styles.recentSevenSummaryLabel}>Cao nhất</Text>
                <Text style={styles.recentSevenSummaryValue}>{highestRecentExpenseDay.label} · {formatCurrency(highestRecentExpenseDay.expense, displayCurrency)}</Text>
              </View>
              <View style={styles.recentSevenSummaryItem}>
                <Text style={styles.recentSevenSummaryLabel}>Thu - chi</Text>
                <Text style={[styles.recentSevenSummaryValue, recentSevenNet >= 0 ? styles.incomeAmount : styles.expenseAmount]}>
                  {recentSevenNet >= 0 ? '+' : '-'}{formatCurrency(Math.abs(recentSevenNet), displayCurrency)}
                </Text>
              </View>
              <View style={styles.recentSevenSummaryItem}>
                <Text style={styles.recentSevenSummaryLabel}>Ngày có chi tiêu</Text>
                <Text style={styles.recentSevenSummaryValue}>{recentRecordedDaysCount}/7 ngày</Text>
              </View>
            </View>
          </View>
        ) : null}

        {activeTab === 'overview' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>So sánh tháng hiện tại</Text>
            <View style={styles.compareGrid}>
              <View style={styles.compareCard}>
                <Text style={styles.compareLabel}>Tổng thu</Text>
                <Text style={styles.compareIncome} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                  {formatCurrency(currentMonthIncome, displayCurrency)}
                </Text>
                <Text style={styles.compareMeta}>Tháng trước: {formatChangePercent(currentIncomeChangePercent)}</Text>
                <Text style={styles.compareMeta} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                  TB 3 tháng trước: {formatCurrency(lastThreeMonthAverageIncome, displayCurrency)}
                </Text>
              </View>
              <View style={styles.compareCard}>
                <Text style={styles.compareLabel}>Tổng chi</Text>
                <Text style={styles.compareExpense} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                  {formatCurrency(currentMonthExpense, displayCurrency)}
                </Text>
                <Text style={styles.compareMeta}>Tháng trước: {formatChangePercent(currentExpenseChangePercent)}</Text>
                <Text style={styles.compareMeta} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                  TB 3 tháng trước: {formatCurrency(lastThreeMonthAverageExpense, displayCurrency)}
                </Text>
              </View>
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
                    <Text
                      style={[styles.recentAmount, item.type === 'income' ? styles.incomeAmount : styles.expenseAmount]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}>
                      {item.type === 'income' ? '+' : '-'}{formatCurrency(item.displayAmount, displayCurrency)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {hasFullStats && activeTab === 'trend' ? (
        <>
        <View style={styles.statGrid}>
          <View style={styles.statCard}>
            <View style={styles.incomeIcon}>
              <TrendingUp size={16} color="#188F5A" />
            </View>
            <Text style={styles.statLabel}>Tổng thu</Text>
            <Text style={styles.statValue}>{formatCurrency(income, displayCurrency)}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.expenseIcon}>
              <TrendingDown size={16} color="#D4621D" />
            </View>
            <Text style={styles.statLabel}>Tổng chi</Text>
            <Text style={styles.statValue}>{formatCurrency(expense, displayCurrency)}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.walletIcon}>
              <WalletCards size={16} color={Colors.primary} />
            </View>
            <Text style={styles.statLabel}>Giao dịch</Text>
            <Text style={styles.statValue}>{transactionCount}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.expenseIcon}>
              <BarChart3 size={16} color="#D4621D" />
            </View>
            <Text style={styles.statLabel}>Chi tiêu trung bình/ngày</Text>
            <Text style={styles.statValue}>{formatCurrency(averageExpenseByPeriod, displayCurrency)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Thu nhập</Text>
          </View>
          {!hasChartData ? (
            <Text style={styles.emptyText}>Không có dữ liệu trong kỳ này.</Text>
          ) : (
            <>
            <Svg width="100%" height={190} viewBox="0 0 320 190">
              <Rect x="18" y="26" width="284" height="124" rx="18" fill="#FFF3E7" />
              <Path d={incomePath} stroke="#188F5A" strokeWidth="4" fill="none" strokeLinecap="round" />
              {chartPoints.map((point, index) => {
                const x = 24 + (index * 272) / Math.max(chartPoints.length - 1, 1);
                const incomeY = 142 - (point.income / maxIncomeChartValue) * 102;

                return (
                  <React.Fragment key={`${point.label}-${index}`}>
                    <Circle cx={x} cy={incomeY} r="4" fill="#188F5A" />
                    {(chartPoints.length <= 7 || index % 2 === 0) && (
                      <SvgText x={x} y="176" fontSize="10" fill="#8B6548" textAnchor="middle">
                        {point.label}
                      </SvgText>
                    )}
                  </React.Fragment>
                );
              })}
            </Svg>
            </>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Chi tiêu</Text>
          </View>
          {!hasChartData ? (
            <Text style={styles.emptyText}>Không có dữ liệu trong kỳ này.</Text>
          ) : (
            <Svg width="100%" height={190} viewBox="0 0 320 190">
              <Rect x="18" y="26" width="284" height="124" rx="18" fill="#FFF3E7" />
              <Path d={expensePath} stroke="#D87219" strokeWidth="4" fill="none" strokeLinecap="round" />
              {chartPoints.map((point, index) => {
                const x = 24 + (index * 272) / Math.max(chartPoints.length - 1, 1);
                const expenseY = 142 - (point.expense / maxExpenseChartValue) * 102;
                return (
                  <React.Fragment key={`expense-${index}`}>
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
          )}
        </View>

        {period !== 'day' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {period === 'week' ? 'Các ngày trong tuần' : period === 'month' ? 'Các tuần trong tháng' : period === 'quarter' ? 'Các tháng trong quý' : period === 'year' ? 'Các tháng trong năm' : 'Khoảng đã chọn'}
          </Text>
          <View style={styles.breakdownList}>
            {breakdownPoints.length === 0 || breakdownPoints.every(item => item.transactions === 0) ? (
              <Text style={styles.emptyText}>Không có dữ liệu trong kỳ này.</Text>
            ) : (
              breakdownPoints.filter(item => item.transactions > 0).map(item => {
                const isDay = item.start === item.end;
                const netAmount = item.income - item.expense;
                return (
                  <TouchableOpacity
                    key={`${item.start}-${item.end}`}
                    style={styles.breakdownRow}
                    onPress={() =>
                      navigation.navigate('TransactionSearch', {
                        wallets,
                        cashFlow: 'normal',
                        initialDateMode: isDay ? 'day' : 'range',
                        initialFromDate: item.start,
                        initialToDate: item.end,
                      })
                    }>
                    <View style={styles.recentCopy}>
                      <Text style={styles.recentTitle}>{item.label}</Text>
                      {!isDay ? <Text style={styles.recentMeta}>{formatDateRangeDisplay(item.start, item.end)}</Text> : null}
                      <Text style={styles.recentMeta}>
                        Thu {formatCurrency(item.income, displayCurrency)} · Chi {formatCurrency(item.expense, displayCurrency)}
                      </Text>
                    </View>
                    <Text
                      style={[styles.recentAmount, netAmount >= 0 ? styles.incomeAmount : styles.expenseAmount]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}>
                      {netAmount >= 0 ? '+' : '-'}{formatCurrency(Math.abs(netAmount), displayCurrency)}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
        ) : null}

        </>
        ) : null}

        {hasFullStats && activeTab === 'trend' ? (
        <>
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Danh mục chi tiêu trong kỳ</Text>
          </View>
          {expenseCategoryStats.length === 0 ? (
            <Text style={styles.emptyText}>Chưa có dữ liệu chi trong kỳ này.</Text>
          ) : (
            <>
              {hasFullStats && totalCategoryExpense > 0 ? (
                <View style={styles.donutRow}>
                  <Svg width={142} height={142} viewBox="0 0 142 142">
                    <Circle cx="71" cy="71" r="48" stroke="#FFE3C8" strokeWidth="18" fill="none" />
                    {expenseCategoryStats.slice(0, 6).map((item, index) => {
                      const angle = (item.total / totalCategoryExpense) * 360;
                      const path = describeArc(71, 71, 48, expenseDonutStartAngle, expenseDonutStartAngle + angle);
                      expenseDonutStartAngle += angle;

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
                      {formatCurrency(totalCategoryExpense, displayCurrency)}
                    </SvgText>
                  </Svg>
                  <View style={styles.donutLegend}>
                    {expenseCategoryStats.slice(0, 4).map((item, index) => (
                      <View key={`legend-${item.category}`} style={styles.donutLegendRow}>
                        <View style={[styles.donutLegendDot, { backgroundColor: donutColors[index % donutColors.length] }]} />
                        <Text style={styles.donutLegendText} numberOfLines={1}>{item.category}</Text>
                        <Text style={styles.donutLegendAmount}>{Math.round((item.total / totalCategoryExpense) * 100)}%</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {expenseCategoryStats.slice(0, 6).map(item => {
                const width = `${Math.max(8, (item.total / Math.max(topExpenseCategory?.total ?? 1, 1)) * 100)}%` as const;

                return (
                  <View key={item.category} style={styles.categoryRow}>
                    <View style={styles.categoryHeader}>
                      <View style={styles.categoryNameWrap}>
                        <CategoryIcon icon={item.icon ?? null} size={20} />
                        <Text style={styles.categoryName}>{item.category}</Text>
                      </View>
                      <Text style={styles.categoryAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                        {formatCurrency(item.total, displayCurrency)}
                      </Text>
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
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Danh mục thu nhập trong kỳ</Text>
          </View>
          {incomeCategoryStats.length === 0 ? (
            <Text style={styles.emptyText}>Chưa có dữ liệu thu trong kỳ này.</Text>
          ) : (
            <>
              {totalCategoryIncome > 0 ? (
                <View style={styles.donutRow}>
                  <Svg width={142} height={142} viewBox="0 0 142 142">
                    <Circle cx="71" cy="71" r="48" stroke="#D5F1E1" strokeWidth="18" fill="none" />
                    {incomeCategoryStats.slice(0, 6).map((item, index) => {
                      const angle = (item.total / totalCategoryIncome) * 360;
                      const path = describeArc(71, 71, 48, incomeDonutStartAngle, incomeDonutStartAngle + angle);
                      incomeDonutStartAngle += angle;

                      return (
                        <Path
                          key={`income-donut-${item.category}`}
                          d={path}
                          stroke={incomeDonutColors[index % incomeDonutColors.length]}
                          strokeWidth="18"
                          fill="none"
                          strokeLinecap="round"
                        />
                      );
                    })}
                    <SvgText x="71" y="67" fontSize="12" fill="#397357" textAnchor="middle" fontWeight="700">
                      Tổng thu
                    </SvgText>
                    <SvgText x="71" y="86" fontSize="13" fill="#24543B" textAnchor="middle" fontWeight="900">
                      {formatCurrency(totalCategoryIncome, displayCurrency)}
                    </SvgText>
                  </Svg>
                  <View style={styles.donutLegend}>
                    {incomeCategoryStats.slice(0, 4).map((item, index) => (
                      <View key={`income-legend-${item.category}`} style={styles.donutLegendRow}>
                        <View style={[styles.donutLegendDot, { backgroundColor: incomeDonutColors[index % incomeDonutColors.length] }]} />
                        <Text style={styles.donutLegendText} numberOfLines={1}>{item.category}</Text>
                        <Text style={styles.donutLegendAmount}>{Math.round((item.total / totalCategoryIncome) * 100)}%</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {incomeCategoryStats.slice(0, 6).map(item => {
                const width = `${Math.max(8, (item.total / Math.max(topIncomeCategory?.total ?? 1, 1)) * 100)}%` as const;

                return (
                  <View key={`income-${item.category}`} style={styles.categoryRow}>
                    <View style={styles.categoryHeader}>
                      <View style={styles.categoryNameWrap}>
                        <CategoryIcon icon={item.icon ?? null} size={20} />
                        <Text style={styles.categoryName}>{item.category}</Text>
                      </View>
                      <Text style={styles.categoryAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                        {formatCurrency(item.total, displayCurrency)}
                      </Text>
                    </View>
                    <View style={styles.categoryTrack}>
                      <View style={[styles.categoryFill, styles.incomeCategoryFill, { width }]} />
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>
        </>
        ) : null}

        {hasFullStats && activeTab === 'trend' && period === 'year' ? (
          <>
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.cardTitle}>Theo tháng</Text>
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
                      <Text style={styles.tagName} numberOfLines={1}>#{item.tag}</Text>
                      <Text style={styles.tagAmount} numberOfLines={1}>
                        {item.count ? `${item.count} lần · ` : ''}
                        {formatCurrency(item.total, displayCurrency)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
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
    padding: 5,
    rowGap: 6,
    columnGap: 6,
  },
  periodChip: {
    flexGrow: 1,
    flexBasis: '31%',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  periodChipActive: { backgroundColor: Colors.white },
  periodText: { color: '#8B6548', fontWeight: '900' },
  periodTextActive: { color: Colors.primary },
  filterCard: {
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: '#FFF9F3',
    padding: 12,
  },
  optionRow: { gap: 8, paddingRight: 10 },
  weekOptionRow: { marginTop: 10 },
  optionChip: {
    borderRadius: 999,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E8B680',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  optionChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionText: { color: '#7A4A28', fontSize: 12, fontWeight: '900' },
  optionTextActive: { color: Colors.white },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 8,
  },
  monthChip: {
    width: '22.5%',
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E8B680',
    paddingVertical: 9,
    alignItems: 'center',
  },
  monthChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  monthText: { color: '#7A4A28', fontWeight: '900' },
  monthTextActive: { color: Colors.white },
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
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 8,
  },
  dateRangeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
    columnGap: 10,
  },
  dateInputWrap: { flex: 1 },
  dateInputLabel: { color: '#7A4A28', fontSize: 12, fontWeight: '900', marginBottom: 6 },
  dateSelectCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  dateSelectValue: { color: '#4A2B1A', fontWeight: '900' },
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
  balanceAmount: { color: Colors.white, fontSize: 34, fontWeight: '900', marginTop: 8, width: '100%' },
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
  compareGrid: { gap: 10, marginTop: 12 },
  compareCard: {
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: '#FFF8F1',
    padding: 12,
  },
  compareLabel: { color: '#8B6548', fontSize: 12, fontWeight: '900' },
  compareIncome: { color: '#188F5A', fontSize: 18, fontWeight: '900', marginTop: 6, width: '100%' },
  compareExpense: { color: '#D4621D', fontSize: 18, fontWeight: '900', marginTop: 6, width: '100%' },
  compareMeta: { color: '#7A4A28', fontSize: 12, fontWeight: '800', marginTop: 5 },
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
  recentSevenCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1.2,
    borderColor: '#E8B680',
  },
  recentSevenHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  recentSevenSubtitle: { color: '#8B6548', fontSize: 12, fontWeight: '700', marginTop: 4 },
  recentSevenBadge: { borderRadius: 999, backgroundColor: '#FFEDD5', paddingHorizontal: 10, paddingVertical: 6 },
  recentSevenBadgeText: { color: '#EA580C', fontSize: 11, fontWeight: '900' },
  recentSevenTotal: { color: '#EA580C', fontSize: 26, fontWeight: '900', marginTop: 14, width: '100%' },
  recentSevenMeta: { color: '#8B735F', fontSize: 12, fontWeight: '800', marginTop: 5 },
  recentSevenChart: {
    minHeight: 148,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 7,
    marginTop: 16,
  },
  recentSevenBarItem: { flex: 1, alignItems: 'center' },
  recentSevenBarTrack: { height: 98, width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  recentSevenBar: { width: 18, borderRadius: 999 },
  recentSevenBarNormal: { backgroundColor: '#FDBA74' },
  recentSevenBarHighest: { backgroundColor: '#EA580C' },
  recentSevenBarLabel: { color: '#7A4A28', fontSize: 11, fontWeight: '900', marginTop: 8 },
  recentSevenBarAmount: { color: '#9A7255', fontSize: 9, fontWeight: '800', marginTop: 3 },
  recentSevenSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  recentSevenSummaryItem: { width: '48%', borderRadius: 16, backgroundColor: '#FFF8F1', borderWidth: 1, borderColor: '#F4DDC8', padding: 10 },
  recentSevenSummaryLabel: { color: '#8B6548', fontSize: 11, fontWeight: '800' },
  recentSevenSummaryValue: { color: '#4A2B1A', fontSize: 13, fontWeight: '900', marginTop: 5 },
  singleDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  singleDateInput: {
    flex: 1.2,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8B680',
    backgroundColor: '#FFFDFB',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  singleDateInputText: { color: '#4A2B1A', fontWeight: '900' },
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
  categoryNameWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryName: { flex: 1, color: '#4A2B1A', fontWeight: '800' },
  categoryAmount: { color: '#A94F18', fontWeight: '900', maxWidth: '46%', textAlign: 'right' },
  categoryTrack: { height: 10, borderRadius: 999, backgroundColor: '#FFE3C8', overflow: 'hidden', marginTop: 8 },
  categoryFill: { height: '100%', borderRadius: 999, backgroundColor: Colors.primary },
  incomeCategoryFill: { backgroundColor: '#188F5A' },
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
  tagName: { flex: 1, minWidth: 0, color: '#4A2B1A', fontWeight: '900' },
  tagAmount: { color: '#8B6548', fontSize: 12, fontWeight: '800', maxWidth: '42%', textAlign: 'right' },
  recentList: { marginTop: 12, gap: 10 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: '#FFF8F1', padding: 10 },
  breakdownList: { marginTop: 12, gap: 10 },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#FFF8F1',
    padding: 10,
  },
  recentIcon: { width: 38, height: 38, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  recentCopy: { flex: 1, minWidth: 0 },
  recentTitle: { color: '#4A2B1A', fontWeight: '900' },
  recentMeta: { color: '#8B6548', fontSize: 12, fontWeight: '700', marginTop: 3 },
  recentAmount: { fontSize: 12, fontWeight: '900', maxWidth: '38%', textAlign: 'right' },
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
