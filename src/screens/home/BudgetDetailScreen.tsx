import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  CalendarDays,
  TrendingUp,
  WalletCards,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { budgetsService } from '../../services/budgets';
import type { Budget, BudgetTransaction } from '../../types/budget';
import { buildBudgetForecastView } from '../../utils/budgetForecast';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency, formatDisplayDate } from '../../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'BudgetDetail'>;
const PAGE_SIZE = 10;

const periodLabels = {
  DAY: 'Ngày',
  WEEK: 'Tuần',
  MONTH: 'Tháng',
  QUARTER: 'Quý',
  YEAR: 'Năm',
  CUSTOM: 'Tùy chọn',
} as const;

const BudgetDetailScreen = ({ navigation, route }: Props) => {
  const { token } = useAuth();
  const [budget, setBudget] = useState<Budget | null>(null);
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDetail = useCallback(
    async (refreshing = false) => {
      if (!token) {
        return;
      }

      refreshing ? setIsRefreshing(true) : setIsLoading(true);
      try {
        const [nextBudget, transactionPage] = await Promise.all([
          budgetsService.getOne(token, route.params.budgetId),
          budgetsService.getTransactions(
            token,
            route.params.budgetId,
            page,
            PAGE_SIZE,
          ),
        ]);
        setBudget(nextBudget);
        setTransactions(transactionPage.data);
        setMeta({
          total: transactionPage.meta.total,
          totalPages: transactionPage.meta.totalPages,
        });
      } catch (error) {
        Alert.alert(
          'Không tải được chi tiết ngân sách',
          getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.'),
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [page, route.params.budgetId, token],
  );

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const forecastView = useMemo(() => {
    if (!budget?.forecast) {
      return null;
    }

    return buildBudgetForecastView(
      budget.forecast,
      Number(budget.available_limit_amount ?? budget.limit_amount),
      budget.wallet_currency,
    );
  }, [budget]);

  const openTransaction = (transaction: BudgetTransaction) => {
    navigation.navigate('TransactionDetail', {
      transaction: {
        id: String(transaction.id),
        walletId: transaction.wallet_id,
        categoryId: transaction.category_id,
        categoryIcon: transaction.category_icon,
        note: transaction.note || transaction.category_name || 'Khoản chi',
        category: transaction.category_name || 'Chưa phân loại',
        wallet: transaction.wallet_name,
        currency: transaction.currency,
        displayAmount: transaction.amount,
        displayCurrency: transaction.currency,
        type: 'expense',
        amount: transaction.amount,
        date: transaction.transaction_date,
      },
    });
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
        <Text style={styles.headerTitle}>Chi tiết ngân sách</Text>
        <View style={styles.headerButton} />
      </View>

      {isLoading && !budget ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : budget ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchDetail(true)}
            />
          }
        >
          <View style={styles.heroCard}>
            <Text style={styles.heroName}>{budget.name}</Text>
            <Text style={styles.heroMeta}>
              {periodLabels[budget.period]} ·{' '}
              {formatDisplayDate(budget.start_date)} -{' '}
              {formatDisplayDate(budget.end_date)}
            </Text>
            <View style={styles.amountRow}>
              <Text style={styles.spentAmount}>
                {formatCurrency(budget.spent, budget.wallet_currency)}
              </Text>
              <Text style={styles.limitAmount}>
                /{' '}
                {formatCurrency(
                  Number(budget.available_limit_amount ?? budget.limit_amount),
                  budget.wallet_currency,
                )}
              </Text>
            </View>
            <Text
              style={
                budget.status === 'EXCEEDED'
                  ? styles.dangerText
                  : styles.remainingText
              }
            >
              {Number(budget.effective_remaining ?? budget.remaining) < 0
                ? 'Vượt '
                : 'Còn lại '}
              {formatCurrency(
                Math.abs(
                  Number(budget.effective_remaining ?? budget.remaining),
                ),
                budget.wallet_currency,
              )}
            </Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <WalletCards size={19} color={Colors.primary} />
              <View style={styles.infoCopy}>
                <Text style={styles.infoLabel}>Phạm vi</Text>
                <Text style={styles.infoValue}>
                  {budget.scope === 'WALLET'
                    ? `Toàn ví · ${budget.wallet_name}`
                    : `${budget.wallet_name} · ${
                        budget.category_name || 'Danh mục'
                      }`}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <CalendarDays size={19} color={Colors.primary} />
              <View style={styles.infoCopy}>
                <Text style={styles.infoLabel}>Khoảng thời gian</Text>
                <Text style={styles.infoValue}>
                  {formatDisplayDate(budget.start_date)} -{' '}
                  {formatDisplayDate(budget.end_date)}
                </Text>
              </View>
            </View>
          </View>

          {forecastView && budget.forecast ? (
            <View style={styles.infoCard}>
              <View style={styles.sectionTitleRow}>
                <TrendingUp
                  size={20}
                  color={
                    forecastView.tone === 'danger' ? '#B3261E' : Colors.primary
                  }
                />
                <Text style={styles.sectionTitle}>Dự báo cuối kỳ</Text>
              </View>
              <Text style={styles.forecastPrimary}>
                {forecastView.projectionLabel}
              </Text>
              <Text
                style={
                  forecastView.tone === 'danger'
                    ? styles.dangerText
                    : styles.remainingText
                }
              >
                {forecastView.projectionHint}
              </Text>
              <Text style={styles.forecastHint}>
                {forecastView.recommendationLabel}
              </Text>
              <Text style={styles.disclaimer}>
                Dự báo dựa trên tốc độ chi hiện tại, không cộng vào số đã chi.
              </Text>
            </View>
          ) : null}

          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>
              Giao dịch được tính ({meta.total})
            </Text>
            {transactions.length === 0 ? (
              <Text style={styles.emptyText}>
                Chưa có giao dịch chi phù hợp trong kỳ ngân sách.
              </Text>
            ) : (
              transactions.map(transaction => (
                <TouchableOpacity
                  key={transaction.id}
                  style={styles.transactionRow}
                  onPress={() => openTransaction(transaction)}
                >
                  <View style={styles.transactionCopy}>
                    <Text style={styles.transactionNote}>
                      {transaction.note ||
                        transaction.category_name ||
                        'Khoản chi'}
                    </Text>
                    <Text style={styles.transactionMeta}>
                      {formatDisplayDate(transaction.transaction_date)} ·{' '}
                      {transaction.category_name || 'Chưa phân loại'}
                    </Text>
                  </View>
                  <Text style={styles.transactionAmount}>
                    -{formatCurrency(transaction.amount, transaction.currency)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          {meta.total > PAGE_SIZE ? (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[
                  styles.pageButton,
                  page === 1 && styles.pageButtonDisabled,
                ]}
                disabled={page === 1}
                onPress={() => setPage(value => Math.max(1, value - 1))}
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
                Trang {page}/{meta.totalPages}
              </Text>
              <TouchableOpacity
                style={[
                  styles.pageButton,
                  page === meta.totalPages && styles.pageButtonDisabled,
                ]}
                disabled={page === meta.totalPages}
                onPress={() =>
                  setPage(value => Math.min(meta.totalPages, value + 1))
                }
              >
                <Text
                  style={[
                    styles.pageButtonText,
                    page === meta.totalPages && styles.pageButtonTextDisabled,
                  ]}
                >
                  Sau
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.loadingBlock}>
          <Text style={styles.emptyText}>Không tìm thấy ngân sách.</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF7EF' },
  header: {
    minHeight: 62,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF0E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#4A2B1A', fontSize: 19, fontWeight: '900' },
  content: { padding: 16, paddingBottom: 44, gap: 14 },
  loadingBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  heroCard: { borderRadius: 14, backgroundColor: '#5B4636', padding: 18 },
  heroName: { color: Colors.white, fontSize: 21, fontWeight: '900' },
  heroMeta: { color: '#EADBCF', fontSize: 12, fontWeight: '700', marginTop: 6 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
    marginTop: 20,
  },
  spentAmount: { color: '#FFE3A3', fontSize: 25, fontWeight: '900' },
  limitAmount: { color: '#EADBCF', fontSize: 13, fontWeight: '800' },
  remainingText: {
    color: '#28724A',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 8,
  },
  dangerText: {
    color: '#B3261E',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 8,
  },
  infoCard: {
    borderRadius: 14,
    backgroundColor: '#FFFDFC',
    borderWidth: 1,
    borderColor: '#F0D6C1',
    padding: 16,
    gap: 13,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoCopy: { flex: 1 },
  infoLabel: { color: '#8B6548', fontSize: 11, fontWeight: '800' },
  infoValue: {
    color: '#4A2B1A',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 3,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: '#4A2B1A', fontSize: 16, fontWeight: '900' },
  forecastPrimary: { color: '#4A2B1A', fontSize: 19, fontWeight: '900' },
  forecastHint: { color: '#6E4B35', fontSize: 14, fontWeight: '900' },
  disclaimer: { color: '#9A765B', fontSize: 11, lineHeight: 17 },
  emptyText: { color: '#8B6548', lineHeight: 20, textAlign: 'center' },
  transactionRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3E5DA',
    paddingTop: 12,
  },
  transactionCopy: { flex: 1 },
  transactionNote: { color: '#4A2B1A', fontSize: 14, fontWeight: '900' },
  transactionMeta: {
    color: '#8B6548',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  transactionAmount: { color: '#B3261E', fontSize: 13, fontWeight: '900' },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
});

export default BudgetDetailScreen;
