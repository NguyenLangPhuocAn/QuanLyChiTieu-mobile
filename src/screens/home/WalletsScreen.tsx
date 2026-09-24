import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
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
import {
  ArrowLeft,
  ArrowRightLeft,
  ChevronRight,
  Ellipsis,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Colors } from '../../constants/Colors';
import { CURRENCY_OPTIONS } from '../../constants/currencies';
import {
  WALLET_TYPES,
  getWalletTypeMeta,
  type WalletType,
} from '../../constants/walletTypes';
import { useAuth } from '../../context/AuthContext';
import { walletsService } from '../../services/wallets';
import { budgetsService } from '../../services/budgets';
import type { Wallet } from '../../types/wallet';
import type { Budget } from '../../types/budget';
import { useFinance } from '../../context/FinanceContext';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency } from '../../utils/format';
import { getWalletBalanceChange } from '../../utils/moneyInput';
import { useSingleFlight } from '../../hooks/useSingleFlight';

type Props = NativeStackScreenProps<RootStackParamList, 'Wallets'>;

const findActiveBudget = (budgets: Budget[], walletId: number) => {
  const now = new Date();

  return budgets
    .filter(budget => {
      const start = new Date(budget.start_date);
      const end = new Date(budget.end_date);

      return (
        budget.scope === 'WALLET' &&
        budget.wallet_id === walletId &&
        start <= now &&
        end >= now
      );
    })
    .sort(
      (left, right) =>
        new Date(right.start_date).getTime() -
          new Date(left.start_date).getTime() || right.id - left.id,
    )[0];
};

