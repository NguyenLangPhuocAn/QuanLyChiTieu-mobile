import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useSingleFlight } from '../hooks/useSingleFlight';
import { getApiBaseUrl } from '../services/api';
import type { FinancialPlanOverview } from '../types/financialPlan';
import {
  buildPlanSchedule,
  readSavedPlan,
  type SavedFinancialPlan,
} from '../utils/savedFinancialPlan';
import { formatCurrency } from '../utils/format';
import { ActionButton, FormField } from './FormControls';

type Props = {
  plan: FinancialPlanOverview['cashflow_plans'][number];
  goals: FinancialPlanOverview['savings_plans'];
  months: number;
  reduction: number;
};
export default function PlanWorkbench({
  plan,
  goals,
  months,
  reduction,
}: Props) {
  const { user } = useAuth();
  const { run, busy } = useSingleFlight();
  const [debt, setDebt] = useState('');
  const [essential, setEssential] = useState('');
  const [reserve, setReserve] = useState('');
  const [saved, setSaved] = useState<SavedFinancialPlan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const key = user?.id
    ? `financial-plan:v1:${getApiBaseUrl()}:${user.id}:${plan.currency}`
    : null;
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setSaved(null);
    setDebt('');
    setEssential('');
    setReserve('');
    setStorageError(false);
    if (!key) return;
    AsyncStorage.getItem(key)
      .then(raw => {
        if (!active) return;
        const previous = readSavedPlan(raw, plan.currency);
        setSaved(previous);
        if (previous) {
          setDebt(String(previous.assumptions.debt));
          setEssential(String(previous.assumptions.essentialFloor));
          setReserve(String(previous.assumptions.reserve));
        }
      })
      .catch(() => {
        if (active) setStorageError(true);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [key, plan.currency]);
  const parse = (value: string) =>
    !value.trim()
      ? 0
      : /^\d+(?:[.,]\d{1,2})?$/.test(value.trim())
        ? Number(value.trim().replace(',', '.'))
        : NaN;
  const assumptions = {
    debt: parse(debt),
    essentialFloor: parse(essential),
    reserve: parse(reserve),
  };
  const valid = Object.values(assumptions).every(
    value => Number.isFinite(value) && value >= 0 && value <= 9999999999999.99,
  );
  const schedule = valid
    ? buildPlanSchedule(plan, goals, months, reduction, assumptions)
    : [];
  const unresolved = goals.some(
    goal =>
      goal.currency === plan.currency &&
      goal.remaining_amount > 0 &&
      goal.roadmap?.status !== 'SCHEDULED',
  );
  const money = (value: number) => formatCurrency(value, plan.currency);
  const save = () =>
    run(async () => {
      if (!key || !loaded || storageError || !valid || !schedule.length) return;
      const snapshot: SavedFinancialPlan = {
        version: 1,
        currency: plan.currency,
        savedAt: new Date().toISOString(),
        months,
        assumptions,
        reduction,
        schedule,
        goals: goals
          .filter(goal => goal.currency === plan.currency)
          .map(goal => ({
            id: goal.id,
            name: goal.name,
            amount: goal.current_amount,
          })),
      };
      try {
        await AsyncStorage.setItem(key, JSON.stringify(snapshot));
        setSaved(snapshot);
        Alert.alert(
          'Đã lưu phương án trên máy',
          'Bạn có thể mở lại để so với thực tế. Chưa tạo ngân sách hoặc chuyển tiền.',
        );
      } catch {
        Alert.alert(
          'Chưa lưu được phương án',
          'Nội dung vẫn còn trên màn hình. Vui lòng thử lại.',
        );
      }
    });
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Khả năng góp sau nghĩa vụ</Text>
      <Text style={styles.help}>
        Nhập số tiền mỗi tháng ({plan.currency}). Chi thiết yếu là mức tối thiểu
        trong tổng chi, không bị trừ thêm lần nữa. Khoản nợ do bạn khai báo;
        chưa tự lấy lịch trả nợ.
      </Text>
      {[
        { label: 'Trả nợ mỗi tháng', value: debt, set: setDebt },
        {
          label: 'Chi thiết yếu cần giữ mỗi tháng',
          value: essential,
          set: setEssential,
        },
        {
          label: 'Tiền để lại thêm mỗi tháng',
          value: reserve,
          set: setReserve,
        },
      ].map(field => (
        <FormField
          key={field.label}
          label={field.label}
          accessibilityLabel={`${field.label} ${plan.currency}`}
          value={field.value}
          onChangeText={field.set}
          keyboardType="decimal-pad"
          placeholder="0"
          editable={loaded && !busy}
        />
      ))}
      {!valid ? (
        <Text style={styles.error}>
          Nhập số không âm, tối đa hai chữ số thập phân; không dùng dấu phân
          cách hàng nghìn.
        </Text>
      ) : null}
      {schedule.map(row => (
        <View key={row.month} style={styles.row}>
          <Text style={styles.label}>{row.month}</Text>
          <Text style={styles.help}>
            Thu {money(row.income)} · Chi {money(row.expense)} · Nợ{' '}
            {money(row.debt)} · Giữ thêm {money(row.reserve)}
          </Text>
          <Text style={styles.help}>
            Lịch góp mục tiêu: {money(row.scheduled)}
          </Text>
          <Text style={row.available < 0 ? styles.error : styles.label}>
            {row.available < 0 ? 'Còn thiếu' : 'Còn lại sau lịch góp'}:{' '}
            {money(Math.abs(row.available))}
          </Text>
        </View>
      ))}
      {unresolved ? (
        <Text style={styles.error}>
          Có mục tiêu chưa có lịch hoặc đã quá hạn. Phần còn lại chưa tính đủ
          các mục tiêu đó.
        </Text>
      ) : null}
      {plan.summary.status === 'INSUFFICIENT_DATA' ? (
        <Text style={styles.error}>
          Dữ liệu còn ít; chỉ lưu để tham khảo, chưa kết luận có tiền dư.
        </Text>
      ) : null}
      <Text style={styles.help}>
        Không tính số dư có sẵn vào tiền dư mỗi tháng. Nếu thiếu tiền, giảm mức
        góp hoặc lùi hạn mục tiêu. Số liệu trên là kịch bản, chưa phải tiền đã
        có.
      </Text>
      <ActionButton
        accessibilityLabel={`Lưu phương án ${plan.currency}`}
        disabled={busy || !loaded || storageError || !valid || !schedule.length}
        onPress={save}
        loading={busy}
        label={saved ? 'Lưu thay phương án trên máy' : 'Lưu phương án trên máy'}
      />
      <Text style={styles.help}>
        Lưu riêng cho tài khoản trên thiết bị này; chưa đồng bộ server. Gỡ
        app/xóa dữ liệu ứng dụng có thể mất phương án.
      </Text>
      {storageError ? (
        <Text style={styles.error}>
          Chưa đọc được phương án đã lưu. Mở lại màn hình để thử lại.
        </Text>
      ) : null}
      {saved ? (
        <View style={styles.row}>
          <Text style={styles.title}>
            Phương án đã lưu · {saved.months} tháng
          </Text>
          <Text style={styles.help}>
            Ngày lưu: {new Date(saved.savedAt).toLocaleDateString('vi-VN')}. Bản
            lưu giữ nguyên khi dự báo mới thay đổi.
          </Text>
          {saved.schedule.map(row => {
            const actual = plan.history.find(item => item.month === row.month);
            return (
              <View key={row.month} style={styles.row}>
                <Text style={styles.label}>
                  {row.month}: dự kiến thu − chi{' '}
                  {money(row.income - row.expense)}, góp mục tiêu{' '}
                  {money(row.scheduled)}
                </Text>
                <Text style={styles.help}>
                  {actual
                    ? `Thực tế thu − chi: ${money(actual.income - actual.expense)}. So với kế hoạch: ${money(actual.income - actual.expense - (row.income - row.expense))}.`
                    : 'Chưa có số liệu tháng đã hoàn tất để đối chiếu.'}
                </Text>
              </View>
            );
          })}
          {saved.goals.map(goal => {
            const actual = goals.find(item => item.id === goal.id);
            return (
              <Text key={goal.id} style={styles.help}>
                {goal.name}:{' '}
                {actual
                  ? `số tiền hiện có ${money(actual.current_amount)}, thay đổi ròng từ lúc lưu ${money(actual.current_amount - goal.amount)} (gồm góp/rút).`
                  : 'không còn trong danh sách mục tiêu đang theo dõi.'}
              </Text>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { paddingTop: 16, gap: 8 },
  title: { color: '#4A2B1A', fontSize: 17, fontWeight: '700' },
  help: { color: '#755A47', fontSize: 13, lineHeight: 20 },
  label: {
    color: '#4A2B1A',
    fontSize: 14,
    fontWeight: '600',
    marginVertical: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCC9B8',
    borderRadius: 12,
    padding: 12,
    color: '#4A2B1A',
  },
  row: {
    borderTopWidth: 1,
    borderTopColor: '#EBDACB',
    paddingTop: 8,
    marginTop: 8,
  },
  error: { color: '#A33224', fontSize: 13, lineHeight: 20 },
  button: {
    backgroundColor: '#A95514',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '600' },
});
