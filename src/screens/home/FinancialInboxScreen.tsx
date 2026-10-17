import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Building2,
  CloudOff,
  FileSpreadsheet,
  Inbox,
  Mic,
  ScanLine,
  Trash2,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { bankNotificationReader } from '../../native/bankNotificationReader';
import {
  financialCaptureInbox,
  type FinancialCaptureDraft,
  type FinancialCaptureSource,
} from '../../services/financialCaptureInbox';
import {
  offlineTransactionQueue,
  type OfflineTransactionDraft,
} from '../../services/offlineTransactionQueue';
import type { BankNotificationEvent } from '../../types/bankNotification';
import { parseBankNotification } from '../../utils/bankNotificationParser';
import { formatCurrency, formatShortDate } from '../../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'FinancialInbox'>;
type SourceFilter = 'ALL' | FinancialCaptureSource | 'OFFLINE' | 'BANK';
type StatusFilter = 'ALL' | 'READY' | 'REVIEW';

type InboxItem = {
  id: string;
  source: Exclude<SourceFilter, 'ALL'>;
  status: 'READY' | 'REVIEW';
  title: string;
  detail: string;
  amount?: number;
  type?: 'INCOME' | 'EXPENSE';
  currency?: string;
  date: string;
  capture?: FinancialCaptureDraft;
  offline?: OfflineTransactionDraft;
  bank?: BankNotificationEvent;
};

const sourceLabels: Record<SourceFilter, string> = {
  ALL: 'Tất cả',
  OCR: 'Hóa đơn',
  VOICE: 'Giọng nói',
  EXCEL: 'Excel',
  OFFLINE: 'Ngoại tuyến',
  BANK: 'Ngân hàng',
};

