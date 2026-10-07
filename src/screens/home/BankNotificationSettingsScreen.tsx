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
import { ArrowLeft, BellRing, Check, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { bankNotificationReader } from '../../native/bankNotificationReader';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { bankNotificationSettings } from '../../services/bankNotificationSettings';
import { createTransactionFromBankEvent } from '../../services/bankNotificationSync';
import { categoriesService } from '../../services/categories';
import { walletsService } from '../../services/wallets';
import type {
  BankAppRule,
  BankNotificationEvent,
  LaunchableAndroidApp,
} from '../../types/bankNotification';
import type { Category } from '../../types/category';
import type { Wallet } from '../../types/wallet';
import { parseBankNotification } from '../../utils/bankNotificationParser';
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
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [apps, setApps] = useState<LaunchableAndroidApp[]>([]);
  const [rules, setRules] = useState<BankAppRule[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pendingEvents, setPendingEvents] = useState<BankNotificationEvent[]>([]);
  const [query, setQuery] = useState('');
  const [busyEventId, setBusyEventId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token || !user) return;
    setIsLoading(true);
    try {
      const [access, installedApps, storedRules, nextWallets, nextCategories, events] =
        await Promise.all([
          bankNotificationReader.isNotificationAccessGranted(),
          bankNotificationReader.getLaunchableApps(),
          bankNotificationSettings.getRules(user.id),
          walletsService.getAll(token),
          categoriesService.getAll(token),
          bankNotificationReader.getPendingEvents(user.id),
        ]);
      setPermissionGranted(access);
      setApps(installedApps);
      setRules(storedRules);
      setWallets(nextWallets.filter(wallet => wallet.wallet_type !== 'SAVINGS'));
      setCategories(
        nextCategories.filter(
          category => (category.cash_flow_group ?? 'NORMAL') === 'NORMAL',
        ),
      );
      setPendingEvents(events.sort((a, b) => b.postedAt - a.postedAt));
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
        if (rules.some(rule => rule.packageName === app.packageName && rule.enabled)) {
          return true;
        }
        const searchable = `${app.appName} ${app.packageName}`.toLowerCase();
        return normalizedQuery
          ? searchable.includes(normalizedQuery)
          : likelyBankTerms.some(term => searchable.includes(term));
      })
      .slice(0, normalizedQuery ? 30 : 15);
  }, [apps, query, rules]);

  const updateRule = (app: LaunchableAndroidApp, patch: Partial<BankAppRule>) => {
    setRules(current => {
      const existing = current.find(rule => rule.packageName === app.packageName);
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

  const handleCreate = async (event: BankNotificationEvent) => {
    if (!token || !user) return;
    const rule = rules.find(item => item.packageName === event.packageName);
    if (!rule) {
      Alert.alert('Chưa có cấu hình', 'Hãy bật app ngân hàng và chọn ví, danh mục.');
      return;
    }
    setBusyEventId(event.id);
    try {
      await createTransactionFromBankEvent({
        token,
        userId: user.id,
        event,
        rule,
        wallets,
        categories,
      });
      setPendingEvents(current => current.filter(item => item.id !== event.id));
      Alert.alert('Đã thêm giao dịch', 'Số dư và lịch sử đã được cập nhật.');
    } catch (error) {
      Alert.alert(
        'Cần kiểm tra lại',
        getUserFriendlyErrorMessage(
          error,
          'Thông báo chưa đủ rõ hoặc cấu hình ví, danh mục chưa phù hợp.',
        ),
      );
    } finally {
      setBusyEventId(null);
    }
  };

  const dismissEvent = async (eventId: string) => {
    if (!user) return;
    await bankNotificationReader.dismissEvent(user.id, eventId);
    setPendingEvents(current => current.filter(item => item.id !== eventId));
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
            Chỉ app bạn chọn mới được theo dõi. OTP, mật khẩu và quảng cáo bị bỏ qua;
            thông báo chờ được giữ trên điện thoại.
          </Text>
          <TouchableOpacity
            style={[styles.permissionButton, permissionGranted && styles.permissionGranted]}
            onPress={async () => {
              await bankNotificationReader.openNotificationAccessSettings();
            }}
          >
            {permissionGranted ? <Check size={18} color="#26734D" /> : <BellRing size={18} color={Colors.white} />}
            <Text style={permissionGranted ? styles.permissionGrantedText : styles.permissionText}>
              {permissionGranted ? 'Đã cấp quyền đọc thông báo' : 'Cấp quyền đọc thông báo'}
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
          <Text style={styles.emptyText}>Không tìm thấy app. Hãy nhập tên hiển thị của ứng dụng ngân hàng.</Text>
        ) : null}

        {visibleApps.map(app => {
          const rule = rules.find(item => item.packageName === app.packageName);
          const enabled = Boolean(rule?.enabled);
          const incomeCategories = categories.filter(item => item.type === 'INCOME');
          const expenseCategories = categories.filter(item => item.type === 'EXPENSE');
          return (
            <View style={styles.appCard} key={app.packageName}>
              <View style={styles.appHeader}>
                <View style={styles.appNameWrap}>
                  <Text style={styles.appName}>{app.appName}</Text>
                  <Text style={styles.packageName} numberOfLines={1}>{app.packageName}</Text>
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
                  <Text style={styles.fieldLabel}>Cách xử lý</Text>
                  <View style={styles.modeRow}>
                    {([
                      ['REVIEW', 'Duyệt trước'],
                      ['AUTO', 'Tự động'],
                    ] as const).map(([mode, label]) => (
                      <TouchableOpacity
                        key={mode}
                        style={[styles.modeChip, rule?.mode === mode && styles.selectedChip]}
                        onPress={() => updateRule(app, { mode })}
                      >
                        <Text style={[styles.chipText, rule?.mode === mode && styles.selectedChipText]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <RuleSelector
                    label="Ghi vào ví"
                    items={wallets.map(wallet => ({ id: wallet.id, label: `${wallet.name} · ${wallet.currency}` }))}
                    selectedId={rule?.walletId}
                    onSelect={walletId => updateRule(app, { walletId })}
                  />
                  <RuleSelector
                    label="Danh mục tiền vào"
                    items={incomeCategories.map(category => ({ id: category.id, label: category.name }))}
                    selectedId={rule?.incomeCategoryId}
                    onSelect={incomeCategoryId => updateRule(app, { incomeCategoryId })}
                  />
                  <RuleSelector
                    label="Danh mục tiền ra"
                    items={expenseCategories.map(category => ({ id: category.id, label: category.name }))}
                    selectedId={rule?.expenseCategoryId}
                    onSelect={expenseCategoryId => updateRule(app, { expenseCategoryId })}
                  />
                  {rule?.mode === 'AUTO' ? (
                    <Text style={styles.autoWarning}>Tự động chỉ chạy khi nhận rõ số tiền, thu/chi, đúng tiền tệ và đã chọn đủ ba mục trên.</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.saveButton}
          disabled={isSaving}
          onPress={() => saveSettings().catch(() => undefined)}
        >
          {isSaving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveButtonText}>Lưu cài đặt</Text>}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Thông báo chờ kiểm tra</Text>
        {!pendingEvents.length ? <Text style={styles.emptyText}>Chưa có thông báo giao dịch nào đang chờ.</Text> : null}
        {pendingEvents.map(event => {
          const parsed = parseBankNotification(event);
          return (
            <View style={styles.pendingCard} key={event.id}>
              <View style={styles.pendingHeader}>
                <Text style={styles.appName}>{event.appName}</Text>
                <TouchableOpacity onPress={() => dismissEvent(event.id).catch(() => undefined)}>
                  <Trash2 size={18} color="#B42318" />
                </TouchableOpacity>
              </View>
              <Text style={styles.pendingDate}>{new Date(event.postedAt).toLocaleString('vi-VN')}</Text>
              <Text style={styles.pendingText} numberOfLines={3}>{event.title} {event.text}</Text>
              {parsed.status === 'READY' && parsed.amount && parsed.currency ? (
                <Text style={styles.detectedAmount}>{parsed.type === 'INCOME' ? 'Tiền vào' : 'Tiền ra'} · {formatCurrency(Number(parsed.amount), parsed.currency)}</Text>
              ) : (
                <Text style={styles.reviewReason}>{parsed.reason}</Text>
              )}
              <TouchableOpacity
                style={[styles.createButton, parsed.status !== 'READY' && styles.disabledButton]}
                disabled={parsed.status !== 'READY' || busyEventId === event.id}
                onPress={() => handleCreate(event).catch(() => undefined)}
              >
                {busyEventId === event.id ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.createButtonText}>Kiểm tra và thêm giao dịch</Text>}
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const RuleSelector = ({
  label,
  items,
  selectedId,
  onSelect,
}: {
  label: string;
  items: Array<{ id: number; label: string }>;
  selectedId?: number;
  onSelect: (id: number) => void;
}) => (
  <View style={styles.selectorWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
      {items.map(item => (
        <TouchableOpacity
          key={item.id}
          style={[styles.optionChip, selectedId === item.id && styles.selectedChip]}
          onPress={() => onSelect(item.id)}
        >
          <Text style={[styles.chipText, selectedId === item.id && styles.selectedChipText]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF3E8' },
  loadingScreen: { flex: 1, backgroundColor: '#FFF3E8', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#FFF9F3', borderBottomWidth: 1, borderBottomColor: '#E8C7A8' },
  iconButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#FFF0DF', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { color: '#4C2A18', fontSize: 18, fontWeight: '900' },
  subtitle: { color: '#8A623F', fontSize: 12, fontWeight: '700', marginTop: 3 },
  content: { padding: 16, paddingBottom: 44 },
  infoCard: { padding: 15, borderRadius: 20, backgroundColor: '#F1FAF5', borderWidth: 1, borderColor: '#A8D8BE' },
  infoHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoTitle: { color: '#245B40', fontWeight: '900', fontSize: 15 },
  infoText: { color: '#47725C', lineHeight: 19, fontWeight: '600', marginTop: 9 },
  permissionButton: { marginTop: 13, minHeight: 46, borderRadius: 14, backgroundColor: Colors.primary, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  permissionGranted: { backgroundColor: '#E0F3E8', borderWidth: 1, borderColor: '#8CC6A5' },
  permissionText: { color: Colors.white, fontWeight: '900' },
  permissionGrantedText: { color: '#26734D', fontWeight: '900' },
  sectionTitle: { color: '#4C2A18', fontSize: 18, fontWeight: '900', marginTop: 22, marginBottom: 10 },
  searchInput: { minHeight: 48, borderRadius: 16, borderWidth: 1.2, borderColor: '#E8B680', backgroundColor: '#FFFFFF', color: '#4C2A18', paddingHorizontal: 14, fontWeight: '700' },
  emptyText: { color: '#8A623F', lineHeight: 19, marginVertical: 8 },
  appCard: { borderRadius: 20, borderWidth: 1.2, borderColor: '#E8B680', backgroundColor: '#FFFFFF', padding: 14, marginTop: 11 },
  appHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  appNameWrap: { flex: 1 },
  appName: { color: '#4C2A18', fontWeight: '900', fontSize: 15 },
  packageName: { color: '#9A7558', fontSize: 11, marginTop: 3 },
  ruleBody: { borderTopWidth: 1, borderTopColor: '#F0D7C1', marginTop: 12, paddingTop: 12 },
  fieldLabel: { color: '#70482E', fontWeight: '900', fontSize: 12, marginBottom: 7 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeChip: { flex: 1, minHeight: 40, borderRadius: 13, borderWidth: 1, borderColor: '#DFC1A4', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF9F3' },
  selectedChip: { backgroundColor: '#C76708', borderColor: '#C76708' },
  selectedChipText: { color: '#FFFFFF' },
  chipText: { color: '#70482E', fontWeight: '800', fontSize: 12 },
  selectorWrap: { marginTop: 14 },
  chipScroll: { gap: 8, paddingRight: 10 },
  optionChip: { minHeight: 39, borderRadius: 13, borderWidth: 1, borderColor: '#DFC1A4', justifyContent: 'center', paddingHorizontal: 12, backgroundColor: '#FFF9F3' },
  autoWarning: { color: '#9A4D00', backgroundColor: '#FFF0DF', borderRadius: 12, padding: 10, lineHeight: 17, fontWeight: '700', fontSize: 12, marginTop: 14 },
  saveButton: { minHeight: 50, borderRadius: 17, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  saveButtonText: { color: Colors.white, fontWeight: '900', fontSize: 15 },
  pendingCard: { borderRadius: 20, borderWidth: 1.2, borderColor: '#E8B680', backgroundColor: '#FFFFFF', padding: 14, marginBottom: 11 },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pendingDate: { color: '#9A7558', fontSize: 11, marginTop: 4 },
  pendingText: { color: '#65442E', lineHeight: 19, marginTop: 9 },
  detectedAmount: { color: '#26734D', fontWeight: '900', marginTop: 10 },
  reviewReason: { color: '#B54708', fontWeight: '800', marginTop: 10 },
  createButton: { minHeight: 44, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  disabledButton: { backgroundColor: '#CBB8A7' },
  createButtonText: { color: Colors.white, fontWeight: '900' },
});

export default BankNotificationSettingsScreen;
