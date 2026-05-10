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

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Thiếu email', 'Vui lòng nhập email đã đăng ký.');
      return;
    }

    try {
      setLoading(true);
      const response = await authService.forgotPassword(email.trim());
      Alert.alert('Kiểm tra email', response.message);
      navigation.navigate('ResetPassword', { token: response.resetToken });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể gửi yêu cầu.';
      Alert.alert('Quên mật khẩu', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <ArrowLeft color={Colors.text} size={22} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Lấy lại mật khẩu</Text>
        <Text style={styles.caption}>
          Nhập email tài khoản. Hệ thống sẽ gửi mã đặt lại mật khẩu cho bạn.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.primaryText}>Gửi mã đặt lại</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF7EF' },
  header: { paddingHorizontal: 20, paddingTop: 12 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 24, paddingTop: 40 },
  title: { color: '#3F2415', fontSize: 30, fontWeight: '900' },
  caption: { color: '#8B6548', fontSize: 15, lineHeight: 23, marginTop: 10, marginBottom: 28 },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#F0D6C1',
    borderRadius: 18,
    padding: 16,
    fontSize: 16,
    marginBottom: 18,
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