const FinancialInboxScreen = ({ navigation }: Props) => {
  const { user } = useAuth();
  const [captures, setCaptures] = useState<FinancialCaptureDraft[]>([]);
  const [offline, setOffline] = useState<OfflineTransactionDraft[]>([]);
  const [bankEvents, setBankEvents] = useState<BankNotificationEvent[]>([]);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [nextCaptures, nextOffline, nextBank] = await Promise.all([
        financialCaptureInbox.list(user.id),
        offlineTransactionQueue.list(user.id),
        bankNotificationReader.isSupported
          ? bankNotificationReader.getPendingEvents(user.id).catch(() => [])
          : Promise.resolve([]),
      ]);
      setCaptures(nextCaptures);
      setOffline(nextOffline);
      setBankEvents(nextBank);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  const items = useMemo<InboxItem[]>(() => {
    const captureItems: InboxItem[] = captures.map(item => ({
      id: item.id,
      source: item.source,
      status: item.status === 'READY' ? 'READY' : 'REVIEW',
      title: item.title,
      detail:
        item.source === 'EXCEL'
          ? `${item.excel?.preview.ready ?? 0} dòng sẵn sàng · ${
              item.excel?.preview.duplicates ?? 0
            } trùng`
          : item.transactionDraft?.note || 'Bản nháp cần kiểm tra',
      amount: item.transactionDraft?.amount ?? undefined,
      type: item.transactionDraft?.type,
      currency:
        item.transactionDraft?.currency ?? user?.currency_default ?? 'VND',
      date: item.createdAt,
      capture: item,
    }));
    const offlineItems: InboxItem[] = offline.map(item => ({
      id: item.id,
      source: 'OFFLINE',
      status: item.status === 'NEEDS_REVIEW' ? 'REVIEW' : 'READY',
      title: item.payload.note || 'Giao dịch ngoại tuyến',
      detail:
        item.status === 'NEEDS_REVIEW'
          ? item.lastError || 'Cần kiểm tra trước khi gửi lại'
          : 'Chờ máy chủ xác nhận; chưa đổi số dư',
      amount: Number(item.payload.amount),
      type: item.payload.type,
      currency: user?.currency_default ?? 'VND',
      date: item.createdAt,
      offline: item,
    }));
    const bankItems: InboxItem[] = bankEvents.map(event => {
      const parsed = parseBankNotification(event);
      return {
        id: event.id,
        source: 'BANK',
        status: parsed.status === 'READY' ? 'READY' : 'REVIEW',
        title: event.appName || event.title || 'Thông báo ngân hàng',
        detail: parsed.note || parsed.reason || event.text,
        amount: parsed.amount ? Number(parsed.amount) : undefined,
        type: parsed.type,
        currency: parsed.currency ?? 'VND',
        date: parsed.transactionDate,
        bank: event,
      };
    });
    return [...captureItems, ...offlineItems, ...bankItems].sort(
      (left, right) => right.date.localeCompare(left.date),
    );
  }, [bankEvents, captures, offline, user?.currency_default]);

  const filtered = items.filter(
    item =>
      (sourceFilter === 'ALL' || item.source === sourceFilter) &&
      (statusFilter === 'ALL' || item.status === statusFilter),
  );

  const openItem = (item: InboxItem) => {
    if (item.source === 'BANK') {
      navigation.navigate('BankNotifications');
      return;
    }
    if (item.source === 'OFFLINE') {
      navigation.navigate('DataManagement');
      return;
    }
    if (item.source === 'EXCEL') {
      navigation.navigate('DataManagement', {
        financialDraftId: item.capture?.id,
      });
      return;
    }
    navigation.navigate('Main', { financialDraftId: item.capture?.id });
  };

  const removeCapture = (item: InboxItem) => {
    if (!item.capture || !user?.id) return;
    Alert.alert(
      'Bỏ bản nháp?',
      'Bản nháp chưa làm thay đổi số dư. Sau khi bỏ sẽ không thể mở lại từ hộp thư.',
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Bỏ bản nháp',
          style: 'destructive',
          onPress: () => {
            financialCaptureInbox
              .remove(user.id, item.capture!.id)
              .then(load)
              .catch(() => undefined);
          },
        },
      ],
    );
  };

  const renderIcon = (source: InboxItem['source']) => {
    if (source === 'OCR') return <ScanLine size={19} color={Colors.primary} />;
    if (source === 'VOICE') return <Mic size={19} color={Colors.primary} />;
    if (source === 'EXCEL')
      return <FileSpreadsheet size={19} color={Colors.primary} />;
    if (source === 'OFFLINE')
      return <CloudOff size={19} color={Colors.primary} />;
    return <Building2 size={19} color={Colors.primary} />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={navigation.goBack}
        >
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Hộp thư tài chính</Text>
          <Text style={styles.subtitle}>{items.length} mục chưa hoàn tất</Text>
        </View>
        <View style={styles.headerButton}>
          <Inbox size={20} color={Colors.primary} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {(Object.keys(sourceLabels) as SourceFilter[]).map(source => (
            <TouchableOpacity
              key={source}
              style={[
                styles.filterChip,
                sourceFilter === source && styles.filterChipActive,
              ]}
              onPress={() => setSourceFilter(source)}
            >
              <Text
                style={[
                  styles.filterText,
                  sourceFilter === source && styles.filterTextActive,
                ]}
              >
                {sourceLabels[source]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.statusRow}>
          {(['ALL', 'READY', 'REVIEW'] as StatusFilter[]).map(status => (
            <TouchableOpacity
              key={status}
              style={[
                styles.statusButton,
                statusFilter === status && styles.statusButtonActive,
              ]}
              onPress={() => setStatusFilter(status)}
            >
              <Text style={styles.statusText}>
                {status === 'ALL'
                  ? 'Mọi trạng thái'
                  : status === 'READY'
                  ? 'Sẵn sàng duyệt'
                  : 'Cần kiểm tra'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.emptyText}>Đang gom các bản nháp…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Inbox size={26} color="#B57745" />
            <Text style={styles.emptyTitle}>Không có mục phù hợp</Text>
            <Text style={styles.emptyText}>
              Các bản nháp chưa duyệt luôn nằm ngoài số dư.
            </Text>
          </View>
        ) : (
          filtered.map(item => (
            <View key={`${item.source}-${item.id}`} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemIcon}>{renderIcon(item.source)}</View>
                <View style={styles.itemCopy}>
                  <Text style={styles.sourceLabel}>
                    {sourceLabels[item.source]} ·{' '}
                    {item.status === 'READY' ? 'Sẵn sàng' : 'Cần kiểm tra'}
                  </Text>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
                {item.amount ? (
                  <Text
                    style={
                      item.type === 'INCOME'
                        ? styles.incomeAmount
                        : styles.expenseAmount
                    }
                  >
                    {item.type === 'INCOME' ? '+' : '-'}
                    {formatCurrency(item.amount, item.currency ?? 'VND')}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.itemDetail} numberOfLines={3}>
                {item.detail}
              </Text>
              <Text style={styles.itemDate}>{formatShortDate(item.date)}</Text>
              <View style={styles.actionRow}>
                {item.capture ? (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => removeCapture(item)}
                  >
                    <Trash2 size={16} color="#B54837" />
                    <Text style={styles.deleteText}>Bỏ</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.reviewButton}
                  onPress={() => openItem(item)}
                >
                  <Text style={styles.reviewText}>
                    {item.source === 'BANK' ? 'Duyệt hoặc ghép' : 'Mở kiểm tra'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Chưa duyệt thì chưa ghi tiền</Text>
          <Text style={styles.noticeText}>
            Hộp thư chỉ gom dữ liệu chờ. Mỗi nguồn vẫn mở màn kiểm tra riêng để
            sửa, ghép, chọn dòng hoặc xác nhận trước khi thay đổi số dư.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF9F4' },
  header: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F1D8C1',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  title: { color: '#4A2B1A', fontSize: 19, fontWeight: '900' },
  subtitle: { color: '#8B6B55', fontSize: 11, marginTop: 3 },
  content: { padding: 16, gap: 11, paddingBottom: 44 },
  filterRow: { gap: 8, paddingRight: 16 },
  filterChip: {
    minHeight: 38,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E8B680',
    backgroundColor: '#FFFDFB',
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: { color: '#7A5438', fontWeight: '800', fontSize: 12 },
  filterTextActive: { color: Colors.white },
  statusRow: { flexDirection: 'row', gap: 7 },
  statusButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 12,
    backgroundColor: '#F4E9DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButtonActive: { backgroundColor: '#FFE0C2' },
  statusText: { color: '#6F4931', fontSize: 10, fontWeight: '900' },
  emptyCard: {
    minHeight: 150,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#F0C49B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 18,
  },
  emptyTitle: { color: '#4A2B1A', fontWeight: '900' },
  emptyText: { color: '#8B6B55', fontSize: 12, textAlign: 'center' },
  itemCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0C49B',
    backgroundColor: Colors.white,
    padding: 14,
    gap: 8,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCopy: { flex: 1, minWidth: 0 },
  sourceLabel: { color: '#A05B29', fontSize: 10, fontWeight: '900' },
  itemTitle: { color: '#4A2B1A', fontWeight: '900', marginTop: 3 },
  itemDetail: { color: '#7A5438', fontSize: 12, lineHeight: 18 },
  itemDate: { color: '#A17B5D', fontSize: 10, fontWeight: '700' },
  incomeAmount: { color: '#188F5A', fontWeight: '900', fontSize: 12 },
  expenseAmount: { color: '#D4621D', fontWeight: '900', fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 8 },
  deleteButton: {
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: '#FFF0EE',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteText: { color: '#B54837', fontWeight: '900' },
  reviewButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewText: { color: Colors.white, fontWeight: '900' },
  noticeCard: { borderRadius: 18, backgroundColor: '#FFF3D8', padding: 14 },
  noticeTitle: { color: '#7A4B00', fontWeight: '900' },
  noticeText: { color: '#8B5700', fontSize: 12, lineHeight: 18, marginTop: 5 },
});

export default FinancialInboxScreen;
