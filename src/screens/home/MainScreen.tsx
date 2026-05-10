import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChartColumnBig, History, MessageCircleMore, Plus, UserRound } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import OverviewScreen from './OverviewScreen';
import HistoryScreen from './HistoryScreen';
import ChatbotScreen from './ChatbotScreen';
import AccountScreen from './AccountScreen';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { categoriesService } from '../../services/categories';
import { transactionsService } from '../../services/transactions';
import { walletsService } from '../../services/wallets';
import { buildWalletBudgetAlerts } from '../../utils/budgetAlerts';
import { formatCurrency } from '../../utils/format';
import type { TransactionItem } from '../../data/mockTransactions';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { ApiTransaction } from '../../types/transaction';
import type { Wallet } from '../../types/wallet';

type TabKey = 'overview' | 'history' | 'chatbot' | 'account';

const tabs: Array<{
  key: TabKey;
  label: string;
  icon: typeof ChartColumnBig;
}> = [
  { key: 'overview', label: 'Tổng quan', icon: ChartColumnBig },
  { key: 'history', label: 'Lịch sử', icon: History },
  { key: 'chatbot', label: 'Chatbot', icon: MessageCircleMore },
  { key: 'account', label: 'Tài khoản', icon: UserRound },
];

const formatAmountInput = (value: string) => {
  const digits = value.replace(/[^\d]/g, '');

  if (!digits) {
    return '';
  }

  return new Intl.NumberFormat('en-US').format(Number(digits));
};

const normalizeAmountInput = (value: string) => value.replace(/[^\d]/g, '');

const buildReceiptUploadFile = (uri: string, transactionId: number) => {
  const trimmedUri = uri.trim();
  const extension = trimmedUri.split('?')[0].split('.').pop()?.toLowerCase();
  const mimeByExtension: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  const type = extension ? mimeByExtension[extension] : undefined;

  if (!trimmedUri) {
    return null;
  }

  if (!type) {
    throw new Error('Ảnh hóa đơn chỉ hỗ trợ JPG, PNG hoặc WEBP.');
  }

  return {
    uri: trimmedUri,
    name: `receipt-${transactionId}.${extension === 'jpeg' ? 'jpg' : extension}`,
    type,
  };
};

const mapApiTransactions = (
  apiTransactions: ApiTransaction[],
  currentWallets: Wallet[],
): TransactionItem[] => {
  const walletMap = new Map(currentWallets.map(wallet => [wallet.id, wallet]));

  return apiTransactions.map(transaction => {
    const wallet = walletMap.get(transaction.wallet_id);

    return {
      id: String(transaction.id),
      walletId: transaction.wallet_id,
      categoryId: transaction.category_id,
      categoryIcon: transaction.category?.icon ?? null,
      receiptImage: transaction.receipt_image ?? null,
    note: transaction.note || 'Không có ghi chú',
      category:
      transaction.category?.name || (transaction.type === 'INCOME' ? 'Thu nhập' : 'Chi tiêu'),
    wallet: wallet?.name || 'Ví',
      currency: transaction.currency || wallet?.currency || 'VND',
      displayAmount: Number(transaction.display_amount ?? transaction.amount),
      displayCurrency:
      transaction.display_currency || wallet?.display_currency || 'VND',
      type: transaction.type === 'INCOME' ? 'income' : 'expense',
      amount: Number(transaction.amount),
      date: transaction.transaction_date,
    };
  });
};

const MainScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, user } = useAuth();
  const {
    categories,
    preferredCurrency,
    setPreferredCurrency,
    selectedTransactionCategory,
    setCategories,
    setSelectedTransactionCategory,
    setTransactions,
    transactions,
  } = useFinance();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionNote, setTransactionNote] = useState('');
  const [receiptImageUri, setReceiptImageUri] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState<number | null>(null);
  const shouldReopenTransactionForm = useRef(false);

  const fetchDashboardData = useCallback(async () => {
    if (!token) {
      return;
    }

    setRefreshing(true);

    try {
      const [nextWallets, nextTransactions, nextCategories] = await Promise.all([
        walletsService.getAll(token),
        transactionsService.getAll(token),
        categoriesService.getAll(token),
      ]);

      setWallets(nextWallets);
      setCategories(nextCategories);
      setTransactions(mapApiTransactions(nextTransactions, nextWallets));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải dữ liệu.';
      Alert.alert('Không tải được dữ liệu', message);
    } finally {
      setRefreshing(false);
    }
  }, [setCategories, setTransactions, token]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (user?.currency_default) {
      setPreferredCurrency(user.currency_default as 'VND' | 'USD' | 'EUR' | 'JPY');
    }
  }, [setPreferredCurrency, user?.currency_default]);

  useEffect(() => {
    if (wallets.length > 0 && selectedWalletId === null) {
      setSelectedWalletId(wallets[0].id);
    }
  }, [wallets, selectedWalletId]);

  useEffect(() => {
    if (!selectedTransactionCategory && categories.length > 0) {
      setSelectedTransactionCategory(categories[0]);
    }
  }, [categories, selectedTransactionCategory, setSelectedTransactionCategory]);

  useFocusEffect(
    useCallback(() => {
      if (shouldReopenTransactionForm.current) {
        shouldReopenTransactionForm.current = false;
        setIsModalVisible(true);
      }
    }, []),
  );

  const selectedWallet = useMemo(
    () => wallets.find(wallet => wallet.id === selectedWalletId) ?? null,
    [selectedWalletId, wallets],
  );

  const resetTransactionForm = () => {
    setTransactionAmount('');
    setTransactionNote('');
    setReceiptImageUri('');
    setSelectedWalletId(wallets[0]?.id ?? null);
  };

  const openCategoryPicker = () => {
    shouldReopenTransactionForm.current = true;
    setIsModalVisible(false);
    navigation.navigate('Categories', { selectMode: true });
  };

  const showBudgetAlertIfNeeded = (
    wallet: Wallet,
    amount: number,
    transactionType: 'income' | 'expense',
  ) => {
    const signedAmount = transactionType === 'income' ? amount : -amount;
    const predictedWallet: Wallet = {
      ...wallet,
      balance: Number(wallet.balance || 0) + signedAmount,
    };
    const predictedTransaction: TransactionItem = {
      id: 'pending-alert',
      walletId: wallet.id,
      wallet: wallet.name,
      category: selectedTransactionCategory?.name ?? 'Giao dịch',
      currency: wallet.currency,
      displayAmount: amount,
      displayCurrency: wallet.currency,
      note: transactionNote.trim() || 'Giao dịch mới',
      type: transactionType,
      amount,
      date: new Date().toISOString(),
    };
    const [alert] = buildWalletBudgetAlerts(
      [predictedWallet],
      [...transactions, predictedTransaction],
    );

    if (!alert) {
      return;
    }

    const budgetLine = alert.budgetLimit
      ? `\nĐã chi ${formatCurrency(alert.monthExpense, wallet.currency)} / ${formatCurrency(alert.budgetLimit, wallet.currency)} trong tháng này.`
      : '';

    Alert.alert('Cảnh báo ngân sách', `${alert.walletName}: ${alert.reasons.join(' · ')}.${budgetLine}`);
  };

  const handleSaveTransaction = async () => {
    const normalizedAmount = normalizeAmountInput(transactionAmount);

    if (!normalizedAmount) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập số tiền giao dịch.');
      return;
    }

    if (!selectedWallet) {
      Alert.alert('Chưa có ví', 'Hãy tạo ít nhất một ví trước khi thêm giao dịch.');
      return;
    }

    if (!selectedTransactionCategory) {
      Alert.alert('Chưa có danh mục', 'Vui lòng chọn danh mục thu hoặc chi cho giao dịch.');
      return;
    }

    if (!token) {
      return;
    }

    const amount = Number(normalizedAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Số tiền chưa hợp lệ', 'Vui lòng nhập số tiền lớn hơn 0.');
      return;
    }

    const transactionType = selectedTransactionCategory.type === 'INCOME' ? 'income' : 'expense';

    try {
      const createdTransaction = await transactionsService.create(token, {
        wallet_id: selectedWallet.id,
        category_id: selectedTransactionCategory.id,
        amount: normalizedAmount,
        type: selectedTransactionCategory.type,
        note: transactionNote.trim() || undefined,
      });

      if (receiptImageUri.trim()) {
        const receiptFile = buildReceiptUploadFile(receiptImageUri, createdTransaction.id);

        if (receiptFile) {
          await transactionsService.uploadReceipt(token, createdTransaction.id, receiptFile);
        }
      }

      await fetchDashboardData();
      showBudgetAlertIfNeeded(selectedWallet, amount, transactionType);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu giao dịch.';
      Alert.alert('Lưu giao dịch thất bại', message);
      return;
    }

    setIsModalVisible(false);
    resetTransactionForm();
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewScreen
            wallets={wallets}
            refreshing={refreshing}
            onRefresh={fetchDashboardData}
          />
        );
      case 'history':
        return <HistoryScreen wallets={wallets} categories={categories} onRefresh={fetchDashboardData} />;
      case 'chatbot':
        return <ChatbotScreen />;
      case 'account':
        return <AccountScreen />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>{renderContent()}</View>

      <Modal transparent visible={isModalVisible} animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setIsModalVisible(false)}>
          <Pressable style={styles.modalShell}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Thêm giao dịch</Text>
              <Text style={styles.fieldLabel}>Trạng thái</Text>
              <View
                style={[
                  styles.typeBadge,
                  selectedTransactionCategory?.type === 'INCOME'
                    ? styles.incomeBadge
                    : styles.expenseBadge,
                ]}>
                <Text
                  style={[
                    styles.typeBadgeText,
                    selectedTransactionCategory?.type === 'INCOME'
                      ? styles.incomeBadgeText
                      : styles.expenseBadgeText,
                  ]}>
                  {selectedTransactionCategory?.type === 'INCOME' ? 'Khoản thu' : 'Khoản chi'}
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Số tiền</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={transactionAmount}
                onChangeText={value => setTransactionAmount(formatAmountInput(value))}
              />

              <Text style={styles.fieldLabel}>Danh mục</Text>
              <TouchableOpacity style={styles.selectorButton} onPress={openCategoryPicker}>
                <Text style={styles.selectorText}>
                  {selectedTransactionCategory?.name ?? 'Chọn danh mục thu/chi'}
                </Text>
                <Text style={styles.selectorHint}>Đổi</Text>
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Ví</Text>
              {selectedWallet ? (
                <Text style={styles.walletCurrencyHint}>
                  Giao dịch này sẽ dùng tiền tệ của ví: {selectedWallet.currency}
                </Text>
              ) : null}
              <View style={styles.optionWrap}>
                {wallets.map(wallet => (
                  <TouchableOpacity
                    key={wallet.id}
                    style={[
                      styles.optionChip,
                      selectedWalletId === wallet.id && styles.optionChipActive,
                    ]}
                    onPress={() => setSelectedWalletId(wallet.id)}>
                    <Text
                      style={[
                        styles.optionChipText,
                        selectedWalletId === wallet.id && styles.optionChipTextActive,
                      ]}>
                      {wallet.name} · {wallet.currency}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {wallets.length === 0 && (
                <Text style={styles.emptyWalletText}>
                  Bạn cần tạo ví trước khi lưu giao dịch.
                </Text>
              )}

              <Text style={styles.fieldLabel}>Ghi chú</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Ví dụ: ăn trưa, nhận lương, mua đồ dùng..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={transactionNote}
                onChangeText={setTransactionNote}
              />

              <Text style={styles.fieldLabel}>Ảnh hóa đơn</Text>
              <TextInput
                style={styles.input}
                placeholder="URI ảnh JPG, PNG hoặc WEBP"
                value={receiptImageUri}
                onChangeText={setReceiptImageUri}
                autoCapitalize="none"
              />
              {receiptImageUri ? (
                <TouchableOpacity
                  style={styles.clearReceiptButton}
                  onPress={() => setReceiptImageUri('')}>
                  <Text style={styles.clearReceiptText}>Bỏ ảnh hóa đơn</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity style={styles.primaryButton} onPress={handleSaveTransaction}>
                <Text style={styles.primaryButtonText}>Lưu giao dịch</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.bottomBar}>
        <View style={styles.navContent}>
          {tabs.slice(0, 2).map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;

            return (
              <TouchableOpacity
                key={item.key}
                style={styles.tabButton}
                onPress={() => setActiveTab(item.key)}>
                <Icon size={20} color={isActive ? '#F28C28' : '#B58A67'} />
                <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.fab} onPress={() => setIsModalVisible(true)}>
            <Plus size={28} color={Colors.white} />
          </TouchableOpacity>

          {tabs.slice(2).map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;

            return (
              <TouchableOpacity
                key={item.key}
                style={styles.tabButton}
                onPress={() => setActiveTab(item.key)}>
                <Icon size={20} color={isActive ? '#F28C28' : '#B58A67'} />
                <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
  },
  content: {
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFDFB',
    borderTopWidth: 1,
    borderColor: '#F0D5BE',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 12,
    paddingBottom: 18,
    paddingHorizontal: 12,
  },
  navContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabLabel: {
    color: '#B58A67',
    fontSize: 11,
    fontWeight: '600',
  },
  activeTabLabel: {
    color: '#F28C28',
  },
  fab: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#F28C28',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -30,
    shadowColor: '#D96D08',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(42, 24, 12, 0.28)',
    justifyContent: 'flex-end',
  },
  modalShell: {
    backgroundColor: '#FFFDFB',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  modalTitle: {
    color: '#4C2A18',
    fontSize: 22,
    fontWeight: '800',
  },
  modalDescription: {
    color: '#8A623F',
    marginTop: 8,
    lineHeight: 22,
    marginBottom: 10,
  },
  fieldLabel: {
    color: '#7B5234',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  incomeBadge: {
    backgroundColor: '#FFF1E3',
  },
  expenseBadge: {
    backgroundColor: '#FFE9DB',
  },
  typeBadgeText: {
    fontWeight: '700',
  },
  incomeBadgeText: {
    color: '#E77700',
  },
  expenseBadgeText: {
    color: '#C75A1B',
  },
  input: {
    backgroundColor: '#FFF6EF',
    borderWidth: 1,
    borderColor: '#F2D9C0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#4C2A18',
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 96,
  },
  selectorButton: {
    backgroundColor: '#FFF1E3',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F2D9C0',
  },
  selectorText: {
    color: '#4C2A18',
    fontSize: 16,
    fontWeight: '700',
  },
  selectorHint: {
    color: '#F28C28',
    fontWeight: '800',
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionChip: {
    backgroundColor: '#FFF1E3',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionChipActive: {
    backgroundColor: '#F28C28',
  },
  optionChipText: {
    color: '#8A623F',
    fontWeight: '700',
  },
  optionChipTextActive: {
    color: Colors.white,
  },
  emptyWalletText: {
    color: '#C75A1B',
    marginTop: 10,
    lineHeight: 20,
  },
  walletCurrencyHint: {
    color: '#8A623F',
    marginBottom: 8,
    lineHeight: 20,
  },
  clearReceiptButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderRadius: 999,
    backgroundColor: '#FFE3C8',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  clearReceiptText: {
    color: '#A94F18',
    fontWeight: '800',
  },
  primaryButton: {
    backgroundColor: '#F28C28',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 22,
  },
  primaryButtonText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 16,
  },
});

export default MainScreen;
