import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Hash, Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { tagsService } from '../../services/tags';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { TagItem } from '../../types/tag';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import { normalizeTagName as normalizeTagInput } from '../../utils/hashtags';

const HashtagsScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token } = useAuth();
  const { tags, setTags } = useFinance();
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [mergeTargetName, setMergeTargetName] = useState('');
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const fetchTags = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await tagsService.getAll(token);
      setTags(response);
    } catch (error) {
      Alert.alert(
        'Không tải được hashtag',
        getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [setTags, token]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const filteredTags = useMemo(() => {
    const keyword = normalizeTagInput(query);

    if (!keyword) {
      return tags;
    }

    return tags.filter(tag => normalizeTagInput(tag.name).includes(keyword));
  }, [query, tags]);

  const openCreateModal = () => {
    setEditingTag(null);
    setName('');
    setMergeTargetName('');
    setIsModalVisible(true);
  };

  const openEditModal = (tag: TagItem) => {
    setEditingTag(tag);
    setName(tag.name);
    setMergeTargetName('');
    setIsModalVisible(true);
  };

  const closeModal = () => {
    if (isSaving) {
      return;
    }

    setIsModalVisible(false);
    setEditingTag(null);
    setName('');
    setMergeTargetName('');
  };

  const handleSave = async () => {
    if (!token) {
      return;
    }

    const normalized = normalizeTagInput(name);

    if (!normalized) {
      Alert.alert('Thiếu hashtag', 'Vui lòng nhập tên hashtag.');
      return;
    }

    setIsSaving(true);

    try {
      const nextTags = editingTag
        ? await tagsService.update(token, editingTag.id, normalized)
        : await tagsService.create(token, normalized);

      setTags(nextTags);
      closeModal();
    } catch (error) {
      Alert.alert(
        'Chưa lưu được hashtag',
        getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (tag: TagItem) => {
    Alert.alert(
      'Xóa hashtag',
      `Hashtag #${tag.name} sẽ được gỡ khỏi các giao dịch đang dùng. Bạn vẫn muốn xóa?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            if (!token) {
              return;
            }

            try {
              const nextTags = await tagsService.remove(token, tag.id);
              setTags(nextTags);
            } catch (error) {
              Alert.alert(
                'Chưa xóa được hashtag',
                getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.'),
              );
            }
          },
        },
      ],
    );
  };

  const handleMerge = async () => {
    if (!token || !editingTag) {
      return;
    }

    const normalized = normalizeTagInput(mergeTargetName);

    if (!normalized) {
      Alert.alert('Thiếu hashtag đích', 'Nhập hashtag muốn gộp vào.');
      return;
    }

    setIsSaving(true);

    try {
      const nextTags = await tagsService.merge(
        token,
        editingTag.id,
        normalized,
      );
      setTags(nextTags);
      closeModal();
    } catch (error) {
      Alert.alert(
        'Chưa gộp được hashtag',
        getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.'),
      );
    } finally {
      setIsSaving(false);
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
        <Text style={styles.title}>Hashtag</Text>
        <TouchableOpacity style={styles.headerButton} onPress={openCreateModal}>
          <Plus size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Hash size={18} color="#A26B48" />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm hashtag"
          placeholderTextColor="#A98A73"
          autoCapitalize="none"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')}>
            <X size={18} color="#A26B48" />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : filteredTags.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Hash size={28} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {query.trim() ? 'Không tìm thấy hashtag' : 'Chưa có hashtag'}
            </Text>
            <Text style={styles.emptyText}>
              {query.trim()
                ? 'Thử tên khác hoặc xóa nội dung tìm kiếm.'
                : 'Tạo hashtag để dùng nhanh khi thêm giao dịch và lọc lịch sử.'}
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={openCreateModal}
            >
              <Text style={styles.primaryButtonText}>Tạo hashtag</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredTags.map(tag => (
            <View key={tag.id} style={styles.tagRow}>
              <View style={styles.tagIcon}>
                <Hash size={18} color={Colors.primary} />
              </View>
              <View style={styles.tagInfo}>
                <Text style={styles.tagName} numberOfLines={1}>
                  #{tag.name}
                </Text>
                <Text style={styles.tagMeta}>
                  {tag.usage_count} giao dịch đang dùng
                </Text>
              </View>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => openEditModal(tag)}
              >
                <Pencil size={17} color="#8A623F" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, styles.deleteIconButton]}
                onPress={() => confirmDelete(tag)}
              >
                <Trash2 size={17} color="#B42318" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <Modal transparent visible={isModalVisible} animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable style={styles.backdropPressable} onPress={closeModal} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingTag ? 'Sửa hashtag' : 'Tạo hashtag'}
            </Text>
            <Text style={styles.modalHint}>
              Hashtag dùng để nhóm, lọc và thống kê giao dịch.
            </Text>
            <Text style={styles.inputLabel}>Tên hashtag</Text>
            <View style={styles.inputBox}>
              <Text style={styles.hashPrefix}>#</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="ví dụ: antrua"
                placeholderTextColor="#B58A6A"
                autoCapitalize="none"
                autoFocus
              />
            </View>
            {editingTag ? (
              <>
                <Text style={styles.inputLabel}>Gộp vào hashtag</Text>
                <View style={styles.inputBox}>
                  <Text style={styles.hashPrefix}>#</Text>
                  <TextInput
                    style={styles.input}
                    value={mergeTargetName}
                    onChangeText={setMergeTargetName}
                    placeholder="ví dụ: cong-viec"
                    placeholderTextColor="#B58A6A"
                    autoCapitalize="none"
                  />
                </View>
                <TouchableOpacity
                  style={styles.mergeButton}
                  onPress={handleMerge}
                  disabled={isSaving}
                >
                  <Text style={styles.mergeButtonText}>Gộp hashtag này</Text>
                </TouchableOpacity>
              </>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={closeModal}
              >
                <Text style={styles.secondaryButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                {isSaving ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Lưu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF3E8' },
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
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#4C2A18',
    fontSize: 24,
    fontWeight: '900',
  },
  searchBox: {
    marginHorizontal: 16,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: Colors.white,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, color: '#4C2A18', fontWeight: '800' },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  loadingCard: {
    minHeight: 120,
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    borderRadius: 24,
    backgroundColor: Colors.white,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 20,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#4C2A18',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 12,
  },
  emptyText: {
    color: '#8A623F',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },
  primaryButton: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonText: { color: Colors.white, fontWeight: '900' },
  tagRow: {
    minHeight: 74,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tagIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagInfo: { flex: 1, minWidth: 0 },
  tagName: { color: '#4C2A18', fontSize: 16, fontWeight: '900' },
  tagMeta: { color: '#8A623F', fontSize: 12, fontWeight: '700', marginTop: 4 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#FFF5EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  deleteIconButton: { backgroundColor: '#FFF0F0' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(36, 22, 12, 0.38)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  backdropPressable: { ...StyleSheet.absoluteFill },
  modalCard: {
    borderRadius: 28,
    backgroundColor: Colors.white,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 20,
  },
  modalTitle: { color: '#4C2A18', fontSize: 22, fontWeight: '900' },
  modalHint: { color: '#8A623F', marginTop: 8, lineHeight: 20 },
  inputLabel: {
    color: '#7B4A25',
    fontWeight: '900',
    marginTop: 16,
    marginBottom: 8,
  },
  inputBox: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: '#FFF8F2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  hashPrefix: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: '900',
    marginRight: 4,
  },
  input: { flex: 1, color: '#4C2A18', fontWeight: '800' },
  mergeButton: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    paddingVertical: 12,
  },
  mergeButtonText: { color: Colors.primary, fontWeight: '900' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  secondaryButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    paddingVertical: 14,
  },
  secondaryButtonText: { color: '#8A623F', fontWeight: '900' },
  saveButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingVertical: 14,
  },
  saveButtonText: { color: Colors.white, fontWeight: '900' },
});

export default HashtagsScreen;
