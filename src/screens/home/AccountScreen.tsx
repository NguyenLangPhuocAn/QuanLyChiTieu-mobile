import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ChevronRight,
  Bell,
  Cloud,
  Crown,
  Download,
  HelpCircle,
  Hash,
  ListTree,
  LockKeyhole,
  LogOut,
  Palette,
  Repeat,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  WalletCards,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { authService } from '../../services/auth';

const premiumUpgradeImage = require('../../assets/premium-upgrade.png');

const AccountScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, user, signOut, upgradeToPremium } = useAuth();
  const [isPlanModalVisible, setIsPlanModalVisible] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const isPremium = user?.role === 'PREMIUM' || user?.role === 'ADMIN';
  const displayPlan = isPremium ? 'PREMIUM' : 'BASIC';

  const handleUpgradePremium = () => {
    if (isPremium) {
      Alert.alert('Gói hiện tại', 'Tài khoản của bạn đã có quyền Premium.');
      return;
    }

    Alert.alert(
      'Nâng cấp Premium',
      'Hiện tại hệ thống chưa tích hợp thanh toán. Bạn có muốn nâng cấp thử lên Premium không?',
      [
        { text: 'Để sau', style: 'cancel' },
        {
          text: 'Đồng ý nâng cấp',
          onPress: async () => {
            setIsUpgrading(true);

            try {
              await upgradeToPremium();
              setIsPlanModalVisible(false);
              Alert.alert('Đã nâng cấp', 'Tài khoản của bạn đã chuyển sang Premium.');
            } catch (error) {
              Alert.alert('Chưa thể nâng cấp', error instanceof Error ? error.message : 'Vui lòng thử lại sau.');
            } finally {
              setIsUpgrading(false);
            }
          },
        },
      ],
    );
  };

  const confirmDeactivateAccount = () => {
    Alert.alert(
      'Xóa tài khoản',
      'Tài khoản sẽ bị vô hiệu hóa. Dữ liệu vẫn được giữ trong hệ thống nếu cần hỗ trợ mở lại.',
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
              Alert.alert('Không thể xóa tài khoản', error instanceof Error ? error.message : 'Vui lòng thử lại sau.');
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Tài khoản</Text>
        <TouchableOpacity style={styles.logoutIconButton} onPress={signOut}>
          <LogOut size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <UserRound size={32} color={Colors.primary} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {user?.full_name || 'Người dùng'}
          </Text>
          <Text style={styles.email} numberOfLines={1}>{user?.email ?? 'Chưa có email'}</Text>
          <View style={styles.roleBadge}>
            <ShieldCheck size={14} color={Colors.primary} />
            <Text style={styles.roleText}>{displayPlan}</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <WalletCards size={18} color={Colors.primary} />
          <Text style={styles.statValue}>{user?.wallet_count ?? 0}</Text>
          <Text style={styles.statLabel}>Ví</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{user?.currency_default ?? 'VND'}</Text>
          <Text style={styles.statLabel}>Tiền tệ</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{user?.profile_setup_completed ? 'Đầy đủ' : 'Thiếu'}</Text>
          <Text style={styles.statLabel}>Thông tin</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.premiumBanner, isPremium && styles.premiumBannerActive]}
        activeOpacity={0.9}
        onPress={() => setIsPlanModalVisible(true)}>
        <Image source={premiumUpgradeImage} style={styles.premiumImage} />
        <View style={styles.premiumCopy}>
          <View style={styles.premiumEyebrow}>
            <Sparkles size={14} color="#9A4D00" />
            <Text style={styles.premiumEyebrowText}>{isPremium ? 'Gói đang dùng' : 'Gợi ý nâng cấp'}</Text>
          </View>
          <Text style={styles.premiumTitle}>{isPremium ? 'Premium đang hoạt động' : 'Mở khóa Premium'}</Text>
          <Text style={styles.premiumSubtitle}>
            {isPremium
              ? 'Bạn đang có đầy đủ quyền lọc nâng cao, thống kê và xuất báo cáo.'
              : 'Thêm ví không giới hạn, danh mục cá nhân, lọc nâng cao và xuất báo cáo.'}
          </Text>
          <View style={styles.premiumCta}>
            <Crown size={15} color={Colors.white} />
            <Text style={styles.premiumCtaText}>{isPremium ? 'Xem gói' : 'Thay đổi gói'}</Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.menuGroup}>
        <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Profile')}>
          <View style={styles.menuLeft}>
            <View style={styles.menuIcon}>
              <UserRound size={19} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.menuTitle}>Thông tin hồ sơ</Text>
              <Text style={styles.menuSubtitle}>Tên, SĐT, tiền tệ, mật khẩu</Text>
            </View>
          </View>
          <ChevronRight size={20} color="#B57745" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Categories')}>
          <View style={styles.menuLeft}>
            <View style={styles.menuIcon}>
              <ListTree size={19} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.menuTitle}>Danh mục thu chi</Text>
              <Text style={styles.menuSubtitle}>Quản lý nhóm giao dịch</Text>
            </View>
          </View>
          <ChevronRight size={20} color="#B57745" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Hashtags')}>
          <View style={styles.menuLeft}>
            <View style={styles.menuIcon}>
              <Hash size={19} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.menuTitle}>Hashtag</Text>
              <Text style={styles.menuSubtitle}>Tạo nhanh tag để lọc và thống kê</Text>
            </View>
          </View>
          <ChevronRight size={20} color="#B57745" />
        </TouchableOpacity>

        {[
          { title: 'Ví & tài khoản', subtitle: 'Số dư, hạn mức, loại ví', Icon: WalletCards, action: () => navigation.navigate('Wallets') },
          { title: 'Ngân sách', subtitle: 'Theo dõi hạn mức theo ví', Icon: ShieldCheck, action: () => navigation.navigate('Wallets') },
          { title: 'Giao dịch định kỳ', subtitle: 'Tính năng Premium', Icon: Repeat, locked: !isPremium },
          { title: 'Bảo mật', subtitle: 'Mật khẩu và đăng nhập', Icon: Shield, action: () => navigation.navigate('Profile') },
          { title: 'Giao diện', subtitle: 'Tùy chỉnh hiển thị', Icon: Palette, locked: !isPremium },
          { title: 'Thông báo', subtitle: 'Nhắc ngân sách và giao dịch', Icon: Bell },
          { title: 'Sao lưu / Khôi phục', subtitle: 'Đồng bộ dữ liệu Premium', Icon: Cloud, locked: !isPremium },
          { title: 'Xuất báo cáo', subtitle: 'Excel/PDF dành cho Premium', Icon: Download, locked: !isPremium, action: () => navigation.navigate('Statistics') },
          { title: 'Hỗ trợ', subtitle: 'Câu hỏi thường gặp', Icon: HelpCircle },
          { title: 'Chính sách bảo mật', subtitle: 'Cách ứng dụng xử lý dữ liệu', Icon: LockKeyhole },
        ].map(item => {
          const Icon = item.Icon;

          return (
            <TouchableOpacity
              key={item.title}
              style={styles.menuRow}
              onPress={() => (item.locked ? setIsPlanModalVisible(true) : item.action?.())}>
              <View style={styles.menuLeft}>
                <View style={styles.menuIcon}>
                  <Icon size={19} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                </View>
              </View>
              {item.locked ? <LockKeyhole size={18} color="#B57745" /> : <ChevronRight size={20} color="#B57745" />}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <LogOut size={18} color={Colors.white} />
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteAccountButton} onPress={confirmDeactivateAccount}>
        <Trash2 size={18} color="#B42318" />
        <Text style={styles.deleteAccountText}>Xóa tài khoản</Text>
      </TouchableOpacity>

      <Modal
        visible={isPlanModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPlanModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropPressable} onPress={() => setIsPlanModalVisible(false)} />
          <View style={styles.planModal}>
            <Text style={styles.planTitle}>So sánh gói tài khoản</Text>
            <Text style={styles.planSubtitle}>Premium đang mở thử trong hệ thống vì chưa tích hợp thanh toán.</Text>

            <View style={styles.planTable}>
              <View style={styles.planColumn}>
                <Text style={styles.planName}>Basic</Text>
                <Text style={styles.planPrice}>Miễn phí</Text>
                <Text style={styles.planCell}>Tối đa 2 ví</Text>
                <Text style={styles.planCell}>Danh mục hệ thống</Text>
                <Text style={styles.planCell}>Lọc lịch sử cơ bản</Text>
                <Text style={styles.planCell}>Thống kê tổng quan</Text>
              </View>
              <View style={[styles.planColumn, styles.planColumnPremium]}>
                <View style={styles.planHeaderRow}>
                  <Crown size={18} color="#B85C00" />
                  <Text style={styles.planNamePremium}>Premium</Text>
                </View>
                <Text style={styles.planPricePremium}>Mở thử</Text>
                <Text style={styles.planCellPremium}>Không giới hạn ví</Text>
                <Text style={styles.planCellPremium}>Tạo danh mục cá nhân</Text>
                <Text style={styles.planCellPremium}>Lọc theo ví, danh mục, thu/chi</Text>
                <Text style={styles.planCellPremium}>Xuất Excel/PDF, hashtag hot</Text>
              </View>
            </View>

            <View style={styles.planActions}>
              <TouchableOpacity
                style={styles.planSecondaryButton}
                onPress={() => setIsPlanModalVisible(false)}
                disabled={isUpgrading}>
                <Text style={styles.planSecondaryText}>Để sau</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.planPrimaryButton, isPremium && styles.planPrimaryButtonDisabled]}
                onPress={handleUpgradePremium}
                disabled={isUpgrading || isPremium}>
                {isUpgrading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.planPrimaryText}>{isPremium ? 'Đã là Premium' : 'Nâng cấp'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
  },
  content: {
    padding: 16,
    paddingBottom: 140,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#4C2A18',
  },
  logoutIconButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    color: '#4C2A18',
    fontSize: 19,
    fontWeight: '900',
  },
  email: {
    color: '#8A623F',
    fontWeight: '700',
    marginTop: 5,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFF0DF',
    marginTop: 10,
  },
  roleText: {
    color: Colors.primary,
    fontWeight: '900',
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    minHeight: 78,
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 12,
    justifyContent: 'center',
  },
  statValue: {
    color: '#4C2A18',
    fontWeight: '900',
    fontSize: 17,
    marginTop: 4,
  },
  statLabel: {
    color: '#8A623F',
    fontWeight: '800',
    fontSize: 12,
    marginTop: 4,
  },
  premiumBanner: {
    marginTop: 14,
    minHeight: 168,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: Colors.white,
  },
  premiumBannerActive: {
    borderColor: '#D99036',
  },
  premiumImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    opacity: 0.42,
  },
  premiumCopy: {
    minHeight: 168,
    padding: 16,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 249, 242, 0.72)',
  },
  premiumEyebrow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#FFE3C8',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  premiumEyebrowText: {
    color: '#9A4D00',
    fontSize: 12,
    fontWeight: '900',
  },
  premiumTitle: {
    color: '#3F2414',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 10,
  },
  premiumSubtitle: {
    color: '#6F4B32',
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 6,
    maxWidth: '86%',
  },
  premiumCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#C76708',
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginTop: 12,
  },
  premiumCtaText: {
    color: Colors.white,
    fontWeight: '900',
  },
  menuGroup: {
    marginTop: 14,
    backgroundColor: Colors.white,
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    overflow: 'hidden',
  },
  menuRow: {
    minHeight: 74,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F3D8BF',
  },
  menuLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    color: '#4C2A18',
    fontWeight: '900',
    fontSize: 15,
  },
  menuSubtitle: {
    color: '#8A623F',
    fontWeight: '700',
    marginTop: 4,
    fontSize: 12,
  },
  logoutButton: {
    marginTop: 14,
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  logoutText: {
    color: Colors.white,
    fontWeight: '900',
    fontSize: 16,
  },
  deleteAccountButton: {
    marginTop: 10,
    backgroundColor: '#FFF1F0',
    borderWidth: 1.2,
    borderColor: '#F3B8B2',
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  deleteAccountText: {
    color: '#B42318',
    fontWeight: '900',
    fontSize: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(42, 24, 12, 0.42)',
    justifyContent: 'center',
    padding: 16,
  },
  modalBackdropPressable: {
    ...StyleSheet.absoluteFill,
  },
  planModal: {
    borderRadius: 24,
    backgroundColor: '#FFF9F3',
    borderWidth: 1.2,
    borderColor: '#E8B680',
    padding: 16,
  },
  planTitle: {
    color: '#3F2414',
    fontSize: 21,
    fontWeight: '900',
  },
  planSubtitle: {
    color: '#7A563C',
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 6,
  },
  planTable: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  planColumn: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8B680',
    backgroundColor: Colors.white,
    padding: 12,
  },
  planColumnPremium: {
    backgroundColor: '#FFF0DF',
    borderColor: '#D99036',
  },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planName: {
    color: '#6A4228',
    fontWeight: '900',
    fontSize: 16,
  },
  planNamePremium: {
    color: '#9A4D00',
    fontWeight: '900',
    fontSize: 16,
  },
  planPrice: {
    color: '#8A623F',
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 8,
  },
  planPricePremium: {
    color: '#B85C00',
    fontWeight: '900',
    marginTop: 6,
    marginBottom: 8,
  },
  planCell: {
    color: '#6F4B32',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 8,
  },
  planCellPremium: {
    color: '#5C351E',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 17,
    marginTop: 8,
  },
  planActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  planSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: '#E8B680',
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planSecondaryText: {
    color: '#7A4A28',
    fontWeight: '900',
  },
  planPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#C76708',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planPrimaryButtonDisabled: {
    backgroundColor: '#D7AD82',
  },
  planPrimaryText: {
    color: Colors.white,
    fontWeight: '900',
  },
});

export default AccountScreen;
