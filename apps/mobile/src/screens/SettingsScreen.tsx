import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  NativeModules,
  NativeEventEmitter,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors } from '../theme/colors';
import { Icon } from '../components/Icon';
import {
  isDiagnosticsExportUnavailable,
  shareDiagnosticsArchive,
} from '../utils/shareDiagnosticsArchive';
import {
  buildSyncConnectionEvidence,
  getConnectionBadgeState,
  type MobileConnectionState,
} from '../utils/effectiveConnectionState';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLUE = '#3b9fd8';
const DARK = '#1a3a5c';
const SCREEN_BG = '#d6ecf8';

// ---------------------------------------------------------------------------
// SettingsScreen
// ---------------------------------------------------------------------------

type NavigationProp = StackNavigationProp<RootStackParamList, 'Settings'>;
type SettingsSyncOverviewState = {
  progressPercent: number;
  transferredBytes: number;
  currentFile: string | null;
  currentFileConfirmedBytes: number;
  uploadState: string;
};

function formatAppVersionLabel(appInfo?: Record<string, unknown>): string {
  const version = typeof appInfo?.version === 'string' ? appInfo.version : '';
  if (!version) return '未知版本';

  const appName =
    typeof appInfo?.appName === 'string' && appInfo.appName
      ? appInfo.appName
      : 'Vivi Drop';
  const build =
    typeof appInfo?.build === 'string' && appInfo.build ? appInfo.build : '0';
  return `${appName} v${version} (${build})`;
}

