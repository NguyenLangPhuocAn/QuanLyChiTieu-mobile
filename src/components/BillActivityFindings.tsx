import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ActionButton } from './FormControls';
import {
  recurringBillsService,
  type BillScope,
} from '../services/recurringBills';
import {
  analyzeBillActivity,
  type BillActivityAlert,
} from '../utils/billActivity';
import type { BillBook } from '../utils/recurringBills';
import type { ApiTransaction } from '../types/transaction';
import { formatCurrency } from '../utils/format';

const dateLabel = (date: string) => date.split('-').reverse().join('/');
export default function BillActivityFindings({
  book,
  rows,
  today,
  scope,
  onBookChange,
  isCurrent,
}: {
  book: BillBook;
  rows: ApiTransaction[];
  today: string;
  scope: BillScope;
  onBookChange: () => Promise<void>;
  isCurrent: () => boolean;
}) {
  const findings = useMemo(
    () => analyzeBillActivity(book, rows, today),
    [book, rows, today],
  );
  const visible = findings.alerts.filter(
    alert => !book.reviewedAlerts?.includes(alert.key),
  );
  const reviewed = findings.alerts.filter(alert =>
    book.reviewedAlerts?.includes(alert.key),
  );
  const [open, setOpen] = useState(false);
  const [showReviewed, setShowReviewed] = useState(false);
  const [showMethod, setShowMethod] = useState(false);
  const [limit, setLimit] = useState(3);
  const [evidenceLimit, setEvidenceLimit] = useState<Record<string, number>>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false);
  const decide = async (alert: BillActivityAlert, value: boolean) => {
    if (working.current || !isCurrent()) return;
    working.current = true;
    setSaving(true);
    setError(null);
    try {
      await recurringBillsService.reviewAlert(
        scope,
        alert.key,
        value,
        isCurrent,
      );
      if (isCurrent()) await onBookChange();
    } catch (reason) {
      if (isCurrent())
        setError(
          reason instanceof Error ? reason.message : 'Chưa lưu được lựa chọn.',
        );
    } finally {
      working.current = false;
      if (isCurrent()) setSaving(false);
    }
  };
  const renderAlert = (alert: BillActivityAlert, hidden: boolean) => (
    <View key={alert.key} style={styles.card}>
      <Text style={styles.title}>{alert.bill.label}</Text>
      <Text style={styles.warning}>
        {alert.kind === 'INCREASE'
          ? 'Khoản chi cao hơn trước'
          : 'Có thể ghi lặp trong một kỳ'}
      </Text>
      <Text style={styles.text}>
        Kỳ {dateLabel(alert.dueDate)} · {alert.bill.currency}
      </Text>
      {alert.kind === 'INCREASE' ? (
        <>
          <Text style={styles.text}>
            Trung vị 3 kỳ trước:{' '}
            {formatCurrency(alert.baseline!, alert.bill.currency)}
          </Text>
          <Text style={styles.amount}>
            Mới ghi:{' '}
            {formatCurrency(alert.evidence.at(-1)!.amount, alert.bill.currency)}
          </Text>
          <Text style={styles.text}>
            Tăng {formatCurrency(alert.increase!, alert.bill.currency)} (
            {alert.percent!.toFixed(1)}%), đồng thời vượt mức dự kiến{' '}
            {formatCurrency(alert.bill.maxAmount, alert.bill.currency)}.
          </Text>
          <Text style={styles.text}>
            Có thể do đổi gói, phí hoặc thuế. Chưa kết luận dịch vụ tăng giá.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.amount}>
            {alert.evidence.length} giao dịch cùng số tiền{' '}
            {formatCurrency(alert.evidence[0].amount, alert.bill.currency)}
          </Text>
          <Text style={styles.text}>
            Cùng kỳ, cách nhau tối đa 3 ngày. Có thể là khoản riêng, trả nhiều
            lần hoặc dữ liệu nhập lặp.
          </Text>
        </>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Xem giao dịch cảnh báo ${
          alert.bill.label
        }, kỳ ${dateLabel(alert.dueDate)}, giao dịch ${alert.evidence[0].id}`}
        style={styles.linkButton}
        onPress={() =>
          setEvidenceLimit(old => ({
            ...old,
            [alert.key]: old[alert.key] ? 0 : 6,
          }))
        }
      >
        <Text style={styles.link}>
          {evidenceLimit[alert.key]
            ? 'Thu gọn giao dịch'
            : `Xem ${alert.evidence.length} giao dịch`}
        </Text>
      </TouchableOpacity>
      {evidenceLimit[alert.key] ? (
        <View style={styles.evidence}>
          {alert.evidence.slice(0, evidenceLimit[alert.key]).map(row => (
            <View
              key={row.id}
              accessible
              accessibilityLabel={`Bằng chứng cảnh báo ${row.id}, ${row.date}, ${row.amount} ${alert.bill.currency}, ${row.note}`}
              style={styles.entry}
            >
              <Text style={styles.text}>
                {dateLabel(row.date)} · #{row.id} ·{' '}
                {formatCurrency(row.amount, alert.bill.currency)}
              </Text>
              <Text style={styles.text}>{row.note || 'Không có ghi chú'}</Text>
            </View>
          ))}
          {evidenceLimit[alert.key] < alert.evidence.length ? (
            <ActionButton
              label="Xem thêm bằng chứng"
              secondary
              onPress={() =>
                setEvidenceLimit(old => ({
                  ...old,
                  [alert.key]: old[alert.key] + 6,
                }))
              }
            />
          ) : null}
        </View>
      ) : null}
      <ActionButton
        label={hidden ? 'Hiện lại cảnh báo' : 'Đã kiểm tra'}
        accessibilityLabel={`${hidden ? 'Hiện lại' : 'Đã kiểm tra'} cảnh báo ${
          alert.bill.label
        }, kỳ ${dateLabel(alert.dueDate)}, giao dịch ${alert.evidence[0].id}`}
        secondary
        disabled={saving}
        onPress={() => decide(alert, !hidden)}
      />
    </View>
  );
  if (!book.bills.some(bill => !bill.archived && !bill.paused)) return null;
  return (
    <View style={styles.section}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Xem cảnh báo định kỳ"
        style={styles.linkButton}
        onPress={() => setOpen(!open)}
      >
        <Text style={styles.title}>Cần xem lại ({visible.length})</Text>
        <Text style={styles.text}>
          {open ? 'Thu gọn' : 'Xem kết quả và giao dịch làm bằng chứng'}
        </Text>
      </TouchableOpacity>
      {open ? (
        <>
          <Text style={styles.text}>
            Đã kiểm tra chỉ ẩn cảnh báo này, không xác nhận đã trả hay thay đổi
            giao dịch.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Cách kiểm tra khoản định kỳ"
            style={styles.linkButton}
            onPress={() => setShowMethod(!showMethod)}
          >
            <Text style={styles.link}>
              {showMethod ? 'Thu gọn cách kiểm tra' : 'Cách kiểm tra'}
            </Text>
          </TouchableOpacity>
          {showMethod ? (
            <Text style={styles.text}>
              Chỉ xét lịch đã xác nhận. Báo tăng khi ít nhất 10% so với trung vị
              3 kỳ liền trước dao động trong ±10%, đồng thời vượt mức dự kiến.
              Báo có thể ghi lặp khi các giao dịch khác ID, cùng số tiền và kỳ,
              trong tối đa 3 ngày. Đây là dấu hiệu cần đối chiếu, không phải kết
              luận thu sai.
            </Text>
          ) : null}
          {findings.ambiguousNames ? (
            <Text style={styles.text}>
              {findings.ambiguousNames} nhóm tên thuộc nhiều lịch: chỉ dùng liên
              kết đã xác nhận, không tự ghép theo tên.
            </Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!visible.length ? (
            <Text style={styles.text}>
              Chưa thấy dấu hiệu cần xem lại trong phần lịch sử đã tải, hoặc bạn
              đã kiểm tra các cảnh báo hiện có.
            </Text>
          ) : null}
          {visible.slice(0, limit).map(alert => renderAlert(alert, false))}
          {visible.length > limit ? (
            <ActionButton
              label="Xem thêm cảnh báo"
              secondary
              onPress={() => setLimit(limit + 3)}
            />
          ) : null}
          {reviewed.length ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Xem cảnh báo đã kiểm tra"
              style={styles.linkButton}
              onPress={() => setShowReviewed(!showReviewed)}
            >
              <Text style={styles.link}>
                {showReviewed ? 'Thu gọn mục đã xem' : 'Đã kiểm tra'} (
                {reviewed.length})
              </Text>
            </TouchableOpacity>
          ) : null}
          {showReviewed
            ? reviewed.slice(0, limit).map(alert => renderAlert(alert, true))
            : null}
          {showReviewed && reviewed.length > limit ? (
            <ActionButton
              label="Xem thêm cảnh báo đã kiểm tra"
              secondary
              onPress={() => setLimit(limit + 3)}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  section: {
    gap: 10,
    borderTopWidth: 1,
    borderColor: '#F0D4BD',
    paddingTop: 12,
  },
  card: {
    padding: 14,
    gap: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0D4BD',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#593420' },
  text: { fontSize: 13, lineHeight: 20, color: '#8A6042' },
  warning: {
    fontSize: 14,
    lineHeight: 21,
    color: '#A95514',
    fontWeight: '600',
  },
  amount: { fontSize: 16, lineHeight: 24, color: '#AA4F0A', fontWeight: '700' },
  link: { fontSize: 13, color: '#AA4F0A', fontWeight: '700' },
  linkButton: { minHeight: 44, justifyContent: 'center', gap: 4 },
  evidence: { gap: 8 },
  entry: { gap: 4, paddingVertical: 6 },
  error: { fontSize: 13, lineHeight: 20, color: '#B44224' },
});
