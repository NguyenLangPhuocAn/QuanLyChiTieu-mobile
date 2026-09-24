import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CalendarDays, X } from 'lucide-react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import { loanDebtsService } from '../../services/loanDebts';
import { walletsService } from '../../services/wallets';
import type { LoanDebtType } from '../../types/loanDebt';
import type { Wallet } from '../../types/wallet';
import { formatCurrency, formatShortDate } from '../../utils/format';
import {
  buildLoanDebtUpdatePayload,
  getLoanDebtErrorMessage,
} from '../../utils/loanDebt';
import { getWalletTypeMeta } from '../../constants/walletTypes';
import { parsePositiveMoneyInput } from '../../utils/moneyInput';
import { useSingleFlight } from '../../hooks/useSingleFlight';

type Props = NativeStackScreenProps<RootStackParamList, 'LoanDebtForm'>;
const plainAmount = parsePositiveMoneyInput;
const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(
    2,
    '0',
  )}-${`${date.getDate()}`.padStart(2, '0')}`;
const parseDateKey = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date();
};

const LoanDebtFormScreen = ({ navigation, route }: Props) => {
  const { token } = useAuth();
  const { run: runLoanMutation } = useSingleFlight();
  const loanDebtId = route.params?.loanDebtId;
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [type, setType] = useState<LoanDebtType>('BORROWED');
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadRevision = useRef(0);
  const [isSaving, setIsSaving] = useState(false);
  const [openingLocked, setOpeningLocked] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);

  const load = useCallback(async () => {
    const revision = ++loadRevision.current;
    if (!token) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [nextWallets, record] = await Promise.all([
        walletsService.getAll(token),
        loanDebtId
          ? loanDebtsService.getOne(token, loanDebtId)
          : Promise.resolve(null),
      ]);
      if (revision !== loadRevision.current) return;
      const availableWallets = nextWallets.filter(
        wallet =>
          wallet.wallet_type !== 'SAVINGS' &&
          (!record || wallet.currency === record.currency),
      );
      setWallets(availableWallets);
      if (record) {
        setType(record.type);
        setPersonName(record.person_name);
        setAmount(String(record.principal_amount));
        setWalletId(record.opening_wallet_id);
        setDueDate(record.due_date?.slice(0, 10) ?? '');
        setNote(record.note ?? '');
        setOpeningLocked(record.payments.length > 0);
      } else {
        setWalletId(
          current =>
            availableWallets.find(wallet => wallet.id === current)?.id ??
            availableWallets[0]?.id ??
            null,
        );
        setOpeningLocked(false);
      }
    } catch (error) {
      if (revision === loadRevision.current)
        setLoadError(
          getLoanDebtErrorMessage(
            error,
            'Không tải được thông tin khoản vay/nợ. Vui lòng thử lại.',
          ),
        );
    } finally {
      if (revision === loadRevision.current) setIsLoading(false);
    }
  }, [loanDebtId, token]);

  useEffect(() => {
    load();
    return () => {
      loadRevision.current += 1;
    };
  }, [load]);

  const save = () =>
    runLoanMutation(async () => {
      if (isLoading || loadError) return;
      const normalizedAmount = plainAmount(amount);
      if (!token || !walletId || !personName.trim() || !normalizedAmount) {
        Alert.alert(
          'Thiếu thông tin',
          'Vui lòng nhập tên người, số tiền và chọn ví.',
        );
        return;
      }
      if (!openingLocked && !wallets.some(wallet => wallet.id === walletId)) {
        Alert.alert(
          'Chọn lại ví',
          'Chọn ví đang hoạt động, cùng tiền tệ với khoản vay/nợ.',
        );
        return;
      }
      setIsSaving(true);
      try {
        if (loanDebtId) {
          await loanDebtsService.update(
            token,
            loanDebtId,
            buildLoanDebtUpdatePayload(
              {
                person_name: personName.trim(),
                principal_amount: normalizedAmount,
                wallet_id: walletId,
                due_date: dueDate || null,
                note: note.trim(),
              },
              openingLocked,
            ),
          );
        } else {
          await loanDebtsService.create(token, {
            person_name: personName.trim(),
            type,
            principal_amount: normalizedAmount,
            wallet_id: walletId,
            due_date: dueDate || null,
            note: note.trim() || undefined,
          });
        }
        navigation.goBack();
      } catch (error) {
        Alert.alert(
          'Không thể lưu khoản vay/nợ',
          getLoanDebtErrorMessage(
            error,
            'Không thể lưu khoản vay/nợ. Vui lòng thử lại.',
          ),
        );
      } finally {
        setIsSaving(false);
      }
    });

  const handleDueDateChange = (
    _event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    setShowDueDatePicker(false);
    if (selectedDate) {
      setDueDate(toDateKey(selectedDate));
    }
  };

  if (isLoading || loadError) {
    return (
      <SafeAreaView style={styles.center}>
        {loadError ? (
          <>
            <Text style={styles.loadError}>{loadError}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Thử tải lại biểu mẫu vay nợ"
              style={styles.retryButton}
              onPress={load}
            >
              <Text>Thử lại</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator color="#FF8500" />
        )}
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.retryButton}
          onPress={() => navigation.goBack()}
        >
          <Text>Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {loanDebtId ? 'Sửa khoản vay/nợ' : 'Thêm khoản vay/nợ'}
        </Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {!loanDebtId ? (
          <View style={styles.segment}>
            {(['BORROWED', 'LENT'] as LoanDebtType[]).map(item => (
              <TouchableOpacity
                key={item}
                style={[styles.segmentButton, type === item && styles.active]}
                onPress={() => setType(item)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    type === item && styles.activeText,
                  ]}
                >
                  {item === 'BORROWED' ? 'Vay' : 'Cho vay'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        <Text style={styles.label}>Tên người</Text>
        <TextInput
          accessibilityLabel="Tên người vay nợ"
          editable={!isSaving}
          style={styles.input}
          value={personName}
          onChangeText={setPersonName}
          placeholder="Nguyễn Văn A"
        />
        <Text style={styles.label}>Số tiền</Text>
        <TextInput
          accessibilityLabel="Tiền gốc vay nợ"
          style={[styles.input, openingLocked && styles.locked]}
          value={amount}
          onChangeText={setAmount}
          editable={!openingLocked && !isSaving}
          keyboardType="decimal-pad"
          placeholder="0"
        />
        <Text style={styles.label}>Ví</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.walletCardRow}
        >
          {wallets.map(wallet => {
            const typeMeta = getWalletTypeMeta(wallet.wallet_type);
            const WalletTypeIcon = typeMeta.Icon;
            const active = walletId === wallet.id;

            return (
              <TouchableOpacity
                key={wallet.id}
                accessibilityRole="button"
                accessibilityLabel={`Chọn ví vay nợ ${wallet.name}`}
                accessibilityState={{ selected: active }}
                style={[
                  styles.walletPickerCard,
                  active && styles.walletPickerCardActive,
                ]}
                disabled={openingLocked || isSaving}
                onPress={() => setWalletId(wallet.id)}
              >
                <View
                  style={[
                    styles.walletPickerIcon,
                    active && styles.walletPickerIconActive,
                  ]}
                >
                  <WalletTypeIcon
                    size={18}
                    color={active ? '#FFFFFF' : '#D87219'}
                  />
                </View>
                <Text style={styles.walletPickerName} numberOfLines={1}>
                  {wallet.name}
                </Text>
                <Text style={styles.walletPickerBalance} numberOfLines={1}>
                  {formatCurrency(Number(wallet.balance ?? 0), wallet.currency)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {wallets.length === 0 ? (
          <Text style={styles.loadError}>
            {openingLocked
              ? 'Ví gốc không còn trong danh sách hoạt động. Bạn vẫn có thể sửa tên người và ngày hẹn trả.'
              : 'Cần có ví thường đang hoạt động; khi sửa khoản cũ, ví phải cùng tiền tệ.'}
          </Text>
        ) : null}
        <Text style={styles.label}>Ngày hẹn trả</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDueDatePicker(true)}
          >
            <CalendarDays size={18} color="#A85C28" />
            <Text style={styles.dateText}>
              {dueDate ? formatShortDate(dueDate) : 'Không có hạn trả'}
            </Text>
          </TouchableOpacity>
          {dueDate ? (
            <TouchableOpacity
              style={styles.clearDateButton}
              onPress={() => setDueDate('')}
            >
              <X size={18} color="#A85C28" />
            </TouchableOpacity>
          ) : null}
        </View>
        {showDueDatePicker ? (
          <DateTimePicker
            value={dueDate ? parseDateKey(dueDate) : new Date()}
            mode="date"
            onChange={handleDueDateChange}
          />
        ) : null}
        <Text style={styles.label}>Ghi chú</Text>
        <TextInput
          style={[styles.input, styles.note]}
          accessibilityLabel="Ghi chú khoản vay nợ"
          editable={!isSaving}
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="Ghi chú"
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Lưu khoản vay nợ"
          style={[styles.save, isSaving && styles.disabled]}
          disabled={isSaving}
          onPress={save}
        >
          <Text style={styles.saveText}>
            {isSaving ? 'Đang lưu...' : 'Lưu khoản vay/nợ'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadError: {
    color: '#8A4330',
    padding: 16,
    lineHeight: 21,
    textAlign: 'center',
  },
  container: { flex: 1, backgroundColor: '#FFF8F1' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '900', color: '#4A2B1A' },
  content: { padding: 16, paddingBottom: 40 },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#FFE8D1',
    borderRadius: 18,
    padding: 4,
    marginBottom: 20,
  },
  segmentButton: {
    flex: 1,
    padding: 13,
    alignItems: 'center',
    borderRadius: 15,
  },
  active: { backgroundColor: '#FF8500' },
  segmentText: { fontWeight: '800', color: '#7B573C' },
  activeText: { color: '#FFF' },
  label: {
    fontWeight: '800',
    color: '#69462F',
    marginTop: 14,
    marginBottom: 7,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F0C8A7',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: '#4A2B1A',
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateButton: {
    flex: 1,
    minHeight: 50,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F0C8A7',
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateText: { color: '#4A2B1A', fontWeight: '800' },
  clearDateButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#FFF0E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { minHeight: 90, textAlignVertical: 'top' },
  walletCardRow: { gap: 10, paddingRight: 16, paddingBottom: 4 },
  walletPickerCard: {
    width: 132,
    minHeight: 106,
    backgroundColor: '#FFF9F5',
    borderWidth: 1,
    borderColor: '#F0D5C2',
    borderRadius: 18,
    padding: 12,
  },
  walletPickerCardActive: {
    borderColor: '#FF8500',
    backgroundColor: '#FFF0DF',
  },
  walletPickerIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#FFF0E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  walletPickerIconActive: { backgroundColor: '#FF8500' },
  walletPickerName: { fontWeight: '900', color: '#4A2B1A', fontSize: 13 },
  walletPickerBalance: {
    color: '#8B674D',
    marginTop: 5,
    fontWeight: '800',
    fontSize: 12,
  },
  save: {
    backgroundColor: '#FF8500',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  disabled: { opacity: 0.6 },
  locked: { opacity: 0.65 },
  saveText: { color: '#FFF', fontWeight: '900', fontSize: 16 },
});

export default LoanDebtFormScreen;
