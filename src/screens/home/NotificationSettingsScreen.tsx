import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Bell,
  BellRing,
  Clock3,
  PiggyBank,
  TrendingUp,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import {
  defaultFinancialReminderSettings,
  financialReminder,
  requestFinancialReminderPermission,
  type FinancialReminderFrequency,
  type FinancialReminderSettings,
} from '../../native/financialReminder';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { notificationsService } from '../../services/notifications';
import type { NotificationSettings } from '../../types/notification';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import {
  formatReminderSchedule,
  withReminderFrequency,
} from '../../utils/financialReminder';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationSettings'>;
type SettingKey =
  | 'budget_alerts_enabled'
  | 'budget_expiring_enabled'
  | 'cashflow_forecast_enabled'
  | 'savings_plan_alerts_enabled'
  | 'system_notifications_enabled';

const settingRows: Array<{
  key: SettingKey;
  label: string;
  description: string;
  Icon: typeof Bell;
}> = [
  {
    key: 'budget_alerts_enabled',
    label: 'Cảnh báo ngân sách',
    description: 'Nhận cảnh báo khi chi tiêu gần hoặc vượt hạn mức.',
    Icon: BellRing,
  },
  {
    key: 'budget_expiring_enabled',
    label: 'Ngân sách sắp hết hạn',
    description: 'Nhắc khi một kỳ ngân sách chuẩn bị kết thúc.',
    Icon: Clock3,
  },
  {
    key: 'cashflow_forecast_enabled',
    label: 'Dự báo thu – chi',
    description: 'Cảnh báo khi dự báo 4 tháng tới có nguy cơ chi cao hơn thu.',
    Icon: TrendingUp,
  },
  {
    key: 'savings_plan_alerts_enabled',
    label: 'Tiến độ tiết kiệm',
    description: 'Nhắc khi mục tiêu tiết kiệm đang chậm hoặc đã quá hạn.',
    Icon: PiggyBank,
  },
  {
    key: 'system_notifications_enabled',
    label: 'Thông báo hệ thống',
    description: 'Cập nhật quan trọng về tài khoản và ứng dụng.',
    Icon: Bell,
  },
];

const getErrorMessage = (error: unknown, fallback: string) =>
  getUserFriendlyErrorMessage(error, fallback);

