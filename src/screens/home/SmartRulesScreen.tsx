import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
  Trash2,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import {
  normalizeSmartRuleKeyword,
  smartRulesService,
} from '../../services/smartRules';
import type { SmartRule } from '../../types/smartRule';
import { filterNormalCashFlowCategories } from '../../utils/transactionClassification';

const SmartRulesScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { categories } = useFinance();
  const [rules, setRules] = useState<SmartRule[]>([]);
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const expenseCategories = useMemo(
    () =>
      filterNormalCashFlowCategories(categories).filter(
        category => category.type === 'EXPENSE',
      ),
    [categories],
  );

  const persist = useCallback(
    async (nextRules: SmartRule[]) => {
      if (!user?.id) return;
      const saved = await smartRulesService.saveRules(user.id, nextRules);
      setRules(saved);
    },
    [user?.id],
  );

  useEffect(() => {
    if (!user?.id) return;
    smartRulesService.getRules(user.id).then(async saved => {
      if (saved.length > 0) {
        setRules(saved);
        return;
      }

      const movementCategory = expenseCategories.find(category =>
        /di chuyển|đi lại|giao thông/i.test(category.name),
      );
      if (!movementCategory) return;

      await persist([
        {
          id: 'default-grab',
          keyword: 'Grab',
          categoryId: movementCategory.id,
          categoryName: movementCategory.name,
          enabled: true,
        },
      ]);
    });
  }, [expenseCategories, persist, user?.id]);

  const addRule = async () => {
    const normalizedKeyword = keyword.trim();
    const category = expenseCategories.find(item => item.id === categoryId);

    if (!normalizedKeyword || !category) {
      Alert.alert(
        'Chưa đủ thông tin',
        'Nhập từ khóa và chọn danh mục cho quy tắc.',
      );
      return;
    }

    const existingRule = rules.find(
      rule =>
        normalizeSmartRuleKeyword(rule.keyword) ===
        normalizeSmartRuleKeyword(normalizedKeyword),
    );
    if (existingRule) {
      if (existingRule.categoryId === category.id) {
        Alert.alert(
          'Quy tắc đã tồn tại',
          `“${existingRule.keyword}” đã được gán vào “${existingRule.categoryName}”.`,
        );
        return;
      }

      Alert.alert(
        'Từ khóa đã có danh mục',
        `“${existingRule.keyword}” đang được gán vào “${existingRule.categoryName}”. Mỗi từ khóa chỉ dùng một quy tắc. Bạn có muốn thay bằng “${category.name}” không?`,
        [
          { text: 'Giữ quy tắc cũ', style: 'cancel' },
          {
            text: 'Thay thế',
            onPress: async () => {
              await persist(
                rules.map(rule =>
                  rule.id === existingRule.id
                    ? {
                        ...rule,
                        keyword: normalizedKeyword,
                        categoryId: category.id,
                        categoryName: category.name,
                        enabled: true,
                      }
                    : rule,
                ),
              );
              setKeyword('');
              setCategoryId(null);
            },
          },
        ],
      );
      return;
    }

    await persist([
      ...rules,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        keyword: normalizedKeyword,
        categoryId: category.id,
        categoryName: category.name,
        enabled: true,
      },
    ]);
    setKeyword('');
    setCategoryId(null);
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
        <Text style={styles.title}>Quy tắc thông minh</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.introCard}>
          <View style={styles.introCopy}>
            <Text style={styles.introTitle}>Tự chọn danh mục theo ghi chú</Text>
            <Text style={styles.introText}>
              Ví dụ: “Grab” → “Di chuyển”. Không phân biệt chữ hoa hay chữ
              thường.
            </Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Tạo quy tắc</Text>
          <Text style={styles.label}>Ghi chú chứa</Text>
          <TextInput
            style={styles.input}
            value={keyword}
            onChangeText={setKeyword}
            placeholder="Ví dụ: Grab"
            placeholderTextColor="#A98A73"
          />
          <Text style={styles.label}>Tự chọn danh mục</Text>
          <View style={styles.categoryWrap}>
            {expenseCategories.map(category => {
              const selected = category.id === categoryId;
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.categoryChip, selected && styles.chipSelected]}
                  onPress={() => setCategoryId(category.id)}
                >
                  {selected ? <Check size={14} color={Colors.white} /> : null}
                  <Text
                    style={[
                      styles.categoryText,
                      selected && styles.categoryTextSelected,
                    ]}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={styles.saveButton} onPress={addRule}>
            <Text style={styles.saveButtonText}>Lưu quy tắc</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Quy tắc đang dùng</Text>
        {rules.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Chưa có quy tắc nào.</Text>
          </View>
        ) : (
          rules.map(rule => (
            <View key={rule.id} style={styles.ruleCard}>
              <View style={styles.ruleTopRow}>
                <View style={styles.ruleCopy}>
                  <Text style={styles.ruleKeyword}>{rule.keyword}</Text>
                  <Text style={styles.ruleCategory}>
                    Tự chọn danh mục: {rule.categoryName}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() =>
                    persist(rules.filter(item => item.id !== rule.id))
                  }
                  accessibilityLabel={`Xóa quy tắc ${rule.keyword}`}
                >
                  <Trash2 size={17} color="#B84A3A" />
                </TouchableOpacity>
              </View>
              <View style={styles.ruleDivider} />
              <View style={styles.ruleFooter}>
                <View style={styles.ruleStatus}>
                  <View
                    style={[
                      styles.ruleStatusDot,
                      rule.enabled
                        ? styles.ruleStatusDotEnabled
                        : styles.ruleStatusDotDisabled,
                    ]}
                  />
                  <Text
                    style={[
                      styles.ruleStatusText,
                      rule.enabled
                        ? styles.ruleStatusTextEnabled
                        : styles.ruleStatusTextDisabled,
                    ]}
                  >
                    {rule.enabled ? 'Đang bật' : 'Đã tắt'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.ruleToggle,
                    rule.enabled
                      ? styles.ruleToggleEnabled
                      : styles.ruleToggleDisabled,
                  ]}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: rule.enabled }}
                  accessibilityLabel={
                    rule.enabled ? 'Tắt quy tắc' : 'Bật quy tắc'
                  }
                  onPress={() =>
                    persist(
                      rules.map(item =>
                        item.id === rule.id
                          ? { ...item, enabled: !item.enabled }
                          : item,
                      ),
                    )
                  }
                >
                  <View
                    style={[
                      styles.ruleToggleKnob,
                      rule.enabled
                        ? styles.ruleToggleKnobEnabled
                        : styles.ruleToggleKnobDisabled,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0DF',
  },
  headerSpacer: { width: 42, height: 42 },
  title: { color: '#4A2B1A', fontSize: 20, fontWeight: '900' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  introCard: {
    borderRadius: 20,
    backgroundColor: '#FFF0DF',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  introCopy: { flex: 1 },
  introTitle: { color: '#4A2B1A', fontSize: 15, fontWeight: '900' },
  introText: {
    color: '#7A5438',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    fontWeight: '700',
  },
  formCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F0C49B',
    backgroundColor: Colors.white,
    padding: 14,
    gap: 10,
  },
  sectionTitle: { color: '#4A2B1A', fontSize: 16, fontWeight: '900' },
  label: { color: '#7A5438', fontSize: 12, fontWeight: '800' },
  input: {
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#EFC9A6',
    backgroundColor: '#FFF9F4',
    color: '#4A2B1A',
    paddingHorizontal: 13,
    fontWeight: '800',
  },
  categoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    width: '23%',
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFC9A6',
    paddingHorizontal: 4,
    backgroundColor: '#FFF8F1',
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryText: {
    color: '#7A5438',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  categoryTextSelected: { color: Colors.white },
  saveButton: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { color: Colors.white, fontWeight: '900' },
  emptyCard: {
    borderRadius: 18,
    backgroundColor: Colors.white,
    padding: 18,
    alignItems: 'center',
  },
  emptyText: { color: '#8B6548', fontWeight: '700' },
  ruleCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0C49B',
    backgroundColor: Colors.white,
    padding: 14,
  },
  ruleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ruleCopy: { flex: 1 },
  ruleKeyword: { color: '#4A2B1A', fontSize: 16, fontWeight: '900' },
  ruleCategory: {
    color: '#8B6548',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  ruleDivider: {
    height: 1,
    backgroundColor: '#F5E2D1',
    marginVertical: 12,
  },
  ruleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ruleStatus: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ruleStatusDot: { width: 8, height: 8, borderRadius: 4 },
  ruleStatusDotEnabled: { backgroundColor: '#209765' },
  ruleStatusDotDisabled: { backgroundColor: '#999999' },
  ruleStatusText: { fontSize: 12, fontWeight: '800' },
  ruleStatusTextEnabled: { color: '#17764E' },
  ruleStatusTextDisabled: { color: '#777777' },
  ruleToggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  ruleToggleEnabled: { backgroundColor: '#209765' },
  ruleToggleDisabled: { backgroundColor: '#B7B7B7' },
  ruleToggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.white,
    shadowColor: '#5A3926',
    shadowOpacity: 0.16,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  ruleToggleKnobEnabled: { alignSelf: 'flex-end' },
  ruleToggleKnobDisabled: { alignSelf: 'flex-start' },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3D6CC',
    backgroundColor: '#FFF9F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SmartRulesScreen;
