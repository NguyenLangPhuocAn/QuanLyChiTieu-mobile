import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Colors } from '../../constants/Colors';
import { authService } from '../../services/auth';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;
};

const ForgotPasswordScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; form?: string }>({});

  const handleSubmit = async () => {
    if (!email.trim()) {
      setErrors({ email: 'Vui lòng nhập email đã đăng ký.' });
      return;
    }

    try {
      setErrors({});
      setLoading(true);
      const response = await authService.forgotPassword(email.trim());
      Alert.alert('Kiểm tra email', response.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể gửi yêu cầu.';
      setErrors({ form: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <ArrowLeft color={Colors.text} size={22} />
          </TouchableOpacity>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          <Text style={styles.title}>Quên mật khẩu</Text>
          <Text style={styles.caption}>Nhập email đã đăng ký để nhận mật khẩu tạm thời.</Text>

          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            placeholder="Email"
            value={email}
            onChangeText={value => {
              setEmail(value);
              setErrors(current => ({ ...current, email: undefined, form: undefined }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          {errors.form ? <Text style={styles.formErrorText}>{errors.form}</Text> : null}

          <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.primaryText}>Gửi email</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  keyboardView: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12 },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 104,
    paddingBottom: 44,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  caption: {
    color: Colors.gray,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    fontSize: 16,
    marginBottom: 8,
  },
  inputError: {
    borderColor: '#E45B5B',
    backgroundColor: '#FFF8F8',
  },
  errorText: {
    color: '#C24141',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
  },
  formErrorText: {
    color: '#C24141',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: 17,
    alignItems: 'center',
  },
  primaryText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
});

export default ForgotPasswordScreen;
