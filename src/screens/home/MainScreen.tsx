import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ChartColumnBig,
  ChevronDown,
  ChevronUp,
  History,
  ImagePlus,
  MessageCircleMore,
  Plus,
  ScanLine,
  UserRound,
  X,
} from 'lucide-react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Colors } from '../../constants/Colors';
import CategoryIcon from '../../components/CategoryIcon';
import OverviewScreen from './OverviewScreen';
import HistoryScreen from './HistoryScreen';
import ChatbotScreen from './ChatbotScreen';
import AccountScreen from './AccountScreen';
import { useAuth } from '../../context/AuthContext';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { useFinance } from '../../context/FinanceContext';
import { categoriesService } from '../../services/categories';
import { transactionsService } from '../../services/transactions';
import { walletsService } from '../../services/wallets';
import { tagsService } from '../../services/tags';
import { budgetsService } from '../../services/budgets';
import { savingsService } from '../../services/savings';
import { notificationsService } from '../../services/notifications';
import { loanDebtsService } from '../../services/loanDebts';
import { buildWalletBudgetAlerts } from '../../utils/budgetAlerts';
import { toDateKey } from '../../utils/budgetPeriod';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency, formatShortDate } from '../../utils/format';
import { parsePositiveMoneyInput } from '../../utils/moneyInput';
import { normalizeTagName, parseTagsInput } from '../../utils/hashtags';
import HashtagChip from '../../components/HashtagChip';
import { getWalletTypeMeta } from '../../constants/walletTypes';
import { mapApiTransactions as mapSharedApiTransactions } from '../../utils/mapTransactions';
import { getLoanDebtErrorMessage } from '../../utils/loanDebt';
import { filterNormalCashFlowCategories } from '../../utils/transactionClassification';
import type { TransactionItem } from '../../data/mockTransactions';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { LoanDebtType } from '../../types/loanDebt';
import type { ReceiptOcrResult } from '../../types/transaction';
import type { SavingsGoal } from '../../types/savings';
import type { Wallet } from '../../types/wallet';

type TabKey = 'overview' | 'history' | 'chatbot' | 'account';
type TransactionEntryType = 'EXPENSE' | 'INCOME' | 'LOAN_DEBT';

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

const parseDateKey = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date();
};
type ReceiptUploadFile = {
  uri: string;
  name: string;
  type: string;
};
const buildReceiptUploadFile = (
  file: ReceiptUploadFile | null,
  transactionId: number,
) => {
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
  const type =
    file.type || (extension ? mimeByExtension[extension] : undefined);

  if (!type) {
    throw new Error('Ảnh hóa đơn chỉ hỗ trợ JPG, PNG hoặc WEBP.');
  }

  return {
    uri: file.uri,
    name:
      file.name ||
      `receipt-${transactionId}.${
        extension === 'jpeg' ? 'jpg' : extension ?? 'jpg'
      }`,
    type,
  };
};

const MainScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, user } = useAuth();
  const { run: runSaveTransaction, busy: savingTransaction } =
    useSingleFlight();
  const {
    categories,
    setPreferredCurrency,
    selectedTransactionCategory,
    setCategories,
    setSelectedTransactionCategory,
    setTransactions,
    setBudgets,
    setTags,
    tags,
    transactions,
    budgets,
  } = useFinance();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionEntryType, setTransactionEntryType] =
    useState<TransactionEntryType>('EXPENSE');
  const [transactionDate, setTransactionDate] = useState(new Date());
  const [isTransactionDatePickerVisible, setIsTransactionDatePickerVisible] =
    useState(false);
  const [transactionNote, setTransactionNote] = useState('');
  const [transactionTags, setTransactionTags] = useState('');
  const [loanDebtType, setLoanDebtType] = useState<LoanDebtType>('BORROWED');
  const [loanDebtPersonName, setLoanDebtPersonName] = useState('');
  const [loanDebtDueDate, setLoanDebtDueDate] = useState('');
  const [isLoanDebtDueDatePickerVisible, setIsLoanDebtDueDatePickerVisible] =
    useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [isTagModalVisible, setIsTagModalVisible] = useState(false);
  const [receiptFile, setReceiptFile] = useState<ReceiptUploadFile | null>(
    null,
  );
  const [isReceiptDetailsExpanded, setIsReceiptDetailsExpanded] =
    useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [receiptOcrWarnings, setReceiptOcrWarnings] = useState<string[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<number | null>(null);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const shouldReopenTransactionForm = useRef(false);
  const amountInputRef = useRef<TextInput>(null);
  const transactionFormScrollRef = useRef<ScrollView>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!token) {
      return;
    }

    setRefreshing(true);

    try {
      const [
        nextWallets,
        nextTransactions,
        nextCategories,
        nextTags,
        nextBudgets,
        nextSavingsGoals,
      ] = await Promise.all([
        walletsService.getAll(token),
        transactionsService.getAll(token),
        categoriesService.getAll(token),
        tagsService.getAll(token),
        budgetsService.getAll(token),
        savingsService.getAll(token).catch(() => []),
      ]);

      setWallets(nextWallets);
      setCategories(nextCategories);
      setTags(nextTags);
      setBudgets(nextBudgets);
      setSavingsGoals(nextSavingsGoals);
      setTransactions(mapSharedApiTransactions(nextTransactions, nextWallets));
      notificationsService
        .getUnreadCount(token)
        .then(nextUnread => setNotificationUnreadCount(nextUnread.count))
        .catch(() => undefined);
    } catch (error) {
      const message = getUserFriendlyErrorMessage(
        error,
        'Không thể tải dữ liệu.',
      );
      Alert.alert('Không tải được dữ liệu', message);
    } finally {
      setRefreshing(false);
    }
  }, [setBudgets, setCategories, setTags, setTransactions, token]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (user?.currency_default) {
      setPreferredCurrency(user.currency_default);
    }
  }, [setPreferredCurrency, user?.currency_default]);

  const spendableWallets = useMemo(
    () => wallets.filter(wallet => wallet.wallet_type !== 'SAVINGS'),
    [wallets],
  );

  useEffect(() => {
    if (spendableWallets.length > 0 && selectedWalletId === null) {
      setSelectedWalletId(spendableWallets[0].id);
    }
  }, [spendableWallets, selectedWalletId]);

  const normalTransactionCategories = useMemo(
    () => filterNormalCashFlowCategories(categories),
    [categories],
  );

  useEffect(() => {
    if (
      (!selectedTransactionCategory ||
        !normalTransactionCategories.some(
          category => category.id === selectedTransactionCategory.id,
        )) &&
      normalTransactionCategories.length > 0
    ) {
      setSelectedTransactionCategory(normalTransactionCategories[0]);
    }
  }, [
    normalTransactionCategories,
    selectedTransactionCategory,
    setSelectedTransactionCategory,
  ]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();

      if (shouldReopenTransactionForm.current) {
        shouldReopenTransactionForm.current = false;
        setIsModalVisible(true);
      }
    }, [fetchDashboardData]),
  );

  const selectedWallet = useMemo(
    () =>
      spendableWallets.find(wallet => wallet.id === selectedWalletId) ?? null,
    [selectedWalletId, spendableWallets],
  );
  const selectedTransactionType =
    transactionEntryType === 'LOAN_DEBT'
      ? 'LOAN_DEBT'
      : selectedTransactionCategory?.type ?? transactionEntryType;
  const recentHashtags = useMemo(() => {
    const counter = new Map<string, number>();

    transactions.forEach(transaction => {
      (transaction.tags ?? []).forEach(tag => {
        const normalized = normalizeTagName(tag);

        if (normalized) {
          counter.set(normalized, (counter.get(normalized) ?? 0) + 1);
        }
      });
    });

    const usedTags = [...counter.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([tag]) => tag)
      .slice(0, 8);
    const managedTags = tags
      .map(tag => normalizeTagName(tag.name))
      .filter(Boolean);

    return [...new Set([...usedTags, ...managedTags])].slice(0, 10);
  }, [tags, transactions]);
  const currentTags = useMemo(
    () => parseTagsInput(transactionTags),
    [transactionTags],
  );
  const openTransactionModal = () => {
    setIsModalVisible(true);
  };

  const handleChangeTab = (tab: TabKey) => {
    if (activeTab === tab) {
      return;
    }

    setIsTabLoading(true);
    setActiveTab(tab);
    setTimeout(() => setIsTabLoading(false), 220);
  };

  const handleSelectTransactionType = (type: TransactionEntryType) => {
    setTransactionEntryType(type);

    if (type === 'LOAN_DEBT') {
      return;
    }

    const nextCategory = normalTransactionCategories.find(
      category => category.type === type,
    );

    if (nextCategory) {
      setSelectedTransactionCategory(nextCategory);
    }
  };

  const setQuickDate = (offset: number) => {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + offset);
    setTransactionDate(nextDate);
  };

  const toggleTag = (tag: string) => {
    const normalized = normalizeTagName(tag);
    const nextTags = currentTags.includes(normalized)
      ? currentTags.filter(item => item !== normalized)
      : [...currentTags, normalized].slice(0, 8);

    setTransactionTags(nextTags.map(item => `#${item}`).join(' '));
  };

  const handleCreateQuickTag = async () => {
    if (!token) {
      return;
    }

    const normalized = normalizeTagName(newTagName);

    if (!normalized) {
      Alert.alert('Thiếu hashtag', 'Nhập tên hashtag cần tạo.');
      return;
    }

    try {
      const nextTags = await tagsService.create(token, normalized);
      setTags(nextTags);
      toggleTag(normalized);
      setNewTagName('');
      setIsTagModalVisible(false);
    } catch (error) {
      Alert.alert(
        'Chưa tạo được hashtag',
        getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.'),
      );
    }
  };

  const resetTransactionForm = () => {
    setTransactionAmount('');
    setTransactionDate(new Date());
    setIsTransactionDatePickerVisible(false);
    setTransactionNote('');
    setTransactionTags('');
    setReceiptFile(null);
    setIsReceiptDetailsExpanded(false);
    setIsOcrLoading(false);
    setReceiptOcrWarnings([]);
    setTransactionEntryType('EXPENSE');
    setLoanDebtType('BORROWED');
    setLoanDebtPersonName('');
    setLoanDebtDueDate('');
    setIsLoanDebtDueDatePickerVisible(false);
    setSelectedWalletId(spendableWallets[0]?.id ?? null);
  };

  const openCategoryPicker = () => {
    shouldReopenTransactionForm.current = true;
    setIsModalVisible(false);
    navigation.navigate('Categories', { selectMode: true });
  };

  const handleTransactionDateChange = (
    _event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    setIsTransactionDatePickerVisible(false);

    if (selectedDate) {
      setTransactionDate(selectedDate);
    }
  };

  const handleLoanDebtDueDateChange = (
    _event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    setIsLoanDebtDueDatePickerVisible(false);

    if (selectedDate) {
      setLoanDebtDueDate(toDateKey(selectedDate));
    }
  };

  const applyReceiptOcrResult = (result: ReceiptOcrResult) => {
    const nextWarnings = [...result.warnings];
    const ocrCurrency = result.currency?.trim().toUpperCase() ?? null;
    const matchingWallets = ocrCurrency
      ? spendableWallets.filter(
          wallet => wallet.currency.trim().toUpperCase() === ocrCurrency,
        )
      : [];
    const currencyMatches =
      !ocrCurrency ||
      selectedWallet?.currency.trim().toUpperCase() === ocrCurrency;
    if (
      result.amount &&
      !transactionAmount.trim() &&
      (currencyMatches || matchingWallets.length === 1)
    ) {
      setTransactionAmount(String(result.amount));
      if (!currencyMatches && matchingWallets.length === 1) {
        setSelectedWalletId(matchingWallets[0].id);
        nextWarnings.push(
          `Đã chọn ví “${matchingWallets[0].name}” vì hóa đơn dùng ${ocrCurrency}.`,
        );
      }
    } else if (result.amount && !currencyMatches) {
      nextWarnings.push(
        `Hóa đơn dùng ${ocrCurrency}, khác tiền tệ của ví đang chọn. Hãy chọn ví phù hợp rồi nhập tổng thanh toán.`,
      );
    } else if (
      result.amount &&
      Number(parsePositiveMoneyInput(transactionAmount)) !== result.amount
    ) {
      nextWarnings.push(
        `OCR đọc tổng thanh toán ${formatCurrency(
          result.amount,
          selectedWallet?.currency ?? 'VND',
        )}; số tiền bạn đã nhập được giữ nguyên.`,
      );
    }
    if (result.note && !transactionNote.trim()) setTransactionNote(result.note);
    if (result.transaction_date) {
      setTransactionDate(parseDateKey(result.transaction_date));
    }
    if (result.suggested_category) {
      const category = normalTransactionCategories.find(
        item => item.id === result.suggested_category?.id,
      );
      if (category?.type === 'EXPENSE') {
        setTransactionEntryType('EXPENSE');
        setSelectedTransactionCategory(category);
      }
    }
    setReceiptOcrWarnings([...new Set(nextWarnings)]);
    setIsReceiptDetailsExpanded(true);
  };

  const analyzeReceiptFile = async (file: ReceiptUploadFile) => {
    if (!token) return;
    setIsOcrLoading(true);
    setReceiptOcrWarnings([]);
    try {
      const result = await transactionsService.analyzeReceipt(token, file);
      applyReceiptOcrResult(result);
    } catch (error) {
      setIsReceiptDetailsExpanded(true);
      Alert.alert(
        'Chưa đọc được hóa đơn',
        `${getUserFriendlyErrorMessage(
          error,
          'Vui lòng thử ảnh rõ hơn.',
        )}\nẢnh vẫn được giữ và bạn có thể nhập món thủ công.`,
      );
    } finally {
      setIsOcrLoading(false);
    }
  };

  const pickAndAnalyzeReceipt = async (source: 'camera' | 'library') => {
    let result;

    try {
      const options = {
        mediaType: 'photo',
        quality: 0.8,
        ...(source === 'library' ? { selectionLimit: 1 as const } : {}),
      } as const;
      result =
        source === 'camera'
          ? await launchCamera(options)
          : await launchImageLibrary(options);
    } catch {
      Alert.alert(
        source === 'camera'
          ? 'Chưa mở được máy ảnh'
          : 'Chưa mở được thư viện ảnh',
        'Vui lòng kiểm tra quyền truy cập rồi thử lại.',
      );
      return;
    }

    if (result.didCancel) {
      return;
    }

    const asset = result.assets?.[0];

    if (!asset?.uri) {
      Alert.alert(
        'Chưa chọn được ảnh',
        'Vui lòng thử lại với ảnh JPG, PNG hoặc WEBP.',
      );
      return;
    }

    const type = asset.type ?? '';

    if (
      type &&
      !['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(type)
    ) {
      Alert.alert(
        'Ảnh chưa hợp lệ',
        'Ảnh hóa đơn chỉ hỗ trợ JPG, PNG hoặc WEBP.',
      );
      return;
    }

    const fallbackName = `receipt-${Date.now()}.${
      type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
    }`;

    const nextFile = {
      uri: asset.uri,
      name: asset.fileName ?? fallbackName,
      type: type || 'image/jpeg',
    };
    setReceiptFile(nextFile);
    setIsReceiptDetailsExpanded(true);
    await analyzeReceiptFile(nextFile);
  };

  const handlePickReceipt = () => {
    Alert.alert('Quét hóa đơn', 'Bạn muốn lấy ảnh từ đâu?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Thư viện ảnh',
        onPress: () => pickAndAnalyzeReceipt('library').catch(() => undefined),
      },
      {
        text: 'Chụp ảnh',
        onPress: () => pickAndAnalyzeReceipt('camera').catch(() => undefined),
      },
    ]);
  };

  const handleScanReceiptFromChatbot = () => {
    setTransactionEntryType('EXPENSE');
    setIsReceiptDetailsExpanded(true);
    setIsModalVisible(true);
    handlePickReceipt();
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
      tags: parseTagsInput(transactionTags),
      type: transactionType,
      amount,
      date: transactionDate.toISOString(),
    };
    const [alert] = buildWalletBudgetAlerts(
      [predictedWallet],
      [...transactions, predictedTransaction],
      budgets,
    );

    if (!alert) {
      return;
    }

    const budgetRange =
      alert.periodStart && alert.periodEnd
        ? `${formatShortDate(alert.periodStart)} - ${formatShortDate(
            alert.periodEnd,
          )}`
        : 'kỳ ngân sách hiện tại';
    const budgetLine = alert.budgetLimit
      ? `\nĐã chi ${formatCurrency(
          alert.periodExpense,
          wallet.currency,
        )} / ${formatCurrency(
          alert.budgetLimit,
          wallet.currency,
        )} trong kỳ ${budgetRange}.`
      : '';

    Alert.alert(
      'Cảnh báo ngân sách',
      `${alert.walletName}: ${alert.reasons.join(' · ')}.${budgetLine}`,
    );
  };

  const handleSaveTransaction = () =>
    runSaveTransaction(async () => {
      if (!token || isOcrLoading) return;
      const normalizedAmount = parsePositiveMoneyInput(transactionAmount);

      if (!normalizedAmount) {
        Alert.alert(
          'Số tiền chưa hợp lệ',
          'Nhập số tiền lớn hơn 0, tối đa 2 số thập phân (ví dụ 12,50), không dùng dấu phân cách hàng nghìn.',
        );
        return;
      }

      if (!selectedWallet) {
        Alert.alert(
          'Chưa có ví',
          'Hãy tạo ít nhất một ví trước khi thêm giao dịch.',
        );
        return;
      }

      const amount = Number(normalizedAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        Alert.alert('Số tiền chưa hợp lệ', 'Vui lòng nhập số tiền lớn hơn 0.');
        return;
      }
      if (
        transactionEntryType !== 'LOAN_DEBT' &&
        !selectedTransactionCategory
      ) {
        Alert.alert(
          'Chưa có danh mục',
          'Vui lòng chọn danh mục thu hoặc chi cho giao dịch.',
        );
        return;
      }
      if (transactionEntryType === 'LOAN_DEBT') {
        if (!loanDebtPersonName.trim()) {
          Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên người vay/nợ.');
          return;
        }

        try {
          await loanDebtsService.create(token, {
            person_name: loanDebtPersonName.trim(),
            type: loanDebtType,
            principal_amount: normalizedAmount,
            wallet_id: selectedWallet.id,
            due_date: loanDebtDueDate.trim() || null,
            note: transactionNote.trim() || undefined,
            transaction_date: toDateKey(transactionDate),
          });
          await fetchDashboardData();
        } catch (error) {
          const message = getLoanDebtErrorMessage(
            error,
            'Không thể lưu khoản vay/nợ. Vui lòng thử lại.',
          );
          Alert.alert('Lưu vay/nợ thất bại', message);
          return;
        }

        setIsModalVisible(false);
        resetTransactionForm();
        return;
      }

      if (!selectedTransactionCategory) {
        return;
      }

      const transactionType =
        selectedTransactionCategory.type === 'INCOME' ? 'income' : 'expense';
      let createdTransaction;
      try {
        createdTransaction = await transactionsService.create(token, {
          wallet_id: selectedWallet.id,
          category_id: selectedTransactionCategory.id,
          amount: normalizedAmount,
          type: selectedTransactionCategory.type,
          note: transactionNote.trim() || undefined,
          transaction_date: toDateKey(transactionDate),
          tags: parseTagsInput(transactionTags),
        });
      } catch (error) {
        const message = getUserFriendlyErrorMessage(
          error,
          'Không thể lưu giao dịch.',
        );
        Alert.alert('Lưu giao dịch thất bại', message);
        return;
      }

      let receiptUploadFailed = false;
      if (receiptFile) {
        try {
          const uploadFile = buildReceiptUploadFile(
            receiptFile,
            createdTransaction.id,
          );
          if (uploadFile) {
            await transactionsService.uploadReceipt(
              token,
              createdTransaction.id,
              uploadFile,
            );
          }
        } catch {
          receiptUploadFailed = true;
        }
      }

      await fetchDashboardData();
      showBudgetAlertIfNeeded(selectedWallet, amount, transactionType);

      setIsModalVisible(false);
      resetTransactionForm();
      if (receiptUploadFailed) {
        Alert.alert(
          'Giao dịch đã được lưu',
          'Giao dịch đã lưu nhưng ảnh chưa tải lên được. Bạn có thể thêm lại ảnh trong lịch sử giao dịch.',
        );
      }
    });

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewScreen
            wallets={wallets}
            savingsGoals={savingsGoals}
            refreshing={refreshing}
            onRefresh={fetchDashboardData}
            onAddTransaction={openTransactionModal}
            notificationUnreadCount={notificationUnreadCount}
          />
        );
      case 'history':
        return (
          <HistoryScreen
            wallets={wallets}
            categories={categories}
            refreshing={refreshing}
            onRefresh={fetchDashboardData}
          />
        );
      case 'chatbot':
        return <ChatbotScreen onScanReceipt={handleScanReceiptFromChatbot} />;
      case 'account':
        return (
          <AccountScreen
            wallets={wallets}
            notificationUnreadCount={notificationUnreadCount}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {renderContent()}
        {isTabLoading ? (
          <View style={styles.routeLoadingOverlay}>
            <View style={styles.routeLoadingCard}>
              <Text style={styles.routeLoadingText}>Đang chuyển trang...</Text>
            </View>
          </View>
        ) : null}
      </View>

      {isModalVisible ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalBackdrop, styles.inlineModalLayer]}
        >
          <Pressable
            style={styles.backdropPressable}
            onPress={() => {
              if (!savingTransaction) setIsModalVisible(false);
            }}
          />
          <Pressable style={styles.modalShell}>
            <ScrollView
              ref={transactionFormScrollRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.transactionFormContent}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.modalTitleRow}>
                <TouchableOpacity
                  style={styles.backFormButton}
                  disabled={savingTransaction}
                  onPress={() => setIsModalVisible(false)}
                >
                  <ArrowLeft size={18} color="#7A4A28" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Thêm giao dịch</Text>
              </View>
              <Text style={styles.modalDescription}>
                Ghi lại khoản tiền vừa phát sinh.
              </Text>
              <View style={styles.typeSegment}>
                {(['EXPENSE', 'INCOME', 'LOAN_DEBT'] as const).map(type => {
                  const active = selectedTransactionType === type;

                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeSegmentButton,
                        active && styles.typeSegmentButtonActive,
                      ]}
                      onPress={() => handleSelectTransactionType(type)}
                    >
                      <Text
                        style={[
                          styles.typeSegmentText,
                          active && styles.typeSegmentTextActive,
                        ]}
                      >
                        {type === 'EXPENSE'
                          ? 'Chi'
                          : type === 'INCOME'
                          ? 'Thu'
                          : 'Vay/Nợ'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Số tiền</Text>
              <TextInput
                ref={amountInputRef}
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor="#C99A72"
                keyboardType="decimal-pad"
                value={transactionAmount}
                onChangeText={setTransactionAmount}
                onFocus={() =>
                  transactionFormScrollRef.current?.scrollTo({
                    y: 120,
                    animated: true,
                  })
                }
              />

              {transactionEntryType === 'LOAN_DEBT' ? (
                <>
                  <Text style={styles.fieldLabel}>Loại vay/nợ</Text>
                  <View style={styles.loanDebtSegment}>
                    {(['BORROWED', 'LENT'] as LoanDebtType[]).map(type => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.loanDebtSegmentButton,
                          loanDebtType === type &&
                            styles.loanDebtSegmentButtonActive,
                        ]}
                        onPress={() => setLoanDebtType(type)}
                      >
                        <Text
                          style={[
                            styles.loanDebtSegmentText,
                            loanDebtType === type &&
                              styles.loanDebtSegmentTextActive,
                          ]}
                        >
                          {type === 'BORROWED' ? 'Vay' : 'Cho vay'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>Tên người</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ví dụ: Nguyễn Văn A"
                    placeholderTextColor="#B58A6A"
                    value={loanDebtPersonName}
                    onChangeText={setLoanDebtPersonName}
                  />
                </>
              ) : null}

              {transactionEntryType !== 'LOAN_DEBT' ? (
                <>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.fieldLabel}>Danh mục</Text>
                    <TouchableOpacity onPress={openCategoryPicker}>
                      <Text style={styles.selectorHint}>Chọn danh mục</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.categorySelectCard}
                    onPress={openCategoryPicker}
                  >
                    <View style={styles.categorySelectIcon}>
                      <CategoryIcon
                        icon={selectedTransactionCategory?.icon ?? null}
                        size={20}
                      />
                    </View>
                    <View style={styles.categorySelectCopy}>
                      <Text style={styles.categorySelectName}>
                        {selectedTransactionCategory?.name ?? 'Chọn danh mục'}
                      </Text>
                      <Text style={styles.categorySelectMeta}>
                        {selectedTransactionType === 'INCOME'
                          ? 'Khoản thu'
                          : 'Khoản chi'}
                      </Text>
                    </View>
                    <Text style={styles.selectorHint}>Đổi</Text>
                  </TouchableOpacity>
                </>
              ) : null}

              <Text style={styles.fieldLabel}>Ví</Text>
              {selectedWallet ? (
                <Text style={styles.walletCurrencyHint}>
                  Giao dịch này sẽ dùng tiền tệ của ví:{' '}
                  {selectedWallet.currency}
                </Text>
              ) : null}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.walletCardRow}
              >
                {spendableWallets.map(wallet => {
                  const typeMeta = getWalletTypeMeta(wallet.wallet_type);
                  const WalletTypeIcon = typeMeta.Icon;
                  const active = selectedWalletId === wallet.id;

                  return (
                    <TouchableOpacity
                      key={wallet.id}
                      style={[
                        styles.walletPickerCard,
                        active && styles.walletPickerCardActive,
                      ]}
                      onPress={() => setSelectedWalletId(wallet.id)}
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
                      <Text
                        style={styles.walletPickerBalance}
                        numberOfLines={1}
                      >
                        {formatCurrency(
                          Number(wallet.balance || 0),
                          wallet.currency,
                        )}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {spendableWallets.length === 0 && (
                <Text style={styles.emptyWalletText}>
                  Bạn cần tạo ví trước khi lưu giao dịch.
                </Text>
              )}

              <Text style={styles.fieldLabel}>Ngày giao dịch</Text>
              <View style={styles.dateShortcutRow}>
                <TouchableOpacity
                  style={styles.dateShortcut}
                  onPress={() => setQuickDate(0)}
                >
                  <Text style={styles.dateShortcutText}>Hôm nay</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateShortcut}
                  onPress={() => setQuickDate(-1)}
                >
                  <Text style={styles.dateShortcutText}>Hôm qua</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dateShortcut, styles.dateShortcutWide]}
                  onPress={() => setIsTransactionDatePickerVisible(true)}
                >
                  <CalendarDays size={16} color="#D87219" />
                  <Text style={styles.dateShortcutText}>
                    {formatShortDate(toDateKey(transactionDate))}
                  </Text>
                </TouchableOpacity>
              </View>
              {isTransactionDatePickerVisible ? (
                <DateTimePicker
                  value={transactionDate}
                  mode="date"
                  display="default"
                  onChange={handleTransactionDateChange}
                />
              ) : null}

              {transactionEntryType === 'LOAN_DEBT' ? (
                <>
                  <Text style={styles.fieldLabel}>Ngày hẹn trả</Text>
                  <View style={styles.dateShortcutRow}>
                    <TouchableOpacity
                      style={[styles.dateShortcut, styles.dateShortcutWide]}
                      onPress={() => setIsLoanDebtDueDatePickerVisible(true)}
                    >
                      <CalendarDays size={16} color="#D87219" />
                      <Text style={styles.dateShortcutText}>
                        {loanDebtDueDate
                          ? formatShortDate(loanDebtDueDate)
                          : 'Không có hạn trả'}
                      </Text>
                    </TouchableOpacity>
                    {loanDebtDueDate ? (
                      <TouchableOpacity
                        style={styles.dateShortcut}
                        onPress={() => setLoanDebtDueDate('')}
                      >
                        <Text style={styles.dateShortcutText}>Bỏ ngày</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {isLoanDebtDueDatePickerVisible ? (
                    <DateTimePicker
                      value={
                        loanDebtDueDate
                          ? parseDateKey(loanDebtDueDate)
                          : new Date()
                      }
                      mode="date"
                      display="default"
                      onChange={handleLoanDebtDueDateChange}
                    />
                  ) : null}
                </>
              ) : null}

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

              {transactionEntryType !== 'LOAN_DEBT' ? (
                <>
                  <Text style={styles.fieldLabel}>Hashtag</Text>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.optionalText}>Không bắt buộc</Text>
                    <TouchableOpacity
                      onPress={() => setIsTagModalVisible(true)}
                    >
                      <Text style={styles.selectorHint}>Thêm nhanh</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Ví dụ: #antrua #congviec"
                    placeholderTextColor="#B58A6A"
                    value={transactionTags}
                    onChangeText={setTransactionTags}
                    autoCapitalize="none"
                  />
                  {currentTags.length > 0 ? (
                    <ScrollView
                      horizontal
                      style={styles.tagScroll}
                      keyboardShouldPersistTaps="handled"
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.tagPreviewRow}
                    >
                      {currentTags.map(tag => (
                        <HashtagChip key={tag} name={tag} onRemove={() => toggleTag(tag)} />
                      ))}
                    </ScrollView>
                  ) : null}
                  {recentHashtags.length > 0 ? (
                    <>
                      <Text style={styles.suggestLabel}>Gợi ý gần đây</Text>
                      <ScrollView
                        horizontal
                        style={styles.tagScroll}
                        keyboardShouldPersistTaps="handled"
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.tagPreviewRow}
                      >
                        {recentHashtags.map(tag => {
                          const normalizedTag = normalizeTagName(tag);
                          const isSelected =
                            currentTags.includes(normalizedTag);

                          return (
                            <TouchableOpacity
                              key={normalizedTag}
                              style={[
                                styles.suggestTagChip,
                                isSelected && styles.suggestTagChipActive,
                              ]}
                              onPress={() => toggleTag(normalizedTag)}
                            >
                              <Text
                                numberOfLines={1}
                                style={[
                                  styles.suggestTagText,
                                  isSelected && styles.suggestTagTextActive,
                                ]}
                              >
                                #{normalizedTag}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </>
                  ) : null}

                  <TouchableOpacity
                    style={styles.receiptSectionHeader}
                    onPress={() =>
                      setIsReceiptDetailsExpanded(current => !current)
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Ảnh hóa đơn không bắt buộc"
                  >
                    <View style={styles.receiptSectionIcon}>
                      <ScanLine size={19} color={Colors.primary} />
                    </View>
                    <View style={styles.receiptSectionCopy}>
                      <Text style={styles.receiptSectionTitle}>
                        Ảnh hóa đơn
                      </Text>
                      <Text style={styles.receiptSectionMeta}>
                        {'Không bắt buộc · quét để điền thông tin chung'}
                      </Text>
                    </View>
                    {isReceiptDetailsExpanded ? (
                      <ChevronUp size={20} color="#8A623F" />
                    ) : (
                      <ChevronDown size={20} color="#8A623F" />
                    )}
                  </TouchableOpacity>

                  {isReceiptDetailsExpanded ? (
                    <View style={styles.receiptDetailsCard}>
                      <Text style={styles.receiptHelperText}>
                        Quét ảnh để gợi ý tổng tiền, ngày và danh mục. Kiểm tra
                        thông tin trước khi lưu giao dịch.
                      </Text>

                      {receiptFile ? (
                        <View style={styles.receiptPreview}>
                          <Image
                            source={{ uri: receiptFile.uri }}
                            style={styles.receiptImage}
                          />
                          <View style={styles.receiptInfo}>
                            <Text style={styles.receiptName} numberOfLines={1}>
                              {receiptFile.name}
                            </Text>
                            <View style={styles.receiptActions}>
                              <TouchableOpacity
                                style={styles.secondaryReceiptButton}
                                onPress={handlePickReceipt}
                                disabled={isOcrLoading}
                              >
                                <ScanLine size={14} color={Colors.primary} />
                                <Text style={styles.secondaryReceiptText}>
                                  Quét lại
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.clearReceiptButton}
                                onPress={() => setReceiptFile(null)}
                              >
                                <X size={14} color="#A94F18" />
                                <Text style={styles.clearReceiptText}>
                                  Bỏ ảnh
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.receiptPickerButton}
                          onPress={handlePickReceipt}
                          disabled={isOcrLoading}
                        >
                          {isOcrLoading ? (
                            <ActivityIndicator color={Colors.primary} />
                          ) : (
                            <ImagePlus size={18} color="#D87219" />
                          )}
                          <Text style={styles.receiptPickerText}>
                            {isOcrLoading
                              ? 'Đang đọc hóa đơn...'
                              : 'Chọn ảnh và quét bằng AI'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {isOcrLoading && receiptFile ? (
                        <View style={styles.ocrLoadingRow}>
                          <ActivityIndicator
                            size="small"
                            color={Colors.primary}
                          />
                          <Text style={styles.ocrLoadingText}>
                            AI đang đọc tổng tiền và từng món...
                          </Text>
                        </View>
                      ) : null}

                      {receiptOcrWarnings.map(warning => (
                        <View key={warning} style={styles.ocrWarningRow}>
                          <AlertTriangle size={15} color="#A15C00" />
                          <Text style={styles.ocrWarningText}>{warning}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : null}

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSaveTransaction}
                disabled={savingTransaction || isOcrLoading}
                accessibilityState={{
                  disabled: savingTransaction || isOcrLoading,
                  busy: savingTransaction,
                }}
              >
                {savingTransaction ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {transactionEntryType === 'LOAN_DEBT'
                      ? 'Lưu khoản vay/nợ'
                      : 'Lưu giao dịch'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      ) : null}

      <Modal transparent visible={isTagModalVisible} animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable
            style={styles.backdropPressable}
            onPress={() => setIsTagModalVisible(false)}
          />
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
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setIsTagModalVisible(false)}
              >
                <ArrowLeft size={18} color="#7A4A28" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleCreateQuickTag}
              >
                <Text style={styles.saveButtonText}>Tạo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
                onPress={() => handleChangeTab(item.key)}
              >
                <Icon size={20} color={isActive ? '#F28C28' : '#B58A67'} />
                <Text
                  style={[styles.tabLabel, isActive && styles.activeTabLabel]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.fab} onPress={openTransactionModal}>
            <Plus size={28} color={Colors.white} />
          </TouchableOpacity>

          {tabs.slice(2).map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;

            return (
              <TouchableOpacity
                key={item.key}
                style={styles.tabButton}
                onPress={() => handleChangeTab(item.key)}
              >
                <Icon size={20} color={isActive ? '#F28C28' : '#B58A67'} />
                <Text
                  style={[styles.tabLabel, isActive && styles.activeTabLabel]}
                >
                  {item.label}
                </Text>
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
  routeLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 243, 232, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  routeLoadingCard: {
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E8B680',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  routeLoadingText: { color: '#7A4A28', fontWeight: '900' },
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
    backgroundColor: 'rgba(42, 24, 12, 0.38)',
    justifyContent: 'flex-end',
    padding: 14,
  },
  inlineModalLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 60,
    elevation: 60,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFill,
  },
  modalShell: {
    backgroundColor: '#FFFDFB',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '100%',
    borderWidth: 1,
    borderColor: '#F0D6C1',
    shadowColor: '#7A3E12',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  transactionFormContent: {
    paddingBottom: 24,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#E8B680',
    marginBottom: 14,
  },
  modalTitle: {
    color: '#4C2A18',
    fontSize: 22,
    fontWeight: '800',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backFormButton: {
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backFormButtonText: { color: Colors.primary, fontWeight: '900' },
  modalDescription: {
    color: '#8A623F',
    marginTop: 8,
    lineHeight: 22,
    marginBottom: 10,
  },
  typeSegment: {
    flexDirection: 'row',
    backgroundColor: '#FFF0DF',
    borderRadius: 18,
    padding: 4,
    marginTop: 14,
  },
  typeSegmentButton: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 12,
  },
  typeSegmentButtonActive: {
    backgroundColor: '#FF8C00',
  },
  typeSegmentText: {
    color: '#8A623F',
    fontWeight: '900',
  },
  typeSegmentTextActive: {
    color: Colors.white,
  },
  loanDebtSegment: {
    flexDirection: 'row',
    backgroundColor: '#FFF6EF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F2D9C0',
    padding: 4,
  },
  loanDebtSegmentButton: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 11,
  },
  loanDebtSegmentButtonActive: {
    backgroundColor: '#FF8C00',
  },
  loanDebtSegmentText: {
    color: '#8A623F',
    fontWeight: '900',
  },
  loanDebtSegmentTextActive: {
    color: Colors.white,
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
  amountInput: {
    minHeight: 72,
    backgroundColor: '#FFF6EF',
    borderWidth: 1.4,
    borderColor: '#F2B77D',
    borderRadius: 22,
    paddingHorizontal: 18,
    color: '#4C2A18',
    fontSize: 30,
    fontWeight: '900',
  },
  multilineInput: {
    minHeight: 96,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionalText: {
    color: '#8B6548',
    fontSize: 12,
    fontWeight: '800',
  },
  categorySelectCard: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F2D9C0',
    backgroundColor: '#FFF6EF',
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
  categorySelectMeta: {
    color: '#8B6548',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  quickCategoryRow: {
    gap: 10,
    paddingRight: 10,
  },
  quickCategoryCard: {
    width: 88,
    minHeight: 88,
    borderRadius: 18,
    backgroundColor: '#FFF6EF',
    borderWidth: 1,
    borderColor: '#F2D9C0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    gap: 8,
  },
  quickCategoryCardActive: {
    backgroundColor: '#FF8C00',
    borderColor: '#FF8C00',
  },
  quickCategoryIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCategoryIconActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  quickCategoryText: {
    color: '#7A4A28',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  quickCategoryTextActive: {
    color: Colors.white,
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
  walletCardRow: {
    gap: 10,
    paddingRight: 10,
  },
  walletPickerCard: {
    width: 138,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F2D9C0',
    backgroundColor: '#FFF6EF',
    padding: 12,
  },
  walletPickerCardActive: {
    borderColor: '#FF8C00',
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
    backgroundColor: '#FF8C00',
  },
  walletPickerName: {
    color: '#4C2A18',
    fontWeight: '900',
  },
  walletPickerBalance: {
    color: '#8A623F',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 5,
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
  dateShortcutRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dateShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#FFF1E3',
    borderWidth: 1,
    borderColor: '#F2D9C0',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dateShortcutWide: {
    flexGrow: 1,
  },
  dateShortcutText: {
    color: '#7A4A28',
    fontWeight: '900',
  },
  tagPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 18,
    paddingVertical: 2,
  },
  tagScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 10,
  },
  tagChip: {
    flexShrink: 0,
    alignSelf: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#FFE3C8',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tagChipText: {
    fontSize: 12,
    lineHeight: 18,
    includeFontPadding: false,
    textAlignVertical: 'center',
    color: '#A94F18',
    fontWeight: '900',
  },
  suggestLabel: {
    color: '#8A623F',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
  },
  suggestTagChip: {
    flexShrink: 0,
    alignSelf: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#FFF1E3',
    borderWidth: 1,
    borderColor: '#F2D9C0',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  suggestTagChipActive: {
    backgroundColor: '#FF8C00',
    borderColor: '#FF8C00',
  },
  suggestTagText: {
    fontSize: 12,
    lineHeight: 18,
    includeFontPadding: false,
    textAlignVertical: 'center',
    color: '#7A4A28',
    fontWeight: '800',
  },
  suggestTagTextActive: {
    color: Colors.white,
  },
  receiptSectionHeader: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F2D9C0',
    backgroundColor: '#FFF6EF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 13,
    marginTop: 16,
  },
  receiptSectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptSectionCopy: { flex: 1, minWidth: 0 },
  receiptSectionTitle: { color: '#4C2A18', fontWeight: '900' },
  receiptSectionMeta: {
    color: '#8A623F',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  receiptDetailsCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#F2D9C0',
    backgroundColor: '#FFFDFC',
    padding: 13,
    gap: 10,
    marginTop: -3,
  },
  receiptHelperText: {
    color: '#7A5438',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  receiptPickerButton: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: '#F2B77D',
    backgroundColor: '#FFF6EF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  receiptPickerText: {
    color: '#D87219',
    fontWeight: '800',
  },
  receiptPreview: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F2D9C0',
    backgroundColor: '#FFF6EF',
    padding: 10,
  },
  receiptImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#FFE3C8',
  },
  receiptInfo: {
    flex: 1,
    justifyContent: 'space-between',
    minWidth: 0,
  },
  receiptName: {
    color: '#4C2A18',
    fontWeight: '800',
  },
  receiptActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondaryReceiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: '#FFF1E3',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  secondaryReceiptText: {
    color: '#D87219',
    fontWeight: '800',
  },
  clearReceiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#FFE3C8',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  clearReceiptText: {
    color: '#A94F18',
    fontWeight: '800',
  },
  ocrLoadingRow: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
  },
  ocrLoadingText: { flex: 1, color: '#7A5438', fontWeight: '800' },
  ocrWarningRow: {
    borderRadius: 13,
    backgroundColor: '#FFF3D8',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
  },
  ocrWarningText: {
    flex: 1,
    color: '#8B5700',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  receiptItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#F2D9C0',
    backgroundColor: Colors.white,
    padding: 8,
  },
  receiptItemIndex: {
    width: 27,
    height: 27,
    borderRadius: 10,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptItemIndexText: {
    color: '#A94F18',
    fontSize: 11,
    fontWeight: '900',
  },
  receiptItemFields: { flex: 1, minWidth: 0, gap: 5 },
  receiptItemNameInput: {
    minHeight: 36,
    color: '#4C2A18',
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  receiptItemAmountInput: {
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: '#FFF6EF',
    color: '#9A4D00',
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  removeReceiptItemButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF2EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptDetailActions: { flexDirection: 'row', gap: 8 },
  addReceiptItemButton: {
    minHeight: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E8B680',
    backgroundColor: '#FFF6EF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
  },
  addReceiptItemText: { color: Colors.primary, fontWeight: '900' },
  clearReceiptDetailsButton: {
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: '#FFF2EE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  clearReceiptDetailsText: {
    color: '#B84A3A',
    fontSize: 12,
    fontWeight: '900',
  },
  receiptSummary: {
    borderRadius: 15,
    backgroundColor: '#FFF6EF',
    padding: 12,
    gap: 7,
  },
  receiptSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  receiptSummaryLabel: { color: '#7A5438', fontWeight: '800' },
  receiptSummaryValue: { color: '#4C2A18', fontWeight: '900' },
  receiptDifferenceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: '#F0D4BA',
    paddingTop: 8,
  },
  receiptDifferenceText: {
    flex: 1,
    color: '#8B5700',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  receiptMatchedText: {
    color: '#217A55',
    fontSize: 12,
    fontWeight: '900',
    borderTopWidth: 1,
    borderTopColor: '#F0D4BA',
    paddingTop: 8,
  },
  primaryButton: {
    backgroundColor: '#FF8C00',
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
  tagModalCard: {
    borderRadius: 24,
    backgroundColor: Colors.white,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 18,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  secondaryButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    paddingVertical: 14,
  },
  secondaryButtonText: { color: '#8A623F', fontWeight: '900' },
  saveButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingVertical: 14,
  },
  saveButtonText: { color: Colors.white, fontWeight: '900' },
});

export default MainScreen;
