import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  AppState,
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
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import { getApiBaseUrl } from '../../services/api';
import {
  dashboardCache,
  type DashboardCache,
} from '../../services/dashboardCache';
import { recurringBillsService as recurringBills } from '../../services/recurringBills';
import {
  offlineTransactionQueue,
  createClientRequestId,
  type OfflineTransactionDraft,
} from '../../services/offlineTransactionQueue';
import { moneyCalendarPlans } from '../../services/moneyCalendarPlans';
import {
  buildMoneyCalendar,
  validateMoneyPlan,
  type MoneyPlan,
} from '../../utils/moneyCalendar';
import type { BillBook } from '../../utils/recurringBills';
import { toDateKey } from '../../utils/budgetPeriod';
import { formatCurrency } from '../../utils/format';
import {
  parsePositiveMoneyInput,
  formatMoneyInputForCurrency,
  normalizeMoneyInputForCurrency,
} from '../../utils/moneyInput';

type Props = NativeStackScreenProps<RootStackParamList, 'MoneyCalendar'>;
type Data = {
  cache: DashboardCache;
  book: BillBook;
  plans: MoneyPlan[];
  drafts: OfflineTransactionDraft[];
};
export default function MoneyCalendarScreen({ navigation }: Props) {
  const { user } = useAuth();
  const server = getApiBaseUrl(),
    currency = user?.currency_default || 'VND';
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState(false);
  const [label, setLabel] = useState(''),
    [amount, setAmount] = useState('');
  const [date, setDate] = useState(toDateKey(new Date()));
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [busy, setBusy] = useState(false);
  const [showCalculation, setShowCalculation] = useState(false);
  const [today, setToday] = useState(toDateKey(new Date()));
  useEffect(() => {
    const next = new Date();
    next.setHours(24, 0, 0, 100);
    const refreshDay = () => setToday(toDateKey(new Date()));
    const timer = setTimeout(refreshDay, next.getTime() - Date.now());
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refreshDay();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [today]);
  const writing = useRef(false),
    generation = useRef(0);
  const scope = useMemo(
    () => ({ userId: user?.id ?? 0, server }),
    [user?.id, server],
  );
  useFocusEffect(
    useCallback(() => {
      const version = ++generation.current;
      let request = 0;
      setData(null);
      setError('');
      setLoading(true);
      setForm(false);
      const refresh = async () => {
        const id = ++request;
        try {
          if (!scope.userId) throw Error('Đăng nhập để xem lịch tiền.');
          const [cache, book, plans, drafts] = await Promise.all([
            dashboardCache.read(scope.userId),
            recurringBills.load(scope),
            moneyCalendarPlans.read(scope),
            offlineTransactionQueue.list(scope.userId),
          ]);
          if (!cache)
            throw Error('Mở Tổng quan có mạng để tải số dư ví trước.');
          if (generation.current !== version || id !== request) return;
          setData({ cache, book, plans, drafts });
          setError('');
        } catch (e) {
          if (generation.current === version && id === request)
            setError((e as Error).message);
        } finally {
          if (generation.current === version && id === request)
            setLoading(false);
        }
      };
      refresh();
      const stops = [
        dashboardCache.subscribe(refresh),
        offlineTransactionQueue.subscribe(refresh),
        recurringBills.subscribe(changed => {
          if (
            changed.userId === scope.userId &&
            changed.server === scope.server
          )
            refresh();
        }),
      ];
      return () => {
        generation.current++;
        stops.forEach(stop => stop());
      };
      // Retry intentionally creates a new focused loader even with the same scope.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scope, revision]),
  );
  const calculated = useMemo(() => {
    if (!data || error) return { value: null, error: '' };
    try {
      return {
        value: buildMoneyCalendar({
          ...data,
          wallets: data.cache.wallets,
          today,
          currency,
        }),
        error: '',
      };
    } catch (e) {
      return { value: null, error: (e as Error).message };
    }
  }, [data, today, currency, error]);
  const model = calculated.value;
  const money = (value: number) => formatCurrency(value, currency);
  const day = (value: string) => value.split('-').reverse().join('/');
  const action = (
    title: string,
    onPress: () => void,
    primary = false,
    disabled = false,
  ) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled}
      style={[s.button, primary && s.primary, disabled && s.disabled]}
    >
      <Text style={[s.buttonText, primary && s.white]}>{title}</Text>
    </TouchableOpacity>
  );
  const mutate = async (
    change: () => Promise<MoneyPlan[]>,
    version: number,
  ) => {
    if (writing.current || version !== generation.current) return;
    writing.current = true;
    setBusy(true);
    try {
      const plans = await change();
      if (version === generation.current) {
        setData(old => (old ? { ...old, plans } : old));
        setForm(false);
      }
    } catch (e) {
      if (version === generation.current)
        Alert.alert('Chưa lưu được', (e as Error).message);
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  const addPlan = () => {
    try {
      const plan = validateMoneyPlan({
        id: createClientRequestId(),
        label,
        date,
        type,
        currency,
        amount: Number(parsePositiveMoneyInput(amount)),
      });
      const version = generation.current;
      Alert.alert(
        'Thêm khoản dự kiến',
        `${plan.label}\n${day(plan.date)} · ${
          plan.type === 'INCOME' ? '+' : '−'
        }${money(
          plan.amount,
        )}\nChỉ thêm vào lịch, không ghi giao dịch hoặc đổi số dư.`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Thêm vào lịch',
            onPress: () =>
              mutate(() => moneyCalendarPlans.add(scope, plan), version),
          },
        ],
      );
    } catch (e) {
      Alert.alert('Kiểm tra thông tin', (e as Error).message);
    }
  };
  return (
    <SafeAreaView style={s.page}>
      <View style={s.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={navigation.goBack}
          style={s.back}
        >
          <Text style={s.buttonText}>Quay lại</Text>
        </TouchableOpacity>
        <Text style={s.title}>Lịch tiền</Text>
      </View>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.muted}>
          30 ngày tới · {currency}. Dự kiến từ số dư đã tải và các lịch bạn đã
          xác nhận.
        </Text>
        {loading && <ActivityIndicator color="#FF8800" />}
        {!!(error || calculated.error) && (
          <View style={s.card}>
            <Text accessibilityRole="alert" style={s.warning}>
              {error || calculated.error}
            </Text>
            {action('Thử lại', () => setRevision(n => n + 1))}
          </View>
        )}
        {model && (
          <>
            <View style={s.hero}>
              <Text style={s.label}>Chi an toàn mỗi ngày</Text>
              <Text style={s.amount}>
                {model.hasWallets
                  ? money(model.safeDaily)
                  : 'Chưa có ví cùng tiền tệ'}
              </Text>
              <Text style={s.muted}>
                {day(model.today)} – {day(model.end)} · chia đều 30 ngày
              </Text>
              <Text style={s.text}>
                Còn sau khi dành tiền: {money(model.available)}. Tiền thu dự
                kiến chưa được cộng vào mức này.
              </Text>
              {model.shortfall > 0 && (
                <Text style={s.warning}>
                  Thiếu {money(model.shortfall)} để đủ các khoản trong khoảng
                  này.
                </Text>
              )}
              {model.firstRiskDate && (
                <Text style={s.warning}>
                  Có thể thiếu tiền từ {day(model.firstRiskDate)}.
                  {model.days.some(
                    item =>
                      item.date === model.firstRiskDate && item.income > 0,
                  )
                    ? ' Các khoản chi trong ngày được tính trước khoản thu dự kiến.'
                    : ''}
                </Text>
              )}
              {action(
                showCalculation ? 'Ẩn cách tính' : 'Cách tính Chi an toàn',
                () => setShowCalculation(value => !value),
              )}
              {showCalculation && (
                <>
                  <Text style={s.text}>
                    Số dư ví thường {money(model.opening)} − hóa đơn{' '}
                    {money(model.billCommitment)} − chi dự kiến{' '}
                    {money(model.manualCommitment)} − chi chờ đồng bộ{' '}
                    {money(model.pending)}, chia 30 ngày và làm tròn xuống. Ví
                    tiết kiệm và tiền tệ khác không được gộp. Không thay hạn mức
                    ngân sách từng danh mục.
                  </Text>
                  <Text style={s.muted}>
                    Hóa đơn biến động dùng mức tối đa. Khoản đã chi nhưng chưa
                    liên kết hóa đơn vẫn được dành tiền; bản chờ có thể đã được
                    server nhận nên cách tính này thận trọng.
                  </Text>
                  <Text style={s.muted}>
                    Số liệu trên máy:{' '}
                    {data?.cache.updatedAt
                      ? new Date(data.cache.updatedAt).toLocaleString('vi-VN')
                      : 'chưa rõ thời điểm'}
                    . Mức tham khảo, chưa tính các khoản bạn chưa ghi hoặc chưa
                    đặt lịch.
                  </Text>
                </>
              )}
            </View>
            <View style={s.row}>
              {action('Hóa đơn định kỳ', () =>
                navigation.navigate('RecurringBills'),
              )}
              {action(
                'Thêm dự kiến',
                () => {
                  setLabel('');
                  setAmount('');
                  setDate(today);
                  setForm(true);
                },
                true,
                busy,
              )}
            </View>
            {form && (
              <View style={s.card}>
                <Text style={s.label}>Khoản thu / chi dự kiến</Text>
                <Text style={s.muted}>
                  Hóa đơn đã có lịch không cần nhập lại ở đây.
                </Text>
                <View style={s.row}>
                  {action(
                    'Dự kiến thu',
                    () => setType('INCOME'),
                    type === 'INCOME',
                    busy,
                  )}
                  {action(
                    'Dự kiến chi',
                    () => setType('EXPENSE'),
                    type === 'EXPENSE',
                    busy,
                  )}
                </View>
                <TextInput
                  accessibilityLabel="Tên khoản dự kiến"
                  placeholder="Ví dụ: Lương tháng tới"
                  value={label}
                  onChangeText={setLabel}
                  maxLength={100}
                  style={s.input}
                  editable={!busy}
                />
                <TextInput
                  accessibilityLabel="Số tiền dự kiến"
                  placeholder="Số tiền"
                  value={formatMoneyInputForCurrency(amount, currency)}
                  onChangeText={v =>
                    setAmount(normalizeMoneyInputForCurrency(v, currency))
                  }
                  keyboardType="decimal-pad"
                  style={s.input}
                  editable={!busy}
                />
                <TextInput
                  accessibilityLabel="Ngày khoản dự kiến"
                  placeholder="YYYY-MM-DD"
                  value={date}
                  onChangeText={setDate}
                  style={s.input}
                  editable={!busy}
                />
                <View style={s.row}>
                  {action('Hủy dự kiến', () => setForm(false), false, busy)}
                  {action('Kiểm tra dự kiến', addPlan, true, busy)}
                </View>
              </View>
            )}
            <Text style={s.label}>Các ngày có khoản dự kiến</Text>
            {!model.days.length && (
              <Text style={s.muted}>
                Chưa có khoản trong 30 ngày tới. Thêm ngày lương, khoản chi hoặc
                hóa đơn định kỳ để xem lịch.
              </Text>
            )}
            {model.days.map(item => (
              <View key={item.date} style={s.card}>
                <Text style={s.label}>
                  {day(item.date)}
                  {item.risk ? ' · có thể thiếu tiền' : ''}
                </Text>
                {item.events.map(event => (
                  <View key={event.id} style={s.event}>
                    <Text style={s.text}>
                      {event.label} · {event.type === 'INCOME' ? '+' : '−'}
                      {money(event.amount)}
                      {event.variable ? ' (mức tối đa)' : ''}
                    </Text>
                    {event.originalDate < today && (
                      <Text style={s.warning}>
                        Quá hạn từ {day(event.originalDate)}, dành tiền từ hôm
                        nay
                      </Text>
                    )}
                    {!event.billId &&
                      action(
                        'Bỏ dự kiến ' + event.label,
                        () => {
                          const version = generation.current;
                          Alert.alert(
                            'Bỏ khỏi dự kiến?',
                            'Chỉ bỏ khỏi lịch tiền. Không tạo hoặc xóa giao dịch.',
                            [
                              { text: 'Hủy', style: 'cancel' },
                              {
                                text: 'Bỏ khỏi lịch',
                                onPress: () =>
                                  mutate(
                                    () =>
                                      moneyCalendarPlans.remove(
                                        scope,
                                        event.id.slice(5),
                                      ),
                                    version,
                                  ),
                              },
                            ],
                          );
                        },
                        false,
                        busy,
                      )}
                  </View>
                ))}
                <Text style={s.muted}>
                  Số dư dự kiến cuối ngày: {money(item.balance)}. Khoản thu là
                  dự kiến, chưa phải tiền đã nhận.
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  back: { padding: 12, borderRadius: 14, backgroundColor: '#FFEAD3' },
  page: { flex: 1, backgroundColor: '#FFF9F2' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#4A2B1A' },
  content: { padding: 18, gap: 16, paddingBottom: 40 },
  card: {
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFDFC',
    borderWidth: 1,
    borderColor: '#F1D4B9',
    borderRadius: 18,
  },
  hero: {
    padding: 18,
    gap: 12,
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: '#F1D4B9',
    borderRadius: 20,
  },
  label: { fontSize: 16, fontWeight: '700', color: '#4A2B1A' },
  amount: { fontSize: 30, fontWeight: '700', color: '#A75410' },
  text: { fontSize: 14, lineHeight: 22, color: '#593420' },
  muted: { fontSize: 13, lineHeight: 20, color: '#886449' },
  warning: { fontSize: 13, lineHeight: 21, color: '#A44024' },
  row: { flexDirection: 'row', gap: 8 },
  button: {
    flexGrow: 1,
    flexShrink: 1,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFEAD3',
    alignItems: 'center',
  },
  buttonText: { color: '#864719', fontWeight: '600' },
  primary: { backgroundColor: '#FF8800' },
  white: { color: '#FFF' },
  disabled: { opacity: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: '#EDC9AA',
    borderRadius: 12,
    padding: 13,
    backgroundColor: '#FFFDFC',
    color: '#4A2B1A',
  },
  event: { gap: 6, paddingVertical: 6 },
});
