import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, FormField } from './FormControls';
import { useSingleFlight } from '../hooks/useSingleFlight';
import { categoriesService } from '../services/categories';
import { payRecurringBill } from '../services/payRecurringBill';
import type { BillScope } from '../services/recurringBills';
import type { CreateTransactionPayload } from '../services/transactions';
import { walletsService } from '../services/wallets';
import type { Category } from '../types/category';
import type { ApiTransaction } from '../types/transaction';
import type { Wallet } from '../types/wallet';
import type { BillOccurrence } from '../utils/recurringBills';
import { formatCurrency } from '../utils/format';
import { getTransactionDateKey } from '../utils/mapTransactions';
import {
  formatMoneyInputForCurrency,
  normalizeMoneyInputForCurrency,
  parsePositiveMoneyInput,
} from '../utils/moneyInput';
import { filterNormalCashFlowCategories } from '../utils/transactionClassification';

export default function BillPaymentEntry({
  occurrence,
  scope,
  token,
  onClose,
  onLinked,
}: {
  occurrence: BillOccurrence;
  scope: BillScope;
  token: string;
  onClose: () => void;
  onLinked: () => Promise<void>;
}) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [amount, setAmount] = useState(
    occurrence.bill.kind === 'FIXED' ? String(occurrence.bill.minAmount) : '',
  );
  const [note, setNote] = useState(occurrence.bill.label);
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [attempt, setAttempt] = useState<CreateTransactionPayload | null>(null);
  const [created, setCreated] = useState<ApiTransaction | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const alive = useRef(true);
  const reviewEpoch = useRef(0);
  const foreground = useRef(AppState.currentState === 'active');
  const { run, busy } = useSingleFlight();
  const currency = occurrence.bill.currency;
  const availableWallets = wallets.filter(
    item => item.currency === currency && item.wallet_type !== 'SAVINGS',
  );
  const availableCategories = filterNormalCashFlowCategories(categories).filter(
    item => item.type === 'EXPENSE',
  );
  const selectedWallet = availableWallets.find(item => item.id === walletId);
  const selectedCategory = availableCategories.find(
    item => item.id === categoryId,
  );

  useEffect(() => {
    alive.current = true;
    const subscription = AppState.addEventListener('change', state => {
      foreground.current = state === 'active';
      if (state !== 'active') reviewEpoch.current += 1;
    });
    Promise.all([walletsService.getAll(token), categoriesService.getAll(token)])
      .then(([nextWallets, nextCategories]) => {
        if (!alive.current) return;
        setWallets(nextWallets);
        setCategories(nextCategories);
        setOptionsError(null);
      })
      .catch(() => {
        if (alive.current)
          setOptionsError('Cần kết nối để tải ví và danh mục trước khi trả.');
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });
    return () => {
      alive.current = false;
      reviewEpoch.current += 1;
      subscription.remove();
    };
  }, [token]);

  const close = () => {
    reviewEpoch.current += 1;
    if (!busy) onClose();
  };

  const submit = (payload: CreateTransactionPayload) =>
    run(async () => {
      setSaveError(null);
      let createdOnAttempt = created;
      try {
        const transaction = await payRecurringBill({
          scope,
          token,
          occurrence,
          payload,
          category: selectedCategory,
          created,
          onCreated: savedTransaction => {
            createdOnAttempt = savedTransaction;
            setCreated(savedTransaction);
          },
          isCurrent: () => alive.current,
        });
        if (!alive.current) return;
        await onLinked();
        Alert.alert(
          'Đã trả hóa đơn',
          `Đã tạo giao dịch chi #${
            transaction.id
          } và liên kết kỳ ${occurrence.dueDate
            .split('-')
            .reverse()
            .join('/')}.`,
        );
      } catch (error) {
        if (!alive.current) return;
        setSaveError(
          `${
            error instanceof Error ? error.message : 'Chưa hoàn tất thanh toán.'
          } ${
            createdOnAttempt
              ? 'Giao dịch đã tạo; bấm Liên kết lại, không tạo thêm.'
              : 'Nếu mạng gián đoạn, thử lại cùng thông tin; mã chống trùng giữ nguyên.'
          }`,
        );
      }
    });

  const preview = () => {
    if (
      !selectedWallet ||
      (availableCategories.length > 0 && !selectedCategory)
    ) {
      setSaveError('Chọn ví và danh mục chi trước khi kiểm tra.');
      return;
    }
    const normalized = parsePositiveMoneyInput(amount);
    const value = Number(normalized);
    if (
      !normalized ||
      !Number.isFinite(value) ||
      value > 9999999999999.99 ||
      (currency === 'VND' && !Number.isInteger(value))
    ) {
      setSaveError('Nhập số tiền hợp lệ trước khi kiểm tra.');
      return;
    }
    const payload: CreateTransactionPayload = {
      wallet_id: selectedWallet.id,
      category_id: selectedCategory?.id,
      amount: normalized,
      type: 'EXPENSE',
      note: note.trim() || occurrence.bill.label,
      transaction_date: getTransactionDateKey(date.toISOString()),
    };
    const outside =
      value < occurrence.bill.minAmount || value > occurrence.bill.maxAmount;
    const epoch = ++reviewEpoch.current;
    Alert.alert(
      'Kiểm tra trước khi trả',
      `${occurrence.bill.label} · kỳ ${occurrence.dueDate
        .split('-')
        .reverse()
        .join('/')}\nChi ${formatCurrency(value, currency)} từ ${
        selectedWallet.name
      } · ${
        selectedCategory?.name ?? 'Chưa phân loại'
      }\nNgày ${payload.transaction_date?.split('-').reverse().join('/')}\n${
        payload.note
      }${
        outside ? '\nSố tiền khác mức dự kiến của lịch.' : ''
      }\nXác nhận sẽ tạo một giao dịch mới, trừ tiền ví và đánh dấu kỳ đã trả.`,
      [
        { text: 'Sửa lại', style: 'cancel' },
        {
          text: 'Tạo và trả',
          onPress: () => {
            if (
              !alive.current ||
              !foreground.current ||
              epoch !== reviewEpoch.current
            )
              return;
            setAttempt(payload);
            submit(payload).catch(() => undefined);
          },
        },
      ],
    );
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.row}>
            <Text style={styles.title}>Tạo giao dịch và trả</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Đóng tạo giao dịch hóa đơn"
              disabled={busy}
              onPress={close}
            >
              <Text style={styles.close}>Đóng</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.muted}>
              {occurrence.bill.label} · kỳ{' '}
              {occurrence.dueDate.split('-').reverse().join('/')} · dự kiến{' '}
              {occurrence.bill.kind === 'FIXED'
                ? formatCurrency(occurrence.bill.minAmount, currency)
                : `${formatCurrency(
                    occurrence.bill.minAmount,
                    currency,
                  )} – ${formatCurrency(occurrence.bill.maxAmount, currency)}`}
            </Text>
            <Text style={styles.muted}>
              Chọn ví và danh mục. Giao dịch chỉ được tạo sau khi bạn kiểm tra
              và xác nhận.
            </Text>
            {loading ? <ActivityIndicator color="#FF8C00" /> : null}
            {optionsError ? (
              <Text style={styles.error}>{optionsError}</Text>
            ) : null}
            {!loading && !optionsError ? (
              <>
                <Text style={styles.label}>Ví thanh toán · {currency}</Text>
                <View style={styles.options}>
                  {availableWallets.map(wallet => (
                    <TouchableOpacity
                      key={wallet.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Ví trả hóa đơn ${wallet.name}`}
                      accessibilityState={{ selected: walletId === wallet.id }}
                      style={[
                        styles.chip,
                        walletId === wallet.id && styles.chipSelected,
                      ]}
                      disabled={Boolean(attempt)}
                      onPress={() => {
                        reviewEpoch.current += 1;
                        setWalletId(wallet.id);
                      }}
                    >
                      <Text style={styles.chipText}>{wallet.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {!availableWallets.length ? (
                  <Text style={styles.error}>
                    Chưa có ví thường cùng tiền tệ với hóa đơn.
                  </Text>
                ) : null}
                <Text style={styles.label}>Danh mục chi</Text>
                <View style={styles.options}>
                  {availableCategories.map(category => (
                    <TouchableOpacity
                      key={category.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Danh mục trả hóa đơn ${category.name}`}
                      accessibilityState={{
                        selected: categoryId === category.id,
                      }}
                      style={[
                        styles.chip,
                        categoryId === category.id && styles.chipSelected,
                      ]}
                      disabled={Boolean(attempt)}
                      onPress={() => {
                        reviewEpoch.current += 1;
                        setCategoryId(category.id);
                      }}
                    >
                      <Text style={styles.chipText}>{category.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {!availableCategories.length ? (
                  <Text style={styles.muted}>
                    Chưa có danh mục chi; giao dịch sẽ lưu chưa phân loại.
                  </Text>
                ) : null}
                <FormField
                  label="Số tiền đã trả"
                  accessibilityLabel="Số tiền trả hóa đơn"
                  placeholder="Nhập số tiền kỳ này"
                  keyboardType="decimal-pad"
                  value={formatMoneyInputForCurrency(amount, currency)}
                  onChangeText={value => {
                    reviewEpoch.current += 1;
                    setAmount(normalizeMoneyInputForCurrency(value, currency));
                  }}
                  editable={!attempt}
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Ngày trả hóa đơn"
                  disabled={Boolean(attempt)}
                  style={styles.date}
                  onPress={() => setShowDate(true)}
                >
                  <Text style={styles.label}>Ngày trả</Text>
                  <Text style={styles.chipText}>
                    {getTransactionDateKey(date.toISOString())
                      .split('-')
                      .reverse()
                      .join('/')}
                  </Text>
                </TouchableOpacity>
                {showDate ? (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    onChange={(_, selected) => {
                      setShowDate(false);
                      if (selected) {
                        reviewEpoch.current += 1;
                        setDate(selected);
                      }
                    }}
                  />
                ) : null}
                <FormField
                  label="Nội dung"
                  accessibilityLabel="Nội dung trả hóa đơn"
                  value={note}
                  maxLength={500}
                  onChangeText={value => {
                    reviewEpoch.current += 1;
                    setNote(value);
                  }}
                  editable={!attempt}
                />
              </>
            ) : null}
            {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
            {!loading && !optionsError ? (
              <ActionButton
                label={
                  created
                    ? 'Liên kết lại giao dịch'
                    : attempt
                    ? 'Thử hoàn tất'
                    : 'Kiểm tra và trả'
                }
                loading={busy}
                disabled={!availableWallets.length}
                onPress={() => {
                  if (attempt) submit(attempt).catch(() => undefined);
                  else preview();
                }}
              />
            ) : null}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#00000055',
  },
  sheet: {
    maxHeight: '87%',
    backgroundColor: '#FFF9F3',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  content: { paddingBottom: 28, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { fontSize: 19, fontWeight: '700', color: '#4A2B1A' },
  close: { color: '#A75410', fontSize: 14, fontWeight: '700' },
  label: { color: '#593420', fontSize: 14, fontWeight: '600' },
  muted: { color: '#886449', fontSize: 13, lineHeight: 20 },
  error: { color: '#B3261E', fontSize: 13, lineHeight: 20 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderColor: '#E8B680',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFDFC',
  },
  chipSelected: { borderColor: '#FF8C00', backgroundColor: '#FFF0DF' },
  chipText: { color: '#593420', fontSize: 14 },
  date: {
    borderColor: '#E8B680',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFFDFC',
    gap: 4,
  },
});
