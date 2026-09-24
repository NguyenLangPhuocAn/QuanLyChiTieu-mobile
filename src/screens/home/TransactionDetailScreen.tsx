import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  CalendarDays,
  Hash,
  Image as ImageIcon,
  WalletCards,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import CategoryIcon from '../../components/CategoryIcon';
import { Colors } from '../../constants/Colors';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { resolveReceiptUrl } from '../../utils/mediaUrls';
import { formatCurrency, formatDisplayDate } from '../../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'TransactionDetail'>;

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
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
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
            style={
              transaction.type === 'income'
                ? styles.incomeAmount
                : styles.expenseAmount
            }
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {transaction.type === 'income' ? '+' : '-'}
            {formatCurrency(transaction.amount, transaction.currency)}
          </Text>
          <Text style={styles.typeText}>{typeLabel}</Text>
        </View>

        <View style={styles.infoCard}>
          <InfoRow
            icon={<CalendarDays size={18} color={Colors.primary} />}
            label="Ngày"
            value={formatDisplayDate(transaction.date)}
          />
          <InfoRow
            icon={<WalletCards size={18} color={Colors.primary} />}
            label="Ví"
            value={transaction.wallet}
          />
          <InfoRow
            icon={<Hash size={18} color={Colors.primary} />}
            label="Danh mục"
            value={transaction.category}
          />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Hashtag</Text>
          {(transaction.tags ?? []).length > 0 ? (
            <View style={styles.tagRow}>
              {(transaction.tags ?? []).map(tag => (
                <View key={tag} style={styles.tagBadge}>
                <Text style={styles.tagText} numberOfLines={1} ellipsizeMode="tail">
                  #{tag}
                </Text>
                </View>
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

const InfoRow = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
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
  headerTitle: {
    flex: 1,
    color: '#4A2B1A',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
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
  note: {
    color: '#4C2A18',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 12,
    textAlign: 'center',
  },
  incomeAmount: {
    color: '#188F5A',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 8,
    width: '100%',
    textAlign: 'center',
  },
  expenseAmount: {
    color: '#C75A1B',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 8,
    width: '100%',
    textAlign: 'center',
  },
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
  infoValue: {
    color: '#4A2B1A',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 3,
  },
  sectionTitle: { color: '#4A2B1A', fontSize: 16, fontWeight: '900' },
  receiptItemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiptItemsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  receiptItemCount: { color: '#8B6548', fontSize: 12, fontWeight: '900' },
  receiptItemRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3E0D0',
  },
  receiptItemName: { flex: 1, color: '#6F4B32', fontWeight: '800' },
  receiptItemAmount: { color: '#9A4D00', fontWeight: '900' },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingTop: 3,
  },
  receiptTotalLabel: { color: '#6F4B32', fontWeight: '900' },
  receiptTotalValue: { color: '#4A2B1A', fontWeight: '900' },
  receiptDifferenceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    borderRadius: 13,
    backgroundColor: '#FFF3D8',
    padding: 10,
  },
  receiptDifferenceText: {
    flex: 1,
    color: '#8B5700',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  tagBadge: {
    maxWidth: '100%',
    flexShrink: 0,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    backgroundColor: '#FFE3C8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  tagText: {
    includeFontPadding: false,
    textAlignVertical: 'center',
    color: '#A94F18',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '900',
  },
  emptyText: { color: '#8B6548', fontWeight: '800', lineHeight: 20 },
  receiptImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: '#FFF0DF',
  },
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
