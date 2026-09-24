import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ImagePlus, MoreHorizontal, Plus, Search, X } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import CategoryIcon from '../../components/CategoryIcon';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { categoriesService } from '../../services/categories';
import { resolveCategoryIconUrl } from '../../utils/categoryIcons';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import { filterNormalCashFlowCategories } from '../../utils/transactionClassification';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { ApiCategoryCashFlowGroup, ApiCategoryType, Category } from '../../types/category';

type Props = NativeStackScreenProps<RootStackParamList, 'Categories'>;
type ModalMode = 'create' | 'edit' | 'delete' | null;
type CategoryScopeFilter = 'ALL' | 'SYSTEM' | 'PERSONAL';
type CategoryIconUploadFile = {
  uri: string;
  name: string;
  type: string;
};

const cashFlowGroupLabels: Record<ApiCategoryCashFlowGroup, string> = {
  NORMAL: 'Thu chi thường',
  LOAN_DEBT: 'Vay/nợ',
  SAVING_TRANSFER: 'Chuyển tiết kiệm',
};

const typeLabels: Record<ApiCategoryType, string> = {
  EXPENSE: 'Chi',
  INCOME: 'Thu',
};

const scopeFilterLabels: Record<CategoryScopeFilter, string> = {
  ALL: 'Tất cả',
  SYSTEM: 'Hệ thống',
  PERSONAL: 'Cá nhân',
};

