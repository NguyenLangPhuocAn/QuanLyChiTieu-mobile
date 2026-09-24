import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  History,
  PiggyBank,
  SendHorizontal,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { getWalletTypeMeta } from '../../constants/walletTypes';
import { useAuth } from '../../context/AuthContext';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { walletTransfersService } from '../../services/walletTransfers';
import { walletsService } from '../../services/wallets';
import type { Wallet } from '../../types/wallet';
import type { WalletTransfer } from '../../types/walletTransfer';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency, formatShortDate } from '../../utils/format';
import { parsePositiveMoneyInput } from '../../utils/moneyInput';

type Props = NativeStackScreenProps<RootStackParamList, 'WalletTransfers'>;

const WalletTransfersScreen = ({ navigation }: Props) => {
  const { token } = useAuth();
  const { run: runTransfer } = useSingleFlight();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transfers, setTransfers] = useState<WalletTransfer[]>([]);
  const [selection, setSelection] = useState<{
    sourceWalletId: number | null;
    destinationWalletId: number | null;
    initialized: boolean;
  }>({ sourceWalletId: null, destinationWalletId: null, initialized: false });
  const { sourceWalletId, destinationWalletId } = selection;
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadRevision = useRef(0);

  const regularWallets = useMemo(
    () => wallets.filter(wallet => wallet.wallet_type !== 'SAVINGS'),
    [wallets],
  );
  const sourceWallet = regularWallets.find(
    wallet => wallet.id === sourceWalletId,
  );
  const destinationWallets = regularWallets.filter(
    wallet =>
      wallet.id !== sourceWalletId &&
      wallet.currency === sourceWallet?.currency,
  );
  const destinationWallet = destinationWallets.find(
    wallet => wallet.id === destinationWalletId,
  );

  const loadData = useCallback(
    async (refresh = false) => {
      const revision = ++loadRevision.current;
      if (!token) return;
      refresh ? setRefreshing(true) : setLoading(true);
      setLoadError(null);
      try {
        const [nextWallets, nextTransfers] = await Promise.all([
          walletsService.getAll(token),
          walletTransfersService.getAll(token),
        ]);
        if (revision !== loadRevision.current) return;
        setWallets(nextWallets);
        setTransfers(nextTransfers);

        const regular = nextWallets.filter(
          wallet => wallet.wallet_type !== 'SAVINGS',
        );
        setSelection(current => {
          const source = current.initialized
            ? regular.find(wallet => wallet.id === current.sourceWalletId)
            : regular[0];
          const destinations = regular.filter(
            wallet =>
              wallet.id !== source?.id && wallet.currency === source?.currency,
          );
          const destination = current.initialized
            ? destinations.find(
                wallet => wallet.id === current.destinationWalletId,
              )
            : destinations[0];
          return {
            sourceWalletId: source?.id ?? null,
            destinationWalletId: destination?.id ?? null,
            initialized: true,
          };
        });
      } catch (error) {
        if (revision === loadRevision.current)
          setLoadError(
            getUserFriendlyErrorMessage(
              error,
              'Chưa tải được ví và lịch sử chuyển tiền.',
            ),
          );
      } finally {
        if (revision === loadRevision.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      loadData().catch(() => undefined);
      return () => {
        loadRevision.current += 1;
      };
    }, [loadData]),
  );

  const selectSource = (wallet: Wallet) => {
    const nextDestination = regularWallets.find(
      item => item.id !== wallet.id && item.currency === wallet.currency,
    );
    setSelection({
      sourceWalletId: wallet.id,
      destinationWalletId: nextDestination?.id ?? null,
      initialized: true,
    });
  };

  const swapWallets = () => {
    if (!sourceWallet || !destinationWallet) return;
    setSelection({
      sourceWalletId: destinationWallet.id,
      destinationWalletId: sourceWallet.id,
      initialized: true,
    });
  };

  const submitTransfer = () =>
    runTransfer(async () => {
      if (loading || refreshing || loadError) return;
      const plainAmount = parsePositiveMoneyInput(amount);
      if (!token || !sourceWallet || !destinationWallet || !plainAmount) {
        Alert.alert(
          'Thiếu thông tin',
          'Chọn đủ ví nguồn, ví nhận và nhập số tiền lớn hơn 0, tối đa 2 số thập phân (ví dụ 12,50). Không nhập dấu phân cách hàng nghìn.',
        );
        return;
      }
      if (!Number.isFinite(Number(plainAmount)) || Number(plainAmount) <= 0) {
        Alert.alert('Số tiền chưa hợp lệ', 'Vui lòng nhập số tiền lớn hơn 0.');
        return;
      }
      if (Number(plainAmount) > Number(sourceWallet.balance)) {
        Alert.alert(
          'Số dư không đủ',
          `Ví “${sourceWallet.name}” không đủ tiền.`,
        );
        return;
      }

      setSubmitting(true);
      try {
        await walletTransfersService.create(token, {
          source_wallet_id: sourceWallet.id,
          destination_wallet_id: destinationWallet.id,
          amount: plainAmount,
          note: note.trim() || undefined,
        });
        setAmount('');
        setNote('');
        await loadData(true);
        Alert.alert(
          'Chuyển tiền thành công',
          `Đã ghi lịch sử: ${sourceWallet.name} → ${destinationWallet.name}.`,
        );
      } catch (error) {
        Alert.alert(
          'Chuyển tiền thất bại',
          getUserFriendlyErrorMessage(
            error,
            'Vui lòng kiểm tra số dư và thử lại.',
          ),
        );
      } finally {
        setSubmitting(false);
      }
    });

  const walletSelector = (
    items: Wallet[],
    selectedId: number | null,
    onSelect: (wallet: Wallet) => void,
  ) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.walletCardRow}
    >
      {items.map(wallet => {
        const typeMeta = getWalletTypeMeta(wallet.wallet_type);
        const WalletTypeIcon = typeMeta.Icon;
        const active = selectedId === wallet.id;

        return (
          <TouchableOpacity
            key={wallet.id}
            accessibilityRole="button"
            accessibilityLabel={`Chọn ${
              items === regularWallets ? 'ví nguồn' : 'ví nhận'
            } ${wallet.name}`}
            accessibilityState={{ selected: active }}
            disabled={submitting}
            style={[
              styles.walletPickerCard,
              active && styles.walletPickerCardActive,
            ]}
            onPress={() => onSelect(wallet)}
          >
            <View
              style={[
                styles.walletPickerIcon,
                active && styles.walletPickerIconActive,
              ]}
            >
              <WalletTypeIcon
                size={18}
                color={active ? Colors.white : '#D87219'}
              />
            </View>
            <Text style={styles.walletPickerName} numberOfLines={1}>
              {wallet.name}
            </Text>
            <Text style={styles.walletPickerBalance} numberOfLines={1}>
              {formatCurrency(Number(wallet.balance), wallet.currency)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={navigation.goBack}
        >
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chuyển tiền</Text>
        <View style={styles.headerButtonPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true).catch(() => undefined)}
            tintColor={Colors.primary}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : loadError ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeText}>{loadError}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Thử tải lại chuyển tiền"
              style={styles.retryButton}
              onPress={() => loadData()}
            >
              <Text>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.noticeCard}>
              <ArrowDownUp size={20} color="#9A4D00" />
              <Text style={styles.noticeText}>
                Chuyển nội bộ chỉ thay đổi số dư ví, không được tính là thu nhập
                hoặc chi tiêu.
              </Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>Tạo chuyển tiền</Text>
              {regularWallets.length < 2 ? (
                <Text style={styles.emptyText}>
                  Bạn cần ít nhất hai ví thường để chuyển tiền. Ví tiết kiệm sử
                  dụng chức năng Đóng góp/Rút tiền trong mục tiêu.
                </Text>
              ) : (
                <>
                  <Text style={styles.label}>Từ ví</Text>
                  {sourceWallet ? (
                    <Text style={styles.walletCurrencyHint}>
                      Chuyển bằng tiền tệ của ví: {sourceWallet.currency}
                    </Text>
                  ) : null}
                  {walletSelector(regularWallets, sourceWalletId, selectSource)}

                  <TouchableOpacity
                    disabled={submitting}
                    style={styles.swapButton}
                    onPress={swapWallets}
                  >
                    <ArrowDownUp size={18} color={Colors.primary} />
                    <Text style={styles.swapText}>Đổi chiều chuyển</Text>
                  </TouchableOpacity>

                  <Text style={styles.label}>Đến ví</Text>
                  {destinationWallets.length > 0 ? (
                    walletSelector(
                      destinationWallets,
                      destinationWalletId,
                      wallet =>
                        setSelection(current => ({
                          ...current,
                          destinationWalletId: wallet.id,
                        })),
                    )
                  ) : (
                    <Text style={styles.helperText}>
                      Không có ví nhận cùng loại tiền {sourceWallet?.currency}.
                    </Text>
                  )}

                  <Text style={styles.label}>Số tiền</Text>
                  <TextInput
                    accessibilityLabel="Số tiền chuyển ví"
                    editable={!submitting}
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder="0"
                  />

                  <Text style={styles.label}>Ghi chú (không bắt buộc)</Text>
                  <TextInput
                    editable={!submitting}
                    style={[styles.input, styles.noteInput]}
                    value={note}
                    onChangeText={setNote}
                    placeholder="Ví dụ: Chuyển tiền sinh hoạt"
                    multiline
                    maxLength={1000}
                  />

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Xác nhận chuyển tiền"
                    style={[
                      styles.submitButton,
                      (!destinationWallet || submitting) &&
                        styles.buttonDisabled,
                    ]}
                    onPress={submitTransfer}
                    disabled={!destinationWallet || submitting || refreshing}
                  >
                    {submitting ? (
                      <ActivityIndicator color={Colors.white} />
                    ) : (
                      <>
                        <SendHorizontal size={19} color={Colors.white} />
                        <Text style={styles.submitText}>Xác nhận chuyển</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

            <View style={styles.historyHeader}>
              <View style={styles.historyTitleRow}>
                <History size={20} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Lịch sử chuyển tiền</Text>
              </View>
              <Text style={styles.historyCount}>{transfers.length} lần</Text>
            </View>

            {transfers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Chưa có lần chuyển nào</Text>
                <Text style={styles.emptyText}>
                  Sau khi chuyển, lịch sử sẽ ghi rõ ví nguồn và ví nhận tại đây.
                </Text>
              </View>
            ) : (
              transfers.map(transfer => (
                <View key={transfer.id} style={styles.historyCard}>
                  <View style={styles.historyIcon}>
                    {transfer.kind === 'SAVINGS' ? (
                      <PiggyBank size={21} color="#9A4D00" />
                    ) : (
                      <ArrowRight size={21} color="#9A4D00" />
                    )}
                  </View>
                  <View style={styles.historyCopy}>
                    <View style={styles.routeRow}>
                      <Text style={styles.routeWallet} numberOfLines={1}>
                        {transfer.source_wallet.name}
                      </Text>
                      <ArrowRight size={14} color="#9C7255" />
                      <Text style={styles.routeWallet} numberOfLines={1}>
                        {transfer.destination_wallet.name}
                      </Text>
                    </View>
                    <Text style={styles.historyMeta}>
                      {formatShortDate(transfer.transfer_date)} ·{' '}
                      {transfer.kind === 'SAVINGS'
                        ? 'Tiết kiệm'
                        : 'Chuyển giữa ví'}
                    </Text>
                    {transfer.note ? (
                      <Text style={styles.historyNote} numberOfLines={2}>
                        {transfer.note}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.historyAmount}>
                    {formatCurrency(transfer.amount, transfer.currency)}
                  </Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  container: { flex: 1, backgroundColor: '#FFF7EF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerTitle: { color: '#4A2B1A', fontSize: 20, fontWeight: '900' },
  content: { padding: 16, paddingBottom: 80, gap: 14 },
  loadingBlock: { paddingVertical: 50 },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#FFF0DF',
    borderWidth: 1,
    borderColor: '#E8B680',
  },
  noticeText: { flex: 1, color: '#6F4B32', lineHeight: 20, fontWeight: '700' },
  formCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#F0D6C1',
  },
  sectionTitle: { color: '#4A2B1A', fontSize: 18, fontWeight: '900' },
  label: {
    color: '#6F4B32',
    fontWeight: '900',
    marginTop: 16,
    marginBottom: 8,
  },
  walletCardRow: { gap: 10, paddingRight: 10 },
  walletPickerCard: {
    width: 138,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F2D9C0',
    backgroundColor: '#FFF6EF',
    padding: 12,
  },
  walletPickerCardActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF0DF',
  },
  walletPickerIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  walletPickerIconActive: {
    backgroundColor: Colors.primary,
  },
  walletPickerName: { color: '#4C2A18', fontWeight: '900' },
  walletPickerBalance: {
    color: '#8A623F',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 5,
  },
  walletCurrencyHint: {
    color: '#8A623F',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  swapButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: '#FFF0E2',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  swapText: { color: Colors.primary, fontWeight: '900', fontSize: 12 },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8B680',
    paddingHorizontal: 13,
    color: '#4A2B1A',
    backgroundColor: '#FFFDFC',
    fontWeight: '800',
  },
  noteInput: { minHeight: 78, paddingTop: 12, textAlignVertical: 'top' },
  helperText: { color: '#A15C30', lineHeight: 20, fontWeight: '700' },
  submitButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  buttonDisabled: { opacity: 0.55 },
  submitText: { color: Colors.white, fontWeight: '900', fontSize: 16 },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyCount: { color: '#8B6548', fontWeight: '800' },
  historyCard: {
    borderRadius: 18,
    padding: 13,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyCopy: { flex: 1, minWidth: 0 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  routeWallet: { color: '#4A2B1A', fontWeight: '900', flexShrink: 1 },
  historyMeta: {
    color: '#8B6548',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '700',
  },
  historyNote: { color: '#6F4B32', fontSize: 12, marginTop: 4 },
  historyAmount: { color: '#9A4D00', fontWeight: '900', fontSize: 13 },
  emptyCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#F0D6C1',
  },
  emptyTitle: { color: '#4A2B1A', fontWeight: '900', fontSize: 16 },
  emptyText: { color: '#8B6548', lineHeight: 21, marginTop: 8 },
});

export default WalletTransfersScreen;
