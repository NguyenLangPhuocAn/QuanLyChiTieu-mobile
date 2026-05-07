import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';
import CategoryIcon from '../../components/CategoryIcon';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import type { TransactionItem } from '../../data/mockTransactions';
import { transactionsService } from '../../services/transactions';
import type { Category } from '../../types/category';
import type { Wallet } from '../../types/wallet';
import { formatCurrency, formatDisplayDate } from '../../utils/format';

type HistoryScreenProps = {
  wallets?: Wallet[];
  categories?: Category[];
  onRefresh?: () => Promise<void> | void;
};

const formatAmountInput = (value: string) => {
  const numericValue = value.replace(/\D/g, '');

  if (!numericValue) {
    return '';
  }

  return Number(numericValue).toLocaleString('en-US');
};

const getPlainAmount = (value: string) => value.replace(/,/g, '');

const HistoryScreen = ({ wallets = [], categories = [], onRefresh }: HistoryScreenProps) => {
  const { token } = useAuth();
  const { transactions, preferredCurrency } = useFinance();
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionItem | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editWalletId, setEditWalletId] = useState<number | null>(null);
  const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const summary = useMemo(
    () =>
      transactions.reduce(
        (total, item) => {
          if (item.type === 'income') {
            total.income += item.amount;
          } else {
            total.expense += item.amount;
          }

          return total;
        },
        { income: 0, expense: 0 },
      ),
    [transactions],
  );

  const selectedCategory = categories.find(category => category.id === editCategoryId);
  const selectedType = selectedCategory?.type ?? (selectedTransaction?.type === 'income' ? 'INCOME' : 'EXPENSE');
  const filteredCategories = categories.filter(category => category.type === selectedType);

  const openEditModal = (item: TransactionItem) => {
    const transactionId = Number(item.id);

    if (!Number.isFinite(transactionId)) {
      Alert.alert('Thông báo', 'Giao dịch này chưa đồng bộ nên chưa thể chỉnh sửa.');
      return;
    }

    setSelectedTransaction(item);
    setEditAmount(formatAmountInput(String(item.amount)));
    setEditNote(item.note === 'Không có ghi chú' ? '' : item.note);
    setEditWalletId(item.walletId ?? wallets[0]?.id ?? null);
    setEditCategoryId(item.categoryId ?? categories.find(category => category.name === item.category)?.id ?? null);
  };

  const closeEditModal = () => {
    setSelectedTransaction(null);
    setEditAmount('');
    setEditNote('');
    setEditWalletId(null);
    setEditCategoryId(null);
  };

  const handleSaveTransaction = async () => {
    if (!token || !selectedTransaction) {
      Alert.alert('Thông báo', 'Vui lòng đăng nhập lại để cập nhật giao dịch.');
      return;
    }

    if (!editWalletId || !editCategoryId || !getPlainAmount(editAmount)) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn ví, danh mục và nhập số tiền.');
      return;
    }

    const transactionId = Number(selectedTransaction.id);
    const category = categories.find(item => item.id === editCategoryId);

    if (!Number.isFinite(transactionId) || !category) {
      Alert.alert('Thông báo', 'Không tìm thấy giao dịch hoặc danh mục cần cập nhật.');
      return;
    }

    setIsSaving(true);

    try {
      // Backend lưu thu/chi theo type INCOME/EXPENSE, nên type luôn đi theo danh mục đang chọn.
      await transactionsService.update(token, transactionId, {
        wallet_id: editWalletId,
        category_id: editCategoryId,
        amount: getPlainAmount(editAmount),
        type: category.type,
        note: editNote.trim() || undefined,
      });
      await onRefresh?.();
      closeEditModal();
    } catch (error) {
      Alert.alert('Không thể cập nhật', error instanceof Error ? error.message : 'Vui lòng thử lại sau.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTransaction = () => {
    if (!token || !selectedTransaction) {
      return;
    }

    const transactionId = Number(selectedTransaction.id);

    if (!Number.isFinite(transactionId)) {
      Alert.alert('Thông báo', 'Giao dịch này chưa đồng bộ nên chưa thể xóa.');
      return;
    }

    Alert.alert('Xóa giao dịch', 'Bạn có chắc muốn xóa giao dịch này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          setIsSaving(true);

          try {
            await transactionsService.remove(token, transactionId);
            await onRefresh?.();
            closeEditModal();
          } catch (error) {
            Alert.alert('Không thể xóa', error instanceof Error ? error.message : 'Vui lòng thử lại sau.');
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Lịch sử thu chi</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Tổng thu</Text>
            <Text style={styles.incomeSummary}>{formatCurrency(summary.income, preferredCurrency)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Tổng chi</Text>
            <Text style={styles.expenseSummary}>{formatCurrency(summary.expense, preferredCurrency)}</Text>
          </View>
        </View>

        {transactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Chưa có giao dịch</Text>
          </View>
        ) : (
          transactions.map(item => (
            <TouchableOpacity key={item.id} style={styles.card} activeOpacity={0.86} onPress={() => openEditModal(item)}>
              <View style={styles.iconBox}>
                <CategoryIcon icon={item.categoryIcon} size={18} />
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle}>{item.note}</Text>
                <Text style={styles.meta}>
                  {item.category} • {item.wallet}
                </Text>
                <Text style={styles.meta}>{formatDisplayDate(item.date)}</Text>
              </View>
              <View style={styles.amountColumn}>
                <Text style={item.type === 'income' ? styles.income : styles.expense}>
                  {item.type === 'income' ? '+' : '-'}
                  {formatCurrency(item.amount, preferredCurrency)}
                </Text>
                <MoreHorizontal size={20} color="#B57745" />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={Boolean(selectedTransaction)} transparent animationType="slide" onRequestClose={closeEditModal}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.backdropPressable} onPress={closeEditModal} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sửa giao dịch</Text>

            <Text style={styles.fieldLabel}>Số tiền</Text>
            <TextInput
              value={editAmount}
              onChangeText={value => setEditAmount(formatAmountInput(value))}
              placeholder="50,000"
              keyboardType="numeric"
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Ví</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {wallets.map(wallet => (
                <TouchableOpacity
                  key={wallet.id}
                  style={[styles.chip, editWalletId === wallet.id && styles.activeChip]}
                  onPress={() => setEditWalletId(wallet.id)}>
                  <Text style={[styles.chipText, editWalletId === wallet.id && styles.activeChipText]}>{wallet.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Danh mục</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {filteredCategories.map(category => (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.chip, editCategoryId === category.id && styles.activeChip]}
                  onPress={() => setEditCategoryId(category.id)}>
                  <View style={styles.chipContent}>
                    <CategoryIcon icon={category.icon} size={16} />
                    <Text style={[styles.chipText, editCategoryId === category.id && styles.activeChipText]}>
                      {category.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Ghi chú</Text>
            <TextInput
              value={editNote}
              onChangeText={setEditNote}
              placeholder="Ví dụ: ăn trưa, đổ xăng..."
              style={[styles.input, styles.noteInput]}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteTransaction} disabled={isSaving}>
                <Text style={styles.deleteButtonText}>Xóa</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveTransaction} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveButtonText}>Lưu</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
  },
  content: {
    padding: 16,
    paddingBottom: 136,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#4C2A18',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 14,
  },
  summaryLabel: {
    color: '#8A623F',
    fontSize: 12,
    fontWeight: '700',
  },
  incomeSummary: {
    color: '#E77700',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  expenseSummary: {
    color: '#C75A1B',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 18,
  },
  emptyTitle: {
    color: '#4C2A18',
    fontSize: 18,
    fontWeight: '800',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.2,
    borderColor: '#E8B680',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    paddingRight: 8,
  },
  itemTitle: {
    color: '#4C2A18',
    fontWeight: '700',
    fontSize: 16,
  },
  meta: {
    color: '#8A623F',
    marginTop: 6,
  },
  amountColumn: {
    alignItems: 'flex-end',
    gap: 8,
  },
  income: {
    color: '#E77700',
    fontWeight: '800',
  },
  expense: {
    color: '#C75A1B',
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(42, 24, 12, 0.36)',
    justifyContent: 'flex-end',
  },
  backdropPressable: {
    flex: 1,
  },
  modalCard: {
    backgroundColor: '#FFF9F3',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: '#E8B680',
  },
  modalTitle: {
    color: '#4C2A18',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 14,
  },
  fieldLabel: {
    color: '#7A4A28',
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    color: '#4C2A18',
    fontWeight: '700',
  },
  noteInput: {
    minHeight: 86,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  chipRow: {
    gap: 10,
    paddingRight: 20,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E8B680',
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeChip: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    color: '#7A4A28',
    fontWeight: '800',
  },
  activeChipText: {
    color: Colors.white,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  deleteButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: '#D86B4C',
    backgroundColor: '#FFF2EE',
  },
  deleteButtonText: {
    color: '#C75A1B',
    fontWeight: '800',
  },
  saveButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  saveButtonText: {
    color: Colors.white,
    fontWeight: '800',
  },
});

export default HistoryScreen;
