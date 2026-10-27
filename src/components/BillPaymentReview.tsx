import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from './FormControls';
import { formatCurrency } from '../utils/format';
import type { BillOccurrence, BillPayment } from '../utils/recurringBills';
import {
  paymentTargetKey,
  type BillPaymentTarget,
  type BillPaymentCheck,
} from '../utils/billPaymentChecks';

export default function BillPaymentReview({
  item,
  results,
  busy,
  onRefresh,
}: {
  item: BillOccurrence;
  results: Record<string, BillPaymentCheck>;
  busy: boolean;
  onRefresh: (target: BillPaymentTarget, current: BillPayment) => void;
}) {
  if (!item.payment) return null;
  const target: BillPaymentTarget = {
    bill: item.bill,
    period: {
      billId: item.bill.id,
      dueDate: item.dueDate,
      status: 'PAID',
      payment: item.payment,
    },
  };
  const check = results[paymentTargetKey(target)];
  const label = !check
    ? 'Chưa đối chiếu giao dịch gốc trong lần xem này.'
    : check.kind === 'MATCHED'
    ? 'Khớp với giao dịch gốc ở lần kiểm tra này.'
    : check.kind === 'CHANGED'
    ? 'Cần kiểm tra: giao dịch gốc đã thay đổi.'
    : check.kind === 'UNAVAILABLE'
    ? 'Cần kiểm tra: không còn truy cập được giao dịch gốc. Có thể giao dịch hoặc ví đã bị xóa.'
    : 'Cần kiểm tra: giao dịch không còn là khoản chi thông thường cùng tiền tệ trong 31 ngày trước/sau kỳ.';
  return (
    <View style={styles.box}>
      <Text
        style={check && check.kind !== 'MATCHED' ? styles.warning : styles.text}
      >
        {label}
      </Text>
      <Text style={styles.text}>
        Nội dung đã lưu: {item.payment.note || 'Không có ghi chú'}
      </Text>
      {check?.kind === 'CHANGED' ? (
        <>
          <Text style={styles.text}>
            Hiện tại:{' '}
            {formatCurrency(check.current.amount, check.current.currency)} ·{' '}
            {check.current.date.split('-').reverse().join('/')}
            {'\n'}
            {check.current.note || 'Không có ghi chú'}
          </Text>
          <ActionButton
            label="Cập nhật liên kết"
            secondary
            disabled={busy}
            onPress={() => onRefresh(target, check.current)}
          />
        </>
      ) : null}
      {check && check.kind !== 'MATCHED' ? (
        <Text style={styles.text}>
          Chưa đổi lịch sử hoặc nhắc lại kỳ này. Bạn có thể mở lại kỳ sau khi
          kiểm tra.
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  box: {
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF6ED',
    borderWidth: 1,
    borderColor: '#F1D4B9',
  },
  text: { fontSize: 13, lineHeight: 20, color: '#886449' },
  warning: {
    fontSize: 13,
    lineHeight: 20,
    color: '#A95514',
    fontWeight: '600',
  },
});
