import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CalendarDays, ChevronRight, ImagePlus, UserRound, X } from 'lucide-react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { launchImageLibrary } from 'react-native-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../../constants/Colors';
import { CURRENCY_OPTIONS } from '../../constants/currencies';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { authService } from '../../services/auth';
import { resolveAvatarUrl } from '../../utils/avatar';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import { formatShortDate } from '../../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;
type AvatarUploadFile = {
  uri: string;
  name: string;
  type: string;
};

const isValidDateParts = (year: number, month: number, day: number) => {
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const formatBirthdayInput = (value?: string | null) => (value ? formatShortDate(String(value)) : '');
const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
const getBirthdayPickerValue = (value: string) => {
  const normalized = normalizeBirthdayInput(value);
  if (!normalized) return new Date();
  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const normalizeBirthdayInput = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const displayMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (displayMatch) {
    const [, dayValue, monthValue, yearValue] = displayMatch;
    const day = Number(dayValue);
    const month = Number(monthValue);
    const year = Number(yearValue);

    if (!isValidDateParts(year, month, day)) {
      return null;
    }

    return `${yearValue}-${monthValue.padStart(2, '0')}-${dayValue.padStart(2, '0')}`;
  }

  const apiMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (apiMatch) {
    const [, yearValue, monthValue, dayValue] = apiMatch;
    const day = Number(dayValue);
    const month = Number(monthValue);
    const year = Number(yearValue);

    if (!isValidDateParts(year, month, day)) {
      return null;
    }

    return `${yearValue}-${monthValue.padStart(2, '0')}-${dayValue.padStart(2, '0')}`;
  }

  return null;
};

const ProfileScreen = ({ navigation, route }: Props) => {
  const { token, user, isLoading, updateProfile, signOut, uploadAvatar } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [birthday, setBirthday] = useState(formatBirthdayInput(user?.birthday));
  const [address, setAddress] = useState(user?.address ?? '');
  const [currency, setCurrency] = useState(user?.currency_default ?? 'VND');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [isBirthdayPickerVisible, setIsBirthdayPickerVisible] = useState(false);
  const [profileErrors, setProfileErrors] = useState<{ phone?: string; form?: string }>({});
  const [passwordErrors, setPasswordErrors] = useState<{
    oldPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
    form?: string;
  }>({});

  const selectedCurrency = useMemo(
    () => CURRENCY_OPTIONS.find(item => item.code === currency) ?? CURRENCY_OPTIONS[0],
    [currency],
  );
  const avatarUrl = resolveAvatarUrl(user?.avatar);
  const displayPlan = user?.role === 'PREMIUM' || user?.role === 'ADMIN' ? 'PREMIUM' : 'BASIC';

  useEffect(() => {
    if (route.params?.selectedCurrency) {
      setCurrency(route.params.selectedCurrency);
      navigation.setParams({ selectedCurrency: undefined });
    }
  }, [navigation, route.params?.selectedCurrency]);

  const closePasswordModal = () => {
    if (isChangingPassword) {
      return;
    }

    setIsPasswordModalVisible(false);
    setPasswordErrors({});
  };

  const handleBirthdayChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setIsBirthdayPickerVisible(false);
    if (selectedDate) {
      setBirthday(formatBirthdayInput(toDateKey(selectedDate)));
      setProfileErrors(current => ({ ...current, form: undefined }));
    }
  };

  const handlePickAvatar = async () => {
    let result;

    try {
      result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 1,
      });
    } catch {
      Alert.alert('Chưa mở được thư viện ảnh', 'Vui lòng thử lại sau.');
      return;
    }

    if (result.didCancel) {
      return;
    }

    const asset = result.assets?.[0];

    if (!asset?.uri) {
      Alert.alert('Chưa chọn được ảnh', 'Vui lòng chọn ảnh JPG, PNG hoặc WEBP.');
      return;
    }

    const type = asset.type ?? 'image/jpeg';

    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(type)) {
      Alert.alert('Ảnh chưa hợp lệ', 'Avatar chỉ hỗ trợ JPG, PNG hoặc WEBP.');
      return;
    }

    const file: AvatarUploadFile = {
      uri: asset.uri,
      name: asset.fileName ?? `avatar-${Date.now()}.${type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'}`,
      type,
    };

    setIsUploadingAvatar(true);

    try {
      await uploadAvatar(file);
      Alert.alert('Đã cập nhật', 'Avatar của bạn đã được thay đổi.');
    } catch (error) {
      Alert.alert('Chưa đổi được avatar', getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (phone.trim() && !/^0\d{9}$/.test(phone.trim())) {
      setProfileErrors({ phone: 'Số điện thoại phải bắt đầu bằng 0 và đủ 10 số.' });
      return;
    }

    try {
      setProfileErrors({});
      const normalizedBirthday = normalizeBirthdayInput(birthday);

      if (normalizedBirthday === null) {
        setProfileErrors({ form: 'Ngày sinh chưa hợp lệ.' });
        return;
      }

      await updateProfile({
        full_name: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
        birthday: normalizedBirthday || undefined,
        address: address.trim() || undefined,
        currency_default: currency.trim() || 'VND',
      });
      Alert.alert('Đã lưu', 'Thông tin hồ sơ đã được cập nhật.');
      navigation.goBack();
    } catch (error) {
      const message = getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.');
      setProfileErrors(/sđt|sdt|điện thoại|phone/i.test(message) ? { phone: message } : { form: message });
    }
  };

  const handleChangePassword = async () => {
    if (!token) {
      Alert.alert('Phiên đăng nhập đã hết hạn', 'Vui lòng đăng nhập lại để đổi mật khẩu.');
      return;
    }

    const nextErrors: typeof passwordErrors = {};

    if (!oldPassword) {
      nextErrors.oldPassword = 'Vui lòng nhập mật khẩu hiện tại.';
    }
    if (!newPassword) {
      nextErrors.newPassword = 'Vui lòng nhập mật khẩu mới.';
    }
    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới.';
    } else if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = 'Mật khẩu xác nhận chưa khớp.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setPasswordErrors(nextErrors);
      return;
    }

    setIsChangingPassword(true);
    setPasswordErrors({});

    try {
      const response = await authService.changePassword(token, {
        oldPassword,
        newPassword,
        confirmPassword,
      });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsPasswordModalVisible(false);
      Alert.alert('Đã đổi mật khẩu', getUserFriendlyErrorMessage(response.message, response.message), [
        {
          text: 'Đăng nhập lại',
          onPress: signOut,
        },
      ]);
    } catch (error) {
      setPasswordErrors({ form: getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.') });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color="#593420" />
          </TouchableOpacity>
          <Text style={styles.title}>Thông tin hồ sơ</Text>
          <View style={styles.headerButtonPlaceholder} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.profileCard}>
            <TouchableOpacity style={styles.avatarWrap} onPress={handlePickAvatar} activeOpacity={0.86}>
              <View style={styles.avatar}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <UserRound size={34} color={Colors.primary} />
                )}
              </View>
              <View style={styles.avatarEditBadge}>
                {isUploadingAvatar ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <ImagePlus size={14} color={Colors.white} />
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.email}>{user?.email}</Text>
            <Text style={styles.role}>{displayPlan}</Text>
          </View>

          <Text style={styles.label}>Họ tên</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Nguyễn Văn A" />

          <Text style={styles.label}>Số điện thoại</Text>
          <TextInput
            style={[styles.input, profileErrors.phone && styles.inputError]}
            value={phone}
            onChangeText={value => {
              setPhone(value);
              setProfileErrors(current => ({ ...current, phone: undefined, form: undefined }));
            }}
            keyboardType="phone-pad"
            placeholder="0900000000"
          />
          {profileErrors.phone ? <Text style={styles.errorText}>{profileErrors.phone}</Text> : null}

          <Text style={styles.label}>Ngày sinh</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={styles.dateSelect}
              onPress={() => setIsBirthdayPickerVisible(true)}>
              <CalendarDays size={18} color="#9A5A24" />
              <Text style={styles.dateSelectText}>
                {birthday || 'Chọn ngày sinh'}
              </Text>
            </TouchableOpacity>
            {birthday ? (
              <TouchableOpacity
                style={styles.clearDateButton}
                onPress={() => setBirthday('')}>
                <X size={18} color="#9A5A24" />
              </TouchableOpacity>
            ) : null}
          </View>
          {isBirthdayPickerVisible ? (
            <DateTimePicker
              value={getBirthdayPickerValue(birthday)}
              mode="date"
              maximumDate={new Date()}
              onChange={handleBirthdayChange}
            />
          ) : null}

          <Text style={styles.label}>Địa chỉ</Text>
          <TextInput
            style={[styles.input, styles.addressInput]}
            value={address}
            onChangeText={setAddress}
            multiline
            placeholder="Địa chỉ"
          />

          <Text style={styles.label}>Tiền tệ mặc định</Text>
          <TouchableOpacity
            style={styles.currencySelect}
            onPress={() =>
              navigation.navigate('CurrencyPicker', {
                selectedCurrency: currency,
                returnTo: 'Profile',
              })
            }>
            <View>
              <Text style={styles.currencyCode}>{selectedCurrency.code}</Text>
              <Text style={styles.currencyLabel}>{selectedCurrency.label}</Text>
            </View>
            <ChevronRight size={22} color="#9A765B" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveText}>Lưu hồ sơ</Text>}
          </TouchableOpacity>
          {profileErrors.form ? <Text style={styles.formErrorText}>{profileErrors.form}</Text> : null}

          <TouchableOpacity
            style={styles.passwordCard}
            activeOpacity={0.86}
            onPress={() => setIsPasswordModalVisible(true)}>
            <View>
              <Text style={styles.sectionTitle}>Đổi mật khẩu</Text>
              <Text style={styles.passwordHint}>Mở biểu mẫu đổi mật khẩu an toàn.</Text>
            </View>
            <ChevronRight size={22} color="#9A765B" />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={isPasswordModalVisible} transparent animationType="slide" onRequestClose={closePasswordModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}>
          <Pressable style={styles.backdropPressable} onPress={closePasswordModal} />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Đổi mật khẩu</Text>

              <Text style={styles.label}>Mật khẩu hiện tại</Text>
              <TextInput
                style={[styles.input, passwordErrors.oldPassword && styles.inputError]}
                value={oldPassword}
                onChangeText={value => {
                  setOldPassword(value);
                  setPasswordErrors(current => ({ ...current, oldPassword: undefined, form: undefined }));
                }}
                secureTextEntry
                placeholder="Nhập mật khẩu hiện tại"
              />
              {passwordErrors.oldPassword ? <Text style={styles.errorText}>{passwordErrors.oldPassword}</Text> : null}

              <Text style={styles.label}>Mật khẩu mới</Text>
              <TextInput
                style={[styles.input, passwordErrors.newPassword && styles.inputError]}
                value={newPassword}
                onChangeText={value => {
                  setNewPassword(value);
                  setPasswordErrors(current => ({ ...current, newPassword: undefined, form: undefined }));
                }}
                secureTextEntry
                placeholder="Tối thiểu 6 ký tự"
              />
              {passwordErrors.newPassword ? <Text style={styles.errorText}>{passwordErrors.newPassword}</Text> : null}

              <Text style={styles.label}>Xác nhận mật khẩu mới</Text>
              <TextInput
                style={[styles.input, passwordErrors.confirmPassword && styles.inputError]}
                value={confirmPassword}
                onChangeText={value => {
                  setConfirmPassword(value);
                  setPasswordErrors(current => ({ ...current, confirmPassword: undefined, form: undefined }));
                }}
                secureTextEntry
                placeholder="Nhập lại mật khẩu mới"
              />
              {passwordErrors.confirmPassword ? (
                <Text style={styles.errorText}>{passwordErrors.confirmPassword}</Text>
              ) : null}
              {passwordErrors.form ? <Text style={styles.formErrorText}>{passwordErrors.form}</Text> : null}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.secondaryButton} onPress={closePasswordModal} disabled={isChangingPassword}>
                  <Text style={styles.secondaryText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSaveButton} onPress={handleChangePassword} disabled={isChangingPassword}>
                  {isChangingPassword ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <Text style={styles.saveText}>Lưu</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF3E8' },
  keyboardView: { flex: 1 },
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
  headerButtonPlaceholder: { width: 42, height: 42 },
  title: { flex: 1, textAlign: 'center', color: '#4A2B1A', fontSize: 22, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 40 },
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
    overflow: 'hidden',
  },
  avatarWrap: {
    width: 86,
    height: 86,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 2,
    bottom: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: '#FFFDFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  email: { color: '#4A2B1A', fontSize: 18, fontWeight: '800', marginTop: 12 },
  role: { color: Colors.primary, fontWeight: '800', marginTop: 6 },
  label: { color: '#7B573C', fontSize: 13, fontWeight: '800', marginTop: 14, marginBottom: 8 },
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
  inputError: { borderColor: '#E45B5B', backgroundColor: '#FFF8F8' },
  errorText: { color: '#C24141', fontSize: 12, fontWeight: '700', marginTop: 6 },
  formErrorText: { color: '#C24141', fontSize: 13, fontWeight: '700', lineHeight: 18, marginTop: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateSelect: {
    flex: 1,
    minHeight: 52,
    backgroundColor: '#FFFDFB',
    borderWidth: 1.5,
    borderColor: '#EBC4A4',
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateSelectText: { color: '#4A2B1A', fontSize: 16, fontWeight: '800' },
  clearDateButton: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#FFF0E2', alignItems: 'center', justifyContent: 'center' },
  addressInput: { minHeight: 88, textAlignVertical: 'top' },
  currencySelect: {
    minHeight: 74,
    borderRadius: 20,
    backgroundColor: '#FFFDFB',
    borderWidth: 1.5,
    borderColor: '#EBC4A4',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currencyCode: { color: Colors.primary, fontSize: 18, fontWeight: '900' },
  currencyLabel: { color: '#8B6548', fontWeight: '700', marginTop: 4 },
  saveButton: {
    backgroundColor: '#F28C28',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 22,
  },
  passwordCard: {
    backgroundColor: '#FFFDFB',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#EBC4A4',
    padding: 16,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { color: '#4A2B1A', fontSize: 18, fontWeight: '900' },
  passwordHint: { color: '#8B6548', fontWeight: '700', marginTop: 5 },
  saveText: { color: Colors.white, fontWeight: '800', fontSize: 16 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(42, 24, 12, 0.36)',
    justifyContent: 'flex-end',
  },
  backdropPressable: { flex: 1 },
  modalCard: {
    maxHeight: '86%',
    backgroundColor: '#FFF9F3',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: '#E8B680',
  },
  modalHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#E5B98E',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalTitle: { color: '#4A2B1A', fontSize: 22, fontWeight: '900' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  secondaryButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: '#FFF1E3',
    borderWidth: 1.2,
    borderColor: '#EBC4A4',
  },
  secondaryText: { color: '#7A4A28', fontWeight: '900' },
  modalSaveButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
});

export default ProfileScreen;
