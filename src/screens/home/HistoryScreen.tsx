import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image as ImageIcon, ImagePlus, MoreHorizontal, Search, WalletCards, X } from 'lucide-react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { launchImageLibrary } from 'react-native-image-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import CategoryIcon from '../../components/CategoryIcon';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import type { TransactionItem } from '../../data/mockTransactions';
import { transactionsService } from '../../services/transactions';
import { tagsService } from '../../services/tags';
import { mapApiTransactions } from '../../utils/mapTransactions';
import type { Category } from '../../types/category';
import type { Wallet } from '../../types/wallet';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { formatCurrency, formatDisplayDate } from '../../utils/format';
import { API_BASE_URLS } from '../../services/api';

type HistoryScreenProps = {
  wallets?: Wallet[];
  categories?: Category[];
  refreshing?: boolean;
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
const today = new Date();
const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
const parseDateKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return new Date();
  }

  return new Date(year, month - 1, day);
};
const defaultMonth = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, '0')}`;
const defaultDay = toDateKey(today);
const PAGE_SIZE = 10;
const parseTagsInput = (value: string) =>
  value
    .split(/[,\s]+/)
    .map(tag => tag.trim().replace(/^#+/, '').toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

type DateFilterMode = 'all' | 'day' | 'month' | 'year' | 'custom';
type TypeFilter = 'all' | 'income' | 'expense';
type DatePickerTarget = 'day' | 'from' | 'to' | 'edit' | null;
type ReceiptUploadFile = {
  uri: string;
  name: string;
  type: string;
};

const resolveReceiptUrl = (receipt?: string | null) => {
  if (!receipt) {
    return null;
  }

  if (receipt.startsWith('http://') || receipt.startsWith('https://')) {
    return receipt;
  }

  return `${API_BASE_URLS[0]}/uploads/receipts/${receipt}`;
};

const buildReceiptUploadFile = (file: ReceiptUploadFile | null, transactionId: number) => {
  if (!file) {
    return null;
  }

  const extension =
    file.name.split('?')[0].split('.').pop()?.toLowerCase() ??
    file.uri.split('?')[0].split('.').pop()?.toLowerCase();
  const mimeByExtension: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  const type = file.type || (extension ? mimeByExtension[extension] : undefined);

  if (!type || !['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(type)) {
    throw new Error('Ảnh hóa đơn chỉ hỗ trợ JPG, PNG hoặc WEBP.');
  }

  return {
    uri: file.uri,
    name: file.name || `receipt-${transactionId}.${extension === 'jpeg' ? 'jpg' : extension ?? 'jpg'}`,
    type,
  };
};

const HistoryScreen = ({ wallets = [], categories = [], refreshing = false, onRefresh }: HistoryScreenProps) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, user } = useAuth();
  const { preferredCurrency, selectedTransactionCategory, setSelectedTransactionCategory, setTags, tags } = useFinance();
  const [serverTransactions, setServerTransactions] = useState<TransactionItem[]>([]);
  const [serverMeta, setServerMeta] = useState({
    total: 0,
    totalPages: 1,
    income: 0,
    expense: 0,
    net: 0,
  });
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionItem | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editDate, setEditDate] = useState(defaultDay);
  const [editWalletId, setEditWalletId] = useState<number | null>(null);
  const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
  const [editType, setEditType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [newTagName, setNewTagName] = useState('');
  const [isTagModalVisible, setIsTagModalVisible] = useState(false);
  const [editReceiptFile, setEditReceiptFile] = useState<ReceiptUploadFile | null>(null);
  const [shouldRemoveReceipt, setShouldRemoveReceipt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<DatePickerTarget>(null);
  const [dateMode] = useState<DateFilterMode>('all');
  const [dayFilter, setDayFilter] = useState(defaultDay);
  const [monthFilter] = useState(defaultMonth);
  const [yearFilter] = useState(String(today.getFullYear()));
  const [fromDate, setFromDate] = useState(defaultDay);
  const [toDate, setToDate] = useState(defaultDay);
  const [walletFilter] = useState<number | null>(null);
  const [categoryFilter] = useState<number | null>(null);
  const [typeFilter] = useState<TypeFilter>('all');
  const [tagFilter] = useState('');
  const [searchText] = useState('');
  const [page, setPage] = useState(1);
  const shouldReopenEditForm = useRef(false);
  const hasPremiumFilters = user?.role === 'PREMIUM' || user?.role === 'ADMIN';

  const fetchTransactionPage = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsPageLoading(true);

    try {
      const response = await transactionsService.getPage(token, {
        page,
        limit: PAGE_SIZE,
      });
      setServerTransactions(mapApiTransactions(response.data, wallets));
      setServerMeta({
        total: response.meta.total,
        totalPages: response.meta.totalPages,
        income: response.meta.income ?? 0,
        expense: response.meta.expense ?? 0,
        net: response.meta.net ?? 0,
      });
    } catch (error) {
      Alert.alert('Không tải được lịch sử', error instanceof Error ? error.message : 'Vui lòng thử lại sau.');
    } finally {
      setIsPageLoading(false);
    }
  }, [page, token, wallets]);

  useEffect(() => {
    fetchTransactionPage();
  }, [fetchTransactionPage]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchTransactionPage(), onRefresh?.()]);
  }, [fetchTransactionPage, onRefresh]);

  const getPickerValue = () => {
    if (datePickerTarget === 'from') {
      return parseDateKey(fromDate);
    }

    if (datePickerTarget === 'to') {
      return parseDateKey(toDate);
    }

    if (datePickerTarget === 'edit') {
      return parseDateKey(editDate);
    }

    return parseDateKey(dayFilter);
  };

  const handleDatePickerChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    const target = datePickerTarget;
    setDatePickerTarget(null);

    if (!selectedDate || !target) {
      return;
    }

    const value = toDateKey(selectedDate);

    if (target === 'day') {
      setDayFilter(value);
      return;
    }

    if (target === 'from') {
      setFromDate(value);
      return;
    }

    if (target === 'to') {
      setToDate(value);
      return;
    }

    setEditDate(value);
  };

  const filteredTransactions = useMemo(() => {
    const normalizedTag = tagFilter.trim().replace(/^#+/, '').toLowerCase();
    const rangeStart = fromDate <= toDate ? fromDate : toDate;
    const rangeEnd = fromDate <= toDate ? toDate : fromDate;

    return serverTransactions.filter(item => {
      const normalizedSearch = searchText.trim().toLowerCase();
      const date = new Date(item.date);
      const dateKey = item.date.slice(0, 10);
      const monthKey = item.date.slice(0, 7);
      const yearKey = String(date.getFullYear());

      if (dateMode === 'day' && dateKey !== dayFilter) {
        return false;
      }

      if (dateMode === 'month' && monthKey !== monthFilter) {
        return false;
      }

      if (dateMode === 'year' && yearKey !== yearFilter) {
        return false;
      }

      if (dateMode === 'custom' && (dateKey < rangeStart || dateKey > rangeEnd)) {
        return false;
      }

      if (hasPremiumFilters && walletFilter && item.walletId !== walletFilter) {
        return false;
      }

      if (hasPremiumFilters && categoryFilter && item.categoryId !== categoryFilter) {
        return false;
      }

      if (hasPremiumFilters && typeFilter !== 'all' && item.type !== typeFilter) {
        return false;
      }

      if (normalizedTag && !(item.tags ?? []).some(tag => tag.toLowerCase().includes(normalizedTag))) {
        return false;
      }

      if (
        normalizedSearch &&
        ![item.note, item.category, item.wallet, ...(item.tags ?? []).map(tag => `#${tag}`)]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch)
      ) {
        return false;
      }

      return true;
    });
  }, [
    categoryFilter,
    dateMode,
    dayFilter,
    fromDate,
    hasPremiumFilters,
    monthFilter,
    searchText,
    tagFilter,
    toDate,
    serverTransactions,
    typeFilter,
    walletFilter,
    yearFilter,
  ]);

  const summary = {
    income: serverMeta.income,
    expense: serverMeta.expense,
  };
  const totalPages = serverMeta.totalPages;
  const paginatedTransactions = filteredTransactions;
  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, TransactionItem[]>();

    paginatedTransactions.forEach(transaction => {
      const key = transaction.date.slice(0, 10);
      groups.set(key, [...(groups.get(key) ?? []), transaction]);
    });

    return [...groups.entries()];
  }, [paginatedTransactions]);
  useEffect(() => {
    setPage(1);
  }, [
    categoryFilter,
    dateMode,
    dayFilter,
    fromDate,
    monthFilter,
    searchText,
    tagFilter,
    toDate,
    typeFilter,
    walletFilter,
    yearFilter,
  ]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const selectedCategory = categories.find(category => category.id === editCategoryId);
  const currentEditTags = useMemo(() => parseTagsInput(editTags), [editTags]);
  const recentHashtags = useMemo(() => {
    const usedTags = serverTransactions.flatMap(transaction => transaction.tags ?? []);
    return [...new Set([...usedTags, ...tags.map(tag => tag.name)])].slice(0, 10);
  }, [serverTransactions, tags]);

  useFocusEffect(
    useCallback(() => {
      if (shouldReopenEditForm.current && selectedTransaction) {
        shouldReopenEditForm.current = false;

        if (selectedTransactionCategory) {
          setEditCategoryId(selectedTransactionCategory.id);
          setEditType(selectedTransactionCategory.type);
        }
      }
    }, [selectedTransaction, selectedTransactionCategory]),
  );

  const openEditModal = (item: TransactionItem) => {
    const transactionId = Number(item.id);

    if (!Number.isFinite(transactionId)) {
      Alert.alert('Thông báo', 'Giao dịch này chưa đồng bộ nên chưa thể chỉnh sửa.');
      return;
    }

    setSelectedTransaction(item);
    setEditAmount(formatAmountInput(String(item.amount)));
    setEditNote(item.note === 'Không có ghi chú' ? '' : item.note);
    setEditTags((item.tags ?? []).map(tag => `#${tag}`).join(' '));
    setEditDate(item.date.slice(0, 10));
    setEditWalletId(item.walletId ?? wallets[0]?.id ?? null);
    const nextCategory = categories.find(category => category.id === item.categoryId) ?? categories.find(category => category.name === item.category);
    setEditCategoryId(nextCategory?.id ?? null);
    setEditType(nextCategory?.type ?? (item.type === 'income' ? 'INCOME' : 'EXPENSE'));
    setEditReceiptFile(null);
    setShouldRemoveReceipt(false);
  };

  const closeEditModal = () => {
    setSelectedTransaction(null);
    setEditAmount('');
    setEditNote('');
    setEditTags('');
    setEditDate(defaultDay);
    setEditWalletId(null);
    setEditCategoryId(null);
    setEditType('EXPENSE');
    setEditReceiptFile(null);
    setShouldRemoveReceipt(false);
  };

  const toggleEditTag = (tag: string) => {
    const normalized = tag.replace(/^#+/, '').toLowerCase();
    const nextTags = currentEditTags.includes(normalized)
      ? currentEditTags.filter(item => item !== normalized)
      : [...currentEditTags, normalized].slice(0, 8);

    setEditTags(nextTags.map(item => `#${item}`).join(' '));
  };

  const openEditCategoryPicker = () => {
    const currentCategory = categories.find(category => category.id === editCategoryId);

    if (currentCategory) {
      setSelectedTransactionCategory(currentCategory);
    }

    shouldReopenEditForm.current = true;
    navigation.navigate('Categories', { selectMode: true });
  };

  const handleEditTypeChange = (type: 'INCOME' | 'EXPENSE') => {
    setEditType(type);
    const nextCategory = categories.find(category => category.type === type);
    setEditCategoryId(nextCategory?.id ?? null);
  };

  const handleCreateQuickTag = async () => {
    if (!token) {
      return;
    }

    const normalized = newTagName.trim().replace(/^#+/, '').toLowerCase();

    if (!normalized) {
      Alert.alert('Thiếu hashtag', 'Nhập tên hashtag cần tạo.');
      return;
    }

    try {
      const nextTags = await tagsService.create(token, normalized);
      setTags(nextTags);
      toggleEditTag(normalized);
      setNewTagName('');
      setIsTagModalVisible(false);
    } catch (error) {
      Alert.alert('Chưa tạo được hashtag', error instanceof Error ? error.message : 'Vui lòng thử lại sau.');
    }
  };

  const handlePickEditReceipt = async () => {
    let result;

    try {
      result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 1,
      });
    } catch {
      Alert.alert('Chưa mở được thư viện ảnh', 'Vui lòng thử lại sau.');
      return;
    }

    if (result.didCancel) {
      return;
    }

    const asset = result.assets?.[0];

    if (!asset?.uri) {
      Alert.alert('Chưa chọn được ảnh', 'Vui lòng thử lại với ảnh JPG, PNG hoặc WEBP.');
      return;
    }

    const type = asset.type ?? 'image/jpeg';

    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(type)) {
      Alert.alert('Ảnh chưa hợp lệ', 'Ảnh hóa đơn chỉ hỗ trợ JPG, PNG hoặc WEBP.');
      return;
    }

    setEditReceiptFile({
      uri: asset.uri,
      name: asset.fileName ?? `receipt-${Date.now()}.${type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'}`,
      type,
    });
    setShouldRemoveReceipt(false);
  };

  const handleSaveTransaction = async () => {
    if (!token || !selectedTransaction) {
      Alert.alert('Thông báo', 'Vui lòng đăng nhập lại để cập nhật giao dịch.');
      return;
    }

    const plainAmount = getPlainAmount(editAmount);
    const numericAmount = Number(plainAmount);

    if (!editWalletId || !editCategoryId || !plainAmount) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn ví, danh mục và nhập số tiền.');
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      Alert.alert('Số tiền chưa hợp lệ', 'Vui lòng nhập số tiền lớn hơn 0.');
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
        amount: plainAmount,
        type: category.type,
        note: editNote.trim() || undefined,
        receipt_image: shouldRemoveReceipt && !editReceiptFile ? null : undefined,
        transaction_date: editDate,
        tags: parseTagsInput(editTags),
      });
      if (editReceiptFile) {
        const uploadFile = buildReceiptUploadFile(editReceiptFile, transactionId);

        if (uploadFile) {
          await transactionsService.uploadReceipt(token, transactionId, uploadFile);
        }
      }

      await Promise.all([fetchTransactionPage(), onRefresh?.()]);
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
            await Promise.all([fetchTransactionPage(), onRefresh?.()]);
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
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isPageLoading}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }>
        <View style={styles.historyHeader}>
          <Text style={styles.title}>Lịch sử thu chi</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerActionButton}
              activeOpacity={0.86}
              onPress={() => navigation.navigate('TransactionSearch', { wallets })}>
              <Search size={18} color="#A26B48" />
            </TouchableOpacity>
          </View>
        </View>

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

        {isPageLoading && filteredTransactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.emptyText}>Đang tải lịch sử giao dịch...</Text>
          </View>
        ) : filteredTransactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <WalletCards size={28} color="#D87219" />
            </View>
            <Text style={styles.emptyTitle}>Chưa có giao dịch phù hợp</Text>
            <Text style={styles.emptyText}>Thử đổi bộ lọc hoặc thêm giao dịch mới bằng nút +.</Text>
          </View>
        ) : (
          groupedTransactions.map(([dateKey, items]) => (
            <View key={dateKey} style={styles.dayGroup}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>{formatDisplayDate(dateKey)}</Text>
                <Text style={styles.dayCount}>{items.length} giao dịch</Text>
              </View>
              {items.map(item => (
                <TouchableOpacity key={item.id} style={styles.card} activeOpacity={0.86} onPress={() => openEditModal(item)}>
                  <View style={styles.iconBox}>
                    <CategoryIcon icon={item.categoryIcon} size={18} />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{item.note}</Text>
                    <Text style={styles.meta}>{item.category} · {item.wallet}</Text>
                    {(item.tags ?? []).length > 0 ? (
                      <View style={styles.tagRow}>
                        {(item.tags ?? []).slice(0, 3).map(tag => (
                          <Text key={tag} style={styles.tagText}>#{tag}</Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.amountColumn}>
                    <Text style={item.type === 'income' ? styles.income : styles.expense}>
                      {item.type === 'income' ? '+' : '-'}
                      {formatCurrency(item.amount, item.currency)}
                    </Text>
                    <MoreHorizontal size={20} color="#B57745" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
        {serverMeta.total > PAGE_SIZE ? (
          <View style={styles.paginationRow}>
            <TouchableOpacity
              style={[styles.pageButton, page === 1 && styles.pageButtonDisabled]}
              disabled={page === 1}
              onPress={() => setPage(current => Math.max(1, current - 1))}>
              <Text style={[styles.pageButtonText, page === 1 && styles.pageButtonTextDisabled]}>Trước</Text>
            </TouchableOpacity>
            <Text style={styles.pageMeta}>
              Trang {page}/{totalPages}
            </Text>
            <TouchableOpacity
              style={[styles.pageButton, page === totalPages && styles.pageButtonDisabled]}
              disabled={page === totalPages}
              onPress={() => setPage(current => Math.min(totalPages, current + 1))}>
              <Text style={[styles.pageButtonText, page === totalPages && styles.pageButtonTextDisabled]}>Sau</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={Boolean(selectedTransaction)} transparent animationType="slide" onRequestClose={closeEditModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}>
          <Pressable style={styles.backdropPressable} onPress={closeEditModal} />
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.modalTitleRow}>
              <TouchableOpacity style={styles.backButton} onPress={closeEditModal}>
                <Text style={styles.backButtonText}>Lùi</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Sửa giao dịch</Text>
            </View>

            <Text style={styles.fieldLabel}>Số tiền</Text>
            <TextInput
              value={editAmount}
              onChangeText={value => setEditAmount(formatAmountInput(value))}
              placeholder="50,000"
              keyboardType="numeric"
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Ngày giao dịch</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setDatePickerTarget('edit')}>
              <Text style={styles.dateButtonText}>{editDate}</Text>
              <Text style={styles.dateButtonHint}>Chọn ngày</Text>
            </TouchableOpacity>

            {datePickerTarget ? (
              <DateTimePicker value={getPickerValue()} mode="date" onChange={handleDatePickerChange} />
            ) : null}

            <Text style={styles.fieldLabel}>Ví</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {wallets.map(wallet => (
                <TouchableOpacity
                  key={wallet.id}
                  style={[styles.chip, editWalletId === wallet.id && styles.activeChip]}
                  onPress={() => setEditWalletId(wallet.id)}>
                  <Text style={[styles.chipText, editWalletId === wallet.id && styles.activeChipText]}>
                    {wallet.name} · {wallet.currency}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Danh mục</Text>
            <View style={styles.typeSegment}>
              {(['EXPENSE', 'INCOME'] as const).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeSegmentButton, editType === type && styles.typeSegmentButtonActive]}
                  onPress={() => handleEditTypeChange(type)}>
                  <Text style={[styles.typeSegmentText, editType === type && styles.typeSegmentTextActive]}>
                    {type === 'EXPENSE' ? 'Chi' : 'Thu'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.categorySelectCard} onPress={openEditCategoryPicker}>
              <View style={styles.categorySelectIcon}>
                <CategoryIcon icon={selectedCategory?.icon ?? null} size={20} />
              </View>
              <View style={styles.categorySelectCopy}>
                <Text style={styles.categorySelectName}>{selectedCategory?.name ?? 'Chọn danh mục'}</Text>
                <Text style={styles.categorySelectMeta}>{editType === 'INCOME' ? 'Khoản thu' : 'Khoản chi'}</Text>
              </View>
              <Text style={styles.selectorHint}>Đổi</Text>
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Ghi chú</Text>
            <TextInput
              value={editNote}
              onChangeText={setEditNote}
              placeholder="Ví dụ: ăn trưa, đổ xăng..."
              style={[styles.input, styles.noteInput]}
              multiline
            />

            <Text style={styles.fieldLabel}>Hashtag</Text>
            <View style={styles.hashtagHeaderRow}>
              <Text style={styles.optionalText}>Không bắt buộc</Text>
              <TouchableOpacity onPress={() => setIsTagModalVisible(true)}>
                <Text style={styles.selectorHint}>Thêm nhanh</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={editTags}
              onChangeText={setEditTags}
              placeholder="Ví dụ: #ăntrưa #côngviệc"
              style={styles.input}
              autoCapitalize="none"
            />
            {recentHashtags.length > 0 ? (
              <View style={styles.tagWrap}>
                {recentHashtags.map(tag => (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.suggestTagChip, currentEditTags.includes(tag) && styles.suggestTagChipActive]}
                    onPress={() => toggleEditTag(tag)}>
                    <Text style={[styles.suggestTagText, currentEditTags.includes(tag) && styles.suggestTagTextActive]}>
                      #{tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Ảnh hóa đơn</Text>
            {editReceiptFile ? (
              <View style={styles.receiptPreview}>
                <Image source={{ uri: editReceiptFile.uri }} style={styles.receiptImage} />
                <View style={styles.receiptActions}>
                  <TouchableOpacity style={styles.secondaryReceiptButton} onPress={handlePickEditReceipt}>
                    <ImagePlus size={15} color={Colors.primary} />
                    <Text style={styles.secondaryReceiptText}>Đổi ảnh</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.clearReceiptButton} onPress={() => setEditReceiptFile(null)}>
                    <X size={14} color="#A94F18" />
                    <Text style={styles.clearReceiptText}>Bỏ ảnh</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : !shouldRemoveReceipt && resolveReceiptUrl(selectedTransaction?.receiptImage) ? (
              <View style={styles.receiptPreview}>
              <Image
                source={{ uri: resolveReceiptUrl(selectedTransaction?.receiptImage) ?? undefined }}
                style={styles.receiptImage}
              />
                <View style={styles.receiptActions}>
                  <TouchableOpacity style={styles.secondaryReceiptButton} onPress={handlePickEditReceipt}>
                    <ImagePlus size={15} color={Colors.primary} />
                    <Text style={styles.secondaryReceiptText}>Đổi ảnh</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.clearReceiptButton} onPress={() => setShouldRemoveReceipt(true)}>
                    <X size={14} color="#A94F18" />
                    <Text style={styles.clearReceiptText}>Xóa ảnh</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.receiptEmpty} onPress={handlePickEditReceipt}>
                <ImageIcon size={22} color="#A06B42" />
                <Text style={styles.receiptEmptyText}>Giao dịch này chưa có ảnh hóa đơn.</Text>
                <Text style={styles.receiptPickerText}>Chọn ảnh</Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteTransaction} disabled={isSaving}>
                <Text style={styles.deleteButtonText}>Xóa</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveTransaction} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveButtonText}>Lưu</Text>}
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal transparent visible={isTagModalVisible} animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}>
          <Pressable style={styles.backdropPressable} onPress={() => setIsTagModalVisible(false)} />
          <View style={styles.tagModalCard}>
            <Text style={styles.modalTitle}>Thêm hashtag</Text>
            <Text style={styles.fieldLabel}>Tên hashtag</Text>
            <TextInput
              style={styles.input}
              value={newTagName}
              onChangeText={setNewTagName}
              placeholder="ví dụ: cong-viec"
              placeholderTextColor="#B58A6A"
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setIsTagModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Lùi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleCreateQuickTag}>
                <Text style={styles.saveButtonText}>Tạo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerActionButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    marginTop: 14,
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#4C2A18',
    fontWeight: '700',
    paddingVertical: 13,
  },
  filterPanel: {
    backgroundColor: '#FFF9F3',
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 14,
    marginTop: 16,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  filterTitle: {
    flex: 1,
    color: '#4C2A18',
    fontWeight: '900',
    fontSize: 16,
  },
  clearFilterButton: {
    borderRadius: 999,
    backgroundColor: '#FFE3C8',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  clearFilterText: {
    color: '#A94F18',
    fontSize: 12,
    fontWeight: '900',
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentChip: {
    backgroundColor: '#FFF1E3',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  segmentChipActive: {
    backgroundColor: Colors.primary,
  },
  segmentText: {
    color: '#8A623F',
    fontWeight: '800',
    fontSize: 12,
  },
  segmentTextActive: {
    color: Colors.white,
  },
  filterInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    color: '#4C2A18',
    fontWeight: '700',
    marginTop: 10,
  },
  dateButton: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
    justifyContent: 'center',
  },
  dateButtonText: {
    color: '#4C2A18',
    fontWeight: '900',
  },
  dateButtonHint: {
    color: '#A06B42',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  dateRangeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rangeInput: {
    flex: 1,
  },
  premiumFilterBox: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: '#FFF4EA',
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0C49B',
  },
  premiumFilterLocked: {
    opacity: 0.72,
  },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  premiumTitle: {
    color: '#7A4A28',
    fontWeight: '900',
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
    alignItems: 'center',
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 22,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#4C2A18',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    color: '#8A623F',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  dayGroup: {
    marginBottom: 10,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  dayTitle: {
    color: '#4C2A18',
    fontSize: 16,
    fontWeight: '900',
  },
  dayCount: {
    color: '#8A623F',
    fontSize: 12,
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
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tagText: {
    color: '#A94F18',
    backgroundColor: '#FFE3C8',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '800',
  },
  amountColumn: {
    alignItems: 'flex-end',
    gap: 8,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
    marginBottom: 12,
  },
  pageButton: {
    minWidth: 86,
    borderRadius: 14,
    backgroundColor: '#4A2B1A',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pageButtonDisabled: {
    backgroundColor: '#F0D6C1',
  },
  pageButtonText: {
    color: Colors.white,
    fontWeight: '900',
  },
  pageButtonTextDisabled: {
    color: '#9C7255',
  },
  pageMeta: {
    color: '#7A4A28',
    fontWeight: '900',
  },
  income: {
    color: '#E77700',
    fontWeight: '800',
  },
  expense: {
    color: '#C75A1B',
    fontWeight: '800',
  },
  receiptImage: {
    width: '100%',
    height: 210,
    borderRadius: 18,
    backgroundColor: '#FFF0DF',
  },
  receiptPreview: {
    gap: 10,
  },
  receiptActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryReceiptButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  secondaryReceiptText: {
    color: Colors.primary,
    fontWeight: '900',
  },
  clearReceiptButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#F1B9A5',
    backgroundColor: '#FFF2EE',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  clearReceiptText: {
    color: '#A94F18',
    fontWeight: '900',
  },
  receiptPickerText: {
    color: Colors.primary,
    fontWeight: '900',
  },
  receiptEmpty: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  receiptEmptyText: {
    flex: 1,
    color: '#8A623F',
    fontWeight: '700',
    lineHeight: 20,
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
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  backButton: {
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButtonText: { color: Colors.primary, fontWeight: '900' },
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
  typeSegment: {
    flexDirection: 'row',
    borderRadius: 999,
    backgroundColor: '#FFE3C8',
    padding: 4,
    marginBottom: 10,
  },
  typeSegmentButton: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 10,
  },
  typeSegmentButtonActive: {
    backgroundColor: Colors.primary,
  },
  typeSegmentText: {
    color: '#8A623F',
    fontWeight: '900',
  },
  typeSegmentTextActive: {
    color: Colors.white,
  },
  categorySelectCard: {
    minHeight: 70,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
  },
  categorySelectIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categorySelectCopy: { flex: 1 },
  categorySelectName: { color: '#4C2A18', fontSize: 15, fontWeight: '900' },
  categorySelectMeta: { color: '#8B6548', fontSize: 12, fontWeight: '800', marginTop: 4 },
  selectorHint: { color: Colors.primary, fontWeight: '900' },
  hashtagHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  optionalText: { color: '#8B6548', fontSize: 12, fontWeight: '800' },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  suggestTagChip: {
    borderRadius: 999,
    backgroundColor: '#FFF0DF',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  suggestTagChipActive: {
    backgroundColor: Colors.primary,
  },
  suggestTagText: { color: '#A94F18', fontSize: 12, fontWeight: '900' },
  suggestTagTextActive: { color: Colors.white },
  chipRow: {
    gap: 10,
    paddingRight: 20,
  },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E8B680',
  },
  filterChipActive: {
    backgroundColor: '#4A2B1A',
    borderColor: '#4A2B1A',
  },
  filterChipText: {
    color: '#7A4A28',
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: Colors.white,
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
  tagModalCard: {
    margin: 16,
    borderRadius: 24,
    backgroundColor: Colors.white,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 18,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: '#FFF0DF',
  },
  cancelButtonText: { color: '#8A623F', fontWeight: '900' },
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
