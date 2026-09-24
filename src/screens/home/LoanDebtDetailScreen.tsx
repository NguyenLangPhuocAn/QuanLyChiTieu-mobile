import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CalendarDays, PenLine, Trash2 } from 'lucide-react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import { loanDebtsService } from '../../services/loanDebts';
import { walletsService } from '../../services/wallets';
import type { LoanDebt } from '../../types/loanDebt';
import type { Wallet } from '../../types/wallet';
import { formatCurrency } from '../../utils/format';
import { parsePositiveMoneyInput } from '../../utils/moneyInput';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  calculateLoanDebtProgress,
  calculateRemainingAfterPayment,
  formatLoanDebtPaymentDate,
  getLoanDebtActionLabel,
  getFullSettlementAmount,
  getLoanDebtErrorMessage,
  getLoanDebtPrincipalLabel,
  getLoanDebtStatusLabel,
  getLoanDebtTypeLabel,
  validateLoanDebtPayment,
} from '../../utils/loanDebt';

type Props = NativeStackScreenProps<RootStackParamList, 'LoanDebtDetail'>;

const LoanDebtDetailScreen = ({ navigation, route }: Props) => {
  const { run: runLoanMutation } = useSingleFlight();
  const { token } = useAuth();
  const [record, setRecord] = useState<LoanDebt | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadRevision = React.useRef(0);

  const load = useCallback(async () => {
    const revision = ++loadRevision.current;
    if (!token) return;
    setLoadError(null);
    try {
      const [nextRecord, nextWallets] = await Promise.all([
        loanDebtsService.getOne(token, route.params.loanDebtId),
        walletsService.getAll(token),
      ]);
      if (revision !== loadRevision.current) return;
      setRecord(nextRecord);
      setWallets(nextWallets);
      setWalletId(
        current =>
          nextWallets.find(
            item =>
              item.id === current && item.currency === nextRecord.currency,
          )?.id ??
          nextWallets.find(item => item.currency === nextRecord.currency)?.id ??
          null,
      );
    } catch (error) {
      if (revision !== loadRevision.current) return;
      setLoadError(
        getLoanDebtErrorMessage(
          error,
          'Không tải được khoản vay/nợ. Vui lòng thử lại.',
        ),
      );
    }
  }, [route.params.loanDebtId, token]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        loadRevision.current += 1;
      };
    }, [load]),
  );

  if (!record || record.id !== route.params.loanDebtId) {
    return (
      <SafeAreaView style={styles.center}>
        {loadError ? (
          <>
            <Text style={styles.loadErrorText}>{loadError}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Thử tải lại khoản vay nợ"
              onPress={load}
              style={styles.retryLoad}
            >
              <Text>Thử lại</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => navigation.goBack()}
              style={styles.retryLoad}
            >
              <Text>Quay lại</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator color="#FF8500" />
        )}
      </SafeAreaView>
    );
  }

  const pay = () =>
    runLoanMutation(async () => {
      const normalizedAmount = parsePositiveMoneyInput(amount);
      const error = validateLoanDebtPayment(amount, record.remaining_amount);
      if (error || !normalizedAmount) {
        Alert.alert(
          'Số tiền chưa hợp lệ',
          error ?? 'Vui lòng kiểm tra số tiền.',
        );
        return;
      }
      if (!walletId) {
        Alert.alert(
          'Thiếu thông tin',
          'Vui lòng chọn ví để ghi nhận lần thanh toán này.',
        );
        return;
      }
      if (!token) return;
      setSaving(true);
      try {
        await loanDebtsService.addPayment(token, record.id, {
          wallet_id: walletId,
          amount: normalizedAmount,
          payment_date: formatLoanDebtPaymentDate(paymentDate),
          note: note.trim() || undefined,
        });
        setModalVisible(false);
        setAmount('');
        setNote('');
        setPaymentDate(new Date());
        await load();
      } catch (error_) {
        Alert.alert(
          'Không thể thanh toán',
          getLoanDebtErrorMessage(
            error_,
            'Không thể ghi nhận lần thanh toán này. Vui lòng thử lại.',
          ),
        );
      } finally {
        setSaving(false);
      }
    });

  const progress = calculateLoanDebtProgress(
    record.settled_amount,
    record.principal_amount,
  );
  const remainingAfterPayment = calculateRemainingAfterPayment(
    amount,
    record.remaining_amount,
  );
  const walletName = (walletIdToFind: number) =>
    wallets.find(wallet => wallet.id === walletIdToFind)?.name ?? 'Ví đã chọn';
  const handlePaymentDateChange = (
    _event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    setShowDatePicker(false);
    if (selectedDate) setPaymentDate(selectedDate);
  };

  const remove = () =>
    Alert.alert(
      'Xóa khoản vay/nợ',
      'Số dư ví và các giao dịch liên kết sẽ được hoàn lại.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () =>
            runLoanMutation(async () => {
              if (!token) return;
              try {
                await loanDebtsService.remove(token, record.id);
                navigation.goBack();
              } catch (error) {
                Alert.alert(
                  'Chưa xóa được khoản vay/nợ',
                  getLoanDebtErrorMessage(error),
                );
              }
            }),
        },
      ],
    );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.icon}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>
        <Text style={styles.title}>Chi tiết vay/nợ</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('LoanDebtForm', { loanDebtId: record.id })
            }
          >
            <PenLine size={20} color="#A85C28" />
          </TouchableOpacity>
          <TouchableOpacity onPress={remove}>
            <Trash2 size={20} color="#D04432" />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {loadError ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={load}
            style={styles.retryLoad}
          >
            <Text style={styles.loadErrorText}>
              Chưa cập nhật được dữ liệu. Chạm để thử lại.
            </Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.hero}>
          <Text style={styles.person}>{record.person_name}</Text>
          <Text style={styles.heroMeta}>
            {getLoanDebtTypeLabel(record.type)} ·{' '}
            {getLoanDebtStatusLabel(record.status)}
          </Text>
          <Text style={styles.remaining}>
            {formatCurrency(record.remaining_amount, record.currency)}
          </Text>
          <Text style={styles.heroMeta}>
            {getLoanDebtPrincipalLabel(record.type)}:{' '}
            {formatCurrency(record.principal_amount, record.currency)}
          </Text>
          {record.due_date ? (
            <Text style={styles.heroMeta}>
              Hẹn trả {record.due_date.slice(0, 10)}
            </Text>
          ) : null}
        </View>
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressLabel}>
                {record.type === 'BORROWED' ? 'Đã trả' : 'Đã thu hồi'}
              </Text>
              <Text style={styles.progressValue}>
                {formatCurrency(record.settled_amount, record.currency)}
              </Text>
            </View>
            <View style={styles.progressRight}>
              <Text style={styles.progressPercent}>{progress}%</Text>
              <Text style={styles.progressRemaining}>
                Còn {formatCurrency(record.remaining_amount, record.currency)}
              </Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
        {record.status !== 'PAID' ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Ghi nhận thanh toán vay nợ"
            style={styles.primary}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.primaryText}>
              {getLoanDebtActionLabel(record.type)}
            </Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.section}>Lịch sử thanh toán</Text>
        {record.payments.length === 0 ? (
          <Text style={styles.empty}>Chưa có lần thanh toán nào.</Text>
        ) : (
          record.payments.map(payment => (
            <View key={payment.id} style={styles.payment}>
              <View style={styles.paymentCopy}>
                <Text style={styles.paymentAmount}>
                  {formatCurrency(Number(payment.amount), record.currency)}
                </Text>
                <Text style={styles.meta}>
                  {payment.payment_date.slice(0, 10)}
                  {payment.note ? ` · ${payment.note}` : ''}
                </Text>
                <Text style={styles.paymentWallet}>
                  {walletName(payment.wallet_id)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'Xóa lần thanh toán',
                    'Số dư ví sẽ được hoàn lại.',
                    [
                      { text: 'Hủy', style: 'cancel' },
                      {
                        text: 'Xóa',
                        style: 'destructive',
                        onPress: () =>
                          runLoanMutation(async () => {
                            if (token) {
                              try {
                                await loanDebtsService.removePayment(
                                  token,
                                  record.id,
                                  payment.id,
                                );
                                await load();
                              } catch (error) {
                                Alert.alert(
                                  'Chưa xóa được lần thanh toán',
                                  getLoanDebtErrorMessage(error),
                                );
                              }
                            }
                          }),
                      },
                    ],
                  )
                }
              >
                <Trash2 size={18} color="#D04432" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
      <Modal
        transparent
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => {
          if (!saving) setModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => {
              if (!saving) setModalVisible(false);
            }}
          />
          <View style={styles.sheet}>
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.sheetTitle}>
                {getLoanDebtActionLabel(record.type)}
              </Text>
              <Text style={styles.sheetHint}>
                Nhập số tiền thực tế của lần này. Bạn có thể thực hiện nhiều
                lần.
              </Text>
              <View style={styles.amountHeader}>
                <Text style={styles.label}>Số tiền lần này</Text>
                <TouchableOpacity
                  disabled={saving}
                  style={styles.settleAllButton}
                  onPress={() =>
                    setAmount(getFullSettlementAmount(record.remaining_amount))
                  }
                >
                  <Text style={styles.settleAllText}>
                    Tất toán phần còn lại
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                accessibilityLabel="Số tiền thanh toán vay nợ"
                editable={!saving}
                style={[styles.input, styles.amountInput]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0"
              />
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>Còn lại sau lần này</Text>
                <Text style={styles.previewValue}>
                  {formatCurrency(remainingAfterPayment, record.currency)}
                </Text>
              </View>
              <Text style={styles.label}>Ví thanh toán</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.walletRow}
              >
                {wallets
                  .filter(wallet => wallet.currency === record.currency)
                  .map(wallet => (
                    <TouchableOpacity
                      key={wallet.id}
                      disabled={saving}
                      style={[
                        styles.wallet,
                        walletId === wallet.id && styles.walletActive,
                      ]}
                      onPress={() => setWalletId(wallet.id)}
                    >
                      <Text style={styles.walletText} numberOfLines={2}>
                        {wallet.name}
                      </Text>
                      <Text style={styles.walletBalance}>
                        {formatCurrency(
                          Number(wallet.balance),
                          wallet.currency,
                        )}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
              <Text style={styles.label}>Ngày thanh toán</Text>
              <TouchableOpacity
                disabled={saving}
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <CalendarDays size={18} color="#A85C28" />
                <Text style={styles.dateText}>
                  {paymentDate.toLocaleDateString('vi-VN')}
                </Text>
              </TouchableOpacity>
              <Text style={styles.label}>Ghi chú</Text>
              <TextInput
                editable={!saving}
                style={styles.input}
                value={note}
                onChangeText={setNote}
                placeholder="Ví dụ: Trả lần 2"
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Xác nhận thanh toán vay nợ"
                style={[styles.primary, saving && styles.disabled]}
                disabled={saving}
                onPress={pay}
              >
                <Text style={styles.primaryText}>
                  {saving ? 'Đang lưu...' : 'Xác nhận lần thanh toán'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
          {showDatePicker ? (
            <DateTimePicker
              value={paymentDate}
              mode="date"
              maximumDate={new Date()}
              onChange={handlePaymentDateChange}
            />
          ) : null}
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  loadErrorText: {
    color: '#9A342B',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  retryLoad: {
    minHeight: 44,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#FFF0E1',
    borderRadius: 10,
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
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 21, fontWeight: '900', color: '#4A2B1A' },
  actions: { flexDirection: 'row', gap: 16 },
  content: { padding: 16, paddingBottom: 40 },
  hero: { backgroundColor: '#5E4433', borderRadius: 22, padding: 20 },
  person: { fontSize: 24, fontWeight: '900', color: '#FFF' },
  heroMeta: { color: '#E6D2C2', marginTop: 6 },
  meta: { color: '#8B674D', marginTop: 6 },
  remaining: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFD98D',
    marginTop: 18,
  },
  primary: {
    backgroundColor: '#FF8500',
    borderRadius: 14,
    padding: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryText: { color: '#FFF', fontWeight: '900', fontSize: 16 },
  disabled: { opacity: 0.6 },
  progressCard: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F0C8A7',
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressLabel: { color: '#8B674D', fontWeight: '800' },
  progressValue: {
    color: '#4A2B1A',
    fontWeight: '900',
    fontSize: 18,
    marginTop: 4,
  },
  progressRight: { alignItems: 'flex-end' },
  progressPercent: { color: '#FF8500', fontWeight: '900', fontSize: 18 },
  progressRemaining: { color: '#8B674D', marginTop: 4 },
  progressTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: '#F2E2D4',
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FF8500',
  },
  section: {
    fontSize: 20,
    fontWeight: '900',
    color: '#4A2B1A',
    marginTop: 26,
    marginBottom: 8,
  },
  empty: { color: '#8B674D', paddingVertical: 20 },
  payment: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F0C8A7',
    borderRadius: 15,
    padding: 14,
    marginTop: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentCopy: { flex: 1, paddingRight: 12 },
  paymentAmount: { fontWeight: '900', color: '#4A2B1A', fontSize: 17 },
  paymentWallet: {
    color: '#A85C28',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 5,
  },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,.35)' },
  sheet: {
    maxHeight: '88%',
    margin: 18,
    backgroundColor: '#FFF8F1',
    borderRadius: 22,
    overflow: 'hidden',
  },
  sheetContent: { padding: 20, paddingBottom: 28 },
  sheetTitle: { fontSize: 22, fontWeight: '900', color: '#4A2B1A' },
  sheetHint: { color: '#8B674D', lineHeight: 20, marginTop: 6 },
  amountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
  },
  settleAllButton: {
    borderWidth: 1,
    borderColor: '#FF8500',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  settleAllText: { color: '#B85F00', fontSize: 12, fontWeight: '900' },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F0C8A7',
    borderRadius: 13,
    padding: 13,
    marginTop: 12,
  },
  amountInput: { fontSize: 24, fontWeight: '900', color: '#4A2B1A' },
  previewCard: {
    backgroundColor: '#FFF0E1',
    borderRadius: 13,
    padding: 13,
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  previewLabel: { color: '#8B674D', fontWeight: '800' },
  previewValue: { color: '#A85C28', fontWeight: '900' },
  label: { fontWeight: '800', color: '#69462F', marginTop: 16 },
  walletRow: { gap: 8, paddingVertical: 8, paddingRight: 8 },
  wallet: {
    width: 160,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F0C8A7',
    borderRadius: 12,
    padding: 12,
  },
  walletActive: { borderColor: '#FF8500', borderWidth: 2 },
  walletText: { fontWeight: '800', color: '#4A2B1A' },
  walletBalance: { color: '#8B674D', fontSize: 12, marginTop: 5 },
  dateButton: {
    minHeight: 50,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F0C8A7',
    borderRadius: 13,
    paddingHorizontal: 13,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  dateText: { color: '#4A2B1A', fontWeight: '800' },
});

export default LoanDebtDetailScreen;
