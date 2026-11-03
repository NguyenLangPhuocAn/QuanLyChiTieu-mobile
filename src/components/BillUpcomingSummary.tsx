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
                ? 'Tổng quá lớn để hiển thị'
                : `${formatCurrency(total.min, total.currency)}${
                    total.min !== total.max
                      ? ` – ${formatCurrency(total.max, total.currency)}`
                      : ''
                  }`}
            </Text>
            <Text style={styles.text}>
              {total.periods} kỳ của {total.bills} lịch
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.text}>
          Không có kỳ chưa trả đến hạn trong 30 ngày này.
        </Text>
      )}
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
