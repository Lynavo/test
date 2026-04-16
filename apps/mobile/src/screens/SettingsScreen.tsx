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
const CARD_BG = '#ffffff';
const CARD_BORDER = 'rgba(187, 214, 233, 0.72)';
const MUTED_TEXT = '#7893ab';
const SECTION_TEXT = '#6e8aa3';
const ROW_CHEVRON = '#b8d0e4';
const ONLINE_GREEN = '#22c55e';
const ONLINE_TEXT = '#16a34a';
const CONNECTING_AMBER = '#f3b24c';
const CONNECTING_TEXT = '#b45309';
const OFFLINE_SLATE = '#94a3b8';
const OFFLINE_TEXT = '#72859a';
const DANGER_RED = '#ef4444';
const DANGER_BG = 'rgba(239,68,68,0.04)';

// ---------------------------------------------------------------------------
// Helpers
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
  const build =
    typeof appInfo?.build === 'string' && appInfo.build ? appInfo.build : '0';
  return `v${version} (${build})`;
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

// ---------------------------------------------------------------------------
// SettingsScreen
// ---------------------------------------------------------------------------

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
  // Handlers
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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
          accessibilityLabel="返回"
        >
          <Icon name="chevron-back" size={20} color={DARK} />
        </TouchableOpacity>
        <Text style={styles.title}>设置</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isAndroid ? (
          <View style={styles.androidNoticeCard}>
            <Text style={styles.androidNoticeTitle}>
              Android 端能力说明
            </Text>
            <Text style={styles.androidNoticeBody}>
              当前版本已提供 Android 壳层、局域网自动发现、基础配对与诊断导出入口；扫码配对、真实上传队列、后台重连和增量同步仍未移植到
              Android 原生引擎。
            </Text>
          </View>
        ) : null}

        {/* ============================================================= */}
        {/* Connected device card                                          */}
        {/* ============================================================= */}
        <View style={styles.deviceCard}>
          <View style={styles.deviceCardTop}>
            <View style={styles.wifiIconCircle}>
              <Icon name="wifi" size={22} color="#fff" />
            </View>
            <Text style={styles.deviceCardLabel}>已连接设备</Text>
          </View>
          <Text style={styles.deviceCardName} numberOfLines={1}>
            {deviceName || '未连接'}
          </Text>
          {deviceIp ? (
            <Text style={styles.deviceCardIp}>{deviceIp}</Text>
          ) : null}
          <View style={styles.deviceCardBottom}>
            <View style={styles.statusBadge}>
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
                  styles.statusBadgeText,
                  isConnected
                    ? styles.statusTextOnline
                    : isConnecting
                      ? styles.statusTextConnecting
                      : styles.statusTextOffline,
                ]}
              >
                {isConnected ? '在线' : isConnecting ? '连接中' : '离线'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.switchButton}
              activeOpacity={0.6}
              onPress={handleSwitchDevice}
            >
              <Icon name="swap-horizontal-outline" size={14} color={BLUE} />
              <Text style={styles.switchButtonText}>切换</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ============================================================= */}
        {/* My device name card                                            */}
        {/* ============================================================= */}
        <View style={styles.card}>
          <View style={styles.myDeviceRow}>
            <View style={styles.phoneIconCircle}>
              <Icon name="phone-portrait-outline" size={20} color="#fff" />
            </View>
            <View style={styles.myDeviceInfo}>
              <Text style={styles.myDeviceLabel}>我的设备名称</Text>
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
                  <Text style={styles.myDeviceName} numberOfLines={1}>
                    {myName}
                  </Text>
                  <TouchableOpacity
                    style={styles.editButton}
                    activeOpacity={0.7}
                    onPress={() => setEditingMyName(true)}
                  >
                    <Icon name="pencil-outline" size={14} color={MUTED_TEXT} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.myDeviceHint}>此名称将在 Mac 端显示</Text>
        </View>

        {/* ============================================================= */}
        {/* Info rows                                                      */}
        {/* ============================================================= */}
        <View style={styles.listCard}>
          {isPhotoPermissionBlocked ? (
            <>
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>照片权限未开启</Text>
                <Text style={styles.warningText}>
                  需要允许访问照片后才能继续自动同步。
                </Text>
                <TouchableOpacity
                  style={styles.warningAction}
                  activeOpacity={0.8}
                  onPress={() => {
                    void Linking.openSettings();
                  }}
                >
                  <Text style={styles.warningActionText}>打开系统设置</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.listSep} />
            </>
          ) : null}
          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <Icon name="time-outline" size={16} color={MUTED_TEXT} />
              <Text style={styles.infoRowLabel}>最近同步</Text>
            </View>
            <Text style={styles.infoRowValue}>{latestSyncLabel}</Text>
          </View>
          <View style={styles.listSep} />
          <View style={styles.infoRow}>
            <Text style={styles.infoRowLabel}>应用版本</Text>
            <Text style={styles.infoRowValue}>{appVersionLabel}</Text>
          </View>
        </View>

        {/* ============================================================= */}
        {/* Support & Help section                                         */}
        {/* ============================================================= */}
        <Text style={styles.sectionLabel}>支持与帮助</Text>
        <View style={styles.listCard}>
          <TouchableOpacity
            style={styles.actionRow}
            activeOpacity={0.6}
            disabled={isExportingDiagnostics}
            onPress={() => {
              void handleExportDiagnostics();
            }}
          >
            <View style={styles.actionRowLeft}>
              <Icon name="download-outline" size={18} color={BLUE} />
              <Text style={styles.actionRowText}>
                {isExportingDiagnostics ? '正在导出诊断包…' : '导出诊断包'}
              </Text>
            </View>
            <Icon name="chevron-forward" size={16} color={ROW_CHEVRON} />
          </TouchableOpacity>
          <View style={styles.listSep} />
          <TouchableOpacity
            style={styles.actionRow}
            activeOpacity={0.6}
            onPress={() => navigation.navigate('Help')}
          >
            <View style={styles.actionRowLeft}>
              <Icon name="help-circle-outline" size={18} color={BLUE} />
              <Text style={styles.actionRowText}>帮助</Text>
            </View>
            <Icon name="chevron-forward" size={16} color={ROW_CHEVRON} />
          </TouchableOpacity>
        </View>

        {/* ============================================================= */}
        {/* Danger zone                                                    */}
        {/* ============================================================= */}
        <View style={[styles.listCard, styles.dangerCard]}>
          <TouchableOpacity
            style={styles.actionRow}
            activeOpacity={0.6}
            onPress={handleResetSyncStatus}
          >
            <View style={styles.actionRowLeft}>
              <Icon name="refresh-outline" size={18} color={DANGER_RED} />
              <Text style={styles.dangerRowText}>重置同步状态</Text>
            </View>
            <Icon name="chevron-forward" size={16} color={ROW_CHEVRON} />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    marginBottom: 12,
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

  // Section label
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: SECTION_TEXT,
    marginBottom: 8,
    marginTop: 8,
    marginLeft: 4,
  },

  // ---------------------------------------------------------------------------
  // Connected device card
  // ---------------------------------------------------------------------------
  deviceCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#4f8fbc',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  deviceCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  wifiIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4abe7b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceCardLabel: {
    fontSize: 12,
    color: MUTED_TEXT,
  },
  deviceCardName: {
    fontSize: 20,
    fontWeight: '700',
    color: DARK,
    marginBottom: 2,
  },
  deviceCardIp: {
    fontSize: 12,
    color: MUTED_TEXT,
    marginBottom: 12,
  },
  deviceCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOnline: {
    backgroundColor: ONLINE_GREEN,
  },
  statusDotConnecting: {
    backgroundColor: CONNECTING_AMBER,
  },
  statusDotOffline: {
    backgroundColor: OFFLINE_SLATE,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusTextOnline: {
    color: ONLINE_TEXT,
  },
  statusTextConnecting: {
    color: CONNECTING_TEXT,
  },
  statusTextOffline: {
    color: OFFLINE_TEXT,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  switchButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: BLUE,
  },

  // ---------------------------------------------------------------------------
  // Generic card
  // ---------------------------------------------------------------------------
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#4f8fbc',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },

  // ---------------------------------------------------------------------------
  // My device name card
  // ---------------------------------------------------------------------------
  myDeviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  phoneIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  myDeviceInfo: {
    flex: 1,
    minWidth: 0,
  },
  myDeviceLabel: {
    fontSize: 12,
    color: MUTED_TEXT,
    marginBottom: 2,
  },
  myDeviceName: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK,
    flexShrink: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
    fontSize: 16,
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
  myDeviceHint: {
    fontSize: 12,
    color: MUTED_TEXT,
    marginTop: 10,
    marginLeft: 62,
  },

  // ---------------------------------------------------------------------------
  // List card (info rows, action rows)
  // ---------------------------------------------------------------------------
  listCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#4f8fbc',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  listSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e4eff7',
    marginHorizontal: 18,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoRowLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: DARK,
  },
  infoRowValue: {
    fontSize: 13,
    color: MUTED_TEXT,
    flexShrink: 1,
    textAlign: 'right',
  },

  // Action rows (support & help)
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  actionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionRowText: {
    fontSize: 15,
    fontWeight: '500',
    color: DARK,
  },

  // Danger zone
  dangerCard: {
    backgroundColor: DANGER_BG,
    borderColor: 'rgba(239,68,68,0.12)',
    marginTop: 8,
  },
  dangerRowText: {
    fontSize: 15,
    fontWeight: '500',
    color: DANGER_RED,
  },

  // Warning box (photo permission)
  warningBox: {
    margin: 14,
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

  bottomSpacer: {
    height: 20,
  },
});
