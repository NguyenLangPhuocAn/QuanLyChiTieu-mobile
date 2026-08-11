import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, Coins, UserRound } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../../constants/Colors';
import { CURRENCY_OPTIONS } from '../../constants/currencies';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { getUserFriendlyErrorMessage } from '../../utils/errors';

type Props = NativeStackScreenProps<RootStackParamList, 'CurrencySetup'>;

const CurrencySetupScreen = ({ navigation, route }: Props) => {
  const { completeCurrencySetup, isLoading, user } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [currency, setCurrency] = useState(user?.currency_default ?? 'VND');
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string; form?: string }>({});
  const selectedCurrency = useMemo(
    () => CURRENCY_OPTIONS.find(item => item.code === currency) ?? CURRENCY_OPTIONS[0],
    [currency],
  );

  useEffect(() => {
    if (route.params?.selectedCurrency) {
      setCurrency(route.params.selectedCurrency);
      navigation.setParams({ selectedCurrency: undefined });
    }
  }, [navigation, route.params?.selectedCurrency]);

  const handleContinue = async () => {
    const nextErrors: typeof errors = {};

    if (!fullName.trim()) {
      nextErrors.fullName = 'Vui lòng nhập họ tên.';
    }

    if (phone.trim() && !/^0\d{9}$/.test(phone.trim())) {
      nextErrors.phone = 'Số điện thoại phải bắt đầu bằng 0 và đủ 10 số.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      setErrors({});
      await completeCurrencySetup({
        currency_default: currency,
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
      });
    } catch (error) {
      const message = getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.');
      setErrors(/sđt|sdt|điện thoại|phone/i.test(message) ? { phone: message } : { form: message });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconRow}>
            <View style={styles.iconBox}>
              <UserRound size={32} color={Colors.primary} />
            </View>
            <View style={styles.iconBox}>
              <Coins size={32} color={Colors.primary} />
            </View>
          </View>

          <Text style={styles.title}>Thiết lập hồ sơ</Text>
          <Text style={styles.subtitle}>
            Nhập vài thông tin cơ bản để app hiển thị đúng với bạn.
          </Text>

          <Text style={styles.label}>Họ tên</Text>
          <TextInput
            style={[styles.input, errors.fullName && styles.inputError]}
            value={fullName}
            onChangeText={value => {
              setFullName(value);
              setErrors(current => ({ ...current, fullName: undefined, form: undefined }));
            }}
            placeholder="Ví dụ: Nguyễn Văn A"
            autoCapitalize="words"
          />
          {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}

          <Text style={styles.label}>Số điện thoại</Text>
          <TextInput
            style={[styles.input, errors.phone && styles.inputError]}
            value={phone}
            onChangeText={value => {
              setPhone(value);
              setErrors(current => ({ ...current, phone: undefined, form: undefined }));
            }}
            placeholder="Tùy chọn"
            keyboardType="phone-pad"
          />
          {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}

          <Text style={styles.label}>Tiền tệ cơ bản</Text>
          <TouchableOpacity
            style={styles.currencySelect}
            onPress={() =>
              navigation.navigate('CurrencyPicker', {
                selectedCurrency: currency,
                returnTo: 'CurrencySetup',
              })
            }>
            <View>
              <Text style={styles.currencyCode}>{selectedCurrency.code}</Text>
              <Text style={styles.currencyLabel}>{selectedCurrency.label}</Text>
            </View>
            <ChevronRight size={22} color="#9A765B" />
          </TouchableOpacity>
          {errors.form ? <Text style={styles.formErrorText}>{errors.form}</Text> : null}

          <TouchableOpacity style={styles.primaryButton} onPress={handleContinue} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.primaryText}>Hoàn tất</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 58,
    paddingBottom: 34,
  },
  iconRow: {
    flexDirection: 'row',
    gap: 12,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#FFF9F3',
    borderWidth: 1.2,
    borderColor: '#E8B680',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#4A2B1A',
    fontSize: 30,
    fontWeight: '900',
    marginTop: 22,
  },
  subtitle: {
    color: '#8B6548',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 10,
  },
  label: {
    color: '#7B573C',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 18,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFDFB',
    borderWidth: 1.3,
    borderColor: '#E8B680',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#4A2B1A',
    fontSize: 16,
    fontWeight: '700',
  },
  inputError: {
    borderColor: '#E45B5B',
    backgroundColor: '#FFF8F8',
  },
  errorText: {
    color: '#C24141',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  formErrorText: {
    color: '#C24141',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 12,
  },
  currencySelect: {
    minHeight: 74,
    borderRadius: 20,
    backgroundColor: '#FFF9F3',
    borderWidth: 1.2,
    borderColor: '#E8B680',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currencyCode: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  currencyLabel: {
    color: '#8B6548',
    fontWeight: '700',
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 26,
  },
  primaryText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '900',
  },
});

export default CurrencySetupScreen;
