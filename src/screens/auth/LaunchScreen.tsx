import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Colors } from '../../constants/Colors';

const logo = require('../../assets/images/splash-wallet-logo-user.png');

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
      <View style={styles.logoStage}>
        <Image source={logo} style={styles.logoImage} resizeMode="contain" />
      </View>
      <Text style={styles.logoText}>Tiêu gì?</Text>
      <Text style={styles.subtitle}>Tiêu gì cũng biết.</Text>
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
  logoStage: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  logoImage: {
    width: 220,
    height: 220,
  },
  logoText: {
    fontSize: 44,
    fontWeight: '900',
    color: Colors.white,
  },
  subtitle: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 17,
    lineHeight: 25,
    textAlign: 'center',
    fontWeight: '700',
  },
});

export default LaunchScreen;
