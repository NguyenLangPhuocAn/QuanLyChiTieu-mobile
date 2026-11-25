import React, { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  mayHaveReachedServer,
  type OfflineTransactionDraft,
} from '../services/offlineTransactionQueue';
import type { OfflineCategoryChange } from '../services/offlineCategoryQueue';
import type { OfflineWalletChange } from '../services/offlineWalletQueue';
import type { Wallet } from '../types/wallet';
import type { Category } from '../types/category';
import type { Budget } from '../types/budget';
import type { OfflineBudgetChange } from '../services/offlineBudgetQueue';
import type { OfflineSavingsGoalChange } from '../services/offlineSavingsGoalQueue';
import type { SavingsGoal } from '../types/savings';
import type { OfflineLoanDebtChange } from '../services/offlineLoanDebtQueue';
import type { OfflineLoanCreate } from '../services/offlineLoanCreateQueue';
import type { LoanDebt } from '../types/loanDebt';
import type {
  OfflineTransactionChange,
  TransactionSnapshot,
} from '../services/offlineTransactionChanges';

export type OfflineSyncReview = {
  drafts: OfflineTransactionDraft[];
  changes: OfflineTransactionChange[];
  categories?: OfflineCategoryChange[];
  remoteCategories?: Record<number, Category | null>;
  wallets?: OfflineWalletChange[];
  remoteWallets?: Record<number, Wallet | null>;
  budgets?: OfflineBudgetChange[];
  remoteBudgets?: Record<number, Budget | null>;
  savingsGoals?: OfflineSavingsGoalChange[];
  remoteSavingsGoals?: Record<number, SavingsGoal | null>;
  loanDebts?: OfflineLoanDebtChange[];
  remoteLoanDebts?: Record<number, LoanDebt | null>;
  loanCreates?: OfflineLoanCreate[];
  remoteLoanWallets?: Record<number, Wallet | null>;
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => setDetailsOpen(false), [review]);
  const transactionCount =
    (review?.drafts.length ?? 0) + (review?.changes.length ?? 0);
  const categoryCount = review?.categories?.length ?? 0;
  const walletCount = review?.wallets?.length ?? 0;
  const budgetCount = review?.budgets?.length ?? 0;
  const savingsCount = review?.savingsGoals?.length ?? 0;
  const loanCount =
    (review?.loanDebts?.length ?? 0) + (review?.loanCreates?.length ?? 0);
  const otherCount =
    categoryCount + walletCount + budgetCount + savingsCount + loanCount;
  const total = transactionCount + otherCount;
  const summary = [
    transactionCount ? `${transactionCount} giao dịch` : '',
    categoryCount ? `${categoryCount} danh mục` : '',
    walletCount ? `${walletCount} ví` : '',
    budgetCount ? `${budgetCount} ngân sách` : '',
    savingsCount ? `${savingsCount} mục tiêu tiết kiệm` : '',
    loanCount ? `${loanCount} khoản vay/nợ` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const needsReview = [
    ...(review?.drafts ?? []),
    ...(review?.changes ?? []),
    ...(review?.categories ?? []),
    ...(review?.wallets ?? []),
    ...(review?.budgets ?? []),
    ...(review?.savingsGoals ?? []),
    ...(review?.loanDebts ?? []),
    ...(review?.loanCreates ?? []),
  ].filter(item => item.status === 'NEEDS_REVIEW').length;
  return (
    <Modal
      visible={Boolean(review)}
      transparent
      animationType="slide"
      onRequestClose={() => onChoose('later')}
    >
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{`${total} thay đổi chưa đồng bộ`}</Text>
          <Text style={styles.description}>
            So với lần kết nối trước: {summary}. Chọn bản bạn muốn giữ.
          </Text>
          {needsReview ? (
            <Text style={styles.warning}>
              {needsReview} mục cần xem lại trước khi đồng bộ.
            </Text>
          ) : null}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={detailsOpen ? 'Ẩn chi tiết' : 'Xem chi tiết'}
            style={styles.detailsButton}
            onPress={() => setDetailsOpen(value => !value)}
          >
            <Text style={styles.detailsText}>
              {detailsOpen ? 'Ẩn chi tiết' : 'Xem chi tiết'}
            </Text>
          </TouchableOpacity>
          {detailsOpen ? (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
            >
              {review?.savingsGoals?.map(item => (
                <View key={`savings-${item.id}`} style={styles.row}>
                  <Text style={styles.rowTitle}>Sửa mục tiêu tiết kiệm</Text>
                  <Text style={styles.local}>
                    Trên máy: {item.payload.name} ·{' '}
                    {Number(item.payload.target_amount).toLocaleString('vi-VN')}
                  </Text>
                  <Text style={styles.remote}>
                    Máy chủ:{' '}
                    {review.remoteSavingsGoals?.[item.id]
                      ? `${review.remoteSavingsGoals[item.id]?.name} · ${Number(
                          review.remoteSavingsGoals[item.id]?.target_amount,
                        ).toLocaleString('vi-VN')}`
                      : 'Không còn mục tiêu'}
                  </Text>
                  {item.status === 'NEEDS_REVIEW' ? (
                    <Text style={styles.warning}>
                      {item.lastError || 'Cần kiểm tra xung đột.'}
                    </Text>
                  ) : null}
                </View>
              ))}
              {review?.loanDebts?.map(item => (
                <View key={`loan-${item.id}`} style={styles.row}>
                  <Text style={styles.rowTitle}>Sửa thông tin Vay/Nợ</Text>
                  <Text style={styles.local}>
                    Trên máy: {item.payload.person_name} ·{' '}
                    {item.payload.due_date?.slice(0, 10) ?? 'Chưa hẹn ngày'}
                  </Text>
                  <Text style={styles.remote}>
                    Máy chủ:{' '}
                    {review.remoteLoanDebts?.[item.id]
                      ? `${review.remoteLoanDebts[item.id]?.person_name} · ${
                          review.remoteLoanDebts[item.id]?.due_date?.slice(
                            0,
                            10,
                          ) ?? 'Chưa hẹn ngày'
                        }`
                      : 'Không còn khoản này'}
                  </Text>
                  {item.status === 'NEEDS_REVIEW' ? (
                    <Text style={styles.warning}>
                      {item.lastError || 'Cần kiểm tra xung đột.'}
                    </Text>
                  ) : null}
                </View>
              ))}
              {review?.loanCreates?.map(item => (
                <View key={`loan-create-${item.id}`} style={styles.row}>
                  <Text style={styles.rowTitle}>Vay/Nợ mới</Text>
                  <Text style={styles.local}>
                    Trên máy:{' '}
                    {item.payload.type === 'BORROWED' ? 'Vay từ' : 'Cho vay'}{' '}
                    {item.payload.person_name} ·{' '}
                    {Number(item.payload.principal_amount).toLocaleString(
                      'vi-VN',
                    )}{' '}
                    {item.wallet.currency}
                  </Text>
                  <Text style={styles.local}>
                    Ví đã chọn: {item.wallet.name}
                  </Text>
                  <Text style={styles.remote}>
                    Máy chủ:{' '}
                    {review.remoteLoanWallets?.[item.wallet.id]
                      ? `Ví ${
                          review.remoteLoanWallets[item.wallet.id]?.name
                        } · ${Number(
                          review.remoteLoanWallets[item.wallet.id]?.balance ??
                            0,
                        ).toLocaleString('vi-VN')} → ${(
                          Number(
                            review.remoteLoanWallets[item.wallet.id]?.balance ??
                              0,
                          ) +
                          (item.payload.type === 'BORROWED' ? 1 : -1) *
                            Number(item.payload.principal_amount)
                        ).toLocaleString('vi-VN')} ${item.wallet.currency}`
                      : 'Ví không còn hoặc chưa đọc được'}
                  </Text>
                  <Text style={styles.remote}>
                    Khoản đã được ghi trước đó sẽ không tạo lại khi gửi cùng mã.
                  </Text>
                  {item.status === 'NEEDS_REVIEW' ? (
                    <Text style={styles.warning}>
                      {item.lastError || 'Cần kiểm tra trước khi gửi.'}
                    </Text>
                  ) : null}
                </View>
              ))}
              {review?.budgets?.map(item => (
                <View key={`budget-${item.id}`} style={styles.row}>
                  <Text style={styles.rowTitle}>
                    {item.action === 'CREATE'
                      ? 'Ngân sách mới'
                      : item.action === 'UPDATE'
                      ? 'Sửa ngân sách'
                      : 'Xóa ngân sách'}
                  </Text>
                  <Text style={styles.local}>
                    Trên máy:{' '}
                    {item.action === 'DELETE'
                      ? item.base?.name
                      : item.payload?.name}
                    {' · '}
                    {Number(
                      item.action === 'DELETE'
                        ? item.base?.limit_amount
                        : item.payload?.limit_amount,
                    ).toLocaleString('vi-VN')}
                  </Text>
                  <Text style={styles.remote}>
                    Máy chủ:{' '}
                    {item.action === 'CREATE'
                      ? 'Chưa xác định đã nhận'
                      : review.remoteBudgets?.[item.id]
                      ? `${review.remoteBudgets[item.id]?.name} · ${Number(
                          review.remoteBudgets[item.id]?.limit_amount,
                        ).toLocaleString('vi-VN')}`
                      : 'Không còn ngân sách'}
                  </Text>
                  {item.status === 'NEEDS_REVIEW' ? (
                    <Text style={styles.warning}>
                      {item.lastError || 'Cần kiểm tra xung đột.'}
                    </Text>
                  ) : null}
                </View>
              ))}
              {review?.wallets?.map(item => (
                <View key={`wallet-${item.id}`} style={styles.row}>
                  <Text style={styles.rowTitle}>
                    {item.action === 'CREATE'
                      ? 'Ví mới'
                      : item.action === 'UPDATE'
                      ? 'Sửa ví'
                      : 'Xóa ví'}
                  </Text>
                  <Text style={styles.local}>
                    Trên máy:{' '}
                    {item.action === 'DELETE'
                      ? item.base?.name
                      : item.payload?.name}{' '}
                    ·{' '}
                    {item.action === 'DELETE'
                      ? item.base?.currency
                      : item.payload?.currency}
                  </Text>
                  <Text style={styles.remote}>
                    Máy chủ:{' '}
                    {item.action === 'CREATE'
                      ? 'Chưa xác định đã nhận'
                      : review.remoteWallets?.[item.id]
                      ? `${review.remoteWallets[item.id]?.name} · ${Number(
                          review.remoteWallets[item.id]?.balance,
                        ).toLocaleString('vi-VN')}`
                      : 'Không còn ví'}
                  </Text>
                  {item.status === 'NEEDS_REVIEW' ? (
                    <Text style={styles.warning}>
                      {item.lastError || 'Cần kiểm tra xung đột.'}
                    </Text>
                  ) : null}
                </View>
              ))}
              {review?.categories?.map(item => (
                <View key={`category-${item.id}`} style={styles.row}>
                  <Text style={styles.rowTitle}>
                    {item.action === 'CREATE'
                      ? 'Danh mục mới'
                      : item.action === 'UPDATE'
                      ? 'Sửa danh mục'
                      : 'Xóa danh mục'}
                  </Text>
                  <Text style={styles.local}>
                    Trên máy:{' '}
                    {item.action === 'DELETE'
                      ? item.base?.name
                      : item.payload?.name}{' '}
                    ·{' '}
                    {item.action === 'DELETE'
                      ? item.base?.type
                      : item.payload?.type}
                  </Text>
                  <Text style={styles.remote}>
                    Máy chủ:{' '}
                    {item.action === 'CREATE'
                      ? 'Chưa xác định đã nhận'
                      : review.remoteCategories?.[item.id]?.name ??
                        'Không còn danh mục'}
                  </Text>
                  {item.status === 'NEEDS_REVIEW' ? (
                    <Text style={styles.warning}>
                      {item.lastError || 'Cần kiểm tra xung đột.'}
                    </Text>
                  ) : null}
                </View>
              ))}
              {review?.drafts.map(item => (
                <View key={item.id} style={styles.row}>
                  <Text style={styles.rowTitle}>Giao dịch mới</Text>
                  <Text style={styles.local}>
                    {item.payload.type === 'INCOME' ? 'Thu +' : 'Chi -'}
                    {Number(item.payload.amount).toLocaleString('vi-VN')} ·{' '}
                    {item.payload.note || 'Không có ghi chú'}
                  </Text>
                  <Text style={styles.remote}>
                    {item.confirmedTransactionId
                      ? 'Máy chủ: Đã ghi giao dịch; ảnh còn chờ tải lên'
                      : mayHaveReachedServer(item)
                      ? 'Máy chủ: Chưa xác định đã nhận khoản này'
                      : item.rejectedByServer
                      ? 'Máy chủ: Đã từ chối; chưa ghi giao dịch'
                      : 'Máy chủ: Chưa gửi giao dịch'}
                  </Text>
                  {item.receipt ? (
                    <Text style={styles.remote}>
                      Ảnh hóa đơn đã giữ trên máy.
                    </Text>
                  ) : null}
                </View>
              ))}
              {review?.changes.map(item => (
                <View key={item.transactionId} style={styles.row}>
                  <Text style={styles.rowTitle}>
                    {item.action === 'DELETE'
                      ? 'Xóa giao dịch'
                      : 'Sửa giao dịch'}
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
          ) : null}
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
  detailsButton: { alignSelf: 'flex-start', paddingVertical: 5 },
  detailsText: { color: '#AE5415', fontSize: 13, fontWeight: '700' },
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
