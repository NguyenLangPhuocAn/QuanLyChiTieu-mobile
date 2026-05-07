import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowLeft, UserRound } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

const ProfileScreen = ({ navigation }: Props) => {
  const { user, isLoading, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [birthday, setBirthday] = useState(user?.birthday ? String(user.birthday).slice(0, 10) : '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [currency, setCurrency] = useState(user?.currency_default ?? 'VND');

  const handleSave = async () => {
    try {
      // Chỉ gửi các trường profile người dùng được phép tự cập nhật.
      await updateProfile({
        full_name: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
        birthday: birthday.trim() || undefined,
        address: address.trim() || undefined,
        currency_default: currency.trim() || 'VND',
      });
      Alert.alert('Đã lưu', 'Thông tin hồ sơ đã được cập nhật.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Không thể lưu', error instanceof Error ? error.message : 'Vui lòng thử lại sau.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#593420" />
        </TouchableOpacity>
        <Text style={styles.title}>Thông tin hồ sơ</Text>
        <View style={styles.headerButtonPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <UserRound size={34} color={Colors.primary} />
          </View>
          <Text style={styles.email}>{user?.email}</Text>
          <Text style={styles.role}>{user?.role ?? 'BASIC'}</Text>
        </View>

        <Text style={styles.label}>Họ tên</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Nguyễn Văn A" />

        <Text style={styles.label}>Số điện thoại</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0900000000" />

        <Text style={styles.label}>Ngày sinh</Text>
        <TextInput style={styles.input} value={birthday} onChangeText={setBirthday} placeholder="YYYY-MM-DD" />

        <Text style={styles.label}>Địa chỉ</Text>
        <TextInput style={[styles.input, styles.addressInput]} value={address} onChangeText={setAddress} multiline placeholder="Địa chỉ" />

        <Text style={styles.label}>Tiền tệ mặc định</Text>
        <View style={styles.currencyRow}>
          {['VND', 'USD', 'EUR', 'JPY'].map(item => (
            <TouchableOpacity
              key={item}
              style={[styles.currencyChip, currency === item && styles.currencyChipActive]}
              onPress={() => setCurrency(item)}>
              <Text style={[styles.currencyText, currency === item && styles.currencyTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveText}>Lưu hồ sơ</Text>}
        </TouchableOpacity>
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
    fontWeight: '800',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: '#FFFDFB',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#EBC4A4',
    padding: 20,
    alignItems: 'center',
    marginBottom: 18,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFF0E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  email: {
    color: '#4A2B1A',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 12,
  },
  role: {
    color: Colors.primary,
    fontWeight: '800',
    marginTop: 6,
  },
  label: {
    color: '#7B573C',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFDFB',
    borderWidth: 1.5,
    borderColor: '#EBC4A4',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#4A2B1A',
    fontSize: 16,
  },
  addressInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  currencyChip: {
    backgroundColor: '#FFFDFB',
    borderWidth: 1.5,
    borderColor: '#EBC4A4',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  currencyChipActive: {
    backgroundColor: '#F28C28',
    borderColor: '#F28C28',
  },
  currencyText: {
    color: '#8B6548',
    fontWeight: '800',
  },
  currencyTextActive: {
    color: Colors.white,
  },
  saveButton: {
    backgroundColor: '#F28C28',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 22,
  },
  saveText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 16,
  },
});

export default ProfileScreen;
