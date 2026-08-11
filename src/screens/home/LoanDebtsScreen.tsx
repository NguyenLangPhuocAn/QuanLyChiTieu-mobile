import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import { loanDebtsService } from '../../services/loanDebts';
import type {
  LoanDebt,
  LoanDebtStatus,
  LoanDebtType,
} from '../../types/loanDebt';
import { formatCurrency } from '../../utils/format';
import {
  getLoanDebtErrorMessage,
  getLoanDebtStatusLabel,
  getLoanDebtTypeLabel,
} from '../../utils/loanDebt';
import { filterLoanDebtsByPeriod, toLoanDebtDateKey, type LoanDebtPeriodFilter } from '../../utils/loanDebtPeriodFilter';

type Props = NativeStackScreenProps<RootStackParamList, 'LoanDebts'>;

const LoanDebtsScreen = ({ navigation }: Props) => {
  const { token } = useAuth();
  const [records, setRecords] = useState<LoanDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<LoanDebtType>();
  const [status, setStatus] = useState<LoanDebtStatus>();
  const [periodFilter, setPeriodFilter] = useState<LoanDebtPeriodFilter>('CURRENT');
  const [filterStartDate, setFilterStartDate] = useState(toLoanDebtDateKey(new Date()));
  const [filterEndDate, setFilterEndDate] = useState(toLoanDebtDateKey(new Date()));
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'end' | null>(null);
  const filteredRecords = filterLoanDebtsByPeriod(records, periodFilter, new Date(), filterStartDate, filterEndDate);

  const onFilterDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    const target = datePickerTarget;
    setDatePickerTarget(null);
    if (!target || !selectedDate) return;
    const value = toLoanDebtDateKey(selectedDate);
    if (target === 'start') setFilterStartDate(value);
    else setFilterEndDate(value);
  };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setRecords(await loanDebtsService.getAll(token, { type, status }));
    } catch (error) {
      Alert.alert(
        'Không tải được vay/nợ',
        getLoanDebtErrorMessage(error, 'Không tải được danh sách vay/nợ. Vui lòng thử lại.'),
      );
    } finally {
      setLoading(false);
    }
  }, [status, token, type]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.icon}
          onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>
        <Text style={styles.title}>Vay/Nợ</Text>
        <TouchableOpacity
          style={styles.icon}
          onPress={() => navigation.navigate('LoanDebtForm')}>
          <Plus size={22} color="#593420" />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.filterTitle}>Loại</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}>
          {[
            { value: undefined, label: 'Tất cả' },
            { value: 'BORROWED' as const, label: 'Vay' },
            { value: 'LENT' as const, label: 'Cho vay' },
          ].map(item => (
            <TouchableOpacity
              key={item.label}
              style={[styles.chip, type === item.value && styles.chipActive]}
              onPress={() => setType(item.value)}>
              <Text
                style={[
                  styles.chipText,
                  type === item.value && styles.chipTextActive,
                ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={styles.filterTitle}>Thời gian</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[
            { value: 'CURRENT' as const, label: 'Đang áp dụng' },
            { value: 'PREVIOUS_MONTH' as const, label: 'Tháng trước' },
            { value: 'PREVIOUS_QUARTER' as const, label: 'Quý trước' },
            { value: 'PREVIOUS_YEAR' as const, label: 'Năm trước' },
            { value: 'CUSTOM_RANGE' as const, label: 'Tùy chọn' },
            { value: 'ALL' as const, label: 'Tất cả' },
          ].map(item => (
            <TouchableOpacity key={item.value} style={[styles.chip, periodFilter === item.value && styles.chipActive]} onPress={() => setPeriodFilter(item.value)}>
              <Text style={[styles.chipText, periodFilter === item.value && styles.chipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {periodFilter === 'CUSTOM_RANGE' ? (
          <View style={styles.dateFilterRow}>
            <TouchableOpacity style={styles.dateFilterButton} onPress={() => setDatePickerTarget('start')}><Text style={styles.dateFilterLabel}>Từ ngày</Text><Text style={styles.dateFilterValue}>{filterStartDate}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.dateFilterButton} onPress={() => setDatePickerTarget('end')}><Text style={styles.dateFilterLabel}>Đến ngày</Text><Text style={styles.dateFilterValue}>{filterEndDate}</Text></TouchableOpacity>
          </View>
        ) : null}
        <Text style={styles.filterTitle}>Trạng thái</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}>
          {[
            { value: undefined, label: 'Tất cả' },
            { value: 'OPEN' as const, label: 'Đang mở' },
            { value: 'OVERDUE' as const, label: 'Quá hạn' },
            { value: 'PAID' as const, label: 'Đã thanh toán' },
          ].map(item => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.chip,
                status === item.value && styles.chipActive,
              ]}
              onPress={() => setStatus(item.value)}>
              <Text
                style={[
                  styles.chipText,
                  status === item.value && styles.chipTextActive,
                ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {loading ? (
          <ActivityIndicator color="#FF8500" style={styles.loading} />
        ) : filteredRecords.length === 0 ? (
          <Text style={styles.empty}>Chưa có khoản vay/nợ.</Text>
        ) : (
          filteredRecords.map(record => (
            <TouchableOpacity
              key={record.id}
              style={styles.card}
              onPress={() =>
                navigation.navigate('LoanDebtDetail', {
                  loanDebtId: record.id,
                })
              }>
              <View style={styles.row}>
                <View style={styles.cardTitleBlock}>
                  <Text style={styles.name} numberOfLines={2}>
                    {record.person_name}
                  </Text>
                  <Text style={styles.meta}>
                    {getLoanDebtTypeLabel(record.type)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    record.status === 'OVERDUE' && styles.overdue,
                    record.status === 'PAID' && styles.paid,
                  ]}>
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {getLoanDebtStatusLabel(record.status)}
                  </Text>
                </View>
              </View>
              <Text style={styles.amount}>
                {formatCurrency(record.remaining_amount, record.currency)} còn lại
              </Text>
              <Text style={styles.detail}>
                Gốc {formatCurrency(record.principal_amount, record.currency)} ·
                Đã thanh toán{' '}
                {formatCurrency(record.settled_amount, record.currency)}
              </Text>
              {record.due_date ? (
                <Text style={styles.detail}>
                  Hẹn trả: {record.due_date.slice(0, 10)}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      {datePickerTarget ? <DateTimePicker value={new Date(`${datePickerTarget === 'start' ? filterStartDate : filterEndDate}T00:00:00`)} mode="date" onChange={onFilterDateChange} /> : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F1' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF0E1', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '900', color: '#4A2B1A' },
  content: { padding: 16, paddingBottom: 40 },
  filterTitle: { fontWeight: '900', color: '#4A2B1A', marginBottom: 8, marginTop: 8 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 12, paddingRight: 16 },
  chip: { borderWidth: 1, borderColor: '#F0C8A7', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#FFF', flexShrink: 0 },
  chipActive: { backgroundColor: '#FF8500', borderColor: '#FF8500' },
  chipText: { fontWeight: '800', color: '#7B573C' },
  chipTextActive: { color: '#FFF' },
  loading: { marginTop: 40 },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#F0C8A7', borderRadius: 18, padding: 16, marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardTitleBlock: { flex: 1, minWidth: 0 },
  name: { fontSize: 18, fontWeight: '900', color: '#4A2B1A', lineHeight: 24 },
  meta: { color: '#8B674D', marginTop: 4 },
  badge: { backgroundColor: '#E7F8EF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, flexShrink: 0, maxWidth: 126 },
  overdue: { backgroundColor: '#FFE5E1' },
  paid: { backgroundColor: '#EEE' },
  badgeText: { fontSize: 11, fontWeight: '900', color: '#4A2B1A' },
  amount: { fontSize: 20, fontWeight: '900', color: '#D66C00', marginTop: 16 },
  detail: { color: '#8B674D', marginTop: 6 },
  empty: { textAlign: 'center', color: '#8B674D', marginTop: 50 },
  dateFilterRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dateFilterButton: { flex: 1, borderWidth: 1, borderColor: '#F0C8A7', backgroundColor: '#FFF', borderRadius: 14, padding: 12 },
  dateFilterLabel: { color: '#8B674D', fontWeight: '800', fontSize: 12 },
  dateFilterValue: { color: '#4A2B1A', fontWeight: '900', marginTop: 4 },
});

export default LoanDebtsScreen;
