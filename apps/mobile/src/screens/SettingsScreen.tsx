import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  NativeModules,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors } from '../theme/colors';
import { Icon } from '../components/Icon';

// ---------------------------------------------------------------------------
// SettingsScreen
// ---------------------------------------------------------------------------

type NavigationProp = StackNavigationProp<RootStackParamList, 'Settings'>;

export function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [deviceName, setDeviceName] = useState('');
  const [deviceIp, setDeviceIp] = useState('');
  const [connected, setConnected] = useState(false);

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
          setDeviceName(state.deviceAlias || state.deviceName || '');
          setDeviceIp(state.host || '');
          setConnected(true);
        }
        if (clientName) {
          setMyName(clientName);
        }
      } catch (e) {
        console.warn('Native module not available for Settings');
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
  // Disconnect and unbind
  // ---------------------------------------------------------------------------

  const handleDisconnect = useCallback(() => {
    Alert.alert(
      '断开连接',
      '确定要断开与电脑的连接吗？断开后需要重新输入连接码配对',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
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
          },
        },
      ],
    );
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
            <Icon name="chevron-back" size={20} color={colors.screenTitle} />
          </TouchableOpacity>
          <Text style={styles.title}>{'设置'}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* My iPhone display name card */}
          <View style={styles.deviceCard}>
            <Text style={styles.sectionLabel}>{'我的设备名称'}</Text>
            <View style={styles.deviceRow}>
              {/* Phone icon */}
              <View style={[styles.monitorIconWrapper, styles.phoneIconWrapper]}>
                <Icon name="phone-portrait-outline" size={20} color="#fff" />
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
                      <Icon name="checkmark" size={16} color="#3b9fd8" />
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
                      <Icon name="pencil-outline" size={14} color="#3b9fd8" />
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={styles.myNameHint}>
                  {'此名称将在 Mac 端显示'}
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
                <Icon name="desktop-outline" size={20} color="#fff" />
              </View>

              {/* Name + IP + status */}
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceNameText} numberOfLines={1}>
                  {deviceName}
                </Text>

                <Text style={styles.deviceIp}>{deviceIp}</Text>

                {/* Connection status */}
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, !connected && styles.statusDotDisconnected]} />
                  <Text style={[styles.statusText, !connected && styles.statusTextDisconnected]}>
                    {connected ? '已连接' : '未连接'}
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
              <Text style={styles.disconnectText}>{'断开连接 / 切换设备'}</Text>
            </TouchableOpacity>
          </View>

          {/* Hint text */}
          <Text style={styles.hintText}>
            {'电脑端名称在电脑端设置中修改'}
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
