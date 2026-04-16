import React, { useState, useEffect } from 'react';
import { NativeModules, ActivityIndicator, View, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';

import { DeviceDiscoveryScreen } from '../screens/DeviceDiscoveryScreen';
import { CodeVerifyScreen } from '../screens/CodeVerifyScreen';
import { SyncActivityScreen } from '../screens/SyncActivityScreen';
import { AlbumWorkbenchScreen } from '../screens/AlbumWorkbenchScreen';
import { SharedFilesScreen } from '../screens/SharedFilesScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { HelpScreen } from '../screens/HelpScreen';
import { QRScannerScreen } from '../screens/QRScannerScreen';

// ---------------------------------------------------------------------------
// Param lists
// ---------------------------------------------------------------------------

export type RootStackParamList = {
  DeviceDiscovery: undefined;
  CodeVerify: {
    deviceId?: string;
    host: string;
    port: number;
    deviceName?: string;
    prefilledCode?: string;
  };
  QRScanner: undefined;
  SyncActivity: undefined;
  AlbumWorkbench: undefined;
  SharedFiles: undefined;
  History: undefined;
  Settings: undefined;
  Help: undefined;
};

// ---------------------------------------------------------------------------
// Root Stack Navigator (no bottom tabs — per PRD UI)
// ---------------------------------------------------------------------------

const Stack = createStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    const checkBinding = async () => {
      try {
        const { NativeSyncEngine } = NativeModules;
        if (NativeSyncEngine) {
          const binding = await NativeSyncEngine.getBindingState();
          if (binding && binding.deviceId) {
            // Already paired — go straight to home
            setInitialRoute('SyncActivity');
            return;
          }
        }
      } catch {
        // Ignore errors
      }
      // Not paired or no native module — show discovery
      setInitialRoute('DeviceDiscovery');
    };
    checkBinding();
  }, []);

  // Show loading while checking binding
  if (!initialRoute) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#3b9fd8" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="DeviceDiscovery" component={DeviceDiscoveryScreen} />
      <Stack.Screen name="QRScanner" component={QRScannerScreen} />
      <Stack.Screen name="CodeVerify" component={CodeVerifyScreen} />
      <Stack.Screen name="SyncActivity" component={SyncActivityScreen} />
      <Stack.Screen name="AlbumWorkbench" component={AlbumWorkbenchScreen} />
      <Stack.Screen name="SharedFiles" component={SharedFilesScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#daeef8',
  },
});
