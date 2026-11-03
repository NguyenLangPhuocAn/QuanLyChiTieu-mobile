import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft } from 'lucide-react-native';
import { ActionButton } from '../../components/FormControls';
import BillPaidTransactionLink from '../../components/BillPaidTransactionLink';
import { useAuth } from '../../context/AuthContext';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { getApiBaseUrl } from '../../services/api';
import { categoriesService } from '../../services/categories';
import { recurringBillsService } from '../../services/recurringBills';
import type { Category } from '../../types/category';
import { formatCurrency } from '../../utils/format';
import { getTransactionDateKey } from '../../utils/mapTransactions';
import {
  billDateOffset,
  billOccurrences,
  type BillBook,
  type BillCycle,
} from '../../utils/recurringBills';

type Props = NativeStackScreenProps<RootStackParamList, 'RecurringBillDetail'>;
const dateLabel = (value: string) => value.split('-').reverse().join('/');
const cycles: Record<BillCycle, string> = {
  WEEKLY: 'Hằng tuần',
  MONTHLY: 'Hằng tháng',
  QUARTERLY: 'Hằng quý',
  YEARLY: 'Hằng năm',
};

export default function RecurringBillDetailScreen({
  navigation,
  route,
}: Props) {
  const { user, token } = useAuth();
  const scope = useMemo(
    () => ({ userId: user?.id ?? 0, server: getApiBaseUrl() }),
    [user?.id],
  );
  const [book, setBook] = useState<BillBook | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(20);
  const active = useRef(false);
  const revision = useRef(0);
  const { run, busy } = useSingleFlight();
  const load = useCallback(async () => {
    const current = ++revision.current;
    try {
      const next = await recurringBillsService.load(scope);
      if (active.current && current === revision.current) {
        setBook(next);
        setError(null);
      }
    } catch (reason) {
      if (active.current && current === revision.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Chưa đọc được lịch hóa đơn.',
        );
    }
  }, [scope]);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      load();
      if (token)
        categoriesService
          .getAll(token)
          .then(rows => {
            if (active.current) setCategories(rows);
          })
          .catch(() => undefined);
      return () => {
        active.current = false;
        revision.current += 1;
      };
    }, [load, token]),
  );
  const bill = book?.bills.find(
    item => item.id === route.params.billId && !item.archived,
  );
  const today = getTransactionDateKey(new Date().toISOString());
  const next = useMemo(
    () =>
      book
        ? billOccurrences(
            book,
            '2000-01-01',
            billDateOffset(today, 730),
            today,
          ).find(
            item =>
              item.bill.id === route.params.billId &&
              ['PENDING', 'OVERDUE'].includes(item.status),
          )
        : undefined,
    [book, route.params.billId, today],
  );
  const periods =
    book?.periods
      .filter(item => item.billId === route.params.billId)
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate)) ?? [];
  const execute = (operation: () => Promise<unknown>, close = false) =>
    run(async () => {
      try {
        await operation();
        if (!active.current) return;
        if (close) navigation.goBack();
        else await load();
      } catch (reason) {
        if (active.current)
          Alert.alert(
            'Chưa thực hiện được',
            reason instanceof Error ? reason.message : 'Vui lòng thử lại.',
          );
      }
    });
  if (!user || !token) return null;
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Quay lại lịch hóa đơn"
          style={styles.back}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={21} color="#593420" />
        </TouchableOpacity>
        <Text style={styles.title}>Chi tiết hóa đơn</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!book && !error ? <ActivityIndicator color="#FF8C00" /> : null}
        {book && !bill ? (
          <Text style={styles.muted}>Lịch này không còn tồn tại.</Text>
        ) : null}
        {bill ? (
          <>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.heading}>{bill.label}</Text>
                <Text style={styles.muted}>
                  {bill.paused ? 'Tạm dừng' : 'Đang theo dõi'}
                </Text>
              </View>
              <Text style={styles.amount}>
                {bill.kind === 'FIXED'
                  ? formatCurrency(bill.minAmount, bill.currency)
                  : `${formatCurrency(
                      bill.minAmount,
                      bill.currency,
                    )} – ${formatCurrency(bill.maxAmount, bill.currency)}`}
              </Text>
              <Text style={styles.muted}>
                {cycles[bill.cycle]} · từ{' '}
                {dateLabel(bill.startDate ?? bill.anchorDate)}
              </Text>
              <Text style={styles.muted}>
                Danh mục chi:{' '}
                {categories.find(item => item.id === bill.categoryId)?.name ??
                  'Chưa phân loại'}
              </Text>
              {bill.note ? <Text style={styles.muted}>{bill.note}</Text> : null}
            </View>
            {next ? (
              <View style={styles.card}>
                <Text style={styles.heading}>
                  Kỳ chưa trả · {dateLabel(next.dueDate)}
                </Text>
                <ActionButton
                  label="Thêm giao dịch"
                  onPress={() => navigation.push('Main', { billPayment: next })}
                />
              </View>
            ) : null}
            <View style={styles.card}>
              <Text style={styles.heading}>Lịch sử kỳ</Text>
              {!periods.length ? (
                <Text style={styles.muted}>Chưa có kỳ đã trả hoặc bỏ qua.</Text>
              ) : null}
              {periods.slice(0, visible).map(period => (
                <View key={period.dueDate} style={styles.period}>
                  <Text style={styles.label}>
                    Kỳ {dateLabel(period.dueDate)} ·{' '}
                    {period.status === 'PAID' ? 'Đã trả' : 'Đã bỏ qua'}
                  </Text>
                  {period.status === 'PAID' ? (
                    <BillPaidTransactionLink
                      payment={period.payment}
                      onOpen={transaction =>
                        navigation.navigate('TransactionDetail', {
                          transaction,
                        })
                      }
                    />
                  ) : null}
                </View>
              ))}
              {periods.length > visible ? (
                <ActionButton
                  label="Xem thêm kỳ"
                  secondary
                  onPress={() => setVisible(value => value + 20)}
                />
              ) : null}
            </View>
            <View style={styles.card}>
              <Text style={styles.heading}>Quản lý lịch</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Sửa lịch hóa đơn"
                  style={styles.action}
                  onPress={() =>
                    navigation.navigate('RecurringBills', {
                      editBillId: bill.id,
                    })
                  }
                >
                  <Text style={styles.actionText}>Sửa lịch</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={
                    bill.paused ? 'Tiếp tục lịch' : 'Tạm dừng'
                  }
                  style={styles.action}
                  disabled={busy}
                  onPress={() =>
                    execute(() =>
                      recurringBillsService.setPaused(
                        scope,
                        bill.id,
                        !bill.paused,
                      ),
                    )
                  }
                >
                  <Text style={styles.actionText}>
                    {bill.paused ? 'Tiếp tục lịch' : 'Tạm dừng'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Xóa lịch ${bill.label}`}
                  style={[styles.action, styles.deleteAction]}
                  disabled={busy}
                  onPress={() =>
                    Alert.alert(
                      'Xóa lịch hóa đơn?',
                      `${bill.label}\nGiao dịch đã ghi vẫn được giữ nguyên.`,
                      [
                        { text: 'Hủy', style: 'cancel' },
                        {
                          text: 'Xóa lịch',
                          style: 'destructive',
                          onPress: () =>
                            execute(
                              () =>
                                recurringBillsService.archive(scope, bill.id),
                              true,
                            ),
                        },
                      ],
                    )
                  }
                >
                  <Text style={styles.deleteText}>Xóa</Text>
                </TouchableOpacity>
              </View>
              <ActionButton
                label={
                  bill.reminderEnabled === false
                    ? 'Bật nhắc lịch này'
                    : 'Tắt nhắc lịch này'
                }
                secondary
                disabled={busy}
                onPress={() =>
                  execute(() =>
                    recurringBillsService.setReminder(
                      scope,
                      bill.id,
                      bill.reminderEnabled === false,
                    ),
                  )
                }
              />
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF9F3' },
  header: { padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#4A2B1A' },
  content: { padding: 18, paddingBottom: 40, gap: 14 },
  card: {
    padding: 16,
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1D4B9',
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  heading: { color: '#4A2B1A', fontSize: 16, fontWeight: '700', flexShrink: 1 },
  amount: { color: '#A95514', fontSize: 18, fontWeight: '700' },
  label: { color: '#593420', fontSize: 13, fontWeight: '600' },
  muted: { color: '#886449', fontSize: 13, lineHeight: 20 },
  error: { color: '#B3261E', fontSize: 13 },
  period: {
    paddingVertical: 8,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F4E3D3',
  },
  action: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F4E8DC',
    borderWidth: 1,
    borderColor: '#F1D4B9',
  },
  actionText: { color: '#593420', fontSize: 13, fontWeight: '700' },
  deleteAction: { backgroundColor: '#FFF7F4', borderColor: '#E7B7AC' },
  deleteText: { color: '#B3261E', fontSize: 13, fontWeight: '700' },
});
