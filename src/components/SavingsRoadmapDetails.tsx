import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { SavingsRoadmap } from '../types/savingsRoadmap';
import { formatCurrency, formatShortDate } from '../utils/format';

export default function SavingsRoadmapDetails({
  roadmap,
  currency,
}: {
  roadmap?: SavingsRoadmap;
  currency: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [compareVisible, setCompareVisible] = useState(false);
  const [compareMonths, setCompareMonths] = useState(3);
  if (!roadmap || roadmap.status === 'COMPLETE') return null;
  const money = (value: number) => formatCurrency(value, currency);
  const comparisonMonthly = roadmap.remaining_amount / compareMonths;
  const comparisonGap = Math.max(
    0,
    comparisonMonthly - roadmap.recent_monthly_contribution,
  );
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Còn cần tích lũy</Text>
        <Text style={styles.value}>{money(roadmap.remaining_amount)}</Text>
      </View>
      {roadmap.status === 'NO_DEADLINE' ? (
        <Text style={styles.body}>
          Thêm ngày muốn hoàn thành để chia số tiền cần góp theo tháng và tuần.
        </Text>
      ) : roadmap.status === 'OVERDUE' ? (
        <Text style={styles.warning}>
          Đã qua hạn. Chọn ngày mới hoặc giảm số tiền mục tiêu để lập lại lịch
          góp.
        </Text>
      ) : (
        <>
          <Text style={styles.next}>
            {roadmap.next_contribution === 0
              ? 'Kỳ này đã góp đủ theo lịch.'
              : `Góp thêm ${money(
                  roadmap.next_contribution ?? 0,
                )} trước ${formatShortDate(roadmap.next_due_date ?? '')}`}
          </Text>
          <Text style={styles.body}>
            Hoặc chia khoảng {money(roadmap.weekly_amount ?? 0)}/tuần đến hạn.
            Hai cách chia cùng một khoản còn thiếu, không cộng lại.
          </Text>
          <Text style={styles.body}>
            Lịch này tính từ số dư hiện tại; các khoản đã góp trong tháng đã
            được tính.
          </Text>
        </>
      )}
      <Text style={styles.body}>
        Bình quân 3 tháng hoàn tất gần nhất:{' '}
        {money(roadmap.recent_monthly_contribution)}/tháng, đã trừ khoản rút.
      </Text>
      {roadmap.months_at_current_pace ? (
        <Text style={styles.body}>
          Giữ tốc độ này, cần khoảng {roadmap.months_at_current_pace} tháng nữa
          để đủ tiền.
        </Text>
      ) : (
        <Text style={styles.body}>
          Chưa có tốc độ góp dương để ước tính thời gian hoàn thành.
        </Text>
      )}
      {(roadmap.monthly_pace_gap ?? 0) > 0 ? (
        <Text style={styles.warning}>
          Lịch mới cần thêm khoảng {money(roadmap.monthly_pace_gap ?? 0)}/tháng
          so với tốc độ cũ. Nếu khó duy trì, hãy lùi hạn hoặc giảm mục tiêu.
        </Text>
      ) : null}
      {roadmap.schedule.length ? (
        <>
          <TouchableOpacity
            onPress={() => setExpanded(!expanded)}
            accessibilityRole="button"
            accessibilityLabel="Xem hoặc thu gọn lịch góp"
            accessibilityState={{ expanded }}
            style={styles.toggle}
          >
            <Text style={styles.link}>
              {expanded
                ? 'Thu gọn lịch góp'
                : `Xem lịch góp · ${roadmap.remaining_months} tháng`}
            </Text>
          </TouchableOpacity>
          {expanded ? (
            <View>
              <View style={styles.row}>
                <Text style={styles.label}>Hạn góp</Text>
                <Text style={styles.label}>Góp thêm / Số dư mục tiêu</Text>
              </View>
              {roadmap.schedule.map(item => (
                <View key={item.due_date} style={styles.scheduleRow}>
                  <Text style={styles.body}>
                    {formatShortDate(item.due_date)}
                  </Text>
                  <View style={styles.amounts}>
                    <Text style={styles.value}>{money(item.amount)}</Text>
                    <Text style={styles.label}>
                      {money(item.target_balance)}
                    </Text>
                  </View>
                </View>
              ))}
              {roadmap.schedule_truncated ? (
                <Text style={styles.body}>
                  Hiển thị 12 kỳ đầu. Lịch sẽ được tính lại sau mỗi lần góp.
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
      <TouchableOpacity
        onPress={() => setCompareVisible(!compareVisible)}
        accessibilityRole="button"
        accessibilityLabel="So sánh phương án tiết kiệm"
        accessibilityState={{ expanded: compareVisible }}
        style={styles.toggle}
      >
        <Text style={styles.link}>
          {compareVisible ? 'Thu gọn phương án' : 'So sánh phương án 1–4 tháng'}
        </Text>
      </TouchableOpacity>
      {compareVisible ? (
        <View style={styles.comparison}>
          <Text style={styles.value}>Chia khoản còn thiếu từ hôm nay</Text>
          <View style={styles.options}>
            {[1, 2, 3, 4].map(months => (
              <TouchableOpacity
                key={months}
                onPress={() => setCompareMonths(months)}
                accessibilityRole="button"
                accessibilityLabel={`Tích lũy trong ${months} tháng`}
                accessibilityState={{ selected: compareMonths === months }}
                style={[
                  styles.option,
                  compareMonths === months && styles.optionSelected,
                ]}
              >
                <Text style={styles.value}>{months} tháng</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.next}>
            Bình quân khoảng {money(comparisonMonthly)}/tháng
          </Text>
          <Text style={styles.body}>
            {roadmap.recent_monthly_contribution > 0
              ? comparisonGap > 0
                ? `Cần thêm khoảng ${money(
                    comparisonGap,
                  )}/tháng so với mức góp gần đây. Thử kéo dài thời gian nếu khoản này vượt tiền dư sau chi thiết yếu.`
                : 'Mức góp gần đây đủ cho phương án này nếu bạn duy trì được và không rút thêm.'
              : 'Chưa có mức góp dương để đối chiếu. Kiểm tra tiền dư sau chi thiết yếu và trả nợ trước khi chọn mức góp.'}
          </Text>
          <Text style={styles.body}>
            Đây là phép chia khoản còn thiếu, không tính lãi và chưa trừ tiền
            dành cho mục tiêu khác. Xem trước không đổi hạn đang lưu hoặc tự
            chuyển tiền.
          </Text>
        </View>
      ) : null}
      <Text style={styles.body}>
        Chọn một ngày cố định sau khi nhận thu nhập để góp tiền; cuối tháng kiểm
        tra lại lịch. Ứng dụng không tự chuyển tiền.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 16,
    paddingTop: 14,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  label: { color: '#667085', fontSize: 12, flexShrink: 1 },
  value: { color: '#20262D', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  body: { color: '#59616D', fontSize: 12, lineHeight: 19 },
  next: { color: '#20262D', fontSize: 15, lineHeight: 22, fontWeight: '600' },
  warning: { color: '#945B21', fontSize: 12, lineHeight: 19 },
  toggle: { minHeight: 44, justifyContent: 'center' },
  link: { color: '#A95514', fontSize: 13, fontWeight: '600' },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#F0F1F3',
    gap: 10,
  },
  amounts: { alignItems: 'flex-end', gap: 3 },
  comparison: {
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F7F5F2',
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    minHeight: 44,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DAD6D0',
    backgroundColor: '#FFFFFF',
  },
  optionSelected: { borderColor: '#A95514', backgroundColor: '#F5E8DA' },
});
