import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
import WalletTransfersScreen from '../screens/home/WalletTransfersScreen';
import CategoriesScreen from '../screens/home/CategoriesScreen';
import ProfileScreen from '../screens/home/ProfileScreen';
import StatisticsScreen from '../screens/home/StatisticsScreen';
import TransactionSearchScreen from '../screens/home/TransactionSearchScreen';
import TransactionDetailScreen from '../screens/home/TransactionDetailScreen';
import HashtagsScreen from '../screens/home/HashtagsScreen';
import BudgetsScreen from '../screens/home/BudgetsScreen';
import BudgetDetailScreen from '../screens/home/BudgetDetailScreen';
import NotificationsScreen from '../screens/home/NotificationsScreen';
import NotificationSettingsScreen from '../screens/home/NotificationSettingsScreen';
import LoanDebtsScreen from '../screens/home/LoanDebtsScreen';
import LoanDebtFormScreen from '../screens/home/LoanDebtFormScreen';
import LoanDebtDetailScreen from '../screens/home/LoanDebtDetailScreen';
import SavingsGoalsScreen from '../screens/home/SavingsGoalsScreen';
import FinancialPlanScreen from '../screens/home/FinancialPlanScreen';
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
  WalletTransfers: undefined;
  Categories:
    | {
        selectMode?: boolean;
        selectTarget?: 'transaction' | 'budget';
        categoryType?: 'INCOME' | 'EXPENSE';
      }
    | undefined;
  Profile:
    | {
        selectedCurrency?: string;
      }
    | undefined;
  Hashtags: undefined;
  Budgets:
    | {
        draft?: {
          categoryId: number;
          categoryName: string;
          currency: string;
          monthlyLimit: number;
        };
      }
    | undefined;
  BudgetDetail: { budgetId: number };
  Notifications: undefined;
  NotificationSettings: undefined;
  LoanDebts: undefined;
  LoanDebtForm: { loanDebtId?: number } | undefined;
  LoanDebtDetail: { loanDebtId: number };
  SavingsGoals: undefined;
  FinancialPlan: { months?: number; reductionFactor?: number } | undefined;
  Statistics:
    | {
        wallets?: Wallet[];
      }
    | undefined;
  TransactionSearch: {
    wallets: Wallet[];
    initialDateMode?: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'range';
    initialFromDate?: string;
    initialToDate?: string;
    cashFlow?: 'normal' | 'loan_debt';
  };
  TransactionDetail: {
    transaction: TransactionItem;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const {
    isAuthenticated,
    isCurrencySetupRequired,
    isLoading,
    user,
    sessionRestoreError,
    retryRestoreSession,
    signOut,
  } = useAuth();
  const mustChangePassword = Boolean(user?.must_change_password);

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (sessionRestoreError) {
    return (
      <View style={styles.restoreScreen}>
        <Text style={styles.restoreTitle}>Chưa tải được tài khoản</Text>
        <Text style={styles.restoreMessage}>{sessionRestoreError}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.restoreButton}
          onPress={retryRestoreSession}
        >
          <Text style={styles.restoreButtonText}>Thử kết nối lại</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.restoreSecondary}
          onPress={signOut}
        >
          <Text>Đăng xuất</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated && mustChangePassword ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name="ForcePasswordSetup"
            component={ForcePasswordSetupScreen}
          />
        </Stack.Navigator>
      ) : isAuthenticated && isCurrencySetupRequired ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="CurrencySetup" component={CurrencySetupScreen} />
          <Stack.Screen
            name="CurrencyPicker"
            component={CurrencyPickerScreen}
          />
        </Stack.Navigator>
      ) : isAuthenticated ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={MainScreen} />
          <Stack.Screen name="Wallets" component={WalletsScreen} />
          <Stack.Screen
            name="WalletTransactions"
            component={WalletTransactionsScreen}
          />
          <Stack.Screen
            name="WalletTransfers"
            component={WalletTransfersScreen}
          />
          <Stack.Screen name="Categories" component={CategoriesScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Hashtags" component={HashtagsScreen} />
          <Stack.Screen name="Budgets" component={BudgetsScreen} />
          <Stack.Screen name="BudgetDetail" component={BudgetDetailScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen
            name="NotificationSettings"
            component={NotificationSettingsScreen}
          />
          <Stack.Screen name="LoanDebts" component={LoanDebtsScreen} />
          <Stack.Screen name="LoanDebtForm" component={LoanDebtFormScreen} />
          <Stack.Screen
            name="LoanDebtDetail"
            component={LoanDebtDetailScreen}
          />
          <Stack.Screen name="SavingsGoals" component={SavingsGoalsScreen} />
          <Stack.Screen name="FinancialPlan" component={FinancialPlanScreen} />
          <Stack.Screen
            name="CurrencyPicker"
            component={CurrencyPickerScreen}
          />
          <Stack.Screen name="Statistics" component={StatisticsScreen} />
          <Stack.Screen
            name="TransactionSearch"
            component={TransactionSearchScreen}
          />
          <Stack.Screen
            name="TransactionDetail"
            component={TransactionDetailScreen}
          />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName="Launch"
        >
          <Stack.Screen name="Launch" component={LaunchScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
          />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  restoreScreen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 16,
    backgroundColor: Colors.white,
  },
  restoreTitle: { fontSize: 20, fontWeight: '700', color: '#20262D' },
  restoreMessage: { fontSize: 15, lineHeight: 23, color: '#667085' },
  restoreButton: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  restoreButtonText: { color: Colors.white, fontWeight: '600' },
  restoreSecondary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
});

export default AppNavigator;
