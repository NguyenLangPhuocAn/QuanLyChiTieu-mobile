import React, { useState } from 'react';
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
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../services/api';
import { getUserFriendlyErrorMessage } from '../../utils/errors';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SignUp'>;
};

const SignUpScreen = ({ navigation }: Props) => {
  const { signUp, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secureText, setSecureText] = useState(true);
  const [secureConfirmText, setSecureConfirmText] = useState(true);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    form?: string;
  }>({});

  const handleSignUp = async () => {
    const nextErrors: typeof errors = {};

    if (!email.trim()) {
      nextErrors.email = 'Vui lòng nhập email.';
    }

    if (!password) {
      nextErrors.password = 'Vui lòng nhập mật khẩu.';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu.';
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Mật khẩu xác nhận chưa khớp.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      setErrors({});
      await signUp(email.trim(), password, confirmPassword);
    } catch (error) {
      const message =
        error instanceof ApiError && error.code === 'ACCOUNT_RESTORE_REQUIRED'
          ? 'Email này thuộc tài khoản đã xóa. Vui lòng quay lại đăng nhập để khôi phục tài khoản và giữ nguyên dữ liệu cũ.'
          : getUserFriendlyErrorMessage(error, 'Đăng ký thất bại.');
      setErrors({ form: message });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <ArrowLeft color={Colors.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Đăng ký</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          <Text style={styles.title}>Tạo tài khoản mới</Text>
          <Text style={styles.subtitle}>
            Sau khi đăng nhập, bạn sẽ thiết lập hồ sơ và tiền tệ mặc định.
          </Text>

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

          <View style={[styles.passwordContainer, errors.password && styles.inputError]}>
            <TextInput
              style={styles.inputPassword}
              placeholder="Mật khẩu"
              value={password}
              onChangeText={value => {
                setPassword(value);
                setErrors(current => ({ ...current, password: undefined, form: undefined }));
              }}
              secureTextEntry={secureText}
            />
            <TouchableOpacity onPress={() => setSecureText(!secureText)} style={styles.eyeIcon}>
              {secureText ? <EyeOff size={20} color={Colors.gray} /> : <Eye size={20} color={Colors.gray} />}
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

          <View style={[styles.passwordContainer, errors.confirmPassword && styles.inputError]}>
            <TextInput
              style={styles.inputPassword}
              placeholder="Xác nhận mật khẩu"
              value={confirmPassword}
              onChangeText={value => {
                setConfirmPassword(value);
                setErrors(current => ({ ...current, confirmPassword: undefined, form: undefined }));
              }}
              secureTextEntry={secureConfirmText}
            />
            <TouchableOpacity
              onPress={() => setSecureConfirmText(!secureConfirmText)}
              style={styles.eyeIcon}>
              {secureConfirmText ? (
                <EyeOff size={20} color={Colors.gray} />
              ) : (
                <Eye size={20} color={Colors.gray} />
              )}
            </TouchableOpacity>
          </View>
          {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
          {errors.form ? <Text style={styles.formErrorText}>{errors.form}</Text> : null}

          <TouchableOpacity style={styles.btnPrimary} onPress={handleSignUp} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.btnPrimaryText}>Đăng ký</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Đã có tài khoản? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.linkText}>Đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  headerSpacer: { width: 44 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.gray,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 28,
    textAlign: 'center',
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  inputError: {
    borderColor: '#E45B5B',
    backgroundColor: '#FFF8F8',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    marginBottom: 16,
  },
  errorText: {
    color: '#C24141',
    fontSize: 12,
    fontWeight: '700',
    marginTop: -8,
    marginBottom: 12,
  },
  formErrorText: {
    color: '#C24141',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 12,
  },
  inputPassword: { flex: 1, padding: 16, fontSize: 16 },
  eyeIcon: { padding: 16 },
  btnPrimary: {
    backgroundColor: Colors.primary,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  btnPrimaryText: { color: Colors.white, fontSize: 18, fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, marginBottom: 4 },
  footerText: { color: Colors.gray, fontSize: 16 },
  linkText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});

export default SignUpScreen;
