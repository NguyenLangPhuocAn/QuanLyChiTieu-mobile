import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Check } from 'lucide-react-native';
import CategoryIcon from './CategoryIcon';
import type { Category } from '../types/category';
import { filterNormalCashFlowCategories } from '../utils/transactionClassification';

const searchKey = (value: string) =>
  value.trim().toLocaleLowerCase('vi').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

export default function WidgetCategoryPicker({
  categories,
  type,
  selectedId,
  onSelect,
  onClear,
}: {
  categories: Category[];
  type: 'INCOME' | 'EXPENSE';
  selectedId: number | null;
  onSelect: (category: Category) => void;
  onClear?: () => void;
}) {
  const [query, setQuery] = useState('');
  const eligible = filterNormalCashFlowCategories(categories).filter(
    c => c.type === type,
  );
  const visible = eligible.filter(c =>
    searchKey(c.name).includes(searchKey(query)),
  );
  return (
    <View style={s.list}>
      <View style={s.heading}>
        <Text style={s.title}>
          {type === 'INCOME' ? 'Danh mục thu' : 'Danh mục chi'}
        </Text>
        <Text style={s.meta}>{eligible.length} danh mục</Text>
      </View>
      <TextInput
        accessibilityLabel="Tìm danh mục widget"
        placeholder="Tìm danh mục"
        value={query}
        onChangeText={setQuery}
        style={s.search}
      />
      {onClear && <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Để chưa phân loại"
        accessibilityState={{ selected: selectedId === null }}
        style={[s.clear, selectedId === null && s.selected]}
        onPress={onClear}
      >
        <Text style={s.clearText}>Chưa phân loại</Text>
      </TouchableOpacity>}
      {visible.map(category => (
        <TouchableOpacity
          key={category.id}
          accessibilityRole="button"
          accessibilityLabel={category.name}
          accessibilityState={{ selected: category.id === selectedId }}
          style={[s.card, category.id === selectedId && s.selected]}
          onPress={() => onSelect(category)}
        >
          <View style={s.icon}>
            <CategoryIcon icon={category.icon} size={24} />
          </View>
          <View style={s.copy}>
            <Text style={s.name}>{category.name}</Text>
            <Text style={s.meta}>
              {category.is_system ? 'Hệ thống' : 'Cá nhân'}
            </Text>
          </View>
          {category.id === selectedId && <Check size={20} color="#C16B16" />}
        </TouchableOpacity>
      ))}
      {!visible.length && <Text style={s.meta}>
        {eligible.length ? 'Không tìm thấy danh mục.' : 'Tài khoản này chưa có danh mục. Bạn vẫn có thể nhập giao dịch chưa phân loại.'}
      </Text>}
    </View>
  );
}
const s = StyleSheet.create({
  list: { gap: 10 },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { color: '#4A2B1A', fontSize: 16, fontWeight: '700' },
  meta: { color: '#8B6548', fontSize: 12 },
  search: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#ECD6C1',
    borderRadius: 12,
    padding: 12,
    color: '#4A2B1A',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFDFB',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#EBC4A4',
  },
  clear: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EBC4A4',
    backgroundColor: '#FFFDFB',
  },
  clearText: { color: '#6F4A32', fontSize: 14, fontWeight: '700' },
  selected: { backgroundColor: '#FFF4EA', borderColor: '#F28C28' },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFF0E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 4 },
  name: { color: '#4A2B1A', fontSize: 16, fontWeight: '700' },
});
