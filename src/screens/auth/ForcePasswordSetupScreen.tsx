import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';

const ForcePasswordSetupScreen = () => {
  const { completePasswordSetup, isLoading } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đầy đủ mật khẩu mới.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Mật khẩu chưa khớp', 'Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    try {
      await completePasswordSetup(newPassword, confirmPassword);
      Alert.alert('Đã lưu', 'Vui lòng đăng nhập lại bằng mật khẩu mới.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tạo mật khẩu mới.';
      Alert.alert('Tạo mật khẩu mới', message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Bảo mật tài khoản</Text>
        <Text style={styles.title}>Tạo mật khẩu mới</Text>
        <Text style={styles.caption}>
          Tài khoản đang dùng mật khẩu tạm. Bạn cần đặt mật khẩu riêng trước khi sử dụng ứng dụng.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Mật khẩu mới"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Xác nhận mật khẩu"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.primaryText}>Lưu mật khẩu mới</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF7EF',
    justifyContent: 'center',
    padding: 22,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    padding: 24,
    shadowColor: '#6B3A18',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  eyebrow: { color: Colors.primary, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: '#3F2415', fontSize: 28, fontWeight: '900', marginTop: 8 },
  caption: { color: '#8B6548', fontSize: 15, lineHeight: 23, marginTop: 10, marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: '#F0D6C1',
    borderRadius: 18,
    padding: 16,
    fontSize: 16,
    marginBottom: 14,
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
