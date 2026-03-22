import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  NativeModules,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors } from '../theme/colors';

// ---------------------------------------------------------------------------
// Mock data (fallback when native module not available)
// ---------------------------------------------------------------------------

const mockDevice = {
  name: '\u526A\u8F91\u5DE5\u4F5C\u7AD9-A',
  ip: '192.168.1.101',
  connected: true,
};

// ---------------------------------------------------------------------------
// SettingsScreen
// ---------------------------------------------------------------------------

type NavigationProp = StackNavigationProp<RootStackParamList, 'Settings'>;

export function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [editing, setEditing] = useState(false);
  const [deviceName, setDeviceName] = useState(mockDevice.name);
  const [deviceIp, setDeviceIp] = useState(mockDevice.ip);
  const [connected, setConnected] = useState(mockDevice.connected);

  // My iPhone display name
  const [myName, setMyName] = useState('iPhone');
  const [editingMyName, setEditingMyName] = useState(false);

  // ---------------------------------------------------------------------------
  // Load real binding state + client display name from native module
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const loadState = async () => {
      try {
        const { NativeSyncEngine } = NativeModules;
        if (!NativeSyncEngine) return;

        const [state, clientName] = await Promise.all([
          NativeSyncEngine.getBindingState(),
          NativeSyncEngine.getClientDisplayName(),
        ]);
        if (state) {
          setDeviceName(state.deviceAlias || state.deviceName || mockDevice.name);
          setDeviceIp(state.host || mockDevice.ip);
          setConnected(true);
        }
        if (clientName) {
          setMyName(clientName);
        }
      } catch (e) {
        console.warn('Native module not available for Settings, using mock data');
      }
    };

    loadState();
  }, []);

  // ---------------------------------------------------------------------------
  // Save my iPhone display name
  // ---------------------------------------------------------------------------

  const handleConfirmMyName = useCallback(async () => {
    setEditingMyName(false);
    const trimmed = myName.trim();
    if (!trimmed) return;
    try {
      const { NativeSyncEngine } = NativeModules;
      if (NativeSyncEngine) {
        await NativeSyncEngine.setClientDisplayName(trimmed);
      }
    } catch (e) {
      console.warn('Failed to save client display name');
    }
  }, [myName]);

  // ---------------------------------------------------------------------------
  // Rename device alias
  // ---------------------------------------------------------------------------

  const handleConfirmEdit = useCallback(async () => {
    setEditing(false);
    try {
      const { NativeSyncEngine } = NativeModules;
      if (NativeSyncEngine) {
        await NativeSyncEngine.renameBoundDeviceAlias(deviceName);
      }
    } catch (e) {
      console.warn('Failed to rename device alias');
    }
  }, [deviceName]);

  // ---------------------------------------------------------------------------
  // Disconnect and unbind
  // ---------------------------------------------------------------------------

  const handleDisconnect = useCallback(async () => {
    try {
      const { NativeSyncEngine } = NativeModules;
      if (NativeSyncEngine) {
        await NativeSyncEngine.disconnectAndUnbind();
      }
    } catch (e) {
      console.warn('Failed to disconnect');
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'DeviceDiscovery' }],
    });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backArrow}>{'\u2190'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{'\u8BBE\u7F6E'}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* My iPhone display name card */}
          <View style={styles.deviceCard}>
            <Text style={styles.sectionLabel}>{'\u6211\u7684\u8BBE\u5907\u540D\u79F0'}</Text>
            <View style={styles.deviceRow}>
              {/* Phone icon */}
              <View style={[styles.monitorIconWrapper, styles.phoneIconWrapper]}>
                <Text style={styles.monitorIcon}>{'\uD83D\uDCF1'}</Text>
              </View>

              {/* Name display / edit */}
              <View style={styles.deviceInfo}>
                {editingMyName ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.nameInput}
                      value={myName}
                      onChangeText={setMyName}
                      autoFocus
                      selectTextOnFocus
                      returnKeyType="done"
                      onSubmitEditing={handleConfirmMyName}
                    />
                    <TouchableOpacity
                      style={styles.confirmButton}
                      activeOpacity={0.7}
                      onPress={handleConfirmMyName}
                    >
                      <Text style={styles.confirmIcon}>{'\u2713'}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.nameRow}>
                    <Text style={styles.deviceNameText} numberOfLines={1}>
                      {myName}
                    </Text>
                    <TouchableOpacity
                      style={styles.editButton}
                      activeOpacity={0.7}
                      onPress={() => setEditingMyName(true)}
                    >
                      <Text style={styles.editIcon}>{'\u270F\uFE0F'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={styles.myNameHint}>
                  {'\u6B64\u540D\u79F0\u5C06\u5728 Mac \u7AEF\u663E\u793A'}
                </Text>
              </View>
            </View>
          </View>

          {/* Connected device card */}
          <View style={styles.deviceCard}>
            {/* Device info row */}
            <View style={styles.deviceRow}>
              {/* Monitor icon */}
              <View style={styles.monitorIconWrapper}>
                <Text style={styles.monitorIcon}>{'\uD83D\uDDA5'}</Text>
              </View>

              {/* Name + IP + status */}
              <View style={styles.deviceInfo}>
                {editing ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.nameInput}
                      value={deviceName}
                      onChangeText={setDeviceName}
                      autoFocus
                      selectTextOnFocus
                      returnKeyType="done"
                      onSubmitEditing={handleConfirmEdit}
                    />
                    <TouchableOpacity
                      style={styles.confirmButton}
                      activeOpacity={0.7}
                      onPress={handleConfirmEdit}
                    >
                      <Text style={styles.confirmIcon}>{'\u2713'}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.nameRow}>
                    <Text style={styles.deviceNameText} numberOfLines={1}>
                      {deviceName}
                    </Text>
                    <TouchableOpacity
                      style={styles.editButton}
                      activeOpacity={0.7}
                      onPress={() => setEditing(true)}
                    >
                      <Text style={styles.editIcon}>{'\u270F\uFE0F'}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={styles.deviceIp}>{deviceIp}</Text>

                {/* Connection status */}
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, !connected && styles.statusDotDisconnected]} />
                  <Text style={[styles.statusText, !connected && styles.statusTextDisconnected]}>
                    {connected ? '\u5DF2\u8FDE\u63A5' : '\u672A\u8FDE\u63A5'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Disconnect button */}
            <TouchableOpacity
              style={styles.disconnectButton}
              activeOpacity={0.7}
              onPress={handleDisconnect}
            >
              <Text style={styles.disconnectText}>{'\u65AD\u5F00\u8FDE\u63A5 / \u5207\u6362\u8BBE\u5907'}</Text>
            </TouchableOpacity>
          </View>

          {/* Hint text */}
          <Text style={styles.hintText}>
            {'\u8BBE\u5907\u540D\u79F0\u9ED8\u8BA4\u683C\u5F0F\uFF1A\u8BBE\u5907\u540D + IP \u5730\u5740\uFF0C\u53EF\u70B9\u51FB\u7F16\u8F91\u56FE\u6807\u81EA\u5B9A\u4E49\u540D\u79F0'}
          </Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.screenBackground,
  },
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 18,
    color: colors.screenTitle,
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.screenTitle,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },

  // Device card
  deviceCard: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    padding: 16,
    shadowColor: 'rgba(80,150,200,0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
    marginBottom: 16,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  monitorIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3ba4dc',
    shadowColor: 'rgba(59,159,216,0.5)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
  },
  monitorIcon: {
    fontSize: 24,
  },
  deviceInfo: {
    flex: 1,
    minWidth: 0,
  },

  // Name display
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceNameText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.screenTitle,
    flexShrink: 1,
  },
  editButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIcon: {
    fontSize: 14,
  },

  // Name editing
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#b8d8ea',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    fontWeight: '600',
    color: colors.screenTitle,
  },
  confirmButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(59,159,216,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmIcon: {
    fontSize: 14,
    color: '#3b9fd8',
  },

  // IP + status
  deviceIp: {
    fontSize: 12,
    color: '#90b0c8',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  statusDotDisconnected: {
    backgroundColor: '#9ca3af',
  },
  statusText: {
    fontSize: 12,
    color: '#22c55e',
  },
  statusTextDisconnected: {
    color: '#9ca3af',
  },

  // Disconnect button
  disconnectButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(59,159,216,0.18)',
    backgroundColor: 'rgba(59,159,216,0.08)',
    borderRadius: 14,
    paddingVertical: 12,
  },
  disconnectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b9fd8',
  },

  // Section label
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#90b0c8',
    marginBottom: 12,
  },

  // Phone icon
  phoneIconWrapper: {
    backgroundColor: '#6366f1',
    shadowColor: 'rgba(99,102,241,0.5)',
  },

  // My name hint
  myNameHint: {
    fontSize: 11,
    color: '#90b0c8',
    marginTop: 4,
  },

  // Hint
  hintText: {
    fontSize: 12,
    color: '#90b0c8',
    paddingHorizontal: 4,
  },
});
