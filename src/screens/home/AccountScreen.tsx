import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, ListTree, LogOut, ShieldCheck, Trash2, UserRound } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { authService } from '../../services/auth';

const AccountScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, user, signOut } = useAuth();

  const confirmDeactivateAccount = () => {
    Alert.alert(
      'Xóa tài khoản',
      'Tài khoản sẽ bị vô hiệu hóa. Dữ liệu vẫn được giữ trong hệ thống và bạn sẽ cần liên hệ hỗ trợ nếu muốn mở lại.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa tài khoản',
          style: 'destructive',
          onPress: async () => {
            if (!token) {
              return;
            }

            try {
              await authService.deactivateMe(token);
              await signOut();
            } catch (error) {
              Alert.alert(
                'Không thể xóa tài khoản',
                error instanceof Error ? error.message : 'Vui lòng thử lại sau.',
              );
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tài khoản</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <UserRound size={32} color={Colors.primary} />
        </View>
        <Text style={styles.email}>{user?.email ?? 'Chưa có email'}</Text>
        <View style={styles.roleBadge}>
          <ShieldCheck size={14} color={Colors.primary} />
          <Text style={styles.roleText}>{user?.role ?? 'BASIC'}</Text>
        </View>
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Số ví</Text>
          <Text style={styles.infoValue}>{user?.wallet_count ?? 0}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Gói dùng</Text>
          <Text style={styles.infoValue}>{user?.role ?? 'BASIC'}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Categories')}>
        <View style={styles.menuLeft}>
          <ListTree size={20} color={Colors.primary} />
          <Text style={styles.menuText}>Danh mục thu chi</Text>
        </View>
        <ChevronRight size={20} color="#B57745" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Profile')}>
        <View style={styles.menuLeft}>
          <UserRound size={20} color={Colors.primary} />
          <Text style={styles.menuText}>Thông tin hồ sơ</Text>
        </View>
        <ChevronRight size={20} color="#B57745" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <LogOut size={18} color={Colors.white} />
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteAccountButton} onPress={confirmDeactivateAccount}>
        <Trash2 size={18} color="#B42318" />
        <Text style={styles.deleteAccountText}>Xóa tài khoản</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#4C2A18',
    marginBottom: 20,
  },
  profileCard: {
    backgroundColor: Colors.white,
    borderRadius: 28,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 24,
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  email: {
    color: '#4C2A18',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 16,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFF0DF',
    marginTop: 12,
  },
  roleText: {
    color: Colors.primary,
    fontWeight: '800',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  infoCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 16,
  },
  infoLabel: {
    color: '#8A623F',
    fontWeight: '700',
    fontSize: 12,
  },
  infoValue: {
    color: '#4C2A18',
    fontWeight: '900',
    fontSize: 22,
    marginTop: 8,
  },
  menuButton: {
    marginTop: 14,
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuText: {
    color: '#4C2A18',
    fontWeight: '800',
    fontSize: 16,
  },
  logoutButton: {
    marginTop: 14,
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  logoutText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 16,
  },
  deleteAccountButton: {
    marginTop: 12,
    backgroundColor: '#FFF1F0',
    borderWidth: 1.2,
    borderColor: '#F3B8B2',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  deleteAccountText: {
    color: '#B42318',
    fontWeight: '800',
    fontSize: 16,
  },
});

export default AccountScreen;