function formatDateTimeLabel(iso?: string): string {
  if (!iso) return '暂无记录';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '暂无记录';

  const now = new Date();
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  if (date.toDateString() === now.toDateString()) {
    return `今天 ${time}`;
  }
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
  }
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${time}`;
}

export function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const isAndroid = Platform.OS === 'android';
  const [deviceName, setDeviceName] = useState('');
  const [deviceIp, setDeviceIp] = useState('');
  const [connectionState, setConnectionState] =
    useState<MobileConnectionState>('offline');
  const [syncOverviewState, setSyncOverviewState] =
    useState<SettingsSyncOverviewState>({
    progressPercent: 0,
    transferredBytes: 0,
    currentFile: null as string | null,
    currentFileConfirmedBytes: 0,
    uploadState: 'idle',
  });
  const [latestSyncLabel, setLatestSyncLabel] = useState('暂无记录');
  const [appVersionLabel, setAppVersionLabel] = useState('读取中…');
  const [isPhotoPermissionBlocked, setIsPhotoPermissionBlocked] =
    useState(false);
  const [isExportingDiagnostics, setIsExportingDiagnostics] = useState(false);

  // My iPhone display name
  const [myName, setMyName] = useState('iPhone');
  const [editingMyName, setEditingMyName] = useState(false);

  // ---------------------------------------------------------------------------
  // Load real binding state + client display name from native module
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let bindingSub: { remove: () => void } | undefined;
    let syncSub: { remove: () => void } | undefined;

    const applyBindingState = (
      state: Record<string, unknown> | null | undefined,
    ) => {
      if (!state || !state.deviceId) {
        setDeviceName('');
        setDeviceIp('');
        setConnectionState('offline');
        return;
      }

      setDeviceName(
        (state.deviceAlias as string) || (state.deviceName as string) || '',
      );
      setDeviceIp((state.host as string) || '');
      setConnectionState(
        (state.connectionState as typeof connectionState) || 'bound',
      );
    };

    const loadState = async () => {
      try {
        const { NativeSyncEngine } = NativeModules;
        if (!NativeSyncEngine) return;

        const emitter = new NativeEventEmitter(NativeSyncEngine);
        bindingSub = emitter.addListener(
          'onBindingStateChanged',
          applyBindingState,
        );
        syncSub = emitter.addListener(
          'onSyncStateChanged',
          (state: Record<string, unknown>) => {
            const uploadState = (state.uploadState as string) || 'idle';
            setSyncOverviewState(prev => ({
              progressPercent:
                typeof state.progressPercent === 'number'
                  ? state.progressPercent
                  : prev.progressPercent,
              transferredBytes:
                typeof state.transferredBytes === 'number'
                  ? state.transferredBytes
                  : prev.transferredBytes,
              currentFile: Object.prototype.hasOwnProperty.call(
                state,
                'currentFile',
              )
                ? typeof state.currentFile === 'string'
                  ? state.currentFile
                  : null
                : prev.currentFile,
              currentFileConfirmedBytes:
                typeof state.currentFileConfirmedBytes === 'number'
                  ? state.currentFileConfirmedBytes
                  : prev.currentFileConfirmedBytes,
              uploadState,
            }));
            setIsPhotoPermissionBlocked(uploadState === 'paused_no_permission');
          },
        );

        // Safely call all methods with optional chaining to prevent synchronous TypeErrors
        // if any method isn't fully exported to the React Native bridge yet.
        const [
          stateResult,
          clientNameResult,
          appInfoResult,
          historyResult,
          syncOverviewResult,
        ] = await Promise.allSettled([
          NativeSyncEngine.getBindingState?.() ?? Promise.resolve(null),
          NativeSyncEngine.getClientDisplayName?.() ??
            Promise.resolve('iPhone'),
          NativeSyncEngine.getAppInfo?.() ?? Promise.resolve(undefined),
          NativeSyncEngine.getHistoryDays?.(null) ?? Promise.resolve(undefined),
          NativeSyncEngine.getSyncOverview?.() ?? Promise.resolve(undefined),
        ]);

        if (stateResult.status === 'fulfilled' && stateResult.value) {
          applyBindingState(
            stateResult.value as Record<string, unknown> | null | undefined,
          );
        }

        if (clientNameResult.status === 'fulfilled' && clientNameResult.value) {
          setMyName(clientNameResult.value as string);
        }

        if (appInfoResult.status === 'fulfilled' && appInfoResult.value) {
          setAppVersionLabel(
            formatAppVersionLabel(
              appInfoResult.value as Record<string, unknown> | undefined,
            ),
          );
        } else {
          setAppVersionLabel('未知版本');
        }

        const history =
          historyResult.status === 'fulfilled'
            ? (historyResult.value as
                | { items?: Array<Record<string, unknown>> }
                | undefined)
            : undefined;
        const items = history?.items as
          | Array<Record<string, unknown>>
          | undefined;
        if (items?.length) {
          let latestItem: Record<string, unknown> | null = null;
          for (const item of items) {
            if (!latestItem) {
              latestItem = item;
              continue;
            }
            const currentTs = new Date(String(item.updatedAt ?? 0)).getTime();
            const latestTs = new Date(
              String(latestItem.updatedAt ?? 0),
            ).getTime();
            if (currentTs > latestTs) {
              latestItem = item;
            }
          }
          if (latestItem?.updatedAt) {
            setLatestSyncLabel(
              `${formatDateTimeLabel(String(latestItem.updatedAt))} · ${String(latestItem.deviceName || 'Mac')}`,
            );
          }
        }
        const syncOverview =
          syncOverviewResult.status === 'fulfilled'
            ? (syncOverviewResult.value as
                | {
                    progressPercent?: number;
                    transferredBytes?: number;
                    currentFile?: string | null;
                    currentFileConfirmedBytes?: number;
                    uploadState?: string;
                  }
                | undefined)
            : undefined;
        setSyncOverviewState({
          progressPercent: syncOverview?.progressPercent ?? 0,
          transferredBytes: syncOverview?.transferredBytes ?? 0,
          currentFile:
            typeof syncOverview?.currentFile === 'string'
              ? syncOverview.currentFile
              : null,
          currentFileConfirmedBytes:
            syncOverview?.currentFileConfirmedBytes ?? 0,
          uploadState: syncOverview?.uploadState ?? 'idle',
        });
        setIsPhotoPermissionBlocked(
          syncOverview?.uploadState === 'paused_no_permission',
        );
      } catch (e) {
        setAppVersionLabel('未知版本');
        console.warn('Native module not available for Settings');
      }
    };

    loadState();

    return () => {
      bindingSub?.remove();
      syncSub?.remove();
    };
  }, []);

  const connectionEvidence = buildSyncConnectionEvidence(syncOverviewState);
  const connectionBadgeState = getConnectionBadgeState(
    connectionState,
    connectionEvidence,
  );
  const isConnected = connectionBadgeState === 'online';
  const isConnecting = connectionBadgeState === 'connecting';

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
  // Switch device (placeholder)
  // ---------------------------------------------------------------------------

  const handleSwitchDevice = useCallback(() => {
    Alert.alert(
      '切换设备',
      '确定要断开当前电脑并切换到其他设备吗？断开后需要重新输入连接码配对。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定切换',
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

  const handleExportDiagnostics = useCallback(async () => {
    try {
      setIsExportingDiagnostics(true);
      await shareDiagnosticsArchive();
    } catch (error) {
      if (isDiagnosticsExportUnavailable(error)) {
        Alert.alert('无法导出', '当前版本暂不支持导出诊断包');
      } else {
        Alert.alert('导出失败', '诊断包导出失败，请稍后重试');
      }
    } finally {
      setIsExportingDiagnostics(false);
    }
  }, []);

  const handleResetSyncStatus = useCallback(() => {
    Alert.alert(
      '重置所有同步状态',
      '将清除所有同步记录并断开当前设备连接，需要重新输入连接码配对。手机和电脑上的照片不会被删除。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定重置',
          style: 'destructive',
          onPress: async () => {
            try {
              const { NativeSyncEngine } = NativeModules;
              if (NativeSyncEngine) {
                await NativeSyncEngine.resetAllStatus();
                await NativeSyncEngine.disconnectAndUnbind();
              }
            } catch (e) {
              console.warn('[Settings] reset error:', e);
            }
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'DeviceDiscovery' }],
              }),
            );
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
            activeOpacity={0.6}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 30 }}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'SyncActivity' as never }],
                });
              }
            }}
            accessibilityLabel={'返回'}
          >
            <Icon name="chevron-back" size={20} color={DARK} />
          </TouchableOpacity>
          <Text style={styles.title}>{'设置'}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isAndroid ? (
            <View style={styles.androidNoticeCard}>
              <Text style={styles.androidNoticeTitle}>
                {'Android 端能力说明'}
              </Text>
              <Text style={styles.androidNoticeBody}>
                {
                  '当前版本已提供 Android 壳层、局域网自动发现、基础配对与诊断导出入口；扫码配对、真实上传队列、后台重连和增量同步仍未移植到 Android 原生引擎。'
                }
              </Text>
            </View>
          ) : null}

          {/* ============================================================= */}
          {/* Section 1: 当前连接电脑信息                                      */}
          {/* ============================================================= */}
          <Text style={styles.sectionHeader}>{'当前连接电脑'}</Text>
          <View style={styles.card}>
            <View style={styles.deviceRow}>
              {/* Desktop icon — matches SyncActivityScreen style */}
              <View style={styles.deviceIconBox}>
                <Icon name="desktop-outline" size={22} color="#fff" />
              </View>

              {/* Name + status */}
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceNameText} numberOfLines={1}>
                  {deviceName || '未连接'}
                </Text>
                <View style={styles.deviceStatusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      isConnected
                        ? styles.statusDotOnline
                        : isConnecting
                          ? styles.statusDotConnecting
                          : styles.statusDotOffline,
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusLabel,
                      isConnected
                        ? styles.statusLabelOnline
                        : isConnecting
                          ? styles.statusLabelConnecting
                          : styles.statusLabelOffline,
                    ]}
                  >
                    {isConnected
                      ? '在线'
                      : isConnecting
                        ? '连接中'
                        : '离线'}
                  </Text>
                </View>
              </View>
            </View>

            {deviceIp ? (
              <Text style={styles.deviceIp}>{deviceIp}</Text>
            ) : null}
          </View>

          {/* 切换设备 */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.6}
            onPress={handleSwitchDevice}
          >
            <View style={styles.menuRowLeft}>
              <Icon name="swap-horizontal-outline" size={18} color={BLUE} />
              <Text style={styles.menuRowText}>{'切换设备'}</Text>
            </View>
            <Icon name="chevron-forward" size={16} color="#90b0c8" />
          </TouchableOpacity>

          {/* ============================================================= */}
          {/* Section 2: 我的设备                                             */}
          {/* ============================================================= */}
          <Text style={styles.sectionHeader}>{'我的设备'}</Text>
          <View style={styles.card}>
            <View style={styles.deviceRow}>
              {/* Phone icon */}
              <View style={[styles.deviceIconBox, styles.phoneIconBox]}>
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
                      <Icon name="checkmark" size={16} color={BLUE} />
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
                      <Icon name="pencil-outline" size={14} color={BLUE} />
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={styles.myNameHint}>{'此名称将在 Mac 端显示'}</Text>
              </View>
            </View>
          </View>

          {/* ============================================================= */}
          {/* Section 4: 基础设置                                             */}
          {/* ============================================================= */}
          <Text style={styles.sectionHeader}>{'基础设置'}</Text>
          <View style={styles.card}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{'最近一次成功同步'}</Text>
              <Text style={styles.metaValue}>{latestSyncLabel}</Text>
            </View>
            <View style={[styles.metaRow, styles.metaRowLast]}>
              <Text style={styles.metaLabel}>{'应用版本'}</Text>
              <Text style={styles.metaValue}>{appVersionLabel}</Text>
            </View>
            {isPhotoPermissionBlocked ? (
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>{'照片权限未开启'}</Text>
                <Text style={styles.warningText}>
                  {'需要允许访问照片后才能继续自动同步。'}
                </Text>
                <TouchableOpacity
                  style={styles.warningAction}
                  activeOpacity={0.8}
                  onPress={() => {
                    void Linking.openSettings();
                  }}
                >
                  <Text style={styles.warningActionText}>{'打开系统设置'}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {/* ============================================================= */}
          {/* Section 5: 支持与诊断                                           */}
          {/* ============================================================= */}
          <Text style={styles.sectionHeader}>{'支持与诊断'}</Text>
          <View style={styles.card}>
            <Text style={styles.diagnosticsHint}>
              {
                '导出当前设备状态、队列快照、本地数据库和最近日志，便于排查同步问题。'
              }
            </Text>

            <View style={styles.actionButtonGroup}>
              <TouchableOpacity
                style={[
                  styles.diagnosticsButton,
                  isExportingDiagnostics && styles.diagnosticsButtonDisabled,
                ]}
                activeOpacity={0.8}
                disabled={isExportingDiagnostics}
                onPress={() => {
                  void handleExportDiagnostics();
                }}
              >
                <Icon name="download-outline" size={16} color={BLUE} />
                <Text style={styles.diagnosticsButtonText}>
                  {isExportingDiagnostics ? '正在导出诊断包…' : '导出诊断包'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resetButton}
                activeOpacity={0.8}
                onPress={handleResetSyncStatus}
              >
                <Icon name="refresh-outline" size={16} color="#ef4444" />
                <Text style={styles.resetButtonText}>{'重置同步状态'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom spacing */}
          <View style={styles.bottomSpacer} />
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
    backgroundColor: SCREEN_BG,
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
    zIndex: 10,
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
    color: DARK,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 40,
  },

  // Android notice
  androidNoticeCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  androidNoticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#28597e',
    marginBottom: 6,
  },
  androidNoticeBody: {
    fontSize: 12,
    lineHeight: 18,
    color: '#5d7f98',
  },

  // Section header
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6e8aa3',
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 4,
  },

  // Generic card
  card: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    padding: 16,
    shadowColor: 'rgba(80,150,200,0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },

  // Device row — matching SyncActivityScreen
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3ba4dc',
    shadowColor: 'rgba(59,159,216,0.5)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
  },
  phoneIconBox: {
    backgroundColor: '#6366f1',
    shadowColor: 'rgba(99,102,241,0.5)',
  },
  deviceInfo: {
    flex: 1,
    minWidth: 0,
  },
  deviceNameText: {
    fontSize: 15,
    fontWeight: '600',
    color: DARK,
    flexShrink: 1,
  },
  deviceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOnline: {
    backgroundColor: '#22c55e',
  },
  statusDotOffline: {
    backgroundColor: '#f59e0b',
  },
  statusDotConnecting: {
    backgroundColor: '#f59e0b',
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusLabelOnline: {
    color: '#16a34a',
  },
  statusLabelOffline: {
    color: '#d97706',
  },
  statusLabelConnecting: {
    color: '#b45309',
  },
  deviceIp: {
    fontSize: 12,
    color: '#90b0c8',
    marginTop: 8,
    marginLeft: 56,
  },

  // Menu row (for "切换设备" entry)
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 10,
    shadowColor: 'rgba(80,150,200,0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuRowText: {
    fontSize: 15,
    fontWeight: '500',
    color: DARK,
  },

  // Placeholder (account & membership)
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  placeholderIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(144,176,200,0.12)',
  },
  placeholderContent: {
    flex: 1,
    minWidth: 0,
  },
  placeholderTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#90b0c8',
  },
  placeholderSubtitle: {
    fontSize: 12,
    color: '#a8c4d8',
    marginTop: 2,
  },

  // Name display
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    color: DARK,
  },
  confirmButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(59,159,216,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // My name hint
  myNameHint: {
    fontSize: 11,
    color: '#90b0c8',
    marginTop: 4,
  },

  // Meta rows (basic settings)
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  metaRowLast: {
    marginBottom: 0,
  },
  metaLabel: {
    fontSize: 13,
    color: '#90b0c8',
  },
  metaValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    color: DARK,
  },

  // Warning box (photo permission)
  warningBox: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.12)',
    backgroundColor: 'rgba(254,242,242,0.9)',
    padding: 12,
    gap: 6,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991b1b',
  },
  warningText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#b91c1c',
  },
  warningAction: {
    alignSelf: 'flex-start',
    marginTop: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(185,28,28,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  warningActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#991b1b',
  },

  // Diagnostics hint
  diagnosticsHint: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6e8aa3',
    marginBottom: 12,
  },

  // Support & Diagnostics buttons
  actionButtonGroup: {
    flexDirection: 'column',
    gap: 12,
  },
  diagnosticsButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(59,159,216,0.18)',
    backgroundColor: 'rgba(59,159,216,0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  diagnosticsButtonDisabled: {
    opacity: 0.6,
  },
  diagnosticsButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: BLUE,
  },
  resetButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.12)',
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
  },

  bottomSpacer: {
    height: 20,
  },
});
