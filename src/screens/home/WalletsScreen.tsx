import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowLeft, Ellipsis, MoreHorizontal, Plus, Wallet as WalletIcon } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { walletsService } from '../../services/wallets';
import type { Wallet } from '../../types/wallet';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency } from '../../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Wallets'>;

const WalletsScreen = ({ navigation }: Props) => {
  const { token, user } = useAuth();
  const { preferredCurrency } = useFinance();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingWallet, setIsSavingWallet] = useState(false);
  const [isWalletModalVisible, setIsWalletModalVisible] = useState(false);
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [walletName, setWalletName] = useState('');
  const [walletBalance, setWalletBalance] = useState('');
  const [walletBudget, setWalletBudget] = useState('');
  const [walletCurrency, setWalletCurrency] = useState<'VND' | 'USD' | 'EUR' | 'JPY'>('VND');

  const fetchWallets = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await walletsService.getAll(token);
      setWallets(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách ví.';
      Alert.alert('Lỗi tải ví', message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

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
    setWalletCurrency((user?.currency_default as 'VND' | 'USD' | 'EUR' | 'JPY') ?? 'VND');
    setIsWalletModalVisible(true);
  };

  const openEditWalletModal = (wallet: Wallet) => {
    setEditingWallet(wallet);
    setWalletName(wallet.name);
    setWalletBalance('');
    setWalletBudget(wallet.budget_limit ? String(wallet.budget_limit) : '');
    setWalletCurrency((wallet.currency as 'VND' | 'USD' | 'EUR' | 'JPY') ?? 'VND');
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
        // Khi sửa ví không gửi balance để số dư luôn khớp với lịch sử giao dịch.
        await walletsService.update(token, editingWallet.id, {
          name: walletName.trim(),
          budget_limit: walletBudget.trim() || undefined,
          currency: walletCurrency,
        });
      } else {
        await walletsService.create(token, {
          name: walletName.trim(),
          balance: walletBalance.trim() || '0',
          budget_limit: walletBudget.trim() || undefined,
          currency: walletCurrency,
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
    user?.role === 'PREMIUM'
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
          wallets.map(wallet => (
            <TouchableOpacity
              key={wallet.id}
              style={styles.walletCard}
              onPress={() =>
                navigation.navigate('WalletTransactions', {
                  walletId: wallet.id,
                  walletName: wallet.name,
                })
              }>
              <View style={styles.walletIconBox}>
                <WalletIcon size={22} color="#D9791F" />
              </View>

              <View style={styles.walletInfo}>
                <Text style={styles.walletName}>{wallet.name}</Text>
                <Text style={styles.walletBalance}>
                  {formatCurrency(Number(wallet.balance || 0), wallet.currency)}
                </Text>
                <Text style={styles.walletCurrency}>{wallet.currency}</Text>
              </View>

              <TouchableOpacity
                style={styles.walletMenuButton}
                onPress={() => openEditWalletModal(wallet)}>
                <MoreHorizontal size={20} color="#9C7255" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openCreateWalletModal}>
        <Plus size={26} color={Colors.white} />
      </TouchableOpacity>

      <Modal transparent visible={isWalletModalVisible} animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setIsWalletModalVisible(false)}>
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingWallet ? 'Sửa ví' : 'Thêm ví mới'}</Text>


            <Text style={styles.inputLabel}>Tên ví</Text>
            <TextInput
              style={styles.input}
              placeholder="Ví chính"
              value={walletName}
              onChangeText={setWalletName}
            />

            {editingWallet ? (
              <View style={styles.readOnlyBalanceCard}>
                <Text style={styles.readOnlyBalanceLabel}>Số dư hiện tại</Text>
                <Text style={styles.readOnlyBalanceValue}>
                  {formatCurrency(Number(editingWallet.balance || 0), editingWallet.currency)}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.inputLabel}>Số dư ban đầu</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="numeric"
                  value={walletBalance}
                  onChangeText={setWalletBalance}
                />
              </>
            )}

            <Text style={styles.inputLabel}>Hạn mức chi tiêu</Text>
            <TextInput
              style={styles.input}
              placeholder="Không bắt buộc"
              keyboardType="numeric"
              value={walletBudget}
              onChangeText={setWalletBudget}
            />

            <Text style={styles.inputLabel}>Tiền tệ của ví</Text>
            <View style={styles.currencyRow}>
              {(['VND', 'USD', 'EUR', 'JPY'] as const).map(item => (
                <TouchableOpacity
                  key={item}
                  style={[styles.currencyChip, walletCurrency === item && styles.currencyChipActive]}
                  onPress={() => setWalletCurrency(item)}>
                  <Text
                    style={[
                      styles.currencyChipText,
                      walletCurrency === item && styles.currencyChipTextActive,
                    ]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleSaveWallet}>
              {isSavingWallet ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Lưu ví</Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    marginBottom: 12,
    gap: 12,
  },
  walletIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#FFF0E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    color: '#4A2B1A',
    fontSize: 16,
    fontWeight: '800',
  },
  walletBalance: {
    color: '#D9791F',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 6,
  },
  walletCurrency: {
    color: '#8B6548',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  walletMenuButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF4EA',
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
    backgroundColor: 'rgba(36, 22, 12, 0.24)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFDFC',
    borderRadius: 22,
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#FFFDFC',
    borderRadius: 22,
    padding: 20,
    marginBottom: 24,
  },
  modalTitle: {
    color: '#4A2B1A',
    fontSize: 22,
    fontWeight: '800',
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
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  currencyChip: {
    backgroundColor: '#FFF8F2',
    borderWidth: 1,
    borderColor: '#F0D6C1',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  currencyChipActive: {
    backgroundColor: '#F28C28',
    borderColor: '#F28C28',
  },
  currencyChipText: {
    color: '#7B573C',
    fontWeight: '700',
  },
  currencyChipTextActive: {
    color: Colors.white,
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
    backgroundColor: '#F28C28',
    borderRadius: 12,
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
