import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { FinanceProvider } from './src/context/FinanceContext';
import AppUpdateManager from './src/components/AppUpdateManager';
import BillReminderSession from './src/components/BillReminderSession';
import OfflineSessionSync from './src/components/OfflineSessionSync';
import HomeWidgetSession from './src/components/HomeWidgetSession';

const AccountWorkspace = () => {
  const { user } = useAuth();
  return (
    <FinanceProvider ownerKey={user?.id ?? 'anonymous'}>
      <BillReminderSession />
      <OfflineSessionSync />
      <HomeWidgetSession />
      <AppNavigator />
    </FinanceProvider>
  );
};

const App = () => {
  return (
    <SafeAreaProvider style={styles.provider}>
      <AuthProvider>
        <AppUpdateManager>
          <AccountWorkspace />
        </AppUpdateManager>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  provider: {
    flex: 1,
  },
});

export default App;