const CategoriesScreen = ({ navigation, route }: Props) => {
  const { token, user } = useAuth();
  const {
    categories,
    selectedBudgetCategory,
    selectedTransactionCategory,
    setCategories,
    setSelectedBudgetCategory,
    setSelectedTransactionCategory,
  } =
    useFinance();
  const selectTarget = route.params?.selectTarget ?? 'transaction';
  const isBudgetSelectTarget = selectTarget === 'budget';
  const [activeType, setActiveType] = useState<ApiCategoryType>(
    isBudgetSelectTarget
      ? 'EXPENSE'
      : route.params?.categoryType ??
          selectedTransactionCategory?.type ??
          'EXPENSE',
  );
  const [scopeFilter, setScopeFilter] = useState<CategoryScopeFilter>('ALL');
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState<ApiCategoryType>('EXPENSE');
  const [categoryCashFlowGroup, setCategoryCashFlowGroup] = useState<ApiCategoryCashFlowGroup>('NORMAL');
  const [iconFile, setIconFile] = useState<CategoryIconUploadFile | null>(null);

  const isSelectMode = Boolean(route.params?.selectMode);
  const canCreateCategory = user?.role === 'PREMIUM' || user?.role === 'ADMIN';
  const canUseScopeFilter = canCreateCategory;

  const fetchCategories = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await categoriesService.getAll(token);
      setCategories(response);
    } catch (error) {
      Alert.alert('Lỗi tải danh mục', getUserFriendlyErrorMessage(error, 'Không thể tải danh mục.'));
    } finally {
      setIsLoading(false);
    }
  }, [setCategories, token]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (!canUseScopeFilter && scopeFilter !== 'ALL') {
      setScopeFilter('ALL');
    }
  }, [canUseScopeFilter, scopeFilter]);

  const visibleCategories = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return filterNormalCashFlowCategories(categories).filter(category => {
      const matchedType = category.type === (isBudgetSelectTarget ? 'EXPENSE' : activeType);
      const matchedKeyword = !keyword || category.name.toLowerCase().includes(keyword);
      const matchedScope =
        scopeFilter === 'ALL'
          ? true
          : scopeFilter === 'SYSTEM'
            ? Boolean(category.is_system)
            : !category.is_system;

      return matchedType && matchedKeyword && matchedScope;
    });
  }, [activeType, categories, isBudgetSelectTarget, scopeFilter, searchText]);

  const closeModal = () => {
    setModalMode(null);
    setSelectedCategory(null);
    setCategoryName('');
    setCategoryType(activeType);
    setCategoryCashFlowGroup('NORMAL');
    setIconFile(null);
  };

  const openCreateModal = () => {
    if (!canCreateCategory) {
      Alert.alert('Cần Premium', 'Tài khoản hiện tại chưa thể thêm danh mục cá nhân.');
      return;
    }

    setSelectedCategory(null);
    setCategoryName('');
    setCategoryType(activeType);
    setCategoryCashFlowGroup('NORMAL');
    setIconFile(null);
    setModalMode('create');
  };

  const openEditModal = (category: Category) => {
    if (category.is_system) {
      return;
    }

    setSelectedCategory(category);
    setCategoryName(category.name);
    setCategoryType(category.type);
    setCategoryCashFlowGroup(category.cash_flow_group ?? 'NORMAL');
    setIconFile(null);
    setModalMode('edit');
  };

  const handlePickIcon = async () => {
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
      Alert.alert('Chưa chọn được ảnh', 'Vui lòng chọn ảnh JPG, PNG hoặc WEBP.');
      return;
    }

    const type = asset.type ?? 'image/jpeg';

    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(type)) {
      Alert.alert('Ảnh chưa hợp lệ', 'Icon chỉ hỗ trợ JPG, PNG hoặc WEBP.');
      return;
    }

    setIconFile({
      uri: asset.uri,
      name: asset.fileName ?? `category-icon-${Date.now()}.${type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'}`,
      type,
    });
  };

  const handleSelectCategory = (category: Category) => {
    if (!isSelectMode) {
      return;
    }

    if (selectTarget === 'budget') {
      setSelectedBudgetCategory(category);
    } else {
      setSelectedTransactionCategory(category);
    }
    navigation.goBack();
  };

  const saveCategory = async () => {
    if (!token) {
      return;
    }

    if (!categoryName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên danh mục.');
      return;
    }

    setIsSaving(true);

    try {
      if (modalMode === 'edit' && selectedCategory) {
        const updatedCategory = await categoriesService.update(token, selectedCategory.id, {
          name: categoryName.trim(),
          type: categoryType,
          cash_flow_group: categoryCashFlowGroup,
        });

        if (iconFile) {
          await categoriesService.uploadIcon(token, updatedCategory.id, iconFile);
        }
      } else {
        const createdCategory = await categoriesService.create(token, {
          name: categoryName.trim(),
          type: categoryType,
          cash_flow_group: categoryCashFlowGroup,
        });

        if (iconFile) {
          await categoriesService.uploadIcon(token, createdCategory.id, iconFile);
        }
      }

      await fetchCategories();
      closeModal();
    } catch (error) {
      Alert.alert('Lưu danh mục thất bại', getUserFriendlyErrorMessage(error, 'Không thể lưu danh mục.'));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCategory = async () => {
    if (!token || !selectedCategory || selectedCategory.is_system) {
      return;
    }

    setIsSaving(true);

    try {
      await categoriesService.remove(token, selectedCategory.id);
      await fetchCategories();
      closeModal();
    } catch (error) {
      Alert.alert('Xóa danh mục thất bại', getUserFriendlyErrorMessage(error, 'Không thể xóa danh mục.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>
        <Text style={styles.title}>Danh mục</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchBox}>
        <Search size={18} color="#A26B48" />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm danh mục"
          placeholderTextColor="#A26B48"
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {!isBudgetSelectTarget ? (
        <View style={styles.segment}>
          {(['EXPENSE', 'INCOME'] as ApiCategoryType[]).map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.segmentButton, activeType === type && styles.segmentButtonActive]}
              onPress={() => setActiveType(type)}>
              <Text style={[styles.segmentText, activeType === type && styles.segmentTextActive]}>
                {typeLabels[type]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {canUseScopeFilter ? (
        <View style={styles.scopeSegment}>
          {(['ALL', 'SYSTEM', 'PERSONAL'] as CategoryScopeFilter[]).map(scope => (
            <TouchableOpacity
              key={scope}
              style={[styles.scopeButton, scopeFilter === scope && styles.scopeButtonActive]}
              onPress={() => setScopeFilter(scope)}>
              <Text style={[styles.scopeText, scopeFilter === scope && styles.scopeTextActive]}>
                {scopeFilterLabels[scope]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : visibleCategories.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Không tìm thấy danh mục</Text>
          </View>
        ) : (
          visibleCategories.map(category => {
            const isSelected =
              isSelectMode &&
              (selectTarget === 'budget'
                ? selectedBudgetCategory?.id
                : selectedTransactionCategory?.id) === category.id;
            const canEditCategory = !category.is_system && canCreateCategory;

            return (
              <TouchableOpacity
                key={category.id}
                style={[styles.categoryCard, isSelected && styles.categoryCardActive]}
                onPress={() => handleSelectCategory(category)}
                activeOpacity={isSelectMode ? 0.8 : 1}>
                <View style={[styles.iconBox, isSelected && styles.iconBoxActive]}>
                  <CategoryIcon icon={category.icon} size={20} />
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.categoryMeta}>{category.is_system ? 'Hệ thống' : 'Cá nhân'}</Text>
                </View>
                {canEditCategory && (
                  <TouchableOpacity style={styles.menuButton} onPress={() => openEditModal(category)}>
                    <MoreHorizontal size={20} color="#9C7255" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {canCreateCategory && (
        <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
          <Plus size={26} color={Colors.white} />
        </TouchableOpacity>
      )}

      <Modal transparent visible={modalMode !== null} animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}>
          <Pressable style={styles.backdropPressable} onPress={closeModal} />
          <Pressable style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {modalMode === 'delete' ? (
              <>
                <Text style={styles.modalTitle}>Xóa danh mục</Text>
                <Text style={styles.modalDescription}>{selectedCategory?.name}</Text>
                <TouchableOpacity style={styles.dangerButton} onPress={deleteCategory}>
                  {isSaving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryButtonText}>Xóa</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>
                  {modalMode === 'edit' ? 'Sửa danh mục' : 'Thêm danh mục'}
                </Text>
                <Text style={styles.inputLabel}>Tên danh mục</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ví dụ: cà phê, đầu tư, thú cưng"
                  value={categoryName}
                  onChangeText={setCategoryName}
                />

                <Text style={styles.inputLabel}>Loại danh mục</Text>
                <View style={styles.modalSegment}>
                  {(['EXPENSE', 'INCOME'] as ApiCategoryType[]).map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.modalSegmentButton, categoryType === type && styles.modalSegmentButtonActive]}
                      onPress={() => setCategoryType(type)}>
                      <Text style={[styles.modalSegmentText, categoryType === type && styles.modalSegmentTextActive]}>
                        {typeLabels[type]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.inputLabel}>Nhóm dòng tiền</Text>
                <View style={styles.modalSegment}>
                  {(['NORMAL', 'LOAN_DEBT'] as ApiCategoryCashFlowGroup[]).map(group => (
                    <TouchableOpacity
                      key={group}
                      style={[styles.modalSegmentButton, categoryCashFlowGroup === group && styles.modalSegmentButtonActive]}
                      onPress={() => setCategoryCashFlowGroup(group)}>
                      <Text style={[styles.modalSegmentText, categoryCashFlowGroup === group && styles.modalSegmentTextActive]}>
                        {cashFlowGroupLabels[group]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Icon danh mục</Text>
                <View style={styles.iconPreviewCard}>
                  <View style={styles.iconPreviewBox}>
                    {iconFile ? (
                      <Image source={{ uri: iconFile.uri }} style={styles.iconPreviewImage} />
                    ) : selectedCategory?.icon ? (
                      <Image
                        source={{ uri: resolveCategoryIconUrl(selectedCategory.icon) ?? undefined }}
                        style={styles.iconPreviewImage}
                      />
                    ) : (
                      <CategoryIcon icon={null} size={28} />
                    )}
                  </View>
                  <View style={styles.iconPreviewInfo}>
                    <Text style={styles.iconPreviewTitle} numberOfLines={1}>
                      {iconFile ? iconFile.name : 'Chưa chọn icon mới'}
                    </Text>
                    <Text style={styles.iconPreviewText}>JPG, PNG hoặc WEBP.</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.iconActionButton}
                    onPress={iconFile ? () => setIconFile(null) : handlePickIcon}>
                    {iconFile ? (
                      <X size={18} color="#A94F18" />
                    ) : (
                      <ImagePlus size={18} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                </View>
                {!iconFile ? (
                  <TouchableOpacity style={styles.iconPickerButton} onPress={handlePickIcon}>
                    <ImagePlus size={18} color={Colors.primary} />
                    <Text style={styles.iconPickerText}>Chọn icon</Text>
                  </TouchableOpacity>
                ) : null}

                <View style={styles.modalActions}>
                  {modalMode === 'edit' && (
                    <TouchableOpacity style={styles.outlineDangerButton} onPress={() => setModalMode('delete')}>
                      <Text style={styles.outlineDangerText}>Xóa</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.primaryButton} onPress={saveCategory}>
                    {isSaving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryButtonText}>Lưu</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
  },
  header: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
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
  headerSpacer: {
    width: 42,
    height: 42,
  },
  title: {
    flex: 1,
    color: '#4A2B1A',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  searchBox: {
    marginHorizontal: 16,
    backgroundColor: '#FFFDFB',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#EBC4A4',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#4A2B1A',
    paddingVertical: 13,
    fontSize: 16,
  },
  segment: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFE3C8',
    borderRadius: 999,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#F28C28',
  },
  segmentText: {
    color: '#9C7255',
    fontWeight: '800',
  },
  segmentTextActive: {
    color: Colors.white,
  },
  scopeSegment: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    gap: 8,
  },
  scopeButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: '#FFFDFB',
    borderWidth: 1.2,
    borderColor: '#EBC4A4',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  scopeButtonActive: {
    backgroundColor: '#F28C28',
    borderColor: '#F28C28',
  },
  scopeText: {
    color: '#8B6548',
    fontSize: 12,
    fontWeight: '900',
  },
  scopeTextActive: {
    color: Colors.white,
  },
  content: {
    padding: 16,
    paddingBottom: 112,
    gap: 12,
  },
  loadingBlock: {
    paddingVertical: 36,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFDFB',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#EBC4A4',
  },
  categoryCardActive: {
    backgroundColor: '#FFF4EA',
    borderColor: '#F28C28',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFF0E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxActive: {
    backgroundColor: '#FFE0BF',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    color: '#4A2B1A',
    fontSize: 16,
    fontWeight: '800',
  },
  categoryMeta: {
    color: '#8B6548',
    marginTop: 4,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: '#FFFDFB',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#EBC4A4',
  },
  emptyTitle: {
    color: '#4A2B1A',
    fontSize: 18,
    fontWeight: '800',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 26,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F28C28',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D96D08',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(36, 22, 12, 0.38)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFill,
  },
  modalCard: {
    backgroundColor: '#FFFDFB',
    borderRadius: 28,
    padding: 20,
    maxHeight: '82%',
    borderWidth: 1,
    borderColor: '#F0D6C1',
    shadowColor: '#7A3E12',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  modalTitle: {
    color: '#4A2B1A',
    fontSize: 22,
    fontWeight: '800',
  },
  modalDescription: {
    color: '#8B6548',
    marginTop: 10,
    lineHeight: 22,
  },
  inputLabel: {
    color: '#7B573C',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF8F2',
    borderWidth: 1,
    borderColor: '#F0D6C1',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#4A2B1A',
    fontSize: 16,
  },
  modalSegment: {
    flexDirection: 'row',
    backgroundColor: '#FFE3C8',
    borderRadius: 999,
    padding: 4,
  },
  modalSegmentButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSegmentButtonActive: {
    backgroundColor: '#F28C28',
  },
  modalSegmentText: {
    color: '#9C7255',
    fontWeight: '800',
  },
  modalSegmentTextActive: {
    color: Colors.white,
  },
  iconPreviewCard: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    backgroundColor: '#FFF8F2',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconPreviewBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFF0E2',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconPreviewImage: {
    width: '100%',
    height: '100%',
  },
  iconPreviewInfo: {
    flex: 1,
  },
  iconPreviewTitle: {
    color: '#4A2B1A',
    fontWeight: '900',
  },
  iconPreviewText: {
    color: '#8B6548',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  iconActionButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#FFF0E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPickerButton: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    backgroundColor: '#FFF8F2',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  iconPickerText: {
    color: Colors.primary,
    fontWeight: '900',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#FF8C00',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 16,
  },
  dangerButton: {
    marginTop: 18,
    backgroundColor: '#C75A1B',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 16,
  },
  outlineDangerButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#C75A1B',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 16,
  },
  outlineDangerText: {
    color: '#C75A1B',
    fontWeight: '800',
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
});

export default CategoriesScreen;
