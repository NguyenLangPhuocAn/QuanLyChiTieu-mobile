import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Colors } from '../../constants/Colors';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Launch'>;
};

const LaunchScreen = ({ navigation }: Props) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Onboarding');
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.logoText}>Tiêu gì?</Text>
      <Text style={styles.subtitle}>
        Quản lý thu chi gọn gàng, rõ ràng và dễ nhìn hơn mỗi ngày.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  logoText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: Colors.white,
  },
  subtitle: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.86)',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
});

export default LaunchScreen;
