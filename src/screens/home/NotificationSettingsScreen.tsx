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
import { ArrowLeft, Bell, BellRing, Clock3 } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { notificationsService } from '../../services/notifications';
import type { NotificationSettings } from '../../types/notification';
import { getUserFriendlyErrorMessage } from '../../utils/errors';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationSettings'>;
type SettingKey =
  | 'budget_alerts_enabled'
  | 'budget_expiring_enabled'
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

  const loadSettings = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await notificationsService.getSettings(token);
      setSettings(response);
    } catch (error) {
      Alert.alert('Không thể tải cài đặt', getErrorMessage(error, 'Vui lòng thử lại sau.'));
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
      const updated = await notificationsService.updateSettings(token, { [key]: value });
      setSettings(updated);
    } catch (error) {
      setSettings(previousSettings);
      Alert.alert('Chưa lưu được cài đặt', getErrorMessage(error, 'Vui lòng thử lại sau.'));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
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
                  <Text style={styles.settingDescription}>{row.description}</Text>
                </View>
                <View style={styles.switchWrap}>
                  {isSaving ? <ActivityIndicator color={Colors.primary} size="small" /> : null}
                  <Switch
                    accessibilityLabel={row.label}
                    value={value}
                    onValueChange={nextValue => handleToggle(row.key, nextValue)}
                    disabled={!settings || Boolean(savingKey)}
                    trackColor={{ false: '#E9D6C4', true: '#FFD9AC' }}
                    thumbColor={value ? Colors.primary : '#FFFFFF'}
                    ios_backgroundColor="#E9D6C4"
                  />
                </View>
              </View>
            );
          })}
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
  title: { flex: 1, textAlign: 'center', color: '#4A2B1A', fontSize: 22, fontWeight: '900' },
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
  settingDescription: { color: '#8B6548', fontSize: 12, lineHeight: 18, marginTop: 5 },
  switchWrap: { minWidth: 54, alignItems: 'center', gap: 6 },
});

export default NotificationSettingsScreen;
