import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { ArrowLeft } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth';
import { getUserFriendlyErrorMessage } from '../../utils/errors';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;
};

type Step = 'EMAIL' | 'OTP' | 'PASSWORD';

const RESEND_COOLDOWN_SECONDS = 60;

const ForgotPasswordScreen = ({ navigation }: Props) => {
  const { completeResetPassword } = useAuth();
  const [step, setStep] = useState<Step>('EMAIL');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    otp?: string;
    newPassword?: string;
    confirmPassword?: string;
    form?: string;
  }>({});

  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      setCooldown(current => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  const requestOtp = async (isResend = false) => {
    const nextEmail = email.trim().toLowerCase();
    if (!nextEmail) {
      setErrors({ email: 'Vui lòng nhập email đã đăng ký.' });
      return;
    }

    try {
      setErrors({});
      setLoading(true);
      const response = await authService.forgotPassword(nextEmail);
      setEmail(nextEmail);
      setOtp('');
      setResetToken('');
      setStep('OTP');
      setCooldown(RESEND_COOLDOWN_SECONDS);
      Alert.alert(isResend ? 'Đã gửi lại mã' : 'Kiểm tra email', getUserFriendlyErrorMessage(response.message, response.message));
    } catch (error) {
      const message = getUserFriendlyErrorMessage(error, 'Không thể gửi mã xác nhận.');
      setErrors({ form: message });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) {
      setErrors({ otp: 'Vui lòng nhập mã xác nhận.' });
      return;
    }

    try {
      setErrors({});
      setLoading(true);
      const response = await authService.verifyResetOtp(email, otp.trim());
      setResetToken(response.reset_token);
      setStep('PASSWORD');
    } catch (error) {
      const message =
        getUserFriendlyErrorMessage(error, 'Mã xác nhận không hợp lệ hoặc đã hết hạn.');
      setErrors({ form: message });
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async () => {
    const nextErrors: typeof errors = {};

    if (!newPassword) {
      nextErrors.newPassword = 'Vui lòng nhập mật khẩu mới.';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu.';
    } else if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = 'Mật khẩu xác nhận chưa khớp.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      setErrors({});
      setLoading(true);
      await completeResetPassword(resetToken, newPassword, confirmPassword);
    } catch (error) {
      const message = getUserFriendlyErrorMessage(error, 'Không thể đặt lại mật khẩu.');
      setErrors({ form: message });
    } finally {
      setLoading(false);
    }
  };

  const title =
    step === 'EMAIL'
      ? 'Quên mật khẩu'
      : step === 'OTP'
        ? 'Nhập mã xác nhận'
        : 'Tạo mật khẩu mới';
  const caption =
    step === 'EMAIL'
      ? 'Nhập email đã đăng ký để nhận mã xác nhận.'
      : step === 'OTP'
        ? `Mã xác nhận đã được gửi đến ${email}.`
        : 'Đặt mật khẩu mới để đăng nhập ngay vào ứng dụng.';

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
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.caption}>{caption}</Text>

          {step === 'EMAIL' ? (
            <>
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
              <TouchableOpacity style={styles.primaryButton} onPress={() => requestOtp()} disabled={loading}>
                {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryText}>Gửi mã</Text>}
              </TouchableOpacity>
            </>
          ) : null}

          {step === 'OTP' ? (
            <>
              <TextInput
                style={[styles.input, styles.otpInput, errors.otp && styles.inputError]}
                placeholder="Mã OTP"
                value={otp}
                onChangeText={value => {
                  setOtp(value.replace(/[^\d]/g, '').slice(0, 6));
                  setErrors(current => ({ ...current, otp: undefined, form: undefined }));
                }}
                keyboardType="number-pad"
                maxLength={6}
              />
              {errors.otp ? <Text style={styles.errorText}>{errors.otp}</Text> : null}
              <TouchableOpacity style={styles.primaryButton} onPress={verifyOtp} disabled={loading}>
                {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryText}>Xác nhận mã</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, (loading || cooldown > 0) && styles.disabledButton]}
                onPress={() => requestOtp(true)}
                disabled={loading || cooldown > 0}>
                <Text style={styles.secondaryText}>
                  {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã'}
                </Text>
              </TouchableOpacity>
            </>
          ) : null}

          {step === 'PASSWORD' ? (
            <>
              <TextInput
                style={[styles.input, errors.newPassword && styles.inputError]}
                placeholder="Mật khẩu mới"
                value={newPassword}
                onChangeText={value => {
                  setNewPassword(value);
                  setErrors(current => ({ ...current, newPassword: undefined, form: undefined }));
                }}
                secureTextEntry
              />
              {errors.newPassword ? <Text style={styles.errorText}>{errors.newPassword}</Text> : null}

              <TextInput
                style={[styles.input, errors.confirmPassword && styles.inputError]}
                placeholder="Xác nhận mật khẩu"
                value={confirmPassword}
                onChangeText={value => {
                  setConfirmPassword(value);
                  setErrors(current => ({ ...current, confirmPassword: undefined, form: undefined }));
                }}
                secureTextEntry
              />
              {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}

              <TouchableOpacity style={styles.primaryButton} onPress={submitNewPassword} disabled={loading}>
                {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryText}>Đổi mật khẩu</Text>}
              </TouchableOpacity>
            </>
          ) : null}

          {errors.form ? <Text style={styles.formErrorText}>{errors.form}</Text> : null}
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
  otpInput: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0,
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
    marginTop: 12,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: 17,
    alignItems: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 15,
    alignItems: 'center',
    marginTop: 12,
  },
  disabledButton: {
    opacity: 0.55,
  },
  primaryText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  secondaryText: { color: Colors.primary, fontSize: 15, fontWeight: '800' },
});

export default ForgotPasswordScreen;
