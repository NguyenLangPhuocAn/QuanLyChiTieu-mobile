import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { FinanceProvider } from './src/context/FinanceContext';

const App = () => {
  return (
    <SafeAreaProvider style={styles.provider}>
      <AuthProvider>
        <FinanceProvider>
          <AppNavigator />
        </FinanceProvider>
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
