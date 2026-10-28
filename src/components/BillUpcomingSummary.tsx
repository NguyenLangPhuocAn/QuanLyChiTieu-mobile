import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BillBook } from '../utils/recurringBills';
import { upcomingBillSummary } from '../utils/billActivity';
import { formatCurrency } from '../utils/format';

export default function BillUpcomingSummary({
  book,
  today,
}: {
  book: BillBook;
  today: string;
}) {
  const summary = useMemo(
    () => upcomingBillSummary(book, today),
    [book, today],
  );
  const dateLabel = (value: string) => value.split('-').reverse().join('/');
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Dự kiến 30 ngày tới</Text>
      <Text style={styles.text}>
        {dateLabel(today)} – {dateLabel(summary.end)}
      </Text>
      {summary.totals.length ? (
        summary.totals.map(total => (
          <View key={total.currency} style={styles.total}>
            <Text style={styles.amount}>
              {total.min === null || total.max === null
                ? `${total.currency}: tổng quá lớn để hiển thị chính xác`
                : `${formatCurrency(total.min, total.currency)}${
                    total.min !== total.max
                      ? ` – ${formatCurrency(total.max, total.currency)}`
                      : ''
                  }`}
            </Text>
            <Text style={styles.text}>
              {total.periods} kỳ của {total.bills} lịch · {total.currency}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.text}>Chưa có kỳ chưa xử lý trong khoảng này.</Text>
      )}
      <Text style={styles.text}>
        Theo mức đã đặt trong lịch, chưa tự điều chỉnh theo cảnh báo tăng tiền.
        Loại kỳ quá hạn, đã liên kết, bỏ qua hoặc lịch tạm dừng/xóa. Khoản đã chi
        nhưng chưa liên kết vẫn có thể được tính. Tách riêng tiền tệ, không quy đổi.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  box: {
    gap: 10,
    borderWidth: 1,
    borderColor: '#F1D4B9',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FFF6ED',
  },
  title: { fontSize: 16, color: '#593420', fontWeight: '700' },
  text: { fontSize: 13, lineHeight: 20, color: '#886449' },
  amount: { fontSize: 17, color: '#A95514', fontWeight: '700' },
  total: { gap: 4 },
});
