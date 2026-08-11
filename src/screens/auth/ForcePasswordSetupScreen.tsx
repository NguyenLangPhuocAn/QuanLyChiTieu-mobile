import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { getUserFriendlyErrorMessage } from '../../utils/errors';

const ForcePasswordSetupScreen = () => {
  const { completePasswordSetup, isLoading } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
    form?: string;
  }>({});

  const handleSubmit = async () => {
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
      await completePasswordSetup(newPassword, confirmPassword);
    } catch (error) {
      const message = getUserFriendlyErrorMessage(error, 'Không thể tạo mật khẩu mới.');
      setErrors({ form: message });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          <Text style={styles.title}>Tạo mật khẩu mới</Text>

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
          {errors.form ? <Text style={styles.formErrorText}>{errors.form}</Text> : null}

          <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.primaryText}>Lưu mật khẩu mới</Text>
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
    marginBottom: 30,
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
    marginTop: 4,
  },
  primaryText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
});

export default ForcePasswordSetupScreen;
