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

export default function WidgetCategoryPicker({
  categories,
  type,
  selectedId,
  onSelect,
}: {
  categories: Category[];
  type: 'INCOME' | 'EXPENSE';
  selectedId: number | null;
  onSelect: (category: Category) => void;
}) {
  const [query, setQuery] = useState('');
  const eligible = filterNormalCashFlowCategories(categories).filter(
    c => c.type === type,
  );
  const visible = eligible.filter(c =>
    c.name
      .toLocaleLowerCase('vi')
      .includes(query.trim().toLocaleLowerCase('vi')),
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
      {!visible.length && <Text style={s.meta}>Không tìm thấy danh mục.</Text>}
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
