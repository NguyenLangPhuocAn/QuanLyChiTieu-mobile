import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowLeft, MoreHorizontal, Plus, Search } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import CategoryIcon from '../../components/CategoryIcon';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { categoriesService } from '../../services/categories';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { ApiCategoryType, Category } from '../../types/category';

type Props = NativeStackScreenProps<RootStackParamList, 'Categories'>;
type ModalMode = 'create' | 'edit' | 'delete' | null;

const typeLabels: Record<ApiCategoryType, string> = {
  EXPENSE: 'Chi',
  INCOME: 'Thu',
};

const CategoriesScreen = ({ navigation, route }: Props) => {
  const { token, user } = useAuth();
  const { categories, selectedTransactionCategory, setCategories, setSelectedTransactionCategory } =
    useFinance();
  const [activeType, setActiveType] = useState<ApiCategoryType>(
    selectedTransactionCategory?.type ?? 'EXPENSE',
  );
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState<ApiCategoryType>('EXPENSE');

  const isSelectMode = Boolean(route.params?.selectMode);
  const canCreateCategory = user?.role === 'PREMIUM' || user?.role === 'ADMIN';

  const fetchCategories = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await categoriesService.getAll(token);
      setCategories(response);
    } catch (error) {
      Alert.alert('Lỗi tải danh mục', error instanceof Error ? error.message : 'Không thể tải danh mục.');
    } finally {
      setIsLoading(false);
    }
  }, [setCategories, token]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const visibleCategories = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return categories.filter(category => {
      const matchedType = category.type === activeType;
      const matchedKeyword = !keyword || category.name.toLowerCase().includes(keyword);

      return matchedType && matchedKeyword;
    });
  }, [activeType, categories, searchText]);

  const closeModal = () => {
    setModalMode(null);
    setSelectedCategory(null);
    setCategoryName('');
    setCategoryType(activeType);
  };

  const openCreateModal = () => {
    if (!canCreateCategory) {
      Alert.alert('Cần Premium', 'Tài khoản hiện tại chưa thể thêm danh mục cá nhân.');
      return;
    }

    setSelectedCategory(null);
    setCategoryName('');
    setCategoryType(activeType);
    setModalMode('create');
  };

  const openEditModal = (category: Category) => {
    if (category.is_system) {
      return;
    }

    setSelectedCategory(category);
    setCategoryName(category.name);
    setCategoryType(category.type);
    setModalMode('edit');
  };

  const handleSelectCategory = (category: Category) => {
    if (!isSelectMode) {
      return;
    }

    setSelectedTransactionCategory(category);
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
        await categoriesService.update(token, selectedCategory.id, {
          name: categoryName.trim(),
          type: categoryType,
        });
      } else {
        await categoriesService.create(token, {
          name: categoryName.trim(),
          type: categoryType,
        });
      }

      await fetchCategories();
      closeModal();
    } catch (error) {
      Alert.alert('Lưu danh mục thất bại', error instanceof Error ? error.message : 'Không thể lưu danh mục.');
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
      Alert.alert('Xóa danh mục thất bại', error instanceof Error ? error.message : 'Không thể xóa danh mục.');
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
        <TouchableOpacity style={styles.headerButton} onPress={openCreateModal}>
          <Plus size={22} color="#593420" />
        </TouchableOpacity>
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
            const isSelected = isSelectMode && selectedTransactionCategory?.id === category.id;
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
        <Pressable style={styles.modalBackdrop} onPress={closeModal}>
          <Pressable style={styles.modalCard}>
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
          </Pressable>
        </Pressable>
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
    backgroundColor: 'rgba(36, 22, 12, 0.24)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFDFB',
    borderRadius: 22,
    padding: 20,
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
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#F28C28',
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
