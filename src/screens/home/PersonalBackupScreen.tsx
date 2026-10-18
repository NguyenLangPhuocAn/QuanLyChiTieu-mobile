import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Check,
  Download,
  LockKeyhole,
  Upload,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  localDocumentPicker,
  type PickedDocument,
} from '../../native/documentPicker';
import {
  getVisibleReadyBackupRowNumbers,
  personalBackupService,
  type BackupPreview,
} from '../../services/personalBackup';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency } from '../../utils/format';

const PersonalBackupScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token } = useAuth();
  const [exportPassword, setExportPassword] = useState('');
  const [exportConfirm, setExportConfirm] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [file, setFile] = useState<PickedDocument | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [visibleRowCount, setVisibleRowCount] = useState(200);
  const [busy, setBusy] = useState<'export' | 'preview' | 'restore' | null>(
    null,
  );

  const exportBackup = async () => {
    if (!token || busy) return;
    if (exportPassword.length < 8) {
      Alert.alert('Mật khẩu chưa đủ mạnh', 'Hãy dùng ít nhất 8 ký tự.');
      return;
    }
    if (exportPassword !== exportConfirm) {
      Alert.alert('Mật khẩu chưa khớp', 'Hãy nhập lại đúng mật khẩu backup.');
      return;
    }
    setBusy('export');
    try {
      const result = await personalBackupService.export(token, exportPassword);
      const savedFile = await localDocumentPicker.saveBase64File(
        result.filename,
        result.mimeType,
        result.base64,
      );
      if (!savedFile) return;
      setExportPassword('');
      setExportConfirm('');
      Alert.alert(
        'Đã tạo backup mã hóa',
        `${result.summary.transactions} giao dịch · ${result.summary.wallets} ví\nĐã lưu file ${savedFile.name} vào thư mục bạn chọn.\n\nHãy giữ mật khẩu riêng; ứng dụng không thể lấy lại mật khẩu này.`,
      );
    } catch (error) {
      Alert.alert(
        'Chưa tạo được backup',
        getUserFriendlyErrorMessage(error, 'Vui lòng thử lại.'),
      );
    } finally {
      setBusy(null);
    }
  };

  const chooseFile = async () => {
    if (busy) return;
    try {
      const picked = await localDocumentPicker.pickBackupFile();
      if (!picked) return;
      setFile(picked);
      setPreview(null);
      setSelectedRows([]);
      setVisibleRowCount(200);
    } catch (error) {
      Alert.alert(
        'Chưa chọn được file',
        getUserFriendlyErrorMessage(error, 'Vui lòng thử lại.'),
      );
    }
  };

  const previewBackup = async () => {
    if (!token || !file || importPassword.length < 8 || busy) return;
    setBusy('preview');
    try {
      const result = await personalBackupService.preview(
        token,
        file,
        importPassword,
      );
      setPreview(result);
      setSelectedRows([]);
      setVisibleRowCount(200);
    } catch (error) {
      Alert.alert(
        'Không đọc được backup',
        getUserFriendlyErrorMessage(error, 'Kiểm tra mật khẩu và file backup.'),
      );
    } finally {
      setBusy(null);
    }
  };

  const toggleRow = (row: number) => {
    setSelectedRows(current =>
      current.includes(row)
        ? current.filter(value => value !== row)
        : [...current, row],
    );
  };

  const selectVisibleReadyRows = () => {
    if (!preview) return;
    setSelectedRows(
      getVisibleReadyBackupRowNumbers(preview.rows, visibleRowCount),
    );
  };

  const restoreSelected = () => {
    if (!token || !file || !preview || selectedRows.length === 0 || busy)
      return;
    Alert.alert(
      'Khôi phục giao dịch đã chọn?',
      `Ứng dụng sẽ thêm ${selectedRows.length} giao dịch mới. Dữ liệu hiện tại không bị ghi đè; dòng trùng sẽ bị bỏ qua.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Khôi phục',
          onPress: async () => {
            setBusy('restore');
            try {
              const result = await personalBackupService.restore(
                token,
                file,
                importPassword,
                selectedRows,
              );
              Alert.alert(
                'Đã khôi phục',
                `Đã thêm ${result.restored} giao dịch · Bỏ qua ${result.skipped} · Lỗi ${result.failed}.`,
              );
              setPreview(null);
              setSelectedRows([]);
              setFile(null);
              setImportPassword('');
            } catch (error) {
              Alert.alert(
                'Chưa khôi phục được',
                getUserFriendlyErrorMessage(
                  error,
                  'Dữ liệu hiện tại chưa bị thay đổi.',
                ),
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={21} color="#5B351E" />
        </TouchableOpacity>
        <Text style={styles.title}>Backup cá nhân</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <LockKeyhole size={25} color={Colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.heroTitle}>
              Dữ liệu được khóa bằng mật khẩu
            </Text>
            <Text style={styles.heroText}>
              File chứa ví, danh mục, giao dịch, hashtag và chi tiết món. Số dư
              không được ghi đè khi khôi phục.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tạo file backup</Text>
          <Text style={styles.cardText}>
            Mật khẩu chỉ dùng để mở file này. Hãy lưu ở nơi an toàn.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Mật khẩu từ 8 ký tự"
            secureTextEntry
            value={exportPassword}
            onChangeText={setExportPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Nhập lại mật khẩu"
            secureTextEntry
            value={exportConfirm}
            onChangeText={setExportConfirm}
          />
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={exportBackup}
            disabled={Boolean(busy)}
          >
            {busy === 'export' ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Download size={19} color="#FFF" />
            )}
            <Text style={styles.primaryText}>Tải backup mã hóa</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Khôi phục từ file</Text>
          <Text style={styles.cardText}>
            Chọn file, xem trước từng giao dịch rồi xác nhận phần muốn thêm.
          </Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={chooseFile}
            disabled={Boolean(busy)}
          >
            <Upload size={18} color={Colors.primary} />
            <Text style={styles.secondaryText}>
              {file?.name ?? 'Chọn file .stcn-backup'}
            </Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Mật khẩu của file backup"
            secureTextEntry
            value={importPassword}
            onChangeText={setImportPassword}
          />
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!file || importPassword.length < 8) && styles.disabled,
            ]}
            onPress={previewBackup}
            disabled={!file || importPassword.length < 8 || Boolean(busy)}
          >
            {busy === 'preview' ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryText}>Xem trước dữ liệu</Text>
            )}
          </TouchableOpacity>
        </View>

        {preview ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Bản backup{' '}
              {new Date(preview.metadata.createdAt).toLocaleString('vi-VN')}
            </Text>
            <Text style={styles.cardText}>
              {preview.summary.ready} sẵn sàng · {preview.summary.duplicate}{' '}
              trùng · {preview.summary.invalid} lỗi
            </Text>
            <Text style={styles.reviewHint}>
              Không có dòng nào được chọn sẵn. Hãy kiểm tra rồi chọn từng dòng
              hoặc chọn các dòng hợp lệ đang hiển thị.
            </Text>
            <View style={styles.selectionActions}>
              <TouchableOpacity
                style={styles.selectionButton}
                onPress={selectVisibleReadyRows}
              >
                <Text style={styles.selectionButtonText}>
                  Chọn dòng hợp lệ đang hiện
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.selectionButton}
                onPress={() => setSelectedRows([])}
              >
                <Text style={styles.selectionButtonText}>Bỏ chọn</Text>
              </TouchableOpacity>
            </View>
            {preview.rows.slice(0, visibleRowCount).map(row => {
              const selectable = row.status === 'READY';
              const selected = selectedRows.includes(row.row);
              return (
                <TouchableOpacity
                  key={row.row}
                  style={styles.row}
                  disabled={!selectable}
                  onPress={() => toggleRow(row.row)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      selected && styles.checkboxSelected,
                    ]}
                  >
                    {selected ? <Check size={15} color="#FFF" /> : null}
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>
                      {row.type === 'EXPENSE' ? 'Chi' : 'Thu'}{' '}
                      {formatCurrency(Number(row.amount), row.wallet.currency)}{' '}
                      · {row.wallet.name}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {row.note || row.category?.name || 'Không có ghi chú'} ·{' '}
                      {row.reason}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {preview.rows.length > visibleRowCount ? (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={() =>
                  setVisibleRowCount(current =>
                    Math.min(current + 200, preview.rows.length),
                  )
                }
              >
                <Text style={styles.loadMoreText}>
                  Hiển thị thêm ({visibleRowCount}/{preview.rows.length})
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                selectedRows.length === 0 && styles.disabled,
              ]}
              onPress={restoreSelected}
              disabled={selectedRows.length === 0 || Boolean(busy)}
            >
              {busy === 'restore' ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryText}>
                  Khôi phục {selectedRows.length} giao dịch
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF9F4' },
  flex: { flex: 1 },
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1D8C1',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0DF',
  },
  title: { color: '#4A2B1A', fontSize: 19, fontWeight: '900' },
  content: { padding: 16, paddingBottom: 44, gap: 14 },
  hero: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFEBD8',
    borderRadius: 22,
    padding: 15,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { color: '#4A2B1A', fontWeight: '900', fontSize: 15 },
  heroText: {
    color: '#7A5438',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F0C49B',
    padding: 15,
    gap: 10,
  },
  cardTitle: { color: '#4A2B1A', fontWeight: '900', fontSize: 16 },
  cardText: {
    color: '#7A5438',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  input: {
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E7C6A9',
    backgroundColor: '#FFF9F4',
    paddingHorizontal: 14,
    color: '#4A2B1A',
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  primaryText: { color: '#FFF', fontWeight: '900' },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0A45D',
    backgroundColor: '#FFF7EE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
  },
  secondaryText: { color: '#8A4718', fontWeight: '900', flex: 1 },
  disabled: { opacity: 0.45 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F5E3D3',
    paddingTop: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D9A77B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  rowTitle: { color: '#4A2B1A', fontWeight: '900', fontSize: 12 },
  rowMeta: { color: '#84644D', fontSize: 11, lineHeight: 16, marginTop: 2 },
  reviewHint: {
    color: '#8B5A2B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    backgroundColor: '#FFF4DE',
    borderRadius: 13,
    padding: 10,
  },
  selectionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectionButton: {
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7B98E',
    backgroundColor: '#FFF8F0',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionButtonText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  loadMoreButton: {
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: { color: Colors.primary, fontWeight: '900' },
});

export default PersonalBackupScreen;
