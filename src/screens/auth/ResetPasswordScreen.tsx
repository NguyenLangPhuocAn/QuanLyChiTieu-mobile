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
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Colors } from '../../constants/Colors';
import { authService } from '../../services/auth';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ResetPassword'>;
  route: RouteProp<RootStackParamList, 'ResetPassword'>;
};

const ResetPasswordScreen = ({ navigation, route }: Props) => {
  const [token, setToken] = useState(route.params?.token ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!token.trim() || !newPassword || !confirmPassword) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mã và mật khẩu mới.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Mật khẩu chưa khớp', 'Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    try {
      setLoading(true);
      await authService.resetPassword(token.trim(), newPassword, confirmPassword);
      Alert.alert('Thành công', 'Bạn có thể đăng nhập bằng mật khẩu mới.');
      navigation.navigate('Login');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể đặt lại mật khẩu.';
      Alert.alert('Đặt lại mật khẩu', message);
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
        <Text style={styles.title}>Đặt mật khẩu mới</Text>
        <Text style={styles.caption}>Dán mã đặt lại từ email và nhập mật khẩu mới.</Text>

        <TextInput style={styles.input} placeholder="Mã đặt lại" value={token} onChangeText={setToken} />
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

        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.primaryText}>Lưu mật khẩu</Text>
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
  content: { padding: 24, paddingTop: 30 },
  title: { color: '#3F2415', fontSize: 30, fontWeight: '900' },
  caption: { color: '#8B6548', fontSize: 15, lineHeight: 23, marginTop: 10, marginBottom: 24 },
  input: {
    backgroundColor: Colors.white,
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

export default ResetPasswordScreen;