const WalletsScreen = ({ navigation, route }: Props) => {
  const { token, user } = useAuth();
  const { preferredCurrency, transactions } = useFinance();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingWallet, setIsSavingWallet] = useState(false);
  const { run: runWalletMutation } = useSingleFlight();
  const [isWalletModalVisible, setIsWalletModalVisible] = useState(false);
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [walletName, setWalletName] = useState('');
  const [walletBalance, setWalletBalance] = useState('');
  const [walletCurrency, setWalletCurrency] = useState('VND');
  const [walletType, setWalletType] = useState<WalletType>('CASH');
  const regularWallets = useMemo(
    () => wallets.filter(wallet => wallet.wallet_type !== 'SAVINGS'),
    [wallets],
  );
  const selectedCurrency = useMemo(
    () =>
      CURRENCY_OPTIONS.find(item => item.code === walletCurrency) ??
      CURRENCY_OPTIONS[0],
    [walletCurrency],
  );

  const fetchWallets = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await walletsService.getAll(token);
      const nextBudgets = await budgetsService.getAll(token);
      setWallets(response);
      setBudgets(nextBudgets);
    } catch (error) {
      const message = getUserFriendlyErrorMessage(
        error,
        'Không thể tải danh sách ví.',
      );
      Alert.alert('Lỗi tải ví', message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchWallets().catch(() => undefined);
    }, [fetchWallets]),
  );

  useEffect(() => {
    const selectedCurrencyParam = route.params?.selectedCurrency;

    if (selectedCurrencyParam && isWalletModalVisible) {
      setWalletCurrency(selectedCurrencyParam);
      navigation.setParams({ selectedCurrency: undefined });
    }
  }, [isWalletModalVisible, navigation, route.params?.selectedCurrency]);

  const totalBalance = useMemo(
    () =>
      wallets.reduce(
        (sum, wallet) =>
          sum + Number(wallet.display_balance ?? wallet.balance ?? 0),
        0,
      ),
    [wallets],
  );

  const openCreateWalletModal = () => {
    setEditingWallet(null);
    setWalletName('');
    setWalletBalance('');
    setWalletCurrency(user?.currency_default ?? 'VND');
    setWalletType('CASH');
    setIsWalletModalVisible(true);
  };

  const openEditWalletModal = (wallet: Wallet) => {
    setEditingWallet(wallet);
    setWalletName(wallet.name);
    setWalletBalance(String(wallet.balance ?? 0));
    setWalletCurrency(wallet.currency ?? 'VND');
    setWalletType(wallet.wallet_type ?? 'CASH');
    setIsWalletModalVisible(true);
  };

  const handleSaveWallet = () =>
    runWalletMutation(async () => {
      if (!token) {
        return;
      }

      if (!walletName.trim()) {
        Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên ví.');
        return;
      }

      const balance = getWalletBalanceChange(
        walletBalance,
        editingWallet ? Number(editingWallet.balance ?? 0) : undefined,
      );
      if (balance === null) {
        Alert.alert(
          'Số dư chưa hợp lệ',
          'Nhập số không âm, tối đa 2 số thập phân (ví dụ 12,50). Không nhập dấu phân cách hàng nghìn.',
        );
        return;
      }
      setIsSavingWallet(true);

      try {
        if (editingWallet) {
          await walletsService.update(token, editingWallet.id, {
            name: walletName.trim(),
            ...(balance !== undefined ? { balance } : {}),
            currency: walletCurrency,
            wallet_type: walletType,
          });
        } else {
          await walletsService.create(token, {
            name: walletName.trim(),
            balance: balance ?? '0',
            currency: walletCurrency,
            wallet_type: walletType,
          });
        }

        await fetchWallets();
        setIsWalletModalVisible(false);
      } catch (error) {
        const message = getUserFriendlyErrorMessage(error, 'Không thể lưu ví.');
        Alert.alert('Lưu ví thất bại', message);
      } finally {
        setIsSavingWallet(false);
      }
    });

  const handleDeleteWallet = () => {
    if (!token || !editingWallet) {
      return;
    }

    Alert.alert(
      'Xóa ví',
      'Ví sẽ được xóa mềm khỏi danh sách đang dùng. Giao dịch cũ vẫn được giữ để thống kê lịch sử.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa ví',
          style: 'destructive',
          onPress: () =>
            runWalletMutation(async () => {
              setIsSavingWallet(true);

              try {
                await walletsService.remove(token, editingWallet.id);
                await fetchWallets();
                setIsWalletModalVisible(false);
                setEditingWallet(null);
                Alert.alert(
                  'Đã xóa ví',
                  'Ví đã được xóa mềm. Dữ liệu giao dịch cũ vẫn được giữ nguyên.',
                );
              } catch (error) {
                const message = getUserFriendlyErrorMessage(
                  error,
                  'Không thể xóa ví.',
                );
                Alert.alert('Xóa ví thất bại', message);
              } finally {
                setIsSavingWallet(false);
              }
            }),
        },
      ],
    );
  };

  const walletLimitText =
    user?.role === 'PREMIUM' || user?.role === 'ADMIN'
      ? 'Tài khoản Premium được tạo không giới hạn số ví.'
      : 'Tài khoản Basic hiện được tạo tối đa 2 ví.';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Ví</Text>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setIsInfoModalVisible(true)}
        >
          <Ellipsis size={22} color="#593420" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Tổng số dư ví</Text>
          <Text style={styles.summaryBalance}>
            {formatCurrency(totalBalance, preferredCurrency)}
          </Text>

          <View style={styles.summaryStats}>
            <View style={styles.summaryStatCard}>
              <Text style={styles.summaryStatLabel}>Số ví</Text>
              <Text style={styles.summaryStatValue}>{wallets.length}</Text>
            </View>
            <View style={styles.summaryStatCard}>
              <Text style={styles.summaryStatLabel}>Tiền tệ</Text>
              <Text style={styles.summaryStatValue}>{preferredCurrency}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.transferShortcut}
          onPress={() => navigation.navigate('WalletTransfers')}
        >
          <View style={styles.transferShortcutIcon}>
            <ArrowRightLeft size={22} color={Colors.white} />
          </View>
          <View style={styles.transferShortcutCopy}>
            <Text style={styles.transferShortcutTitle}>
              Chuyển tiền giữa các ví
            </Text>
            <Text style={styles.transferShortcutText}>
              Chuyển nội bộ và xem rõ lịch sử ví nguồn → ví nhận
            </Text>
          </View>
          <ChevronRight size={21} color="#9A4D00" />
        </TouchableOpacity>

        {isLoading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : regularWallets.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Bạn chưa có ví nào</Text>
            <Text style={styles.emptyText}>
              Tạo ví đầu tiên để bắt đầu theo dõi số dư, ngân sách và giao dịch.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={openCreateWalletModal}
            >
              <Text style={styles.primaryButtonText}>Tạo ví đầu tiên</Text>
            </TouchableOpacity>
          </View>
        ) : (
          regularWallets.map(wallet => {
            const typeMeta = getWalletTypeMeta(wallet.wallet_type);
            const WalletTypeIcon = typeMeta.Icon;
            const walletTransactions = transactions.filter(
              transaction => transaction.walletId === wallet.id,
            );
            const activeBudget = findActiveBudget(budgets, wallet.id);
            const budgetLimit = Number(
              activeBudget?.limit_amount ?? activeBudget?.amount ?? 0,
            );
            const budgetProgress = activeBudget
              ? Math.min(100, activeBudget.percentage)
              : 0;

            return (
              <TouchableOpacity
                key={wallet.id}
                style={styles.walletCard}
                onPress={() =>
                  wallet.wallet_type === 'SAVINGS'
                    ? navigation.navigate('SavingsGoals')
                    : navigation.navigate('WalletTransactions', {
                        walletId: wallet.id,
                        walletName: wallet.name,
                      })
                }
              >
                <ImageBackground
                  source={typeMeta.background}
                  imageStyle={styles.walletCardBackground}
                  style={styles.walletCardBackgroundWrap}
                >
                  <View style={styles.walletIconBox}>
                    <WalletTypeIcon size={22} color={Colors.white} />
                  </View>

                  <View style={styles.walletInfo}>
                    <View style={styles.walletTitleRow}>
                      <Text style={styles.walletName}>{wallet.name}</Text>
                      <View style={styles.walletTypeBadge}>
                        <Text style={styles.walletTypeText}>
                          {typeMeta.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.walletBalance}>
                      {formatCurrency(
                        Number(wallet.balance || 0),
                        wallet.currency,
                      )}
                    </Text>
                    <Text style={styles.walletCurrency}>{wallet.currency}</Text>
                    <View style={styles.walletMiniStats}>
                      <Text style={styles.walletMiniText}>
                        {walletTransactions.length} giao dịch
                      </Text>
                      {budgetLimit > 0 ? (
                        <Text style={styles.walletMiniText}>
                          {Math.round(budgetProgress)}% ngân sách
                        </Text>
                      ) : null}
                    </View>
                    {budgetLimit > 0 ? (
                      <View style={styles.budgetProgressTrack}>
                        <View
                          style={[
                            styles.budgetProgressFill,
                            budgetProgress >= 100
                              ? styles.budgetProgressDanger
                              : budgetProgress >= 80
                              ? styles.budgetProgressWarn
                              : null,
                            { width: `${Math.max(5, budgetProgress)}%` },
                          ]}
                        />
                      </View>
                    ) : null}
                  </View>

                  {wallet.wallet_type !== 'SAVINGS' ? (
                    <TouchableOpacity
                      style={styles.walletMenuButton}
                      onPress={() => openEditWalletModal(wallet)}
                    >
                      <MoreHorizontal size={20} color={Colors.white} />
                    </TouchableOpacity>
                  ) : null}
                </ImageBackground>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openCreateWalletModal}>
        <Plus size={26} color={Colors.white} />
      </TouchableOpacity>

      <Modal transparent visible={isWalletModalVisible} animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable
            style={styles.backdropPressable}
            onPress={() => setIsWalletModalVisible(false)}
          />
          <Pressable style={styles.modalCard}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitle}>
                {editingWallet ? 'Sửa ví' : 'Thêm ví mới'}
              </Text>

              <Text style={styles.inputLabel}>Loại ví</Text>
              <View style={styles.typeGrid}>
                {WALLET_TYPES.map(item => {
                  const TypeIcon = item.Icon;
                  const active = walletType === item.value;

                  return (
                    <TouchableOpacity
                      key={item.value}
                      style={[styles.typeCard, active && styles.typeCardActive]}
                      onPress={() => setWalletType(item.value)}
                    >
                      <ImageBackground
                        source={item.background}
                        imageStyle={styles.typeCardBackground}
                        style={styles.typeCardBackgroundWrap}
                      >
                        <View style={styles.typeIconCircle}>
                          <TypeIcon size={20} color={Colors.white} />
                        </View>
                        <Text style={styles.typeLabel}>{item.label}</Text>
                        <Text style={styles.typeDescription}>
                          {item.description}
                        </Text>
                      </ImageBackground>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Tên ví</Text>
              <TextInput
                style={styles.input}
                placeholder="Ví chính"
                value={walletName}
                onChangeText={setWalletName}
              />

              {editingWallet ? (
                <>
                  <Text style={styles.inputLabel}>Số dư mới</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    value={walletBalance}
                    onChangeText={setWalletBalance}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.inputLabel}>Số dư ban đầu</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    value={walletBalance}
                    onChangeText={setWalletBalance}
                  />
                </>
              )}

              <Text style={styles.inputLabel}>Tiền tệ của ví</Text>
              <TouchableOpacity
                style={styles.currencySelect}
                onPress={() =>
                  navigation.navigate('CurrencyPicker', {
                    selectedCurrency: walletCurrency,
                    returnTo: 'Wallets',
                  })
                }
              >
                <View>
                  <Text style={styles.currencyCode}>
                    {selectedCurrency.code}
                  </Text>
                  <Text style={styles.currencyLabel}>
                    {selectedCurrency.label}
                  </Text>
                </View>
                <ChevronRight size={22} color="#9A765B" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSaveWallet}
              >
                {isSavingWallet ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Lưu ví</Text>
                )}
              </TouchableOpacity>
              {editingWallet ? (
                <TouchableOpacity
                  style={styles.dangerButton}
                  onPress={handleDeleteWallet}
                  disabled={isSavingWallet}
                >
                  <Trash2 size={18} color="#B42318" />
                  <Text style={styles.dangerButtonText}>Xóa ví</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal transparent visible={isInfoModalVisible} animationType="fade">
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsInfoModalVisible(false)}
        >
          <Pressable style={styles.infoCard}>
            <Text style={styles.modalTitle}>Ví là gì?</Text>
            <Text style={styles.infoText}>
              Ví là nơi gom và quản lý tiền theo từng mục đích. Bạn có thể dùng
              ví để tách tiền mặt, tài khoản ngân hàng, quỹ tiết kiệm hoặc khoản
              chi riêng.
            </Text>
            <Text style={styles.infoText}>{walletLimitText}</Text>
            <Text style={styles.infoText}>
              Khi có nhiều ví, bạn sẽ xem được tổng số dư và chọn đúng ví cho
              từng giao dịch.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF7EF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  headerTitle: {
    color: '#4A2B1A',
    fontSize: 20,
    fontWeight: '800',
  },
  content: {
    padding: 16,
    paddingBottom: 120,
    gap: 14,
  },
  summaryCard: {
    backgroundColor: '#FFFDFC',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F0D6C1',
  },
  transferShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#FFF0DF',
    borderWidth: 1,
    borderColor: '#E8B680',
  },
  transferShortcutIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferShortcutCopy: { flex: 1 },
  transferShortcutTitle: { color: '#4A2B1A', fontWeight: '900', fontSize: 15 },
  transferShortcutText: {
    color: '#8B6548',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  summaryLabel: {
    color: '#A26B48',
    fontSize: 14,
  },
  summaryBalance: {
    color: '#4A2B1A',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 8,
  },
  summaryStats: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  summaryStatCard: {
    flex: 1,
    backgroundColor: '#FFF4EA',
    borderRadius: 8,
    padding: 14,
  },
  summaryStatLabel: {
    color: '#9C7255',
    fontSize: 12,
  },
  summaryStatValue: {
    color: '#4A2B1A',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 6,
  },
  loadingBlock: {
    paddingVertical: 36,
  },
  emptyCard: {
    backgroundColor: '#FFFDFC',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F0D6C1',
  },
  emptyTitle: {
    color: '#4A2B1A',
    fontSize: 20,
    fontWeight: '800',
  },
  emptyText: {
    color: '#8B6548',
    marginTop: 10,
    lineHeight: 22,
    marginBottom: 18,
  },
  walletCard: {
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  walletCardBackground: {
    borderRadius: 18,
  },
  walletCardBackgroundWrap: {
    minHeight: 124,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  walletIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletInfo: {
    flex: 1,
  },
  walletTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  walletName: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '900',
  },
  walletTypeBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  walletTypeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
  walletBalance: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 6,
  },
  walletCurrency: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  walletMiniStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  walletMiniText: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 11,
    fontWeight: '800',
  },
  budgetProgressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.24)',
    marginTop: 9,
    overflow: 'hidden',
  },
  budgetProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  budgetProgressWarn: {
    backgroundColor: '#FFE2A8',
  },
  budgetProgressDanger: {
    backgroundColor: '#FFB4A2',
  },
  walletMenuButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 26,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F28C28',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D96D08',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(36, 22, 12, 0.38)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFill,
  },
  modalCard: {
    backgroundColor: '#FFFDFC',
    borderRadius: 28,
    padding: 20,
    maxHeight: '86%',
    borderWidth: 1,
    borderColor: '#F0D6C1',
    shadowColor: '#7A3E12',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  infoCard: {
    backgroundColor: '#FFFDFC',
    borderRadius: 28,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F0D6C1',
  },
  modalTitle: {
    color: '#4A2B1A',
    fontSize: 22,
    fontWeight: '800',
  },
  typeGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  typeCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeCardActive: {
    borderColor: '#4A2B1A',
  },
  typeCardBackground: {
    borderRadius: 14,
  },
  typeCardBackgroundWrap: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  typeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
  typeDescription: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    fontWeight: '700',
  },
  modalDescription: {
    color: '#8B6548',
    marginTop: 10,
    lineHeight: 22,
  },
  readOnlyBalanceCard: {
    backgroundColor: '#FFF4EA',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    marginTop: 16,
  },
  readOnlyBalanceLabel: {
    color: '#7B573C',
    fontSize: 13,
    fontWeight: '700',
  },
  readOnlyBalanceValue: {
    color: '#4A2B1A',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 6,
  },
  readOnlyBalanceHint: {
    color: '#8B6548',
    lineHeight: 20,
    marginTop: 8,
  },
  adjustmentHint: {
    color: '#8B6548',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  infoText: {
    color: '#8B6548',
    lineHeight: 22,
    marginTop: 12,
  },
  inputLabel: {
    color: '#7B573C',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  currencySelect: {
    minHeight: 66,
    backgroundColor: '#FFF8F2',
    borderWidth: 1,
    borderColor: '#F0D6C1',
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currencyCode: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  currencyLabel: {
    color: '#8B6548',
    fontWeight: '700',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#FFF8F2',
    borderWidth: 1,
    borderColor: '#F0D6C1',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#4A2B1A',
    fontSize: 16,
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: '#FF8C00',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  dangerButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F4B6B0',
    backgroundColor: '#FFF4F2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  dangerButtonText: {
    color: '#B42318',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default WalletsScreen;
