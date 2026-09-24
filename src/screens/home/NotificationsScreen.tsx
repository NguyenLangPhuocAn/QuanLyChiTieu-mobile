import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  Info,
  PiggyBank,
  Settings,
  Trash2,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { notificationsService } from '../../services/notifications';
import type {
  AppNotification,
  NotificationSeverity,
} from '../../types/notification';
import { getUserFriendlyErrorMessage } from '../../utils/errors';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

const severityMeta: Record<
  NotificationSeverity,
  { color: string; background: string }
> = {
  INFO: { color: '#2E6F9E', background: '#E8F4FF' },
  WARNING: { color: '#A15C00', background: '#FFF3D8' },
  CRITICAL: { color: '#B3261E', background: '#FFE4DF' },
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${`${date.getDate()}`.padStart(2, '0')}/${`${
    date.getMonth() + 1
  }`.padStart(2, '0')}/${date.getFullYear()}`;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  getUserFriendlyErrorMessage(error, fallback);

const NotificationsScreen = ({ navigation }: Props) => {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter(item => !item.read_at).length,
    [notifications],
  );

  const loadNotifications = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await notificationsService.getAll(token);
      setNotifications(response.data);
    } catch (error) {
      Alert.alert(
        'Không thể tải thông báo',
        getErrorMessage(error, 'Vui lòng thử lại sau.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = async (notification: AppNotification) => {
    if (!token || notification.read_at) {
      return;
    }

    try {
      await notificationsService.markRead(token, notification.id);
      const readAt = new Date().toISOString();
      setNotifications(current =>
        current.map(item =>
          item.id === notification.id ? { ...item, read_at: readAt } : item,
        ),
      );
    } catch (error) {
      Alert.alert(
        'Chưa đánh dấu đã đọc',
        getErrorMessage(error, 'Vui lòng thử lại sau.'),
      );
    }
  };

  const handleOpenNotification = async (notification: AppNotification) => {
    await handleMarkRead(notification);

    if (notification.source_type === 'cashflow_forecast') {
      navigation.navigate('FinancialPlan');
      return;
    }
    if (notification.source_type === 'savings_goal') {
      navigation.navigate('SavingsGoals');
      return;
    }
    if (notification.source_type === 'budget' && notification.source_id) {
      navigation.navigate('BudgetDetail', {
        budgetId: notification.source_id,
      });
    }
  };

  const handleMarkAllRead = async () => {
    if (!token || unreadCount === 0) {
      return;
    }

    try {
      setIsMarkingAll(true);
      await notificationsService.markAllRead(token);
      const readAt = new Date().toISOString();
      setNotifications(current =>
        current.map(item =>
          item.read_at ? item : { ...item, read_at: readAt },
        ),
      );
    } catch (error) {
      Alert.alert(
        'Chưa đánh dấu tất cả',
        getErrorMessage(error, 'Vui lòng thử lại sau.'),
      );
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleDelete = async (notification: AppNotification) => {
    if (!token) {
      return;
    }

    try {
      await notificationsService.remove(token, notification.id);
      setNotifications(current =>
        current.filter(item => item.id !== notification.id),
      );
    } catch (error) {
      Alert.alert(
        'Chưa xóa được thông báo',
        getErrorMessage(error, 'Vui lòng thử lại sau.'),
      );
    }
  };

  const renderNotification = ({ item }: { item: AppNotification }) => {
    const unread = !item.read_at;
    const meta = severityMeta[item.severity] ?? severityMeta.INFO;
    const StatusIcon =
      item.source_type === 'cashflow_forecast'
        ? TrendingUp
        : item.source_type === 'savings_goal'
        ? PiggyBank
        : item.severity === 'INFO'
        ? Info
        : TriangleAlert;

    return (
      <TouchableOpacity
        activeOpacity={0.86}
        style={[
          styles.notificationCard,
          unread && styles.notificationCardUnread,
        ]}
        onPress={() => handleOpenNotification(item)}
      >
        <View
          style={[
            styles.notificationIcon,
            { backgroundColor: meta.background },
          ]}
        >
          <StatusIcon size={20} color={meta.color} />
        </View>
        <View style={styles.notificationCopy}>
          <View style={styles.notificationTitleRow}>
            <Text style={styles.notificationTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {unread ? <View style={styles.unreadDot} /> : null}
          </View>
          <Text style={styles.notificationMessage}>{item.message}</Text>
          {item.created_at ? (
            <Text style={styles.notificationDate}>
              {formatDate(item.created_at)}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          accessibilityLabel={`Xóa thông báo ${item.title}`}
          style={styles.deleteButton}
          onPress={() => handleDelete(item)}
        >
          <Trash2 size={18} color="#B3261E" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Thông báo</Text>
          <Text style={styles.subtitle}>
            {unreadCount > 0
              ? `${unreadCount} thông báo chưa đọc`
              : 'Không có thông báo chưa đọc'}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityLabel="Cài đặt thông báo"
          style={styles.headerButton}
          onPress={() => navigation.navigate('NotificationSettings')}
        >
          <Settings size={21} color="#593420" />
        </TouchableOpacity>
      </View>

      <View style={styles.actionsRow}>
        <View style={styles.summaryPill}>
          <Bell size={17} color="#D87219" />
          <Text style={styles.summaryText}>
            {notifications.length} thông báo
          </Text>
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={handleMarkAllRead}
            disabled={isMarkingAll}
          >
            {isMarkingAll ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <>
                <CheckCheck size={17} color={Colors.primary} />
                <Text style={styles.markAllText}>Đọc tất cả</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => String(item.id)}
          renderItem={renderNotification}
          contentContainerStyle={
            notifications.length ? styles.listContent : styles.emptyContent
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Bell size={30} color="#D87219" />
              <Text style={styles.emptyTitle}>Chưa có thông báo</Text>
              <Text style={styles.emptyText}>
                Các cảnh báo ngân sách và thông báo hệ thống sẽ xuất hiện tại
                đây.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF7EF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF0E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  title: { color: '#4A2B1A', fontSize: 22, fontWeight: '900' },
  subtitle: { color: '#8B6548', fontSize: 13, fontWeight: '800', marginTop: 4 },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  summaryPill: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: '#FFF0E2',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  summaryText: { color: '#7B573C', fontSize: 13, fontWeight: '900' },
  markAllButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    backgroundColor: '#FFFDFC',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  markAllText: { color: Colors.primary, fontSize: 13, fontWeight: '900' },
  loadingBlock: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, paddingBottom: 36, gap: 10 },
  emptyContent: { flexGrow: 1, padding: 16, justifyContent: 'center' },
  emptyState: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    backgroundColor: '#FFFDFC',
    padding: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#4A2B1A',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 12,
  },
  emptyText: {
    color: '#8B6548',
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
  },
  notificationCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    backgroundColor: '#FFFDFC',
    padding: 14,
    flexDirection: 'row',
    gap: 12,
  },
  notificationCardUnread: {
    borderColor: '#F2B067',
    backgroundColor: '#FFF9F3',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationCopy: { flex: 1 },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
    color: '#4A2B1A',
    fontSize: 16,
    fontWeight: '900',
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    marginTop: 5,
  },
  notificationMessage: {
    color: '#7B573C',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  notificationDate: {
    color: '#9A765B',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFECE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default NotificationsScreen;
