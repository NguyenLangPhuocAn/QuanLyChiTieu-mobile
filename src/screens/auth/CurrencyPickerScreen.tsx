import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowLeft, Check, Search } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../../constants/Colors';
import { CURRENCY_OPTIONS } from '../../constants/currencies';
import type { RootStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'CurrencyPicker'>;

const CurrencyPickerScreen = ({ navigation, route }: Props) => {
  const [query, setQuery] = useState('');
  const selectedCurrency = route.params.selectedCurrency ?? 'VND';

  const filteredCurrencies = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    if (!keyword) {
      return CURRENCY_OPTIONS;
    }

    return CURRENCY_OPTIONS.filter(item => {
      const code = item.code.toLowerCase();
      const label = item.label.toLowerCase();
      return code.includes(keyword) || label.includes(keyword);
    });
  }, [query]);

  const handleSelect = (currency: string) => {
    navigation.navigate(route.params.returnTo, { selectedCurrency: currency });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>
        <Text style={styles.title}>Chọn tiền tệ</Text>
        <View style={styles.headerButtonPlaceholder} />
      </View>

      <View style={styles.searchBox}>
        <Search size={20} color="#9A765B" />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm theo tên hoặc mã tiền tệ"
          placeholderTextColor="#A98A73"
          autoCapitalize="none"
        />
      </View>

      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {filteredCurrencies.map(item => {
          const active = selectedCurrency === item.code;

          return (
            <TouchableOpacity
              key={item.code}
              style={[styles.currencyItem, active && styles.currencyItemActive]}
              onPress={() => handleSelect(item.code)}>
              <View style={styles.currencyInfo}>
                <Text style={[styles.currencyCode, active && styles.currencyCodeActive]}>{item.code}</Text>
                <Text style={[styles.currencyLabel, active && styles.currencyLabelActive]}>{item.label}</Text>
              </View>
              {active ? (
                <View style={styles.checkCircle}>
                  <Check size={16} color={Colors.white} />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}

        {filteredCurrencies.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Không tìm thấy tiền tệ</Text>
            <Text style={styles.emptyText}>Thử nhập mã như USD, VND hoặc tên quốc gia.</Text>
          </View>
        ) : null}
      </ScrollView>
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
    alignItems: 'center',
    gap: 12,
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
  headerButtonPlaceholder: {
    width: 42,
    height: 42,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#4A2B1A',
    fontSize: 22,
    fontWeight: '900',
  },
  searchBox: {
    marginHorizontal: 16,
    marginBottom: 10,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: '#FFFDFB',
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
    fontSize: 15,
    fontWeight: '700',
  },
  list: {
    padding: 16,
    paddingTop: 6,
    paddingBottom: 34,
    gap: 10,
  },
  currencyItem: {
    minHeight: 72,
    borderRadius: 20,
    backgroundColor: '#FFFDFB',
    borderWidth: 1.5,
    borderColor: '#EBC4A4',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currencyItemActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF0DF',
  },
  currencyInfo: {
    flex: 1,
    paddingRight: 12,
  },
  currencyCode: {
    color: '#4A2B1A',
    fontSize: 18,
    fontWeight: '900',
  },
  currencyCodeActive: {
    color: Colors.primary,
  },
  currencyLabel: {
    color: '#8B6548',
    fontWeight: '700',
    marginTop: 4,
  },
  currencyLabelActive: {
    color: '#7A4A28',
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 38,
    paddingHorizontal: 18,
  },
  emptyTitle: {
    color: '#4A2B1A',
    fontSize: 17,
    fontWeight: '900',
  },
  emptyText: {
    color: '#8B6548',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

export default CurrencyPickerScreen;
