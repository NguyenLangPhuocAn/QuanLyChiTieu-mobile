import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LaunchScreen from '../screens/auth/LaunchScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import ForcePasswordSetupScreen from '../screens/auth/ForcePasswordSetupScreen';
import CurrencySetupScreen from '../screens/auth/CurrencySetupScreen';
import CurrencyPickerScreen from '../screens/auth/CurrencyPickerScreen';
import MainScreen from '../screens/home/MainScreen';
import WalletsScreen from '../screens/home/WalletsScreen';
import WalletTransactionsScreen from '../screens/home/WalletTransactionsScreen';
import CategoriesScreen from '../screens/home/CategoriesScreen';
import ProfileScreen from '../screens/home/ProfileScreen';
import StatisticsScreen from '../screens/home/StatisticsScreen';
import TransactionSearchScreen from '../screens/home/TransactionSearchScreen';
import TransactionDetailScreen from '../screens/home/TransactionDetailScreen';
import HashtagsScreen from '../screens/home/HashtagsScreen';
import type { Wallet } from '../types/wallet';
import type { TransactionItem } from '../data/mockTransactions';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/Colors';

// Xuất kiểu route dùng chung để các màn hình truyền tham số điều hướng an toàn.
export type RootStackParamList = {
  Launch: undefined;
  Onboarding: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ResetPassword:
    | {
        token?: string;
      }
    | undefined;
  ForcePasswordSetup: undefined;
  CurrencySetup:
    | {
        selectedCurrency?: string;
      }
    | undefined;
  CurrencyPicker: {
    selectedCurrency?: string;
    returnTo: 'CurrencySetup' | 'Profile' | 'Wallets';
  };
  Main: undefined;
  Wallets:
    | {
        selectedCurrency?: string;
      }
    | undefined;
  WalletTransactions: {
    walletId: number;
    walletName: string;
  };
  Categories:
    | {
        selectMode?: boolean;
      }
    | undefined;
  Profile:
    | {
        selectedCurrency?: string;
      }
    | undefined;
  Hashtags: undefined;
  Statistics: undefined;
  TransactionSearch: {
    wallets: Wallet[];
  };
  TransactionDetail: {
    transaction: TransactionItem;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const { isAuthenticated, isCurrencySetupRequired, isLoading, user } = useAuth();
  const mustChangePassword = Boolean(user?.must_change_password);

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated && mustChangePassword ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="ForcePasswordSetup" component={ForcePasswordSetupScreen} />
        </Stack.Navigator>
      ) : isAuthenticated && isCurrencySetupRequired ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="CurrencySetup" component={CurrencySetupScreen} />
          <Stack.Screen name="CurrencyPicker" component={CurrencyPickerScreen} />
        </Stack.Navigator>
      ) : isAuthenticated ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={MainScreen} />
          <Stack.Screen name="Wallets" component={WalletsScreen} />
          <Stack.Screen name="WalletTransactions" component={WalletTransactionsScreen} />
          <Stack.Screen name="Categories" component={CategoriesScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Hashtags" component={HashtagsScreen} />
          <Stack.Screen name="CurrencyPicker" component={CurrencyPickerScreen} />
          <Stack.Screen name="Statistics" component={StatisticsScreen} />
          <Stack.Screen name="TransactionSearch" component={TransactionSearchScreen} />
          <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Launch">
          <Stack.Screen name="Launch" component={LaunchScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
});

export default AppNavigator;
