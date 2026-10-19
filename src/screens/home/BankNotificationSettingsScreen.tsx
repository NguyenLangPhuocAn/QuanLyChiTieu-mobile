import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  BellRing,
  Check,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { bankNotificationReader } from '../../native/bankNotificationReader';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { bankNotificationSettings } from '../../services/bankNotificationSettings';
import { buildBankTransactionDraft } from '../../services/bankNotificationSync';
import { transactionsService } from '../../services/transactions';
import type {
  BankAppRule,
  BankNotificationEvent,
  LaunchableAndroidApp,
} from '../../types/bankNotification';
import type { ApiTransaction } from '../../types/transaction';
import { parseBankNotification } from '../../utils/bankNotificationParser';
import {
  findBestEvidenceMatch,
  mergeBankEvidenceNote,
} from '../../utils/evidenceMatcher';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency } from '../../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'BankNotifications'>;

const likelyBankTerms = [
  'bank',
  'ngân hàng',
  'ngan hang',
  'mb ',
  'mbbank',
  'vietcombank',
  'vietinbank',
  'bidv',
  'techcombank',
  'tpbank',
  'vpbank',
  'acb',
  'sacombank',
  'vib',
  'msb',
  'ocb',
  'seabank',
  'agribank',
];

const BankNotificationSettingsScreen = ({ navigation }: Props) => {
  const { token, user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [shakeEnabled, setShakeEnabled] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [apps, setApps] = useState<LaunchableAndroidApp[]>([]);
  const [rules, setRules] = useState<BankAppRule[]>([]);
  const [pendingEvents, setPendingEvents] = useState<BankNotificationEvent[]>(
    [],
  );
  const [recentTransactions, setRecentTransactions] = useState<
    ApiTransaction[]
  >([]);
  const [query, setQuery] = useState('');
  const [busyEventId, setBusyEventId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token || !user) return;
    setIsLoading(true);
    try {
      const [
        access,
        installedApps,
        storedRules,
        events,
        storedShakeEnabled,
        recentResponse,
      ] = await Promise.all([
        bankNotificationReader.isNotificationAccessGranted(),
        bankNotificationReader.getLaunchableApps(),
        bankNotificationSettings.getRules(user.id),
        bankNotificationReader.getPendingEvents(user.id),
        bankNotificationSettings.getShakeEnabled(user.id),
        transactionsService.getPage(token, {
          page: 1,
          limit: 100,
          from: new Date(Date.now() - 7 * 86_400_000)
            .toISOString()
            .slice(0, 10),
        }),
      ]);
      setPermissionGranted(access);
      setApps(installedApps);
      setRules(storedRules);
      setPendingEvents(events.sort((a, b) => b.postedAt - a.postedAt));
      setShakeEnabled(storedShakeEnabled);
      setRecentTransactions(recentResponse.data);
    } catch (error) {
      Alert.alert(
        'Chưa tải được cài đặt',
        getUserFriendlyErrorMessage(error, 'Vui lòng thử lại.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    loadData().catch(() => undefined);
  }, [loadData]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') return;
      bankNotificationReader
        .isNotificationAccessGranted()
        .then(setPermissionGranted)
        .catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);

  const visibleApps = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return apps
      .filter(app => {
        if (
          rules.some(
            rule => rule.packageName === app.packageName && rule.enabled,
          )
        ) {
          return true;
        }
        const searchable = `${app.appName} ${app.packageName}`.toLowerCase();
        return normalizedQuery
          ? searchable.includes(normalizedQuery)
          : likelyBankTerms.some(term => searchable.includes(term));
      })
      .slice(0, normalizedQuery ? 30 : 15);
  }, [apps, query, rules]);

  const updateRule = (
    app: LaunchableAndroidApp,
    patch: Partial<BankAppRule>,
  ) => {
    setRules(current => {
      const existing = current.find(
        rule => rule.packageName === app.packageName,
      );
      const nextRule: BankAppRule = {
        packageName: app.packageName,
        appName: app.appName,
        enabled: false,
        mode: 'REVIEW',
        ...existing,
        ...patch,
      };
      return existing
        ? current.map(rule =>
            rule.packageName === app.packageName ? nextRule : rule,
          )
        : [...current, nextRule];
    });
  };

  const saveSettings = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await bankNotificationSettings.saveRules(user.id, rules);
      await bankNotificationSettings.saveShakeEnabled(user.id, shakeEnabled);
      await bankNotificationReader.setConfiguration(
        user.id,
        rules.filter(rule => rule.enabled).map(rule => rule.packageName),
      );
      Alert.alert('Đã lưu', 'Ứng dụng sẽ chỉ đọc thông báo từ các app đã bật.');
    } catch (error) {
      Alert.alert(
        'Chưa lưu được',
        getUserFriendlyErrorMessage(error, 'Vui lòng thử lại.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const readNewNotifications = async () => {
    if (!user) return;
    if (!permissionGranted) {
      Alert.alert(
        'Chưa có quyền đọc thông báo',
        'Hãy cấp quyền cho Sổ Thu Chi Nova trước khi đọc thông báo ngân hàng.',
      );
      return;
    }
    setIsReading(true);
    try {
      const events = await bankNotificationReader.getPendingEvents(user.id);
      setPendingEvents(events.sort((a, b) => b.postedAt - a.postedAt));
      if (!events.length) {
        Alert.alert(
          'Chưa có thông báo mới',
          'App chỉ nhận thông báo giao dịch phát sinh sau khi bạn cấp quyền và bật app ngân hàng.',
        );
      }
    } catch (error) {
      Alert.alert(
        'Chưa đọc được thông báo',
        getUserFriendlyErrorMessage(error, 'Vui lòng thử lại.'),
      );
    } finally {
      setIsReading(false);
    }
  };

  const openTransactionDraft = (event: BankNotificationEvent) => {
    try {
      navigation.navigate('Main', {
        bankTransactionDraft: buildBankTransactionDraft(event),
      });
    } catch (error) {
      Alert.alert(
        'Cần kiểm tra lại',
        getUserFriendlyErrorMessage(
          error,
          'Thông báo chưa đủ rõ để điền vào giao dịch.',
        ),
      );
    }
  };

  const dismissEvent = async (eventId: string) => {
    if (!user) return;
    await bankNotificationReader.dismissEvent(user.id, eventId);
    setPendingEvents(current => current.filter(item => item.id !== eventId));
  };

  const handleMergeEvidence = async (
    event: BankNotificationEvent,
    transaction: ApiTransaction,
  ) => {
    if (!token || !user) return;
    const parsed = parseBankNotification(event);
    setBusyEventId(event.id);
    try {
      const note = mergeBankEvidenceNote(transaction.note, parsed.note);
      if (note !== (transaction.note?.trim() ?? '')) {
        await transactionsService.update(token, transaction.id, { note });
      }
      await bankNotificationReader.markProcessed(user.id, event.id);
      setPendingEvents(current => current.filter(item => item.id !== event.id));
      setRecentTransactions(current =>
        current.map(item =>
          item.id === transaction.id ? { ...item, note } : item,
        ),
      );
      Alert.alert(
        'Đã ghép bằng chứng',
        'Thông báo ngân hàng đã được nối vào giao dịch có ảnh hóa đơn; không tạo thêm giao dịch mới.',
      );
    } catch (error) {
      Alert.alert(
        'Chưa ghép được',
        getUserFriendlyErrorMessage(error, 'Vui lòng thử lại.'),
      );
    } finally {
      setBusyEventId(null);
    }
  };

  const confirmMergeEvidence = (
    event: BankNotificationEvent,
    transaction: ApiTransaction,
  ) => {
    const parsed = parseBankNotification(event);
    Alert.alert(
      'Xác nhận ghép bằng chứng',
      `Thông báo ngân hàng sẽ được nối vào giao dịch “${
        transaction.note || 'Giao dịch có hóa đơn'
      }”. Ảnh hóa đơn và chi tiết món vẫn được giữ nguyên.\n\n${parsed.note}`,
      [
        { text: 'Quay lại', style: 'cancel' },
        {
          text: 'Xác nhận ghép',
          onPress: () =>
            handleMergeEvidence(event, transaction).catch(() => undefined),
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={navigation.goBack}>
          <ArrowLeft size={22} color="#4C2A18" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Giao dịch từ ngân hàng</Text>
          <Text style={styles.subtitle}>Nhận biến động số dư trên Android</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={() => loadData()}>
          <RefreshCw size={19} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <View style={styles.infoHeading}>
            <ShieldCheck size={20} color="#26734D" />
            <Text style={styles.infoTitle}>Quyền kiểm soát thuộc về bạn</Text>
          </View>
          <Text style={styles.infoText}>
            Chỉ app bạn chọn mới được theo dõi. OTP, mật khẩu và quảng cáo bị bỏ
            qua; thông báo chờ được giữ trên điện thoại. Khi thêm giao dịch, nội
            dung thông báo đã che số tài khoản sẽ được lưu làm ghi chú.
          </Text>
          <TouchableOpacity
            style={[
              styles.permissionButton,
              permissionGranted && styles.permissionGranted,
            ]}
            onPress={async () => {
              await bankNotificationReader.openNotificationAccessSettings();
            }}
          >
            {permissionGranted ? (
              <Check size={18} color="#26734D" />
            ) : (
              <BellRing size={18} color={Colors.white} />
            )}
            <Text
              style={
                permissionGranted
                  ? styles.permissionGrantedText
                  : styles.permissionText
              }
            >
              {permissionGranted
                ? 'Đã cấp quyền đọc thông báo'
                : 'Cấp quyền đọc thông báo'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Chọn ứng dụng ngân hàng</Text>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm tên app hoặc nhập tên ngân hàng"
          placeholderTextColor="#A17B5D"
        />
        {!visibleApps.length ? (
          <Text style={styles.emptyText}>
            Không tìm thấy app. Hãy nhập tên hiển thị của ứng dụng ngân hàng.
          </Text>
        ) : null}

        {visibleApps.map(app => {
          const rule = rules.find(item => item.packageName === app.packageName);
          const enabled = Boolean(rule?.enabled);
          return (
            <View style={styles.appCard} key={app.packageName}>
              <View style={styles.appHeader}>
                <View style={styles.appNameWrap}>
                  <Text style={styles.appName}>{app.appName}</Text>
                  <Text style={styles.packageName} numberOfLines={1}>
                    {app.packageName}
                  </Text>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={value => updateRule(app, { enabled: value })}
                  trackColor={{ false: '#D8C4B2', true: '#F2A55D' }}
                  thumbColor={enabled ? Colors.primary : '#FFFFFF'}
                />
              </View>

              {enabled ? (
                <View style={styles.ruleBody}>
                  <Text style={styles.autoWarning}>
                    Nova chỉ điền thu/chi, số tiền và nội dung. Ví và danh mục
                    được chọn trong màn tạo giao dịch trước khi lưu.
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={styles.shakeCard}>
          <View style={styles.shakeCopy}>
            <Text style={styles.shakeTitle}>Lắc để mở giao dịch mới</Text>
            <Text style={styles.shakeDescription}>
              Khi đang ở màn hình chính, lắc điện thoại hai nhịp để mở các thông
              báo ngân hàng đang chờ duyệt.
            </Text>
          </View>
          <Switch
            value={shakeEnabled}
            onValueChange={setShakeEnabled}
            trackColor={{ false: '#D5D0CA', true: '#9BCDBB' }}
            thumbColor={shakeEnabled ? '#26734D' : '#8C8178'}
            accessibilityLabel="Bật lắc điện thoại để đọc thông báo ngân hàng"
          />
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          disabled={isSaving}
          onPress={() => saveSettings().catch(() => undefined)}
        >
          {isSaving ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Lưu cài đặt</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.readButton}
          disabled={isReading}
          onPress={() => readNewNotifications().catch(() => undefined)}
          accessibilityRole="button"
          accessibilityLabel="Đọc thông báo ngân hàng mới"
        >
          {isReading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <>
              <RefreshCw size={18} color={Colors.primary} />
              <Text style={styles.readButtonText}>Đọc thông báo mới</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Thông báo chờ kiểm tra</Text>
        {!pendingEvents.length ? (
          <Text style={styles.emptyText}>
            Chưa có thông báo giao dịch nào đang chờ.
          </Text>
        ) : null}
        {pendingEvents.map(event => {
          const parsed = parseBankNotification(event);
          const evidenceMatch = findBestEvidenceMatch(
            parsed,
            event.postedAt,
            recentTransactions,
          );
          return (
            <View style={styles.pendingCard} key={event.id}>
              <View style={styles.pendingHeader}>
                <Text style={styles.appName}>{event.appName}</Text>
                <TouchableOpacity
                  onPress={() => dismissEvent(event.id).catch(() => undefined)}
                >
                  <Trash2 size={18} color="#B42318" />
                </TouchableOpacity>
              </View>
              <Text style={styles.pendingDate}>
                {new Date(event.postedAt).toLocaleString('vi-VN')}
              </Text>
              <Text style={styles.pendingText} numberOfLines={3}>
                {event.title} {event.text}
              </Text>
              {parsed.status === 'READY' && parsed.amount && parsed.currency ? (
                <Text style={styles.detectedAmount}>
                  {parsed.type === 'INCOME' ? 'Tiền vào +' : 'Tiền ra -'}{' '}
                  {formatCurrency(Number(parsed.amount), parsed.currency)}
                </Text>
              ) : (
                <Text style={styles.reviewReason}>{parsed.reason}</Text>
              )}
              <Text style={styles.pendingNote} numberOfLines={3}>
                Ghi chú sẽ lưu: {parsed.note}
              </Text>
              {evidenceMatch ? (
                <View style={styles.matchCard}>
                  <Text style={styles.matchTitle}>
                    Có thể ghép với hóa đơn đã lưu
                  </Text>
                  <Text style={styles.matchText}>
                    {evidenceMatch.transaction.note || 'Giao dịch có hóa đơn'} ·{' '}
                    độ tin cậy {evidenceMatch.score}%
                  </Text>
                  <Text style={styles.matchReason}>
                    {evidenceMatch.reasons.join(' · ')}
                  </Text>
                  <TouchableOpacity
                    style={styles.mergeButton}
                    disabled={busyEventId === event.id}
                    onPress={() =>
                      confirmMergeEvidence(event, evidenceMatch.transaction)
                    }
                  >
                    <Text style={styles.mergeButtonText}>
                      Ghép, không tạo giao dịch mới
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <TouchableOpacity
                style={[
                  styles.createButton,
                  parsed.status !== 'READY' && styles.disabledButton,
                ]}
                disabled={parsed.status !== 'READY' || busyEventId === event.id}
                onPress={() => openTransactionDraft(event)}
              >
                {busyEventId === event.id ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.createButtonText}>Tạo giao dịch</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF3E8' },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#FFF3E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFF9F3',
    borderBottomWidth: 1,
    borderBottomColor: '#E8C7A8',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  title: { color: '#4C2A18', fontSize: 18, fontWeight: '900' },
  subtitle: { color: '#8A623F', fontSize: 12, fontWeight: '700', marginTop: 3 },
  content: { padding: 16, paddingBottom: 44 },
  infoCard: {
    padding: 15,
    borderRadius: 20,
    backgroundColor: '#F1FAF5',
    borderWidth: 1,
    borderColor: '#A8D8BE',
  },
  infoHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoTitle: { color: '#245B40', fontWeight: '900', fontSize: 15 },
  infoText: {
    color: '#47725C',
    lineHeight: 19,
    fontWeight: '600',
    marginTop: 9,
  },
  permissionButton: {
    marginTop: 13,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionGranted: {
    backgroundColor: '#E0F3E8',
    borderWidth: 1,
    borderColor: '#8CC6A5',
  },
  permissionText: { color: Colors.white, fontWeight: '900' },
  permissionGrantedText: { color: '#26734D', fontWeight: '900' },
  sectionTitle: {
    color: '#4C2A18',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 22,
    marginBottom: 10,
  },
  searchInput: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: '#FFFFFF',
    color: '#4C2A18',
    paddingHorizontal: 14,
    fontWeight: '700',
  },
  emptyText: { color: '#8A623F', lineHeight: 19, marginVertical: 8 },
  appCard: {
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginTop: 11,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  appNameWrap: { flex: 1 },
  appName: { color: '#4C2A18', fontWeight: '900', fontSize: 15 },
  packageName: { color: '#9A7558', fontSize: 11, marginTop: 3 },
  ruleBody: {
    borderTopWidth: 1,
    borderTopColor: '#F0D7C1',
    marginTop: 12,
    paddingTop: 12,
  },
  autoWarning: {
    color: '#9A4D00',
    backgroundColor: '#FFF0DF',
    borderRadius: 12,
    padding: 10,
    lineHeight: 17,
    fontWeight: '700',
    fontSize: 12,
    marginTop: 14,
  },
  shakeCard: {
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: '#FFF8F1',
    padding: 14,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shakeCopy: { flex: 1 },
  shakeTitle: { color: '#4C2A18', fontWeight: '900', fontSize: 14 },
  shakeDescription: {
    color: '#7A5B45',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  saveButton: {
    minHeight: 50,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  saveButtonText: { color: Colors.white, fontWeight: '900', fontSize: 15 },
  readButton: {
    minHeight: 50,
    borderRadius: 17,
    borderWidth: 1.2,
    borderColor: Colors.primary,
    backgroundColor: '#FFF8F1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  readButtonText: { color: Colors.primary, fontWeight: '900', fontSize: 15 },
  pendingCard: {
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginBottom: 11,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pendingDate: { color: '#9A7558', fontSize: 11, marginTop: 4 },
  pendingText: { color: '#65442E', lineHeight: 19, marginTop: 9 },
  detectedAmount: { color: '#26734D', fontWeight: '900', marginTop: 10 },
  reviewReason: { color: '#B54708', fontWeight: '800', marginTop: 10 },
  pendingNote: { color: '#70482E', fontSize: 12, lineHeight: 17, marginTop: 8 },
  matchCard: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#A8D8BE',
    backgroundColor: '#F1FAF5',
    padding: 12,
    marginTop: 10,
  },
  matchTitle: { color: '#245B40', fontWeight: '900' },
  matchText: { color: '#47725C', fontSize: 12, marginTop: 4 },
  matchReason: {
    color: '#5F7F6D',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  mergeButton: {
    minHeight: 40,
    borderRadius: 13,
    backgroundColor: '#2F7D6B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 9,
  },
  mergeButtonText: { color: Colors.white, fontWeight: '900', fontSize: 12 },
  createButton: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  disabledButton: { backgroundColor: '#CBB8A7' },
  createButtonText: { color: Colors.white, fontWeight: '900' },
});

export default BankNotificationSettingsScreen;
