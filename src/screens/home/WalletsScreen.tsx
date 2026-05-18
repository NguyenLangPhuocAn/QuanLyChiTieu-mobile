import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowLeft, ChevronRight, Ellipsis, MoreHorizontal, Plus } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Colors } from '../../constants/Colors';
import { CURRENCY_OPTIONS } from '../../constants/currencies';
import { WALLET_TYPES, getWalletTypeMeta, type WalletType } from '../../constants/walletTypes';
import { useAuth } from '../../context/AuthContext';
import { walletsService } from '../../services/wallets';
import type { Wallet } from '../../types/wallet';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency } from '../../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Wallets'>;

const formatAmountInput = (value: string) => {
  const numericValue = value.replace(/\D/g, '');

  if (!numericValue) {
    return '';
  }

  return Number(numericValue).toLocaleString('en-US');
};

const getPlainAmount = (value: string) => value.replace(/,/g, '');

const WalletsScreen = ({ navigation, route }: Props) => {
  const { token, user } = useAuth();
  const { preferredCurrency, transactions } = useFinance();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingWallet, setIsSavingWallet] = useState(false);
  const [isWalletModalVisible, setIsWalletModalVisible] = useState(false);
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [walletName, setWalletName] = useState('');
  const [walletBalance, setWalletBalance] = useState('');
  const [walletBudget, setWalletBudget] = useState('');
  const [walletCurrency, setWalletCurrency] = useState('VND');
  const [walletType, setWalletType] = useState<WalletType>('CASH');
  const selectedCurrency = useMemo(
    () => CURRENCY_OPTIONS.find(item => item.code === walletCurrency) ?? CURRENCY_OPTIONS[0],
    [walletCurrency],
  );

  const fetchWallets = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await walletsService.getAll(token);
      setWallets(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách và.';
      Alert.alert('Lỗi tải ví', message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

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
        (sum, wallet) => sum + Number(wallet.display_balance ?? wallet.balance ?? 0),
        0,
      ),
    [wallets],
  );

  const openCreateWalletModal = () => {
    setEditingWallet(null);
    setWalletName('');
    setWalletBalance('');
    setWalletBudget('');
    setWalletCurrency(user?.currency_default ?? 'VND');
    setWalletType('CASH');
    setIsWalletModalVisible(true);
  };

  const openEditWalletModal = (wallet: Wallet) => {
    setEditingWallet(wallet);
    setWalletName(wallet.name);
    setWalletBalance(formatAmountInput(String(wallet.balance ?? 0)));
    setWalletBudget(wallet.budget_limit ? formatAmountInput(String(wallet.budget_limit)) : '');
    setWalletCurrency(wallet.currency ?? 'VND');
    setWalletType(wallet.wallet_type ?? 'CASH');
    setIsWalletModalVisible(true);
  };

  const handleSaveWallet = async () => {
    if (!token) {
      return;
    }

    if (!walletName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên ví.');
      return;
    }

    setIsSavingWallet(true);

    try {
      if (editingWallet) {
        await walletsService.update(token, editingWallet.id, {
          name: walletName.trim(),
          balance: getPlainAmount(walletBalance.trim()) || '0',
          budget_limit: getPlainAmount(walletBudget.trim()) || undefined,
          currency: walletCurrency,
          wallet_type: walletType,
        });
      } else {
        await walletsService.create(token, {
          name: walletName.trim(),
          balance: getPlainAmount(walletBalance.trim()) || '0',
          budget_limit: getPlainAmount(walletBudget.trim()) || undefined,
          currency: walletCurrency,
          wallet_type: walletType,
        });
      }

      await fetchWallets();
      setIsWalletModalVisible(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu ví.';
      Alert.alert('Lưu ví thất bại', message);
    } finally {
      setIsSavingWallet(false);
    }
  };

  const walletLimitText =
    user?.role === 'PREMIUM' || user?.role === 'ADMIN'
      ? 'Tài khoản Premium được tạo không giới hạn số ví.'
      : 'Tài khoản Basic hiện được tạo tối đa 2 ví.';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Ví</Text>

        <TouchableOpacity style={styles.headerButton} onPress={() => setIsInfoModalVisible(true)}>
          <Ellipsis size={22} color="#593420" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Tổng số dư ví</Text>
          <Text style={styles.summaryBalance}>{formatCurrency(totalBalance, preferredCurrency)}</Text>

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

        {isLoading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : wallets.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Bạn chưa có ví nào</Text>
            <Text style={styles.emptyText}>
              Tạo ví đầu tiên để bắt đầu theo dõi số dư, ngân sách và giao dịch.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={openCreateWalletModal}>
              <Text style={styles.primaryButtonText}>Tạo ví đầu tiên</Text>
            </TouchableOpacity>
          </View>
        ) : (
          wallets.map(wallet => {
            const typeMeta = getWalletTypeMeta(wallet.wallet_type);
            const WalletTypeIcon = typeMeta.Icon;
            const walletTransactions = transactions.filter(transaction => transaction.walletId === wallet.id);
            const budgetLimit = Number(wallet.budget_limit ?? 0);
            const monthExpense = walletTransactions
              .filter(transaction => {
                const date = new Date(transaction.date);
                const now = new Date();

                return (
                  transaction.type === 'expense' &&
                  date.getFullYear() === now.getFullYear() &&
                  date.getMonth() === now.getMonth()
                );
              })
              .reduce((sum, transaction) => sum + transaction.displayAmount, 0);
            const budgetProgress = budgetLimit > 0 ? Math.min(100, (monthExpense / budgetLimit) * 100) : 0;

            return (
            <TouchableOpacity
              key={wallet.id}
              style={styles.walletCard}
              onPress={() =>
                navigation.navigate('WalletTransactions', {
                  walletId: wallet.id,
                  walletName: wallet.name,
                })
              }>
              <ImageBackground
                source={typeMeta.background}
                imageStyle={styles.walletCardBackground}
                style={styles.walletCardBackgroundWrap}>
                <View style={styles.walletIconBox}>
                  <WalletTypeIcon size={22} color={Colors.white} />
                </View>

                <View style={styles.walletInfo}>
                  <View style={styles.walletTitleRow}>
                    <Text style={styles.walletName}>{wallet.name}</Text>
                    <View style={styles.walletTypeBadge}>
                      <Text style={styles.walletTypeText}>{typeMeta.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.walletBalance}>
                    {formatCurrency(Number(wallet.balance || 0), wallet.currency)}
                  </Text>
                  <Text style={styles.walletCurrency}>{wallet.currency}</Text>
                  <View style={styles.walletMiniStats}>
                    <Text style={styles.walletMiniText}>{walletTransactions.length} giao dịch</Text>
                    {budgetLimit > 0 ? (
                      <Text style={styles.walletMiniText}>
                        {Math.round(budgetProgress)}% ngân sách
                      </Text>
                    ) : null}
                  </View>
                  {budgetLimit > 0 ? (
                    <View style={styles.walletBudgetTrack}>
                      <View
                        style={[
                          styles.walletBudgetFill,
                          budgetProgress >= 100
                            ? styles.walletBudgetDanger
                            : budgetProgress >= 80
                              ? styles.walletBudgetWarn
                              : null,
                          { width: `${Math.max(5, budgetProgress)}%` },
                        ]}
                      />
                    </View>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={styles.walletMenuButton}
                  onPress={() => openEditWalletModal(wallet)}>
                  <MoreHorizontal size={20} color={Colors.white} />
                </TouchableOpacity>
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
          style={styles.modalBackdrop}>
          <Pressable style={styles.backdropPressable} onPress={() => setIsWalletModalVisible(false)} />
          <Pressable style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{editingWallet ? 'Sửa ví' : 'Thêm ví mới'}</Text>

            <Text style={styles.inputLabel}>Loại ví</Text>
            <View style={styles.typeGrid}>
              {WALLET_TYPES.map(item => {
                const TypeIcon = item.Icon;
                const active = walletType === item.value;

                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.typeCard, active && styles.typeCardActive]}
                    onPress={() => setWalletType(item.value)}>
                    <ImageBackground
                      source={item.background}
                      imageStyle={styles.typeCardBackground}
                      style={styles.typeCardBackgroundWrap}>
                      <View style={styles.typeIconCircle}>
                        <TypeIcon size={20} color={Colors.white} />
                      </View>
                      <Text style={styles.typeLabel}>{item.label}</Text>
                      <Text style={styles.typeDescription}>{item.description}</Text>
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
                  keyboardType="numeric"
                  value={walletBalance}
                  onChangeText={value => setWalletBalance(formatAmountInput(value))}
                />
              </>
            ) : (
              <>
                <Text style={styles.inputLabel}>Số dư ban đầu</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="numeric"
                  value={walletBalance}
                  onChangeText={value => setWalletBalance(formatAmountInput(value))}
                />
              </>
            )}

            <Text style={styles.inputLabel}>Hạn mức chi tiêu</Text>
            <TextInput
              style={styles.input}
              placeholder="Không bắt buộc"
              keyboardType="numeric"
              value={walletBudget}
              onChangeText={value => setWalletBudget(formatAmountInput(value))}
            />

            <Text style={styles.inputLabel}>Tiền tệ của ví</Text>
            <TouchableOpacity
              style={styles.currencySelect}
              onPress={() =>
                navigation.navigate('CurrencyPicker', {
                  selectedCurrency: walletCurrency,
                  returnTo: 'Wallets',
                })
              }>
              <View>
                <Text style={styles.currencyCode}>{selectedCurrency.code}</Text>
                <Text style={styles.currencyLabel}>{selectedCurrency.label}</Text>
              </View>
              <ChevronRight size={22} color="#9A765B" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryButton} onPress={handleSaveWallet}>
              {isSavingWallet ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Lưu ví</Text>
              )}
            </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal transparent visible={isInfoModalVisible} animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setIsInfoModalVisible(false)}>
          <Pressable style={styles.infoCard}>
            <Text style={styles.modalTitle}>Ví là gì?</Text>
            <Text style={styles.infoText}>
              Ví là nơi gom và quản lý tiền theo từng mục đích. Bạn có thể dùng ví để tách tiền
              mặt, tài khoản ngân hàng, quỹ tiết kiệm hoặc khoản chi riêng.
            </Text>
            <Text style={styles.infoText}>{walletLimitText}</Text>
            <Text style={styles.infoText}>
              Khi có nhiều ví, bạn sẽ xem được tổng số dư và chọn đúng ví cho từng giao dịch.
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
  walletBudgetTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.24)',
    marginTop: 9,
    overflow: 'hidden',
  },
  walletBudgetFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  walletBudgetWarn: {
    backgroundColor: '#FFE2A8',
  },
  walletBudgetDanger: {
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
});

export default WalletsScreen;