const NotificationSettingsScreen = ({ navigation }: Props) => {
  const { token } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<SettingKey | null>(null);
  const [reminderSettings, setReminderSettings] =
    useState<FinancialReminderSettings>(defaultFinancialReminderSettings);
  const [isSavingReminder, setIsSavingReminder] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const [response, localReminder] = await Promise.all([
        notificationsService.getSettings(token),
        financialReminder.isSupported
          ? financialReminder
              .getSettings()
              .catch(() => defaultFinancialReminderSettings)
          : Promise.resolve(defaultFinancialReminderSettings),
      ]);
      setSettings(response);
      setReminderSettings(localReminder);
    } catch (error) {
      Alert.alert(
        'Không thể tải cài đặt',
        getErrorMessage(error, 'Vui lòng thử lại sau.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleToggle = async (key: SettingKey, value: boolean) => {
    if (!token || !settings) {
      return;
    }

    const previousSettings = settings;
    setSettings({ ...settings, [key]: value });
    setSavingKey(key);

    try {
      const updated = await notificationsService.updateSettings(token, {
        [key]: value,
      });
      setSettings(updated);
    } catch (error) {
      setSettings(previousSettings);
      Alert.alert(
        'Chưa lưu được cài đặt',
        getErrorMessage(error, 'Vui lòng thử lại sau.'),
      );
    } finally {
      setSavingKey(null);
    }
  };

  const saveReminder = async (next: FinancialReminderSettings) => {
    if (!financialReminder.isSupported) return;
    const previous = reminderSettings;
    setReminderSettings(next);
    setIsSavingReminder(true);
    try {
      setReminderSettings(await financialReminder.saveSettings(next));
    } catch (error) {
      setReminderSettings(previous);
      Alert.alert(
        'Chưa lưu được lời nhắc',
        getErrorMessage(error, 'Vui lòng thử lại.'),
      );
    } finally {
      setIsSavingReminder(false);
    }
  };

  const handleReminderToggle = async (enabled: boolean) => {
    if (enabled && !(await requestFinancialReminderPermission())) {
      Alert.alert(
        'Chưa bật được thông báo',
        'Hãy cho phép Sổ Thu Chi Nova gửi thông báo trong cài đặt Android.',
      );
      return;
    }
    await saveReminder({ ...reminderSettings, enabled });
  };

  const selectReminderFrequency = (frequency: FinancialReminderFrequency) => {
    saveReminder(withReminderFrequency(reminderSettings, frequency)).catch(
      () => undefined,
    );
  };

  const selectReminderHour = (hour: number) => {
    saveReminder({ ...reminderSettings, hour, minute: 0 }).catch(
      () => undefined,
    );
  };

  const showReminderPreview = async () => {
    if (!(await requestFinancialReminderPermission())) {
      Alert.alert(
        'Chưa gửi được thông báo thử',
        'Hãy cho phép thông báo trong cài đặt Android rồi thử lại.',
      );
      return;
    }
    const displayed = await financialReminder.showPreview(
      reminderSettings.message,
    );
    if (!displayed) {
      Alert.alert(
        'Chưa gửi được thông báo thử',
        'Quyền thông báo đang bị tắt trong cài đặt Android.',
      );
    }
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
        <Text style={styles.title}>Cài đặt thông báo</Text>
        <View style={styles.headerButtonPlaceholder} />
      </View>

      {isLoading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {settingRows.map(row => {
            const Icon = row.Icon;
            const value = Boolean(settings?.[row.key]);
            const isSaving = savingKey === row.key;

            return (
              <View key={row.key} style={styles.settingCard}>
                <View style={styles.settingIcon}>
                  <Icon size={20} color="#D87219" />
                </View>
                <View style={styles.settingCopy}>
                  <Text style={styles.settingLabel}>{row.label}</Text>
                  <Text style={styles.settingDescription}>
                    {row.description}
                  </Text>
                </View>
                <View style={styles.switchWrap}>
                  {isSaving ? (
                    <ActivityIndicator color={Colors.primary} size="small" />
                  ) : null}
                  <Switch
                    accessibilityLabel={row.label}
                    value={value}
                    onValueChange={nextValue =>
                      handleToggle(row.key, nextValue)
                    }
                    disabled={!settings || Boolean(savingKey)}
                    trackColor={{ false: '#E9D6C4', true: '#FFD9AC' }}
                    thumbColor={value ? Colors.primary : '#FFFFFF'}
                    ios_backgroundColor="#E9D6C4"
                  />
                </View>
              </View>
            );
          })}

          {financialReminder.isSupported ? (
            <View style={styles.reminderCard}>
              <View style={styles.reminderHeader}>
                <View style={styles.settingIcon}>
                  <BellRing size={20} color="#D87219" />
                </View>
                <View style={styles.settingCopy}>
                  <Text style={styles.settingLabel}>
                    Nhắc tài chính chủ động
                  </Text>
                  <Text style={styles.settingDescription}>
                    Hiện ngoài ứng dụng kể cả khi Nova đang đóng.
                  </Text>
                </View>
                {isSavingReminder ? (
                  <ActivityIndicator color={Colors.primary} size="small" />
                ) : (
                  <Switch
                    accessibilityLabel="Bật nhắc tài chính chủ động"
                    value={reminderSettings.enabled}
                    onValueChange={value =>
                      handleReminderToggle(value).catch(() => undefined)
                    }
                    trackColor={{ false: '#E9D6C4', true: '#FFD9AC' }}
                    thumbColor={
                      reminderSettings.enabled ? Colors.primary : '#FFFFFF'
                    }
                  />
                )}
              </View>

              <Text style={styles.reminderFieldLabel}>Tần suất</Text>
              <View style={styles.chipRow}>
                {(
                  [
                    ['DAILY', 'Hằng ngày'],
                    ['WEEKLY', 'Hằng tuần'],
                    ['MONTHLY', 'Ngày 25'],
                  ] as const
                ).map(([frequency, label]) => {
                  const selected = reminderSettings.frequency === frequency;
                  return (
                    <TouchableOpacity
                      key={frequency}
                      style={[styles.chip, selected && styles.chipSelected]}
                      disabled={isSavingReminder}
                      onPress={() => selectReminderFrequency(frequency)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.reminderFieldLabel}>Giờ nhắc</Text>
              <View style={styles.chipRow}>
                {[8, 12, 20].map(hour => {
                  const selected = reminderSettings.hour === hour;
                  return (
                    <TouchableOpacity
                      key={hour}
                      style={[styles.timeChip, selected && styles.chipSelected]}
                      disabled={isSavingReminder}
                      onPress={() => selectReminderHour(hour)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {String(hour).padStart(2, '0')}:00
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.previewBox}>
                <Text style={styles.previewSchedule}>
                  {formatReminderSchedule(reminderSettings)}
                </Text>
                <Text style={styles.previewMessage}>
                  “{reminderSettings.message}”
                </Text>
                <Text style={styles.privacyNote}>
                  Không hiện số dư hoặc số tiền trên màn hình khóa.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.testButton}
                onPress={() => showReminderPreview().catch(() => undefined)}
              >
                <Bell size={18} color={Colors.primary} />
                <Text style={styles.testButtonText}>Gửi thông báo thử</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
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
  headerButtonPlaceholder: { width: 42, height: 42 },
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#4A2B1A',
    fontSize: 22,
    fontWeight: '900',
  },
  loadingBlock: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 36, gap: 12 },
  settingCard: {
    minHeight: 88,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    backgroundColor: '#FFFDFC',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#FFF0E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingCopy: { flex: 1 },
  settingLabel: { color: '#4A2B1A', fontSize: 16, fontWeight: '900' },
  settingDescription: {
    color: '#8B6548',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  switchWrap: { minWidth: 54, alignItems: 'center', gap: 6 },
  reminderCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EDB982',
    backgroundColor: '#FFFDFC',
    padding: 14,
    gap: 12,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reminderFieldLabel: {
    color: '#6D432B',
    fontSize: 12,
    fontWeight: '800',
  },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9C8AA',
    backgroundColor: '#FFF7EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeChip: {
    minWidth: 76,
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9C8AA',
    backgroundColor: '#FFF7EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { borderColor: Colors.primary, backgroundColor: '#FFF0DE' },
  chipText: { color: '#7E5C44', fontSize: 13, fontWeight: '700' },
  chipTextSelected: { color: '#B85C16' },
  previewBox: {
    borderRadius: 10,
    backgroundColor: '#FFF4E8',
    padding: 12,
    gap: 5,
  },
  previewSchedule: { color: '#B85C16', fontSize: 12, fontWeight: '900' },
  previewMessage: { color: '#4A2B1A', fontSize: 14, lineHeight: 20 },
  privacyNote: { color: '#8B6548', fontSize: 11, lineHeight: 16 },
  testButton: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E7AA71',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  testButtonText: { color: Colors.primary, fontSize: 14, fontWeight: '900' },
});

export default NotificationSettingsScreen;
