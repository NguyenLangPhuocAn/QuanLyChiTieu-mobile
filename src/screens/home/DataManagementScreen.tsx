import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Database,
  Download,
  FileSpreadsheet,
  Upload,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { localDocumentPicker } from '../../native/documentPicker';
import {
  dashboardCache,
  type DashboardCache,
} from '../../services/dashboardCache';
import { dataTransferService } from '../../services/dataTransfer';
import { getUserFriendlyErrorMessage } from '../../utils/errors';

type Route = NativeStackScreenProps<
  RootStackParamList,
  'DataManagement'
>['route'];

const DataManagementScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Route>();
  const { token, user } = useAuth();
  const [cache, setCache] = useState<DashboardCache | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    dashboardCache.read(user.id).then(setCache);
  }, [user?.id]);

  const importExcel = async () => {
    if (!token || isImporting) return;
    try {
      const file = await localDocumentPicker.pickExcelFile();
      if (!file) return;
      setIsImporting(true);
      const result = await dataTransferService.importExcel(token, file);
      Alert.alert(
        'Đã nhập dữ liệu',
        `Thêm mới ${result.created} giao dịch · Bỏ qua ${
          result.skipped
        } dòng trùng hoặc không thuộc thu/chi · Lỗi ${result.failed} dòng.${
          result.warnings.length
            ? `\n\n${result.warnings.slice(0, 3).join('\n')}`
            : ''
        }`,
      );
    } catch (error) {
      Alert.alert(
        'Chưa nhập được dữ liệu',
        getUserFriendlyErrorMessage(error, 'Vui lòng kiểm tra file XLSX.'),
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>
        <Text style={styles.title}>Dữ liệu và xuất nhập</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.localCard}>
          <View style={styles.localIcon}>
            <Database size={23} color={Colors.primary} />
          </View>
          <View style={styles.localCopy}>
            <Text style={styles.cardTitle}>Bản dữ liệu trên máy</Text>
            <Text style={styles.cardText}>
              Ứng dụng lưu bản sao gần nhất để vẫn xem được dữ liệu khi mất kết
              nối.
            </Text>
            <Text style={styles.cacheMeta}>
              {cache
                ? `${cache.transactions.length} giao dịch · cập nhật ${new Date(
                    cache.updatedAt,
                  ).toLocaleString('vi-VN')}`
                : 'Chưa có bản dữ liệu trên máy'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() =>
            navigation.navigate('Statistics', {
              wallets: route.params?.wallets ?? [],
            })
          }
        >
          <View style={styles.actionIcon}>
            <Download size={22} color={Colors.primary} />
          </View>
          <View style={styles.actionCopy}>
            <Text style={styles.cardTitle}>Xuất Excel</Text>
            <Text style={styles.cardText}>
              Chọn kỳ báo cáo rồi tải file có giao dịch và chi tiết hóa đơn.
            </Text>
          </View>
          <FileSpreadsheet size={20} color="#B57745" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={importExcel}
          disabled={isImporting}
        >
          <View style={styles.actionIcon}>
            {isImporting ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <Upload size={22} color={Colors.primary} />
            )}
          </View>
          <View style={styles.actionCopy}>
            <Text style={styles.cardTitle}>Nhập dữ liệu cũ từ Excel</Text>
            <Text style={styles.cardText}>
              Chọn file XLSX từng xuất từ ứng dụng. Dòng trùng sẽ được bỏ qua.
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Khi nhập file</Text>
          <Text style={styles.noticeText}>
            Tên ví và danh mục trong file cần tồn tại trong tài khoản hiện tại.
            Giao dịch vay/nợ và chuyển ví được bỏ qua để tránh làm sai số dư.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF9F4' },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1D8C1',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#4A2B1A', fontSize: 19, fontWeight: '900' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  localCard: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 22,
    backgroundColor: '#FFEBD8',
    padding: 15,
  },
  localIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  localCopy: { flex: 1 },
  cardTitle: { color: '#4A2B1A', fontWeight: '900' },
  cardText: {
    color: '#7A5438',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  cacheMeta: {
    color: '#B65D1A',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 8,
  },
  actionCard: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0C49B',
    backgroundColor: Colors.white,
    padding: 14,
  },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: { flex: 1 },
  noticeCard: {
    borderRadius: 18,
    backgroundColor: '#FFF3D8',
    padding: 14,
  },
  noticeTitle: { color: '#7A4B00', fontWeight: '900' },
  noticeText: {
    color: '#8B5700',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 5,
  },
});

export default DataManagementScreen;
