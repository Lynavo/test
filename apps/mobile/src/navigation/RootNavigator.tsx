import React, { useState, useEffect } from 'react';
import { NativeModules, ActivityIndicator, View, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';

import { DeviceDiscoveryScreen } from '../screens/DeviceDiscoveryScreen';
import { CodeVerifyScreen } from '../screens/CodeVerifyScreen';
import { SyncStatusScreen } from '../screens/SyncStatusScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

export type RootStackParamList = {
  DeviceDiscovery: undefined;
  CodeVerify: { deviceId: string; host: string; port: number; deviceName: string };
  SyncStatus: undefined;
  History: undefined;
  Settings: undefined;
};

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
            // Already paired — go straight to sync
            setInitialRoute('SyncStatus');
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
      <Stack.Screen name="CodeVerify" component={CodeVerifyScreen} />
      <Stack.Screen name="SyncStatus" component={SyncStatusScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
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
