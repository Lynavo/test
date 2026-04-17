import { useEffect } from 'react';
import { StatusBar, StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './stores/auth-store';
import { RootNavigator } from './navigation/RootNavigator';
import { loadDebugBaseUrlOverride } from './services/config';
import './i18n';

export function App() {
  const isDarkMode = useColorScheme() === 'dark';

  // Load any persisted dev-only API base URL override BEFORE the AuthProvider
  // mounts and triggers its first request — see services/config.ts for the
  // real-device debug instructions.
  useEffect(() => {
    loadDebugBaseUrlOverride();
  }, []);

  return (
    <AuthProvider>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <NavigationContainer>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
            <RootNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
