import React, { useMemo } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Bell,
  ChartColumnBig,
  ChevronRight,
  CircleDollarSign,
  Lightbulb,
  PiggyBank,
  ShieldAlert,
  Target,
  Wallet as WalletIcon,
  WalletCards,
} from 'lucide-react-native';
import CategoryIcon from '../../components/CategoryIcon';
import { Colors } from '../../constants/Colors';
import { getWalletTypeMeta } from '../../constants/walletTypes';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import type { TransactionItem } from '../../data/mockTransactions';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { Wallet } from '../../types/wallet';
import { buildWalletBudgetAlerts } from '../../utils/budgetAlerts';
import { formatCurrency, formatDisplayDate } from '../../utils/format';

type Props = {
  wallets: Wallet[];
  refreshing: boolean;
  onRefresh: () => void;
  onAddTransaction: () => void;
};

type TopCategory = {
  name: string;
  total: number;
  icon?: string | null;
};

const getMonthLabel = () => {
  const now = new Date();

  return `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
};

const getCurrentMonthTransactions = (transactions: TransactionItem[]) => {
  const now = new Date();

  return transactions.filter(item => {
    const date = new Date(item.date);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
};

const getWalletMonthExpense = (walletId: number, transactions: TransactionItem[]) => {
  const now = new Date();

  return transactions.reduce((total, item) => {
    const date = new Date(item.date);
    const isCurrentMonth = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();

    return item.walletId === walletId && item.type === 'expense' && isCurrentMonth ? total + item.amount : total;
  }, 0);
};

const buildTopCategories = (transactions: TransactionItem[]): TopCategory[] => {
  const totals = new Map<string, TopCategory>();

  transactions
    .filter(item => item.type === 'expense')
    .forEach(item => {
      const current = totals.get(item.category);
      totals.set(item.category, {
        name: item.category,
        total: (current?.total ?? 0) + item.displayAmount,
        icon: current?.icon ?? item.categoryIcon,
      });
    });

  return [...totals.values()].sort((left, right) => right.total - left.total).slice(0, 3);
};

const buildRecentSevenDays = (transactions: TransactionItem[]) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dayTransactions = transactions.filter(item => {
      const itemDate = new Date(item.date);

      return itemDate.getFullYear() === date.getFullYear() && itemDate.getMonth() === date.getMonth() && itemDate.getDate() === date.getDate();
    });

    return {
      label: `${date.getDate()}/${date.getMonth() + 1}`,
      income: dayTransactions.filter(item => item.type === 'income').reduce((total, item) => total + item.displayAmount, 0),
      expense: dayTransactions.filter(item => item.type === 'expense').reduce((total, item) => total + item.displayAmount, 0),
    };
  });
};

const OverviewScreen = ({ wallets, refreshing, onRefresh, onAddTransaction }: Props) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { transactions, preferredCurrency } = useFinance();

  const monthTransactions = useMemo(() => getCurrentMonthTransactions(transactions), [transactions]);
  const totalBalance = useMemo(
    () => wallets.reduce((sum, wallet) => sum + Number(wallet.display_balance ?? wallet.balance ?? 0), 0),
    [wallets],
  );
  const income = monthTransactions
    .filter(item => item.type === 'income')
    .reduce((total, item) => total + item.displayAmount, 0);
  const expense = monthTransactions
    .filter(item => item.type === 'expense')
    .reduce((total, item) => total + item.displayAmount, 0);
  const saving = income - expense;
  const visibleWallets = wallets.slice(0, 3);
  const topCategories = buildTopCategories(monthTransactions);
  const budgetAlerts = buildWalletBudgetAlerts(wallets, transactions);
  const recentTransactions = transactions.slice(0, 4);
  const recentSevenDays = useMemo(() => buildRecentSevenDays(transactions), [transactions]);
  const recentSevenExpense = recentSevenDays.reduce((total, item) => total + item.expense, 0);
  const maxWeeklyExpense = Math.max(1, ...recentSevenDays.map(item => item.expense));
  const greetingName = user?.full_name?.split(' ')[0] || 'bạn';
  const monthLabel = getMonthLabel();

  const budgetRows = wallets
    .filter(wallet => Number(wallet.budget_limit || 0) > 0)
    .slice(0, 3)
    .map(wallet => {
      const budgetLimit = Number(wallet.budget_limit || 0);
      const spent = getWalletMonthExpense(wallet.id, transactions);
      const percent = budgetLimit > 0 ? spent / budgetLimit : 0;

      return {
        name: wallet.name,
        spent,
        budgetLimit,
        currency: wallet.currency,
        percent,
        status: percent >= 0.9 ? 'Gần hạn mức' : percent >= 0.6 ? 'Đang dùng' : 'Ổn định',
      };
    });

  const summaryRows = [
    { label: 'Tổng thu', value: income, color: '#188F5A' },
    { label: 'Tổng chi', value: expense, color: '#D87219' },
    { label: 'Số dư', value: saving, color: '#C87900' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.greeting}>Xin chào, {greetingName}</Text>
        </View>
        <TouchableOpacity style={styles.iconButton}>
          <Bell size={19} color="#8B6548" />
          {budgetAlerts.length > 0 ? (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>1</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <View style={styles.monthRow}>
        <Text style={styles.screenTitle}>Tổng quan</Text>
        <View style={styles.monthChip}>
          <Text style={styles.monthChipText}>{monthLabel}</Text>
        </View>
      </View>

      <View style={styles.walletCard}>
        <View style={styles.walletTopRow}>
          <View>
            <Text style={styles.walletCardTitle}>Ví của tôi</Text>
            <Text style={styles.walletCount}>
              {wallets.length > 0 ? `${wallets.length} ví đang sử dụng` : 'Chưa có ví'}
            </Text>
          </View>
          <TouchableOpacity style={styles.allWalletChip} onPress={() => navigation.navigate('Wallets')}>
            <Text style={styles.allWalletText}>Tất cả ví</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.balanceLabel}>Tổng số dư</Text>
        <Text style={styles.balanceValue}>{formatCurrency(totalBalance, preferredCurrency)}</Text>

        <View style={styles.walletPreview}>
          {visibleWallets.length === 0 ? (
            <Text style={styles.emptyOnDark}>Chưa có dữ liệu ví. Hãy tạo ví đầu tiên để bắt đầu.</Text>
          ) : (
            visibleWallets.map(wallet => {
              const typeMeta = getWalletTypeMeta(wallet.wallet_type);
              const WalletTypeIcon = typeMeta.Icon ?? WalletIcon;
              const amount = Number(wallet.display_balance ?? wallet.balance ?? 0);

              return (
                <TouchableOpacity
                  key={wallet.id}
                  style={styles.walletPreviewRow}
                  onPress={() => navigation.navigate('WalletTransactions', { walletId: wallet.id, walletName: wallet.name })}>
                  <View style={styles.walletMiniIcon}>
                    <WalletTypeIcon size={16} color="#D87219" />
                  </View>
                  <Text style={styles.walletPreviewName} numberOfLines={1}>{wallet.name}</Text>
                  <Text style={styles.walletPreviewAmount}>{formatCurrency(amount, wallet.currency)}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </View>

      <View style={styles.quickGrid}>
        {[
          { label: 'Ví của tôi', icon: WalletCards, onPress: () => navigation.navigate('Wallets') },
          { label: 'Báo cáo', icon: ChartColumnBig, onPress: () => navigation.navigate('Statistics') },
        ].map(item => {
          const Icon = item.icon;
          return (
            <TouchableOpacity key={item.label} style={styles.quickButton} onPress={item.onPress}>
              <View style={styles.quickIcon}>
                <Icon size={20} color={Colors.primary} />
              </View>
              <Text style={styles.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.statGrid}>
        <View style={styles.statCard}>
          <TrendingIcon type="income" />
          <Text style={styles.statLabel}>Tổng thu</Text>
          <Text style={[styles.statValue, styles.incomeText]}>{formatCurrency(income, preferredCurrency)}</Text>
        </View>
        <View style={styles.statCard}>
          <TrendingIcon type="expense" />
          <Text style={styles.statLabel}>Tổng chi</Text>
          <Text style={[styles.statValue, styles.expenseText]}>{formatCurrency(expense, preferredCurrency)}</Text>
        </View>
        <View style={styles.statCard}>
          <PiggyBank size={20} color="#C87900" />
          <Text style={styles.statLabel}>Thu - chi tháng này</Text>
          <Text style={[styles.statValue, styles.savingText]}>{formatCurrency(saving, preferredCurrency)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tiến độ ngân sách</Text>
          <Target size={20} color={Colors.primary} />
        </View>
        {budgetRows.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có ngân sách ví để theo dõi.</Text>
        ) : (
          budgetRows.map(row => (
            <View key={row.name} style={styles.budgetRow}>
              <View style={styles.budgetTop}>
                <Text style={styles.budgetName}>{row.name}</Text>
                <Text style={[
                  styles.statusPill,
                  row.percent >= 0.9 ? styles.statusDanger : row.percent >= 0.6 ? styles.statusWarning : styles.statusOk,
                ]}>
                  {row.status}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    row.percent >= 0.9 ? styles.progressDanger : row.percent >= 0.6 ? styles.progressWarning : styles.progressNormal,
                    { width: `${Math.min(100, Math.max(6, row.percent * 100))}%` },
                  ]}
                />
              </View>
              <Text style={styles.budgetMeta}>
                {formatCurrency(row.spent, row.currency)} / {formatCurrency(row.budgetLimit, row.currency)}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Thống kê</Text>
          <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate('Statistics')}>
            <Text style={styles.linkText}>Xem</Text>
            <ChevronRight size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.filterChips}>
          {['Tuần', 'Tháng', 'Năm'].map(item => (
            <View key={item} style={[styles.filterChip, item === 'Tuần' && styles.filterChipActive]}>
              <Text style={[styles.filterText, item === 'Tuần' && styles.filterTextActive]}>{item}</Text>
            </View>
          ))}
          <View style={styles.premiumChip}>
            <Text style={styles.premiumText}>Danh mục · Premium</Text>
          </View>
        </View>
        <Text style={styles.chartTitle}>Chi tiêu 7 ngày gần nhất</Text>
        {recentSevenDays.every(item => item.income === 0 && item.expense === 0) ? (
          <Text style={styles.emptyText}>Chưa có dữ liệu 7 ngày gần nhất.</Text>
        ) : (
          <>
            <Svg width="100%" height={128} viewBox="0 0 320 128">
              {recentSevenDays.map((item, index) => {
                const height = Math.max(8, (item.expense / maxWeeklyExpense) * 78);
                const x = 28 + index * 40;

                return (
                  <React.Fragment key={`${item.label}-${index}`}>
                    <Rect x={x} y={88 - height} width={18} height={height} rx={8} fill={index === recentSevenDays.length - 1 ? Colors.primary : '#F2B36D'} />
                    <SvgText x={x + 9} y={116} fontSize="11" fill="#8B6548" textAnchor="middle">
                      {item.label}
                    </SvgText>
                  </React.Fragment>
                );
              })}
            </Svg>
            <Text style={styles.chartSummary}>
              Tổng chi 7 ngày gần nhất: {formatCurrency(recentSevenExpense, preferredCurrency)}
            </Text>
          </>
        )}
      </View>

      <View style={styles.insightCard}>
        <View style={styles.insightIcon}>
          <Lightbulb size={21} color="#C87900" />
        </View>
        <View style={styles.insightCopy}>
          <Text style={styles.insightTitle}>Gợi ý hôm nay</Text>
          {budgetRows.length === 0 && topCategories.length === 0 ? (
            <Text style={styles.insightText}>Chưa có dữ liệu để tạo gợi ý. Hãy thêm giao dịch và ngân sách.</Text>
          ) : (
            <>
              {budgetRows[0] ? (
                <Text style={styles.insightText}>
                  {budgetRows[0].name} đã dùng {Math.round(budgetRows[0].percent * 100)}% ngân sách tháng này
                </Text>
              ) : null}
              {topCategories[0] ? <Text style={styles.insightText}>Danh mục chi nhiều nhất: {topCategories[0].name}</Text> : null}
              {budgetRows.find(item => item.percent >= 0.8) ? (
                <Text style={styles.insightText}>
                  {budgetRows.find(item => item.percent >= 0.8)?.name} đang gần đạt hạn mức
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
              <Text style={styles.warningText}>{alert.walletName}: {alert.reasons[0]}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Giao dịch gần đây</Text>
          <Text style={styles.mutedAction}>{recentTransactions.length} mới nhất</Text>
        </View>
        {recentTransactions.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có giao dịch gần đây.</Text>
        ) : (
          recentTransactions.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.transactionRow}
              activeOpacity={0.86}
              onPress={() => navigation.navigate('TransactionDetail', { transaction: item })}>
              <View style={styles.transactionIcon}>
                <CategoryIcon icon={item.categoryIcon} size={18} />
              </View>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionName}>{item.note}</Text>
                <Text style={styles.transactionMeta}>{item.category} · {formatDisplayDate(item.date)}</Text>
              </View>
              <Text style={item.type === 'income' ? styles.transactionIncome : styles.transactionExpense}>
                {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount, item.currency)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.panelRow}>
        <View style={styles.miniPanel}>
          <Text style={styles.panelTitle}>Tóm tắt tháng này</Text>
          {summaryRows.map(row => (
            <View key={row.label} style={styles.panelLine}>
              <Text style={styles.panelLabel}>{row.label}</Text>
              <Text style={[styles.panelValue, { color: row.color }]}>{formatCurrency(row.value, preferredCurrency)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.miniPanel}>
          <Text style={styles.panelTitle}>Top chi tiêu</Text>
          {topCategories.length === 0 ? (
            <Text style={styles.emptyText}>Chưa có dữ liệu chi tiêu.</Text>
          ) : (
            topCategories.map((row, index) => (
              <View key={row.name} style={styles.panelLine}>
                <Text style={styles.panelLabel}>{index + 1}. {row.name}</Text>
                <Text style={styles.panelValue}>{formatCurrency(row.total, preferredCurrency)}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const TrendingIcon = ({ type }: { type: 'income' | 'expense' }) => (
  <View style={type === 'income' ? styles.trendIncomeIcon : styles.trendExpenseIcon}>
    <CircleDollarSign size={18} color={type === 'income' ? '#188F5A' : '#D87219'} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF3E8' },
  content: { padding: 16, paddingBottom: 136, gap: 14 },
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
  notificationBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '900' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.white, fontWeight: '900', fontSize: 16 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  screenTitle: { color: '#4A2B1A', fontSize: 28, fontWeight: '900' },
  monthChip: { backgroundColor: '#FFE3C8', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  monthChipText: { color: '#A94F18', fontWeight: '900', fontSize: 12 },
  walletCard: {
    backgroundColor: Colors.primary,
    borderRadius: 28,
    padding: 18,
    shadowColor: '#7A3E12',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  walletTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  walletCardTitle: { color: Colors.white, fontSize: 22, fontWeight: '900' },
  walletCount: { color: '#FFF4E7', fontWeight: '700', marginTop: 4 },
  allWalletChip: { backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  allWalletText: { color: '#A94F18', fontWeight: '900', fontSize: 12 },
  balanceLabel: { color: '#FFF4E7', fontWeight: '800', marginTop: 22 },
  balanceValue: { color: Colors.white, fontSize: 32, fontWeight: '900', marginTop: 6 },
  walletPreview: { backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 20, padding: 10, marginTop: 18, gap: 8 },
  walletPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  walletMiniIcon: { width: 30, height: 30, borderRadius: 12, backgroundColor: '#FFF0DF', alignItems: 'center', justifyContent: 'center' },
  walletPreviewName: { flex: 1, color: '#4A2B1A', fontWeight: '800' },
  walletPreviewAmount: { color: '#4A2B1A', fontWeight: '900' },
  emptyOnDark: { color: '#7A4A28', fontWeight: '800', lineHeight: 20 },
  quickGrid: { flexDirection: 'row', gap: 10 },
  quickButton: { flex: 1, minHeight: 86, backgroundColor: '#FFFDFB', borderRadius: 20, borderWidth: 1, borderColor: '#F0C49B', alignItems: 'center', justifyContent: 'center', padding: 8 },
  quickIcon: { width: 38, height: 38, borderRadius: 15, backgroundColor: '#FFF0DF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickLabel: { color: '#4A2B1A', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  statGrid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: '#FFFDFB', borderRadius: 20, borderWidth: 1, borderColor: '#F0C49B', padding: 12, minHeight: 116 },
  trendIncomeIcon: { width: 34, height: 34, borderRadius: 14, backgroundColor: '#E9F8EF', alignItems: 'center', justifyContent: 'center' },
  trendExpenseIcon: { width: 34, height: 34, borderRadius: 14, backgroundColor: '#FFF0DF', alignItems: 'center', justifyContent: 'center' },
  statLabel: { color: '#8B6548', fontSize: 12, fontWeight: '800', marginTop: 9 },
  statValue: { fontSize: 14, fontWeight: '900', marginTop: 5 },
  incomeText: { color: '#188F5A' },
  expenseText: { color: '#D87219' },
  savingText: { color: '#C87900' },
  card: { backgroundColor: '#FFFDFB', borderRadius: 24, borderWidth: 1, borderColor: '#F0C49B', padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  sectionTitle: { color: '#4A2B1A', fontSize: 18, fontWeight: '900' },
  emptyText: { color: '#8B6548', fontWeight: '800', lineHeight: 21, marginTop: 4 },
  budgetRow: { marginTop: 12 },
  budgetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetName: { color: '#4A2B1A', fontWeight: '900' },
  statusPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, fontSize: 11, fontWeight: '900' },
  statusOk: { color: '#188F5A', backgroundColor: '#E9F8EF' },
  statusWarning: { color: '#B26A00', backgroundColor: '#FFF1CF' },
  statusDanger: { color: '#C75A1B', backgroundColor: '#FFE4D8' },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: '#FFE3C8', overflow: 'hidden', marginTop: 9 },
  progressFill: { height: '100%', borderRadius: 999 },
  progressNormal: { backgroundColor: Colors.primary },
  progressWarning: { backgroundColor: '#F0AA24' },
  progressDanger: { backgroundColor: '#D85F3F' },
  budgetMeta: { color: '#8B6548', fontSize: 12, fontWeight: '700', marginTop: 7 },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  linkText: { color: Colors.primary, fontWeight: '900' },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { borderRadius: 999, backgroundColor: '#FFF0DF', paddingHorizontal: 12, paddingVertical: 8 },
  filterChipActive: { backgroundColor: Colors.primary },
  filterText: { color: '#8B6548', fontWeight: '900', fontSize: 12 },
  filterTextActive: { color: Colors.white },
  premiumChip: { borderRadius: 999, backgroundColor: '#4A2B1A', paddingHorizontal: 12, paddingVertical: 8 },
  premiumText: { color: Colors.white, fontWeight: '900', fontSize: 12 },
  chartTitle: { color: '#4A2B1A', fontWeight: '900', marginTop: 14 },
  chartLoader: { marginVertical: 22 },
  chartSummary: { color: '#A94F18', fontWeight: '900', marginTop: 6 },
  insightCard: { backgroundColor: '#FFF1CF', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#F2C972', flexDirection: 'row', gap: 12 },
  insightIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: '#FFE4A3', alignItems: 'center', justifyContent: 'center' },
  insightCopy: { flex: 1 },
  insightTitle: { color: '#4A2B1A', fontSize: 18, fontWeight: '900', marginBottom: 6 },
  insightText: { color: '#7A4A28', fontWeight: '800', lineHeight: 21 },
  warningCard: { backgroundColor: '#FFF0EA', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#F1A58D' },
  warningTitle: { color: '#7A2B18', fontSize: 18, fontWeight: '900' },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 10 },
  warningDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D85F3F' },
  warningText: { flex: 1, color: '#8F3F28', fontWeight: '800', lineHeight: 20 },
  mutedAction: { color: '#8B6548', fontWeight: '800', fontSize: 12 },
  transactionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: 1, borderTopColor: '#F4DDC8' },
  transactionIcon: { width: 40, height: 40, borderRadius: 15, backgroundColor: '#FFF0DF', alignItems: 'center', justifyContent: 'center' },
  transactionInfo: { flex: 1 },
  transactionName: { color: '#4A2B1A', fontWeight: '900' },
  transactionMeta: { color: '#8B6548', fontSize: 12, fontWeight: '700', marginTop: 4 },
  transactionIncome: { color: '#188F5A', fontWeight: '900' },
  transactionExpense: { color: '#D87219', fontWeight: '900' },
  panelRow: { gap: 14 },
  miniPanel: { backgroundColor: '#FFFDFB', borderRadius: 24, borderWidth: 1, borderColor: '#F0C49B', padding: 16 },
  panelTitle: { color: '#4A2B1A', fontSize: 17, fontWeight: '900', marginBottom: 8 },
  panelLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F4DDC8' },
  panelLabel: { color: '#8B6548', fontWeight: '800' },
  panelValue: { color: '#4A2B1A', fontWeight: '900' },
});

export default OverviewScreen;
