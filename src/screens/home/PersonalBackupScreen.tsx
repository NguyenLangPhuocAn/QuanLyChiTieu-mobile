import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Check, Download, Upload } from 'lucide-react-native';
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
import { getApiBaseUrl } from '../../services/api';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency } from '../../utils/format';

const PersonalBackupScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, user } = useAuth();
  const identity = String(user?.id) + '|' + getApiBaseUrl();
  const session = useRef({ token, identity });
  session.current = { token, identity };
  const alive = useRef(false),
    revision = useRef(0),
    working = useRef(false),
    nativePicker = useRef(false);
  const [file, setFile] = useState<PickedDocument | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [visibleRowCount, setVisibleRowCount] = useState(200);
  const [busy, setBusy] = useState<
    'export' | 'preview' | 'restore' | 'file' | null
  >(null);
  const invalidate = useCallback(() => {
    revision.current += 1;
    setPreview(null);
    setSelectedRows([]);
  }, []);
  useFocusEffect(
    useCallback(() => {
      alive.current = true;
      return () => {
        alive.current = false;
        revision.current += 1;
      };
    }, []),
  );
  useEffect(() => {
    invalidate();
    setFile(null);
  }, [identity, invalidate]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active' && !nativePicker.current) invalidate();
    });
    return () => listener.remove();
  }, [invalidate]);
  const operate = async (
    kind: NonNullable<typeof busy>,
    action: (current: () => boolean, accessToken: string) => Promise<void>,
  ) => {
    if (working.current || !alive.current || !session.current.token) return;
    working.current = true;
    setBusy(kind);
    const rev = revision.current,
      owner = session.current.identity;
    const current = () =>
      alive.current &&
      revision.current === rev &&
      session.current.identity === owner;
    try {
      await action(current, session.current.token);
    } catch (error) {
      if (current())
        Alert.alert(
          'Chưa thực hiện được',
          getUserFriendlyErrorMessage(error, 'Kiểm tra file và thử lại.'),
        );
    } finally {
      working.current = false;
      if (alive.current) setBusy(null);
    }
  };
  const exportBackup = () =>
    operate('export', async (current, accessToken) => {
      const result = await personalBackupService.export(accessToken);
      if (!current()) return;
      nativePicker.current = true;
      let saved;
      try {
        saved = await localDocumentPicker.saveBase64File(
          result.filename,
          result.mimeType,
          result.base64,
        );
      } finally {
        nativePicker.current = false;
      }
      if (current() && saved)
        Alert.alert(
          'Đã tạo file backup',
          result.summary.transactions +
            ' giao dịch · ' +
            result.summary.wallets +
            ' ví\nĐã lưu file ' +
            saved.name +
            '.',
        );
    });
  const chooseFile = () =>
    operate('file', async current => {
      nativePicker.current = true;
      let picked;
      try {
        picked = await localDocumentPicker.pickBackupFile();
      } finally {
        nativePicker.current = false;
      }
      if (current() && picked) {
        invalidate();
        setFile(picked);
        setVisibleRowCount(200);
      }
    });
  const previewBackup = () => {
    if (!file) return;
    invalidate();
    return operate('preview', async (current, accessToken) => {
      const result = await personalBackupService.preview(accessToken, file);
      if (!current()) return;
      if (!/^[a-f0-9]{64}$/.test(result.metadata?.fileHash ?? ''))
        throw new Error(
          'Máy chủ chưa hỗ trợ file backup mới. Chưa thể khôi phục.',
        );
      setPreview(result);
      setSelectedRows([]);
      setVisibleRowCount(200);
    });
  };
  const toggleRow = (row: number) => {
    if (working.current) return;
    setSelectedRows(current =>
      current.includes(row)
        ? current.filter(value => value !== row)
        : [...current, row],
    );
  };
  const selectVisibleReadyRows = () => {
    if (preview && !working.current)
      setSelectedRows(
        getVisibleReadyBackupRowNumbers(preview.rows, visibleRowCount),
      );
  };
  const restoreSelected = () => {
    if (
      !token ||
      !file ||
      !preview ||
      selectedRows.length === 0 ||
      working.current
    )
      return;
    const rev = revision.current,
      owner = identity,
      chosen = [...selectedRows],
      chosenFile = file,
      chosenPreview = preview;
    Alert.alert(
      'Khôi phục giao dịch đã chọn?',
      'Ứng dụng sẽ thêm ' +
        chosen.length +
        ' giao dịch mới. Dữ liệu hiện tại không bị ghi đè; dòng trùng sẽ bị bỏ qua.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Khôi phục',
          onPress: () => {
            if (
              !alive.current ||
              revision.current !== rev ||
              session.current.identity !== owner
            )
              return;
            operate('restore', async (current, accessToken) => {
              const result = await personalBackupService.restore(
                accessToken,
                chosenFile,
                chosen,
                chosenPreview.metadata.fileHash,
              );
              if (!current()) return;
              invalidate();
              setFile(null);
              Alert.alert(
                'Đã khôi phục',
                'Đã thêm ' +
                  result.restored +
                  ' giao dịch · Bỏ qua ' +
                  result.skipped +
                  ' · Lỗi ' +
                  result.failed +
                  '.',
              );
            });
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
            <Download size={25} color={Colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.heroTitle}>Sao lưu dữ liệu cá nhân</Text>
            <Text style={styles.heroText}>
              File chứa ví, danh mục, giao dịch, hashtag và chi tiết món. Số dư
              không được ghi đè khi khôi phục.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tạo file backup</Text>
          <Text style={styles.cardText}>
            Lưu file thường, không cần mật khẩu, để nhập lại dữ liệu khi cần.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            accessibilityLabel="Tải file backup"
            onPress={exportBackup}
            disabled={Boolean(busy)}
          >
            {busy === 'export' ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Download size={19} color="#FFF" />
            )}
            <Text style={styles.primaryText}>Tải file backup</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Khôi phục từ file</Text>
          <Text style={styles.cardText}>
            Chọn file, xem trước từng giao dịch rồi xác nhận phần muốn thêm.
          </Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            accessibilityLabel="Chọn file backup cá nhân"
            onPress={chooseFile}
            disabled={Boolean(busy)}
          >
            <Upload size={18} color={Colors.primary} />
            <Text style={styles.secondaryText}>
              {file?.name ?? 'Chọn file .stcn-backup'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, !file && styles.disabled]}
            accessibilityLabel="Xem trước backup cá nhân"
            onPress={previewBackup}
            disabled={!file || Boolean(busy)}
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
                accessibilityLabel="Chọn dòng backup đang hiện"
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
              accessibilityLabel="Khôi phục backup đã chọn"
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
