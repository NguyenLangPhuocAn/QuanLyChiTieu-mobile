import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, SafeAreaView, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Colors } from '../../constants/Colors';

const { width } = Dimensions.get('window');

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;
};

// Dữ liệu dùng đuôi .png chuẩn xác
const slides = [
  { 
    id: '1', 
    title: 'Kiểm soát tiền của bạn', 
    description: 'Trở thành người quản lý tài chính của riêng bạn.',
    image: require('../../assets/hand-money-slide.png')
  },
  { 
    id: '2', 
    title: 'Biết tiền của bạn đi đâu', 
    description: 'Theo dõi giao dịch dễ dàng với các danh mục.',
    image: require('../../assets/plan-slide.png')
  },
  { 
    id: '3', 
    title: 'Lập kế hoạch trước', 
    description: 'Thiết lập ngân sách cho từng danh mục để bạn luôn làm chủ.',
    image: require('../../assets/paper-money-slide.png')
  },
];

const OnboardingScreen = ({ navigation }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(slideIndex);
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            {/* Đã thêm resizeMode="contain" */}
            <Image 
              source={item.image} 
              style={styles.image} 
              resizeMode="contain" 
            />
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dotsContainer}>
          {slides.map((_, index) => (
            <View key={index} style={[styles.dot, currentIndex === index && styles.activeDot]} />
          ))}
        </View>

        <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.btnPrimaryText}>Đăng ký</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.btnSecondaryText}>Đăng nhập</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  slide: { width, alignItems: 'center', padding: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: 'bold', color: Colors.text, textAlign: 'center', marginBottom: 15 },
  description: { fontSize: 16, color: Colors.gray, textAlign: 'center', lineHeight: 24, paddingHorizontal: 10 },
  footer: { padding: 20, paddingBottom: 40 },
  dotsContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border, marginHorizontal: 4 },
  activeDot: { backgroundColor: Colors.primary, width: 16 },
  btnPrimary: { backgroundColor: Colors.primary, padding: 18, borderRadius: 16, alignItems: 'center', marginBottom: 15 },
  btnPrimaryText: { color: Colors.white, fontSize: 18, fontWeight: 'bold' },
  btnSecondary: { backgroundColor: Colors.primary, padding: 18, borderRadius: 16, alignItems: 'center' },
  btnSecondaryText: { color: Colors.white, fontSize: 18, fontWeight: 'bold' },
  image: { width: 250, height: 250, marginBottom: 40},
});

export default OnboardingScreen;
