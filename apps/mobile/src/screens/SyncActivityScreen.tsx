import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  NativeModules,
  NativeEventEmitter,
  Alert,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useNavigation,
  CommonActions,
} from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { UploadTaskSource, AutoUploadState } from '@syncflow/contracts';
import { Icon } from '../components/Icon';
import {
  cancelAllManualUploads,
  interruptAutoUpload,
  enableAutoUpload,
} from '../services/SyncEngineModule';
import { formatBytes } from '../utils/format';
import { formatLocalDateKey } from '../utils/localDateKey';
import {
  buildSyncConnectionEvidence,
  getConnectionBadgeState,
} from '../utils/effectiveConnectionState';
import { formatQueueCountDisplay } from '../utils/queueCountDisplay';
import { hasPendingManualWork } from '../utils/manualUploadState';
import type { RootStackParamList } from '../navigation/RootNavigator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SyncActivityNav = StackNavigationProp<RootStackParamList, 'SyncActivity'>;

interface SyncOverview {
  progressPercent: number;
  currentSpeedMbps: number;
  uploadState: string;
  completedCount: number;
  totalCount: number;
  completedBytes: number;
  totalBytes: number;
  currentFile?: string;
  currentFilename?: string;
  currentFileConfirmedBytes: number;
  currentFileTotalBytes: number;
  currentTaskSource?: UploadTaskSource | null;
  autoUploadState?: AutoUploadState;
  manualPending?: number;
  autoPending?: number;
  lastErrorCode?: string;
}

