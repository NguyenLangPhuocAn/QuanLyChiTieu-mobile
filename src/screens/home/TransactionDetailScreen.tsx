import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CalendarDays, Hash, Image as ImageIcon, WalletCards } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import CategoryIcon from '../../components/CategoryIcon';
import { Colors } from '../../constants/Colors';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { API_BASE_URLS } from '../../services/api';
import { formatCurrency, formatDisplayDate } from '../../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'TransactionDetail'>;

const resolveReceiptUrl = (receipt?: string | null) => {
  if (!receipt) {
    return null;
  }

  if (receipt.startsWith('http://') || receipt.startsWith('https://')) {
    return receipt;
  }

  return `${API_BASE_URLS[0]}/uploads/receipts/${receipt}`;
};

const TransactionDetailScreen = ({ navigation, route }: Props) => {
  const { transaction } = route.params;
  const receiptUrl = resolveReceiptUrl(transaction.receiptImage);
  const typeLabel =
    transaction.cashFlowType === 'loan_debt'
      ? 'Dòng tiền vay/nợ'
      : transaction.type === 'income'
        ? 'Khoản thu'
        : 'Khoản chi';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết giao dịch</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.categoryIcon}>
            <CategoryIcon icon={transaction.categoryIcon} size={26} />
          </View>
          <Text style={styles.note}>{transaction.note}</Text>
          <Text
            style={transaction.type === 'income' ? styles.incomeAmount : styles.expenseAmount}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}>
            {transaction.type === 'income' ? '+' : '-'}
            {formatCurrency(transaction.amount, transaction.currency)}
          </Text>
                    <Text style={styles.typeText}>{typeLabel}</Text>
        </View>

        <View style={styles.infoCard}>
          <InfoRow icon={<CalendarDays size={18} color={Colors.primary} />} label="Ngày" value={formatDisplayDate(transaction.date)} />
          <InfoRow icon={<WalletCards size={18} color={Colors.primary} />} label="Ví" value={transaction.wallet} />
          <InfoRow icon={<Hash size={18} color={Colors.primary} />} label="Danh mục" value={transaction.category} />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Hashtag</Text>
          {(transaction.tags ?? []).length > 0 ? (
            <View style={styles.tagRow}>
              {(transaction.tags ?? []).map(tag => (
                <Text key={tag} style={styles.tagText}>#{tag}</Text>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Giao dịch này chưa có hashtag.</Text>
          )}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Ảnh hóa đơn</Text>
          {receiptUrl ? (
            <Image source={{ uri: receiptUrl }} style={styles.receiptImage} />
          ) : (
            <View style={styles.receiptEmpty}>
              <ImageIcon size={22} color="#A06B42" />
              <Text style={styles.emptyText}>Chưa có ảnh hóa đơn.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIcon}>{icon}</View>
    <View style={styles.infoCopy}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF3E8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 12,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF0E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, color: '#4A2B1A', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  headerSpacer: { width: 42 },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  heroCard: {
    backgroundColor: Colors.white,
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 18,
    alignItems: 'center',
  },
  categoryIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { color: '#4C2A18', fontSize: 20, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  incomeAmount: { color: '#188F5A', fontSize: 24, fontWeight: '900', marginTop: 8, width: '100%', textAlign: 'center' },
  expenseAmount: { color: '#C75A1B', fontSize: 24, fontWeight: '900', marginTop: 8, width: '100%', textAlign: 'center' },
  typeText: { color: '#8B6548', fontWeight: '800', marginTop: 5 },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 14,
    gap: 12,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: { flex: 1 },
  infoLabel: { color: '#8B6548', fontSize: 12, fontWeight: '800' },
  infoValue: { color: '#4A2B1A', fontSize: 15, fontWeight: '900', marginTop: 3 },
  sectionTitle: { color: '#4A2B1A', fontSize: 16, fontWeight: '900' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagText: {
    color: '#A94F18',
    backgroundColor: '#FFE3C8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyText: { color: '#8B6548', fontWeight: '800', lineHeight: 20 },
  receiptImage: { width: '100%', height: 220, borderRadius: 16, backgroundColor: '#FFF0DF' },
  receiptEmpty: {
    minHeight: 92,
    borderRadius: 16,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});

export default TransactionDetailScreen;
