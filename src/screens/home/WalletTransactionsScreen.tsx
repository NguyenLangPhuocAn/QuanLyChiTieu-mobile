import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, formatDisplayDate } from '../../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'WalletTransactions'>;

const WalletTransactionsScreen = ({ navigation, route }: Props) => {
  const { walletId, walletName } = route.params;
  const { transactions } = useFinance();

  // Backend trả về wallet_id nên lọc theo id để không bị sai khi người dùng đổi tên ví.
  const walletTransactions = transactions.filter(item => item.walletId === walletId);
  const walletCurrency = walletTransactions[0]?.currency ?? 'VND';

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
        {walletTransactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Chưa có giao dịch</Text>
            <Text style={styles.emptyText}>
              Các giao dịch gắn với ví này sẽ xuất hiện ở đây sau khi bạn thêm giao dịch.
            </Text>
          </View>
        ) : (
          walletTransactions.map(item => (
            <View key={item.id} style={styles.transactionCard}>
              <View>
                <Text style={styles.transactionTitle}>{item.note}</Text>
                <Text style={styles.transactionMeta}>
                  {item.category} • {formatDisplayDate(item.date)}
                </Text>
              </View>
              <Text style={item.type === 'income' ? styles.incomeAmount : styles.expenseAmount}>
                {item.type === 'income' ? '+' : '-'}
                {formatCurrency(item.amount, item.currency)}
              </Text>
            </View>
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
    justifyContent: 'space-between',
    gap: 10,
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
    alignSelf: 'center',
  },
  expenseAmount: {
    color: '#A94F18',
    fontWeight: '800',
    alignSelf: 'center',
  },
});

export default WalletTransactionsScreen;
