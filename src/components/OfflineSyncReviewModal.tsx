import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { OfflineTransactionDraft } from '../services/offlineTransactionQueue';
import type {
  OfflineTransactionChange,
  TransactionSnapshot,
} from '../services/offlineTransactionChanges';

export type OfflineSyncReview = {
  drafts: OfflineTransactionDraft[];
  changes: OfflineTransactionChange[];
  remote: Record<number, TransactionSnapshot | null>;
};

const describe = (item: TransactionSnapshot | null | undefined) =>
  item
    ? `${item.type === 'INCOME' ? 'Thu +' : 'Chi -'}${Number(
        item.amount,
      ).toLocaleString('vi-VN')} · ${item.date}${
        item.note ? ` · ${item.note}` : ''
      }`
    : 'Không còn trên máy chủ';

export default function OfflineSyncReviewModal({
  review,
  onChoose,
}: {
  review: OfflineSyncReview | null;
  onChoose: (choice: 'later' | 'local' | 'server') => void;
}) {
  return (
    <Modal
      visible={Boolean(review)}
      transparent
      animationType="slide"
      onRequestClose={() => onChoose('later')}
    >
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Dữ liệu khi có mạng lại</Text>
          <Text style={styles.description}>
            Xem từng thay đổi trên điện thoại trước khi chọn bản cần giữ.
          </Text>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
          >
            {review?.drafts.map(item => (
              <View key={item.id} style={styles.row}>
                <Text style={styles.rowTitle}>Giao dịch mới</Text>
                <Text style={styles.local}>
                  {item.payload.type === 'INCOME' ? 'Thu +' : 'Chi -'}
                  {Number(item.payload.amount).toLocaleString('vi-VN')} ·{' '}
                  {item.payload.note || 'Không có ghi chú'}
                </Text>
                <Text style={styles.remote}>
                  Máy chủ: Chưa có giao dịch này
                </Text>
              </View>
            ))}
            {review?.changes.map(item => (
              <View key={item.transactionId} style={styles.row}>
                <Text style={styles.rowTitle}>
                  {item.action === 'DELETE' ? 'Xóa giao dịch' : 'Sửa giao dịch'}
                </Text>
                <Text style={styles.local}>
                  Trên máy:{' '}
                  {item.action === 'DELETE'
                    ? 'Đã xóa'
                    : `${
                        item.payload?.type === 'INCOME' ? 'Thu +' : 'Chi -'
                      }${Number(item.payload?.amount).toLocaleString(
                        'vi-VN',
                      )} · ${item.payload?.note || 'Không có ghi chú'}`}
                </Text>
                <Text style={styles.remote}>
                  Máy chủ: {describe(review.remote[item.transactionId])}
                </Text>
                {item.status === 'NEEDS_REVIEW' ? (
                  <Text style={styles.warning}>
                    Cần kiểm tra xung đột trước khi ghi lên máy chủ.
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.primary}
            onPress={() => onChoose('local')}
          >
            <Text style={styles.primaryText}>Dùng thay đổi trên máy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.secondary}
            onPress={() => onChoose('server')}
          >
            <Text style={styles.secondaryText}>Giữ dữ liệu máy chủ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.later}
            onPress={() => onChoose('later')}
          >
            <Text style={styles.laterText}>Để sau</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: '#2A1A12A6', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '86%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#FFF9F4',
    padding: 20,
    gap: 10,
  },
  title: { color: '#4A2B1A', fontSize: 20, fontWeight: '800' },
  description: { color: '#7A5438', fontSize: 13, lineHeight: 19 },
  list: { flexGrow: 0 },
  listContent: { gap: 10, paddingVertical: 8 },
  row: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0D1B3',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 5,
  },
  rowTitle: { color: '#4A2B1A', fontWeight: '800' },
  local: { color: '#AE5415', fontSize: 13 },
  remote: { color: '#735744', fontSize: 13 },
  warning: { color: '#B34338', fontSize: 12 },
  primary: {
    borderRadius: 14,
    backgroundColor: '#F78305',
    padding: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
  secondary: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6C2A1',
    padding: 13,
    alignItems: 'center',
  },
  secondaryText: { color: '#7A421E', fontWeight: '800' },
  later: { padding: 10, alignItems: 'center' },
  laterText: { color: '#7A5438', fontWeight: '700' },
});
