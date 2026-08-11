import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import type { TransactionItem } from '../../data/mockTransactions';
import { transactionsService } from '../../services/transactions';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency, formatDisplayDate } from '../../utils/format';
import { mapApiTransactions } from '../../utils/mapTransactions';

type Props = NativeStackScreenProps<RootStackParamList, 'WalletTransactions'>;

const WalletTransactionsScreen = ({ navigation, route }: Props) => {
  const { walletId, walletName } = route.params;
  const { token } = useAuth();
  const [walletTransactions, setWalletTransactions] = useState<TransactionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWalletTransactions = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await transactionsService.getPage(token, {
        wallet_id: walletId,
        page: 1,
        limit: 100,
      });
      setWalletTransactions(
        mapApiTransactions(response.data, [
          {
            id: walletId,
            user_id: null,
            name: walletName,
            currency: response.data[0]?.currency ?? 'VND',
            balance: 0,
            created_at: '',
          },
        ]),
      );
    } catch (error) {
      Alert.alert(
        'Không tải được giao dịch ví',
        getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [token, walletId, walletName]);

  useEffect(() => {
    fetchWalletTransactions();
  }, [fetchWalletTransactions]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>{walletName}</Text>
          <Text style={styles.subtitle}>Sổ giao dịch ví</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color="#D87219" />
            <Text style={styles.emptyText}>Đang tải giao dịch ví...</Text>
          </View>
        ) : walletTransactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Chưa có giao dịch</Text>
            <Text style={styles.emptyText}>
              Các giao dịch gắn với ví này sẽ xuất hiện ở đây sau khi bạn thêm giao dịch.
            </Text>
          </View>
        ) : (
          walletTransactions.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.transactionCard}
              activeOpacity={0.86}
              onPress={() => navigation.navigate('TransactionDetail', { transaction: item })}>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionTitle} numberOfLines={2}>{item.note}</Text>
                <Text style={styles.transactionMeta}>
                  {item.category} · {formatDisplayDate(item.date)}
                </Text>
              </View>
              <Text style={item.type === 'income' ? styles.incomeAmount : styles.expenseAmount} numberOfLines={2}>
                {item.type === 'income' ? '+' : '-'}
                {formatCurrency(item.displayAmount, item.displayCurrency)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
    alignItems: 'center',
    gap: 12,
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
  headerText: {
    flex: 1,
  },
  title: {
    color: '#4A2B1A',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9C7255',
    marginTop: 3,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  emptyCard: {
    backgroundColor: '#FFFDFC',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F0D6C1',
  },
  emptyTitle: {
    color: '#4A2B1A',
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    color: '#8B6548',
    marginTop: 10,
    lineHeight: 22,
  },
  transactionCard: {
    backgroundColor: '#FFFDFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  transactionInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  transactionTitle: {
    color: '#4A2B1A',
    fontSize: 16,
    fontWeight: '800',
  },
  transactionMeta: {
    color: '#8B6548',
    marginTop: 6,
  },
  incomeAmount: {
    color: '#D87219',
    fontWeight: '800',
    maxWidth: 116,
    textAlign: 'right',
  },
  expenseAmount: {
    color: '#A94F18',
    fontWeight: '800',
    maxWidth: 116,
    textAlign: 'right',
  },
});

export default WalletTransactionsScreen;
