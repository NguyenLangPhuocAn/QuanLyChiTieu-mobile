import React, { useEffect, useState } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {
  ArrowLeft,
  CloudOff,
  Database,
  Download,
  FileSpreadsheet,
  LockKeyhole,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { localDocumentPicker } from '../../native/documentPicker';
import type { PickedDocument } from '../../native/documentPicker';
import {
  dashboardCache,
  type DashboardCache,
} from '../../services/dashboardCache';
import {
  dataTransferService,
  type ExcelImportPreview,
} from '../../services/dataTransfer';
import { financialCaptureInbox } from '../../services/financialCaptureInbox';
import {
  offlineTransactionQueue,
  type OfflineTransactionDraft,
} from '../../services/offlineTransactionQueue';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency } from '../../utils/format';
import { parsePositiveMoneyInput } from '../../utils/moneyInput';

type Route = NativeStackScreenProps<
  RootStackParamList,
  'DataManagement'
>['route'];

type OfflineDraftEditor = {
  id: string;
  amount: string;
  note: string;
  walletId: number;
  categoryId?: number;
  type: 'INCOME' | 'EXPENSE';
};

const DataManagementScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Route>();
  const { token, user } = useAuth();
  const [cache, setCache] = useState<DashboardCache | null>(null);
  const [offlineDrafts, setOfflineDrafts] = useState<OfflineTransactionDraft[]>(
    [],
  );
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncingDrafts, setIsSyncingDrafts] = useState(false);
  const [draftEditor, setDraftEditor] = useState<OfflineDraftEditor | null>(
    null,
  );
  const [excelPreview, setExcelPreview] = useState<{
    file: PickedDocument;
    result: ExcelImportPreview;
    selectedRows: number[];
    inboxDraftId?: string;
  } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      dashboardCache.read(user.id),
      offlineTransactionQueue.list(user.id),
    ]).then(([nextCache, drafts]) => {
      setCache(nextCache);
      setOfflineDrafts(drafts);
    });
  }, [user?.id]);

  useEffect(() => {
    const draftId = route.params?.financialDraftId;
    if (!draftId || !user?.id) return;
    financialCaptureInbox
      .get(user.id, draftId)
      .then(draft => {
        if (!draft?.excel) return;
        setExcelPreview({
          file: draft.excel.file,
          result: draft.excel.preview,
          selectedRows: draft.excel.preview.rows
            .filter(row => row.status === 'READY')
            .map(row => row.row),
          inboxDraftId: draft.id,
        });
      })
      .catch(() => undefined);
  }, [route.params?.financialDraftId, user?.id]);

  const performImport = async (
    file: Awaited<ReturnType<typeof localDocumentPicker.pickExcelFile>>,
    selectedRows?: number[],
  ) => {
    if (!token || !file) return;
    const result = await dataTransferService.importExcel(
      token,
      file,
      selectedRows,
    );
    if (excelPreview?.inboxDraftId && user?.id) {
      await financialCaptureInbox.remove(user.id, excelPreview.inboxDraftId);
    }
    setExcelPreview(null);
    Alert.alert(
      'Đã nhập dữ liệu',
      `Thêm mới ${result.created} giao dịch · Bỏ qua ${
        result.skipped
      } dòng trùng hoặc không thuộc thu/chi · Lỗi ${result.failed} dòng.${
        result.warnings.length
          ? `\n\n${result.warnings.slice(0, 3).join('\n')}`
          : ''
      }`,
      result.batchId
        ? [
            { text: 'Đóng', style: 'cancel' },
            {
              text: 'Hoàn tác lô nhập',
              style: 'destructive',
              onPress: () => {
                dataTransferService
                  .undoExcelImport(token, result.batchId!)
                  .then(undo =>
                    Alert.alert(
                      'Đã hoàn tác',
                      `Đã xóa ${undo.removed} giao dịch của đúng lô nhập này.${
                        undo.failed
                          ? ` ${undo.failed} giao dịch cần kiểm tra.`
                          : ''
                      }`,
                    ),
                  )
                  .catch(error =>
                    Alert.alert(
                      'Chưa hoàn tác được',
                      getUserFriendlyErrorMessage(error, 'Vui lòng thử lại.'),
                    ),
                  );
              },
            },
          ]
        : [{ text: 'Đóng' }],
    );
  };

  const importExcel = async () => {
    if (!token || isImporting) return;
    try {
      const file = await localDocumentPicker.pickExcelFile();
      if (!file) return;
      setIsImporting(true);
      const result = await dataTransferService.previewExcel(token, file);
      const captureDraft = user?.id
        ? await financialCaptureInbox.enqueue(user.id, {
            source: 'EXCEL',
            status: result.ready > 0 ? 'READY' : 'NEEDS_REVIEW',
            dedupeKey: `excel:${result.fileHash}`,
            title: file.name,
            excel: { file, preview: result },
          })
        : null;
      setExcelPreview({
        file,
        result,
        selectedRows: result.rows
          .filter(row => row.status === 'READY')
          .map(row => row.row),
        inboxDraftId: captureDraft?.id,
      });
    } catch (error) {
      Alert.alert(
        'Chưa nhập được dữ liệu',
        getUserFriendlyErrorMessage(error, 'Vui lòng kiểm tra file XLSX.'),
      );
    } finally {
      setIsImporting(false);
    }
  };

  const toggleExcelRow = (rowNumber: number) => {
    setExcelPreview(current => {
      if (!current) return current;
      const selected = new Set(current.selectedRows);
      if (selected.has(rowNumber)) selected.delete(rowNumber);
      else selected.add(rowNumber);
      return { ...current, selectedRows: Array.from(selected) };
    });
  };

  const confirmExcelImport = () => {
    if (!excelPreview || isImporting || excelPreview.selectedRows.length === 0)
      return;
    setIsImporting(true);
    performImport(excelPreview.file, excelPreview.selectedRows)
      .catch(error =>
        Alert.alert(
          'Chưa nhập được dữ liệu',
          getUserFriendlyErrorMessage(error, 'Vui lòng kiểm tra file XLSX.'),
        ),
      )
      .finally(() => setIsImporting(false));
  };

  const closeExcelPreview = () => {
    if (excelPreview?.inboxDraftId && user?.id) {
      financialCaptureInbox
        .remove(user.id, excelPreview.inboxDraftId)
        .catch(() => undefined);
    }
    setExcelPreview(null);
  };

  const syncOfflineDrafts = async () => {
    if (!token || !user?.id || isSyncingDrafts) return;
    setIsSyncingDrafts(true);
    try {
      const result = await offlineTransactionQueue.sync(token, user.id);
      setOfflineDrafts(await offlineTransactionQueue.list(user.id));
      Alert.alert(
        'Đồng bộ bản nháp',
        `Đã thêm ${result.synced} · Còn chờ ${result.pending} · Cần kiểm tra ${result.needsReview}.`,
      );
    } catch (error) {
      Alert.alert(
        'Chưa đồng bộ được',
        getUserFriendlyErrorMessage(error, 'Bản nháp vẫn được giữ trên máy.'),
      );
    } finally {
      setIsSyncingDrafts(false);
    }
  };

  const removeOfflineDraft = (draft: OfflineTransactionDraft) => {
    if (!user?.id) return;
    Alert.alert(
      'Xóa bản nháp?',
      'Bản nháp chưa làm thay đổi số dư. Sau khi xóa sẽ không thể khôi phục.',
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            offlineTransactionQueue
              .remove(user.id, draft.id)
              .then(() => offlineTransactionQueue.list(user.id))
              .then(setOfflineDrafts)
              .catch(() => undefined);
          },
        },
      ],
    );
  };

  const editOfflineDraft = (draft: OfflineTransactionDraft) => {
    setDraftEditor({
      id: draft.id,
      amount: draft.payload.amount,
      note: draft.payload.note ?? '',
      walletId: draft.payload.wallet_id,
      categoryId: draft.payload.category_id,
      type: draft.payload.type,
    });
  };

  const confirmDraftUpdate = () => {
    if (!user?.id || !draftEditor || !cache) return;
    const amount = parsePositiveMoneyInput(draftEditor.amount);
    const wallet = cache.wallets.find(item => item.id === draftEditor.walletId);
    const category = cache.categories.find(
      item =>
        item.id === draftEditor.categoryId && item.type === draftEditor.type,
    );
    if (!amount || !wallet || !category) {
      Alert.alert(
        'Chưa đủ dữ liệu',
        'Hãy nhập số tiền lớn hơn 0, chọn ví và danh mục phù hợp.',
      );
      return;
    }

    Alert.alert(
      'Lưu bản nháp đã sửa?',
      `${draftEditor.type === 'INCOME' ? 'Thu +' : 'Chi -'}${formatCurrency(
        Number(amount),
        wallet.currency,
      )}\n${wallet.name} · ${
        category.name
      }\n\nBước này chưa ghi tiền; bản nháp sẽ chờ bạn đồng bộ.`,
      [
        { text: 'Xem lại', style: 'cancel' },
        {
          text: 'Lưu bản nháp',
          onPress: () => {
            offlineTransactionQueue
              .update(user.id, draftEditor.id, {
                amount,
                wallet_id: wallet.id,
                category_id: category.id,
                note: draftEditor.note.trim() || undefined,
              })
              .then(() => offlineTransactionQueue.list(user.id))
              .then(drafts => {
                setOfflineDrafts(drafts);
                setDraftEditor(null);
              })
              .catch(error =>
                Alert.alert(
                  'Chưa lưu được bản nháp',
                  getUserFriendlyErrorMessage(error, 'Vui lòng thử lại.'),
                ),
              );
          },
        },
      ],
    );
  };

  const getDraftCurrency = (draft: OfflineTransactionDraft) =>
    cache?.wallets.find(wallet => wallet.id === draft.payload.wallet_id)
      ?.currency ??
    user?.currency_default ??
    'VND';

  const formatPreviewDate = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString('vi-VN');
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
        {excelPreview ? (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={styles.actionCopy}>
                <Text style={styles.previewTitle}>Xem trước dữ liệu nhập</Text>
                <Text style={styles.cardText}>
                  {excelPreview.result.totalRows} dòng · sẵn sàng{' '}
                  {excelPreview.result.ready} · trùng{' '}
                  {excelPreview.result.duplicates} · lỗi{' '}
                  {excelPreview.result.invalid} · không hỗ trợ{' '}
                  {excelPreview.result.unsupported}
                </Text>
                <Text style={styles.previewNotice}>
                  Chưa có dữ liệu nào được ghi. Dòng trùng và dòng lỗi không thể chọn.
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Đóng xem trước Excel"
                style={styles.previewClose}
                onPress={closeExcelPreview}
              >
                <Text style={styles.previewCloseText}>Đóng</Text>
              </TouchableOpacity>
            </View>
            {excelPreview.result.rows.map(row => {
              const isReady = row.status === 'READY';
              const selected = excelPreview.selectedRows.includes(row.row);
              const statusLabel =
                row.status === 'READY'
                  ? 'Sẵn sàng'
                  : row.status === 'DUPLICATE'
                  ? 'Đã có trong dữ liệu'
                  : row.status === 'INVALID'
                  ? 'Dữ liệu không hợp lệ'
                  : 'Chưa hỗ trợ';
              return (
                <TouchableOpacity
                  key={row.row}
                  accessibilityRole={isReady ? 'checkbox' : 'text'}
                  accessibilityState={isReady ? { checked: selected } : undefined}
                  disabled={!isReady}
                  style={[styles.previewRow, !isReady && styles.previewRowMuted]}
                  onPress={() => toggleExcelRow(row.row)}
                >
                  {isReady ? (
                    <View
                      style={[
                        styles.previewCheckbox,
                        selected && styles.previewCheckboxSelected,
                      ]}
                    >
                      {selected ? <Text style={styles.previewCheck}>✓</Text> : null}
                    </View>
                  ) : (
                    <View style={styles.previewStatusIcon}>
                      <Text style={styles.previewStatusIconText}>!</Text>
                    </View>
                  )}
                  <View style={styles.actionCopy}>
                    <View style={styles.previewRowHeader}>
                      <Text style={styles.previewAmount}>
                        Dòng {row.row} · {row.type === 'INCOME' ? 'Thu' : 'Chi'}{' '}
                        {formatCurrency(row.amount ?? 0, 'VND')}
                      </Text>
                      <Text
                        style={[
                          styles.previewStatus,
                          isReady
                            ? styles.previewStatusReady
                            : styles.previewStatusBlocked,
                        ]}
                      >
                        {statusLabel}
                      </Text>
                    </View>
                    <Text style={styles.draftMeta} numberOfLines={3}>
                      {row.date ? `${formatPreviewDate(row.date)} · ` : ''}
                      {row.wallet || 'Chưa có ví'} ·{' '}
                      {row.category || 'Chưa có danh mục'}
                      {row.note ? ` · ${row.note}` : ''}
                    </Text>
                    {row.reason ? (
                      <Text style={styles.previewReason}>{row.reason}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              accessibilityRole="button"
              style={[
                styles.importButton,
                excelPreview.selectedRows.length === 0 && styles.disabledButton,
              ]}
              disabled={excelPreview.selectedRows.length === 0 || isImporting}
              onPress={confirmExcelImport}
            >
              {isImporting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.importButtonText}>
                  Nhập {excelPreview.selectedRows.length} dòng đã chọn
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
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

        <View style={styles.draftCard}>
          <View style={styles.draftHeader}>
            <View style={styles.actionIcon}>
              <CloudOff size={22} color={Colors.primary} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.cardTitle}>Bản nháp ngoại tuyến</Text>
              <Text style={styles.cardText}>
                Chưa làm thay đổi số dư cho đến khi máy chủ xác nhận.
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Đồng bộ bản nháp ngoại tuyến"
              style={styles.syncButton}
              onPress={syncOfflineDrafts}
              disabled={isSyncingDrafts || offlineDrafts.length === 0}
            >
              {isSyncingDrafts ? (
                <ActivityIndicator color={Colors.primary} size="small" />
              ) : (
                <RefreshCw size={18} color={Colors.primary} />
              )}
            </TouchableOpacity>
          </View>
          {offlineDrafts.length === 0 ? (
            <Text style={styles.emptyDraft}>Không có giao dịch đang chờ.</Text>
          ) : (
            offlineDrafts.map(draft => {
              const isEditing = draftEditor?.id === draft.id;
              const compatibleCategories = (cache?.categories ?? []).filter(
                category =>
                  category.type === draft.payload.type &&
                  (category.cash_flow_group ?? 'NORMAL') === 'NORMAL',
              );
              return (
                <View key={draft.id} style={styles.draftItem}>
                  <View style={styles.draftRow}>
                    <View style={styles.actionCopy}>
                      <Text style={styles.draftAmount}>
                        {draft.payload.type === 'INCOME' ? '+' : '-'}
                        {formatCurrency(
                          Number(draft.payload.amount),
                          getDraftCurrency(draft),
                        )}
                      </Text>
                      <Text style={styles.draftMeta} numberOfLines={2}>
                        {draft.payload.note || 'Giao dịch chưa có ghi chú'} ·{' '}
                        {draft.status === 'NEEDS_REVIEW'
                          ? `Cần kiểm tra: ${
                              draft.lastError || 'dữ liệu chưa hợp lệ'
                            }`
                          : 'Đang chờ đồng bộ'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Sửa bản nháp"
                      style={styles.editDraftButton}
                      onPress={() =>
                        isEditing
                          ? setDraftEditor(null)
                          : editOfflineDraft(draft)
                      }
                    >
                      <Pencil size={17} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Xóa bản nháp"
                      style={styles.deleteDraftButton}
                      onPress={() => removeOfflineDraft(draft)}
                    >
                      <Trash2 size={17} color="#C9483D" />
                    </TouchableOpacity>
                  </View>

                  {isEditing && draftEditor ? (
                    <View style={styles.draftEditor}>
                      <Text style={styles.editorTitle}>
                        Xem lại trước khi đồng bộ
                      </Text>
                      <Text style={styles.editorLabel}>Số tiền</Text>
                      <TextInput
                        style={styles.editorInput}
                        value={draftEditor.amount}
                        onChangeText={amount =>
                          setDraftEditor(current =>
                            current ? { ...current, amount } : current,
                          )
                        }
                        keyboardType="decimal-pad"
                        placeholder="Ví dụ: 125000"
                        placeholderTextColor="#A8866C"
                      />

                      <Text style={styles.editorLabel}>Ví</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.editorChoices}
                      >
                        {(cache?.wallets ?? [])
                          .filter(wallet => wallet.wallet_type !== 'SAVINGS')
                          .map(wallet => {
                            const selected = draftEditor.walletId === wallet.id;
                            return (
                              <TouchableOpacity
                                key={wallet.id}
                                style={[
                                  styles.editorChip,
                                  selected && styles.editorChipSelected,
                                ]}
                                onPress={() =>
                                  setDraftEditor(current =>
                                    current
                                      ? { ...current, walletId: wallet.id }
                                      : current,
                                  )
                                }
                              >
                                <Text
                                  style={[
                                    styles.editorChipText,
                                    selected && styles.editorChipTextSelected,
                                  ]}
                                >
                                  {wallet.name}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                      </ScrollView>

                      <Text style={styles.editorLabel}>Danh mục</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.editorChoices}
                      >
                        {compatibleCategories.map(category => {
                          const selected =
                            draftEditor.categoryId === category.id;
                          return (
                            <TouchableOpacity
                              key={category.id}
                              style={[
                                styles.editorChip,
                                selected && styles.editorChipSelected,
                              ]}
                              onPress={() =>
                                setDraftEditor(current =>
                                  current
                                    ? { ...current, categoryId: category.id }
                                    : current,
                                )
                              }
                            >
                              <Text
                                style={[
                                  styles.editorChipText,
                                  selected && styles.editorChipTextSelected,
                                ]}
                              >
                                {category.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>

                      <Text style={styles.editorLabel}>Ghi chú</Text>
                      <TextInput
                        style={[styles.editorInput, styles.editorNoteInput]}
                        value={draftEditor.note}
                        onChangeText={note =>
                          setDraftEditor(current =>
                            current ? { ...current, note } : current,
                          )
                        }
                        multiline
                        placeholder="Nội dung giao dịch"
                        placeholderTextColor="#A8866C"
                      />
                      <TouchableOpacity
                        style={styles.saveDraftButton}
                        onPress={confirmDraftUpdate}
                      >
                        <Text style={styles.saveDraftButtonText}>
                          Lưu bản nháp đã sửa
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.editorHint}>
                        Chưa thay đổi số dư. Nhấn nút đồng bộ phía trên khi bạn
                        đã kiểm tra xong.
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('PersonalBackup')}
        >
          <View style={styles.actionIcon}>
            <LockKeyhole size={22} color={Colors.primary} />
          </View>
          <View style={styles.actionCopy}>
            <Text style={styles.cardTitle}>Backup cá nhân mã hóa</Text>
            <Text style={styles.cardText}>
              Tạo file có mật khẩu hoặc xem trước từng giao dịch trước khi khôi
              phục.
            </Text>
          </View>
        </TouchableOpacity>

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
  draftCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0C49B',
    backgroundColor: Colors.white,
    padding: 14,
    gap: 10,
  },
  draftHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  syncButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0DF',
  },
  emptyDraft: { color: '#8B6B55', fontSize: 12, fontWeight: '700' },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  draftItem: {
    borderTopWidth: 1,
    borderTopColor: '#F5E3D3',
    paddingTop: 10,
    gap: 10,
  },
  draftAmount: { color: '#4A2B1A', fontWeight: '900' },
  draftMeta: {
    color: '#8B6B55',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  deleteDraftButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#FFF0EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editDraftButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftEditor: {
    borderRadius: 16,
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#F0C49B',
    padding: 12,
    gap: 8,
  },
  editorTitle: { color: '#4A2B1A', fontSize: 14, fontWeight: '900' },
  editorLabel: { color: '#7A5438', fontSize: 11, fontWeight: '900' },
  editorInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8C6A7',
    backgroundColor: Colors.white,
    color: '#4A2B1A',
    paddingHorizontal: 12,
    fontWeight: '700',
  },
  editorNoteInput: { minHeight: 72, paddingTop: 11, textAlignVertical: 'top' },
  editorChoices: { gap: 8, paddingRight: 10 },
  editorChip: {
    minHeight: 36,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E8C6A7',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FFE8CE',
  },
  editorChipText: { color: '#7A5438', fontSize: 12, fontWeight: '800' },
  editorChipTextSelected: { color: Colors.primary },
  saveDraftButton: {
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDraftButtonText: { color: Colors.white, fontWeight: '900' },
  editorHint: { color: '#8B6B55', fontSize: 11, lineHeight: 16 },
  previewCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0A45D',
    backgroundColor: '#FFF8F0',
    padding: 14,
    gap: 10,
  },
  previewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  previewTitle: { color: '#4A2B1A', fontSize: 16, fontWeight: '900' },
  previewNotice: {
    color: '#8B6B55',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 7,
  },
  previewClose: { paddingHorizontal: 10, paddingVertical: 7 },
  previewCloseText: { color: '#A45118', fontWeight: '900', fontSize: 12 },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F5E3D3',
    paddingTop: 10,
  },
  previewRowMuted: { backgroundColor: '#FFF3E8', borderRadius: 14, padding: 10 },
  previewRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  previewCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E78A3A',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  previewCheckboxSelected: { backgroundColor: Colors.primary },
  previewCheck: { color: Colors.white, fontWeight: '900' },
  previewStatusIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#F4D7BC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewStatusIconText: { color: '#A45118', fontWeight: '900' },
  previewAmount: { color: '#4A2B1A', fontWeight: '900', fontSize: 12 },
  previewStatus: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
  },
  previewStatusReady: { color: '#176B3A', backgroundColor: '#DDF4E5' },
  previewStatusBlocked: { color: '#93470F', backgroundColor: '#F7DEC7' },
  previewReason: {
    color: '#93470F',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 5,
  },
  importButton: {
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  disabledButton: { opacity: 0.45 },
  importButtonText: { color: Colors.white, fontWeight: '900' },
});

export default DataManagementScreen;
