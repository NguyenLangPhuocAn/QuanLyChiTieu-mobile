import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import type { TransactionItem } from '../data/mockTransactions';
import { transactionsService } from '../services/transactions';
import { walletsService } from '../services/wallets';
import { formatCurrency } from '../utils/format';
import { mapApiTransactions, getTransactionDateKey } from '../utils/mapTransactions';
import { billDateOffset, type BillPayment } from '../utils/recurringBills';

type Props = {
  payment: BillPayment;
  onOpen: (transaction: TransactionItem) => void;
};

const dateLabel = (value: string) => value.split('-').reverse().join('/');

export default function BillPaidTransactionLink({ payment, onOpen }: Props) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const active = useRef(true);
  const opening = useRef(false);
  useEffect(() => {
    active.current = true;
    opening.current = false;
    setLoading(false);
    return () => {
      active.current = false;
    };
  }, []);

  const open = async () => {
    if (!token || opening.current) return;
    opening.current = true;
    setLoading(true);
    try {
      // The saved bill link is only a snapshot. Resolve its current owner-scoped
      // transaction, then fetch the complete record for receipt and item details.
      const linked = await transactionsService.getLinkedPayments(token, [
        payment.id,
      ]);
      const current = linked.data.find(item => item.id === payment.id);
      if (!current)
        throw new Error('Giao dịch đã trả không còn trong tài khoản này.');
      const date = getTransactionDateKey(current.transaction_date);
      const [rows, wallets] = await Promise.all([
        transactionsService.getAll(token, {
          wallet_id: current.wallet_id,
          from: billDateOffset(date, -1),
          to: billDateOffset(date, 1),
        }),
        walletsService.getAll(token),
      ]);
      const record = rows.find(item => item.id === payment.id);
      if (!record)
        throw new Error('Chưa tải được chi tiết giao dịch đã trả.');
      const transaction = mapApiTransactions([record], wallets)[0];
      if (active.current) onOpen(transaction);
    } catch (reason) {
      if (active.current)
        Alert.alert(
          'Chưa mở được giao dịch',
          reason instanceof Error ? reason.message : 'Vui lòng thử lại.',
        );
    } finally {
      opening.current = false;
      if (active.current) setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Xem giao dịch đã trả ${formatCurrency(
        payment.amount,
        payment.currency,
      )} ngày ${dateLabel(payment.date)}`}
      accessibilityState={{ disabled: loading }}
      disabled={loading}
      onPress={open}
      style={styles.link}
    >
      <Text style={styles.text}>
        Đã trả · {formatCurrency(payment.amount, payment.currency)} ·{' '}
        {dateLabel(payment.date)}
      </Text>
      {loading ? <ActivityIndicator size="small" color="#A95514" /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  link: { alignItems: 'center', flexDirection: 'row', gap: 6, alignSelf: 'flex-start' },
  text: { color: '#A95514', fontSize: 13, fontWeight: '600', lineHeight: 20 },
});