interface BindingState {
  deviceId: string;
  deviceName: string;
  deviceAlias?: string;
  deviceType?: 'mac' | 'win';
  host: string;
  connectionState:
    | 'bound'
    | 'connecting'
    | 'connected'
    | 'offline'
    | 'discovering';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLUE = '#3b9fd8';
const DARK = '#1a3a5c';
const SCREEN_BG = '#d6ecf8';
const CARD_BG = 'rgba(255,255,255,0.62)';

const EMPTY_OVERVIEW: SyncOverview = {
  progressPercent: 0,
  currentSpeedMbps: 0,
  uploadState: 'idle',
  completedCount: 0,
  totalCount: 0,
  completedBytes: 0,
  totalBytes: 0,
  currentFileConfirmedBytes: 0,
  currentFileTotalBytes: 0,
  currentTaskSource: null,
  autoUploadState: 'disabled',
  manualPending: 0,
  autoPending: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSpeedMbps(speedMbps: number): string {
  if (!Number.isFinite(speedMbps) || speedMbps <= 0) {
    return '0 MB/s';
  }
  return `${speedMbps >= 10 ? speedMbps.toFixed(0) : speedMbps.toFixed(1)} MB/s`;
}

// ---------------------------------------------------------------------------
// SyncActivityScreen
// ---------------------------------------------------------------------------

export function SyncActivityScreen() {
  const navigation = useNavigation<SyncActivityNav>();
  const [overview, setOverview] = useState<SyncOverview>(EMPTY_OVERVIEW);
  const [bindingState, setBindingState] = useState<BindingState | null>(null);
  const [todayStats, setTodayStats] = useState({ fileCount: 0, totalBytes: 0 });
  const [initialLoading, setInitialLoading] = useState(true);
  const [cancellingBatch, setCancellingBatch] = useState(false);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadTodayStats = useCallback(async (engine?: Record<string, Function>) => {
    try {
      const mod = engine ?? NativeModules.NativeSyncEngine;
      if (!mod) return;
      const history = await mod.getHistoryDays(null);
      if (history?.items) {
        const today = formatLocalDateKey(new Date());
        let totalFiles = 0;
        let totalBytesSum = 0;
        for (const item of history.items) {
          if ((item.ledgerDate || item.dateKey) === today) {
            totalFiles += item.fileCount || 0;
            totalBytesSum += item.totalBytes || 0;
          }
        }
        setTodayStats({ fileCount: totalFiles, totalBytes: totalBytesSum });
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let syncSub: { remove: () => void } | undefined;
    let bindingSub: { remove: () => void } | undefined;
    let errorSub: { remove: () => void } | undefined;

    const applyBindingState = (
      state: Record<string, unknown> | null | undefined,
    ) => {
      if (!state || !state.deviceId) {
        setBindingState(null);
        // Navigate back to pairing flow when binding is lost
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'DeviceDiscovery' }],
          }),
        );
        return false;
      }
      setBindingState({
        deviceId: state.deviceId as string,
        deviceName: (state.deviceName as string) || '',
        deviceAlias: state.deviceAlias as string | undefined,
        deviceType: state.deviceType as BindingState['deviceType'] | undefined,
        host: (state.host as string) || '',
        connectionState:
          (state.connectionState as BindingState['connectionState']) || 'bound',
      });
      return true;
    };

    const loadReal = async () => {
      try {
        const { NativeSyncEngine } = NativeModules;
        if (!NativeSyncEngine) return;

        const emitter = new NativeEventEmitter(NativeSyncEngine);

        bindingSub = emitter.addListener(
          'onBindingStateChanged',
          (state: Record<string, unknown>) => {
            applyBindingState(state);
          },
        );

        const binding = await NativeSyncEngine.getBindingState();
        applyBindingState(binding);

        await loadTodayStats(NativeSyncEngine);

        const syncData = await NativeSyncEngine.getSyncOverview();
        if (syncData) {
          setOverview(prev => buildOverview(syncData, prev));
        }

        setInitialLoading(false);

        await NativeSyncEngine.startDiscovery();
        // Do NOT call triggerSync() here — per PRD, auto upload must be
        // explicitly enabled by the user in the album page. Unconditional
        // triggerSync on mount was the old "always auto sync" behavior.

        syncSub = emitter.addListener(
          'onSyncStateChanged',
          (state: Record<string, unknown>) => {
            setOverview(prev => buildOverview(state, prev));
            if (state.uploadState === 'completed') {
              void loadTodayStats();
            }
          },
        );

        errorSub = emitter.addListener(
          'onError',
          (error: { code?: string; message?: string }) => {
            const msg = error?.message || '发生未知错误';
            Alert.alert('同步异常', msg);
          },
        );
      } catch (e) {
        console.warn('[SyncActivity] loadReal error:', e);
        setInitialLoading(false);
      }
    };

    void loadReal();

    return () => {
      syncSub?.remove();
      bindingSub?.remove();
      errorSub?.remove();
    };
  }, [loadTodayStats]);

  // Foreground refresh
  useEffect(() => {
    let appState = AppState.currentState;
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (appState !== 'active' && nextState === 'active') {
          void loadTodayStats();
        }
        appState = nextState;
      },
    );
    return () => subscription.remove();
  }, [loadTodayStats]);

  // ---------------------------------------------------------------------------
  // Control handlers
  // ---------------------------------------------------------------------------

  const handleCancelManualBatch = useCallback(() => {
    Alert.alert('取消手动上传', '确定取消当前的手动上传队列吗？', [
      { text: '再想想', style: 'cancel' },
      {
        text: '确认取消',
        style: 'destructive',
        onPress: async () => {
          try {
            setCancellingBatch(true);
            await cancelAllManualUploads();
          } catch (e) {
            console.warn('[SyncActivity] cancelAllManualUploads error:', e);
            Alert.alert('取消失败', '无法取消当前手动上传，请稍后重试');
          } finally {
            setCancellingBatch(false);
          }
        },
      },
    ]);
  }, []);

  const handleCloseAutoUpload = useCallback(() => {
    Alert.alert(
      '关闭自动上传',
      '关闭后，当前自动上传任务将停止，后续新素材不会继续自动上传。',
      [
        { text: '继续上传', style: 'cancel' },
        {
          text: '确认关闭',
          style: 'destructive',
          onPress: async () => {
            try {
              await interruptAutoUpload();
              // Reload overview to reflect the new state
              const syncData = await NativeModules.NativeSyncEngine?.getSyncOverview();
              if (syncData) {
                setOverview(prev => buildOverview(syncData, prev));
              }
            } catch (e) {
              console.warn('[SyncActivity] interruptAutoUpload error:', e);
              Alert.alert('操作失败', '无法关闭自动上传，请稍后重试');
            }
          },
        },
      ],
    );
  }, []);

  const handleReconnect = useCallback(async () => {
    try {
      const { NativeSyncEngine } = NativeModules;
      if (!NativeSyncEngine) return;
      await NativeSyncEngine.startDiscovery();
      NativeSyncEngine.triggerSync?.().catch((e: Error) => {
        console.warn('[SyncActivity] triggerSync failed:', e);
      });
    } catch (e) {
      console.warn('[SyncActivity] reconnect error:', e);
      Alert.alert('重连失败', '请稍后重试');
    }
  }, []);

  const handleSwitchDevice = useCallback(() => {
    Alert.alert('切换设备', '将断开当前设备并返回设备扫描页', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认切换',
        style: 'destructive',
        onPress: async () => {
          try {
            await NativeModules.NativeSyncEngine?.disconnectAndUnbind();
          } catch (e) {
            console.warn('[SyncActivity] disconnectAndUnbind error:', e);
          }
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'DeviceDiscovery' }],
            }),
          );
        },
      },
    ]);
  }, [navigation]);

  const handleEnableAutoUpload = useCallback(async () => {
    // Check device connection first
    try {
      const binding = await NativeModules.NativeSyncEngine?.getBindingState();
      if (
        !binding?.deviceId ||
        (binding.connectionState !== 'connected' &&
          binding.connectionState !== 'bound')
      ) {
        Alert.alert('无法开启', '请先连接设备');
        return;
      }
    } catch {
      Alert.alert('无法开启', '请先连接设备');
      return;
    }
    try {
      const syncData = await NativeModules.NativeSyncEngine?.getSyncOverview();
      if (hasPendingManualWork(syncData)) {
        Alert.alert(
          '切换上传模式',
          '当前正在上传，继续自动上传将中断手动上传，是否继续？',
          [
            { text: '取消', style: 'cancel' },
            {
              text: '确认切换',
              onPress: async () => {
                try {
                  await cancelAllManualUploads();
                  await enableAutoUpload();
                  await NativeModules.NativeSyncEngine?.triggerSync();
                  const nextSyncData =
                    await NativeModules.NativeSyncEngine?.getSyncOverview();
                  if (nextSyncData) {
                    setOverview(prev => buildOverview(nextSyncData, prev));
                  }
                } catch (e) {
                  console.warn('[SyncActivity] enableAutoUpload error:', e);
                  Alert.alert('操作失败', '无法开启自动上传，请稍后重试');
                }
              },
            },
          ],
        );
        return;
      }

      await enableAutoUpload();
      await NativeModules.NativeSyncEngine?.triggerSync();
      const nextSyncData = await NativeModules.NativeSyncEngine?.getSyncOverview();
      if (nextSyncData) {
        setOverview(prev => buildOverview(nextSyncData, prev));
      }
    } catch (e) {
      console.warn('[SyncActivity] enableAutoUpload error:', e);
      Alert.alert('操作失败', '无法开启自动上传，请稍后重试');
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const boundDeviceName =
    bindingState?.deviceAlias ||
    bindingState?.deviceName ||
    (bindingState?.deviceType === 'win' ? 'Windows 电脑' : '电脑');

  const connectionBadgeState = getConnectionBadgeState(
    bindingState?.connectionState,
    buildSyncConnectionEvidence({
      progressPercent: overview.progressPercent,
      currentFile: overview.currentFile,
      currentFileConfirmedBytes: overview.currentFileConfirmedBytes,
      uploadState: overview.uploadState,
    }),
  );
  const isConnecting = connectionBadgeState === 'connecting';
  const isOffline = connectionBadgeState === 'offline';

  const isSyncing =
    overview.uploadState === 'uploading' ||
    overview.uploadState === 'preparing' ||
    overview.uploadState === 'cloud_downloading';

  const isAutoUploadActive = overview.autoUploadState === 'active';
  const currentTaskSource = overview.currentTaskSource;
  const hasManualUploadWork = hasPendingManualWork({
    manualPending: overview.manualPending,
    currentTaskSource,
  });

  // Whether there's an active file transfer right now (vs. idle/completed monitoring)
  const isActivelyTransferring =
    isSyncing ||
    overview.uploadState === 'scanning' ||
    hasManualUploadWork ||
    (overview.autoPending ?? 0) > 0;

  const progressPercent =
    overview.currentFileTotalBytes > 0
      ? Math.round(
          (overview.currentFileConfirmedBytes / overview.currentFileTotalBytes) *
            100,
        )
      : 0;

  const totalPending =
    (overview.manualPending ?? 0) + (overview.autoPending ?? 0);
  const totalPendingDisplay = formatQueueCountDisplay(totalPending);

  // ---------------------------------------------------------------------------
  // Card state determination
  // ---------------------------------------------------------------------------

  // State 1: Upload Running — auto or manual upload active
  // State 2: Auto Upload Not Started — device online, no upload active
  // State 3: Device Offline

  const isManualUploading = hasManualUploadWork;

  type MainCardState = 'running' | 'not_started' | 'offline';

  const mainCardState: MainCardState = isOffline && !isSyncing
    ? 'offline'
    : (isAutoUploadActive || hasManualUploadWork)
      ? 'running'
      : 'not_started';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>同步动态</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('History')}
            >
              <Icon name="time-outline" size={22} color={DARK} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Settings')}
            >
              <Icon name="settings-outline" size={22} color={DARK} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Unified main card */}
        <View style={styles.mainCard}>
          {/* Device info row — always shown at top of card */}
          <View style={styles.deviceRow}>
            <View style={styles.deviceIconBox}>
              <Icon name="desktop-outline" size={22} color="#fff" />
            </View>
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName}>{boundDeviceName}</Text>
              <View style={styles.deviceStatusRow}>
                <View
                  style={[
                    styles.statusDot,
                    connectionBadgeState === 'offline'
                      ? styles.statusDotOffline
                      : connectionBadgeState === 'connecting'
                        ? styles.statusDotConnecting
                        : styles.statusDotOnline,
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    connectionBadgeState === 'offline'
                      ? styles.statusTextOffline
                      : connectionBadgeState === 'connecting'
                        ? styles.statusTextConnecting
                        : styles.statusTextOnline,
                  ]}
                >
                  {connectionBadgeState === 'offline'
                    ? '离线'
                    : isConnecting
                      ? '连接中'
                      : '在线'}
                </Text>
              </View>
            </View>
          </View>

          {/* ---- State 1: Upload Running (auto or manual) ---- */}
          {mainCardState === 'running' && (
            <View style={styles.cardBody}>
              {/* Badge row — dynamic based on upload source */}
              <View style={styles.badgeRow}>
                <View style={isManualUploading ? styles.manualBadge : styles.autoBadge}>
                  <Text style={isManualUploading ? styles.manualBadgeText : styles.autoBadgeText}>
                    {isManualUploading ? '手动' : '自动'}
                  </Text>
                </View>
                <Text style={styles.badgeLabel}>
                  {isManualUploading ? '手动上传中' : '自动上传已开启'}
                </Text>
              </View>

              {(isActivelyTransferring || isManualUploading) ? (
                <>
                  {/* Title row with percentage */}
                  <View style={styles.runningTitleRow}>
                    <Text style={styles.runningTitle}>
                      {isManualUploading ? '手动上传中' : '正在自动上传'}
                    </Text>
                    <Text style={styles.runningPercent}>{progressPercent}%</Text>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.min(100, progressPercent)}%` },
                      ]}
                    />
                  </View>

                  {/* Current file */}
                  {overview.currentFilename ? (
                    <Text style={styles.currentFileName} numberOfLines={1}>
                      {overview.currentFilename}
                    </Text>
                  ) : null}

                  {/* Stats row */}
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>速度</Text>
                      <Text style={styles.statValue}>
                        {formatSpeedMbps(overview.currentSpeedMbps)}
                      </Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>进度</Text>
                      <Text style={styles.statValue}>
                        {`${overview.completedCount} / ${overview.totalCount}`}
                      </Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>已传输</Text>
                      <Text style={styles.statValue}>
                        {formatBytes(overview.completedBytes)}
                      </Text>
                    </View>
                  </View>

                  {/* Queue info */}
                  {totalPending > 0 && (
                    <Text style={styles.queueInfoText}>
                      排队中 {totalPendingDisplay}项
                    </Text>
                  )}
                </>
              ) : (
                <>
                  {/* Active but idle — monitoring for new photos */}
                  <Text style={styles.runningTitle}>自动上传运行中</Text>
                  <Text style={styles.idleSubtitle}>
                    新素材将自动传输到 PC 端
                  </Text>
                  {overview.completedCount > 0 && (
                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>已传输</Text>
                        <Text style={styles.statValue}>
                          {overview.completedCount} 个
                        </Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>数据量</Text>
                        <Text style={styles.statValue}>
                          {formatBytes(overview.completedBytes)}
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              )}

              {/* Action button — only one visible at a time per PRD */}
              {hasManualUploadWork ? (
                <TouchableOpacity
                  style={[styles.outlinedButton, styles.dangerButton]}
                  activeOpacity={0.7}
                  onPress={handleCancelManualBatch}
                  disabled={cancellingBatch}
                >
                  <Text style={styles.dangerButtonText}>
                    {cancellingBatch ? '正在取消...' : '取消本次手动上传'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.outlinedButton}
                  activeOpacity={0.7}
                  onPress={handleCloseAutoUpload}
                >
                  <Text style={styles.outlinedButtonText}>关闭自动上传</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ---- State 2: Auto Upload Not Started ---- */}
          {mainCardState === 'not_started' && (
            <View style={styles.cardBodyCentered}>
              <View style={styles.emptyIconBox}>
                <Icon name="cloud-upload-outline" size={44} color={BLUE} />
              </View>
              <Text style={styles.centeredTitle}>自动上传未开启</Text>
              <Text style={styles.centeredSubtitle}>
                开启自动上传，拍完就同步；或者也可以选手动传输
              </Text>
              <View style={styles.twoButtonRow}>
                <TouchableOpacity
                  style={[styles.rowButton, styles.rowButtonOutlined]}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('AlbumWorkbench')}
                >
                  <Text style={styles.rowButtonOutlinedText}>去相册</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rowButton, styles.rowButtonPrimary]}
                  activeOpacity={0.7}
                  onPress={() => void handleEnableAutoUpload()}
                >
                  <Text style={styles.rowButtonPrimaryText}>开启自动上传</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ---- State 3: Device Offline ---- */}
          {mainCardState === 'offline' && (
            <View style={styles.cardBodyCentered}>
              <View style={styles.emptyIconBox}>
                <Icon name="alert-circle-outline" size={44} color="#e53935" />
              </View>
              <Text style={styles.centeredTitle}>当前设备已离线</Text>
              <Text style={styles.centeredSubtitle}>
                请检查电脑是否在线并连接同一局域网。恢复后可继续上传或访问共享目录
              </Text>
              <View style={styles.twoButtonRow}>
                <TouchableOpacity
                  style={[styles.rowButton, styles.rowButtonOutlined]}
                  activeOpacity={0.7}
                  onPress={handleSwitchDevice}
                >
                  <Text style={styles.rowButtonOutlinedText}>切换设备</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rowButton, styles.rowButtonPrimary]}
                  activeOpacity={0.7}
                  onPress={handleReconnect}
                >
                  <Text style={styles.rowButtonPrimaryText}>重新连接</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Quick entry cards */}
        <View style={styles.quickEntrySection}>
          <Text style={styles.sectionLabel}>快捷入口</Text>
          <View style={styles.quickEntryRow}>
            <TouchableOpacity
              style={styles.quickEntryCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('AlbumWorkbench')}
            >
              <View
                style={[
                  styles.quickEntryIcon,
                  { backgroundColor: 'rgba(59,159,216,0.12)' },
                ]}
              >
                <Icon name="albums-outline" size={22} color={BLUE} />
              </View>
              <Text style={styles.quickEntryTitle}>相册</Text>
              <Text style={styles.quickEntryDesc}>浏览和手动上传素材</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickEntryCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('SharedFiles')}
            >
              <View
                style={[
                  styles.quickEntryIcon,
                  { backgroundColor: 'rgba(34,197,94,0.12)' },
                ]}
              >
                <Icon name="folder-outline" size={22} color="#22c55e" />
              </View>
              <Text style={styles.quickEntryTitle}>共享目录</Text>
              <Text style={styles.quickEntryDesc}>浏览PC设备的共享目录</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Overview builder
// ---------------------------------------------------------------------------

function buildOverview(
  payload: Record<string, unknown>,
  prev: SyncOverview,
): SyncOverview {
  if (!payload) return prev;

  const uploadState =
    (payload.uploadState as string | undefined) ?? prev.uploadState;
  const currentFileConfirmedBytes =
    (payload.currentFileConfirmedBytes as number | undefined) ??
    (payload.confirmedBytes as number | undefined) ??
    prev.currentFileConfirmedBytes;
  const currentFileTotalBytes =
    (payload.currentFileTotalBytes as number | undefined) ??
    prev.currentFileTotalBytes;

  return {
    progressPercent:
      (payload.progressPercent as number | undefined) ??
      (currentFileTotalBytes > 0
        ? Math.round((currentFileConfirmedBytes / currentFileTotalBytes) * 100)
        : prev.progressPercent),
    currentSpeedMbps:
      uploadState === 'reconnecting'
        ? 0
        : ((payload.currentSpeedMbps as number | undefined) ??
          prev.currentSpeedMbps),
    uploadState,
    completedCount:
      (payload.completedCount as number | undefined) ?? prev.completedCount,
    totalCount:
      (payload.totalCount as number | undefined) ??
      (payload.queueTotalCount as number | undefined) ??
      prev.totalCount,
    completedBytes:
      (payload.completedBytes as number | undefined) ?? prev.completedBytes,
    totalBytes:
      (payload.totalBytes as number | undefined) ??
      (payload.queueTotalBytes as number | undefined) ??
      prev.totalBytes,
    currentFile:
      uploadState === 'completed' || uploadState === 'idle'
        ? undefined
        : typeof payload.currentFile === 'string'
          ? payload.currentFile
          : prev.currentFile,
    currentFilename:
      uploadState === 'completed' || uploadState === 'idle'
        ? undefined
        : typeof payload.currentFilename === 'string'
          ? payload.currentFilename
          : prev.currentFilename,
    currentFileConfirmedBytes:
      uploadState === 'completed' || uploadState === 'idle'
        ? 0
        : currentFileConfirmedBytes,
    currentFileTotalBytes:
      uploadState === 'completed' || uploadState === 'idle'
        ? 0
        : currentFileTotalBytes,
    // Native sends null (NSNull) when no task is active — respect it as
    // "clear". Only fall back to prev when the key is absent from payload.
    currentTaskSource:
      'currentTaskSource' in payload
        ? (payload.currentTaskSource as UploadTaskSource | undefined) ?? undefined
        : prev.currentTaskSource,
    autoUploadState:
      (payload.autoUploadState as AutoUploadState | undefined) ??
      prev.autoUploadState,
    manualPending:
      (payload.manualPending as number | undefined) ??
      prev.manualPending,
    autoPending:
      (payload.autoPending as number | undefined) ?? prev.autoPending,
    lastErrorCode:
      typeof payload.lastErrorCode === 'string'
        ? payload.lastErrorCode
        : prev.lastErrorCode,
  };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK,
  },

  // Unified main card
  mainCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#50a0d2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
  },

  // Device row (top of card)
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
  deviceInfo: {
    flex: 1,
    minWidth: 0,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: DARK,
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
  statusDotConnecting: {
    backgroundColor: '#f59e0b',
  },
  statusDotOffline: {
    backgroundColor: '#94a3b8',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusTextOnline: {
    color: '#16a34a',
  },
  statusTextConnecting: {
    color: '#d97706',
  },
  statusTextOffline: {
    color: '#64748b',
  },

  // Card body for state 1 (running)
  cardBody: {
    marginTop: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  autoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  autoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
  },
  manualBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(59,159,216,0.12)',
  },
  manualBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: BLUE,
  },
  badgeLabel: {
    fontSize: 12,
    color: '#6a96b8',
  },
  runningTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  runningTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK,
  },
  idleSubtitle: {
    fontSize: 14,
    color: '#6b8da0',
    marginTop: 4,
    marginBottom: 8,
  },
  runningPercent: {
    fontSize: 18,
    fontWeight: '700',
    color: BLUE,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(59,159,216,0.12)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: BLUE,
  },
  currentFileName: {
    fontSize: 12,
    color: '#6a96b8',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(106,150,184,0.2)',
  },
  statLabel: {
    fontSize: 10,
    color: '#8aabbd',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
    color: DARK,
    marginTop: 2,
  },
  queueInfoText: {
    fontSize: 12,
    color: '#6a96b8',
    textAlign: 'center',
    marginBottom: 12,
  },

  // Outlined button (close auto upload)
  outlinedButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(26,58,92,0.18)',
    backgroundColor: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },
  outlinedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK,
  },
  dangerButton: {
    backgroundColor: 'rgba(229,57,53,0.06)',
    borderColor: 'rgba(229,57,53,0.2)',
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e53935',
  },

  // Card body for state 2 & 3 (centered content)
  cardBodyCentered: {
    marginTop: 20,
    alignItems: 'center',
  },
  emptyIconBox: {
    marginBottom: 14,
  },
  centeredTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK,
    marginBottom: 8,
  },
  centeredSubtitle: {
    fontSize: 13,
    color: '#8aabbd',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  twoButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  rowButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
  },
  rowButtonOutlined: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(26,58,92,0.18)',
  },
  rowButtonOutlinedText: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK,
  },
  rowButtonPrimary: {
    backgroundColor: BLUE,
  },
  rowButtonPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // Quick entry section
  quickEntrySection: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6a96b8',
    marginBottom: 10,
  },
  quickEntryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickEntryCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: 'rgba(80,160,210,0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  quickEntryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickEntryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK,
    marginBottom: 4,
  },
  quickEntryDesc: {
    fontSize: 11,
    color: '#8aabbd',
  },
});
