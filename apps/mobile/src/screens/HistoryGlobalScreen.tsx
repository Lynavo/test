import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  NativeModules,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import type { DesktopSyncRecordDTO } from '@syncflow/contracts';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon } from '../components/Icon';
import { GlobalGradientBackground } from '../components/GlobalGradientBackground';
import { listHistory } from '../services/desktop-local-service';
import { formatBytes } from '../utils/format';

type NavigationProp = StackNavigationProp<RootStackParamList, 'History'>;

interface DailyTransferSummary {
  id: string;
  deviceName: string;
  deviceMeta: string;
  fileCount: number;
  totalBytes: number;
  duration: string;
  isSyncing?: boolean;
  sortTime: number;
}

interface HistoryDayGroup {
  id: string;
  label: string;
  syncingLabel?: string;
  transfers: DailyTransferSummary[];
}

interface NativeBindingState {
  deviceId?: string | null;
  deviceName?: string | null;
  deviceAlias?: string | null;
  host?: string | null;
}

interface DesktopHistoryIdentity {
  title?: string;
  meta?: string;
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function getDesktopHistoryIdentity(
  binding: NativeBindingState,
): DesktopHistoryIdentity {
  return {
    title: firstNonEmptyString(binding.deviceAlias, binding.deviceName),
    meta: firstNonEmptyString(binding.host, binding.deviceId),
  };
}

function createPreviewRecord({
  id,
  desktopDeviceId,
  displayName,
  filename,
  mediaType,
  fileSize,
  dayOffset,
  hour,
  minute,
}: {
  id: string;
  desktopDeviceId: string;
  displayName: string;
  filename: string;
  mediaType: string;
  fileSize: number;
  dayOffset: number;
  hour: number;
  minute: number;
}): DesktopSyncRecordDTO {
  const completedAt = new Date();
  completedAt.setDate(completedAt.getDate() - dayOffset);
  completedAt.setHours(hour, minute, 0, 0);

  return {
    recordId: id,
    desktopDeviceId,
    clientId: 'iphone-15-pro',
    displayName,
    fileKey: `preview/${filename}`,
    filename,
    mediaType,
    fileSize,
    status: 'completed',
    completedAt: completedAt.toISOString(),
  };
}

const MOCK_HISTORY_ITEMS: DesktopSyncRecordDTO[] = [
  createPreviewRecord({
    id: 'mock-history-1',
    desktopDeviceId: 'Mini4',
    displayName: 'openimdeMac-mini',
    filename: 'IMG_5198.MOV',
    mediaType: 'video',
    fileSize: 27787264,
    dayOffset: 0,
    hour: 22,
    minute: 51,
  }),
  createPreviewRecord({
    id: 'mock-history-2',
    desktopDeviceId: 'Mini4',
    displayName: 'openimdeMac-mini',
    filename: 'IMG_5203.JPG',
    mediaType: 'image',
    fileSize: 4194304,
    dayOffset: 0,
    hour: 22,
    minute: 48,
  }),
  createPreviewRecord({
    id: 'mock-history-3',
    desktopDeviceId: 'studio-a',
    displayName: '剪辑工作站-A',
    filename: 'A-CAM_0319_001.MOV',
    mediaType: 'video',
    fileSize: 3288490188,
    dayOffset: 0,
    hour: 21,
    minute: 12,
  }),
  createPreviewRecord({
    id: 'mock-history-4',
    desktopDeviceId: 'studio-a',
    displayName: '剪辑工作站-A',
    filename: 'A-CAM_0319_002.MOV',
    mediaType: 'video',
    fileSize: 4127195136,
    dayOffset: 0,
    hour: 21,
    minute: 9,
  }),
  createPreviewRecord({
    id: 'mock-history-5',
    desktopDeviceId: 'MacBook Pro',
    displayName: 'MacBook Pro',
    filename: 'ScreenRecording_0615.mp4',
    mediaType: 'video',
    fileSize: 130023420,
    dayOffset: 1,
    hour: 19,
    minute: 40,
  }),
  createPreviewRecord({
    id: 'mock-history-6',
    desktopDeviceId: 'MacBook Pro',
    displayName: 'MacBook Pro',
    filename: 'Poster_A_Final.jpg',
    mediaType: 'image',
    fileSize: 29360128,
    dayOffset: 1,
    hour: 18,
    minute: 35,
  }),
  createPreviewRecord({
    id: 'mock-history-7',
    desktopDeviceId: 'backup-b',
    displayName: '备用机-B',
    filename: 'VID_3018.MP4',
    mediaType: 'video',
    fileSize: 1717986918,
    dayOffset: 2,
    hour: 17,
    minute: 28,
  }),
  createPreviewRecord({
    id: 'mock-history-8',
    desktopDeviceId: 'backup-b',
    displayName: '备用机-B',
    filename: 'Vacation-01.JPG',
    mediaType: 'image',
    fileSize: 8808038,
    dayOffset: 2,
    hour: 17,
    minute: 11,
  }),
  createPreviewRecord({
    id: 'mock-history-9',
    desktopDeviceId: 'studio-a',
    displayName: '剪辑工作站-A',
    filename: 'Interview-Final.mp4',
    mediaType: 'video',
    fileSize: 195035136,
    dayOffset: 3,
    hour: 15,
    minute: 42,
  }),
  createPreviewRecord({
    id: 'mock-history-10',
    desktopDeviceId: 'MacBook Pro',
    displayName: 'MacBook Pro',
    filename: 'Project-Brief.pdf',
    mediaType: 'document',
    fileSize: 2202009,
    dayOffset: 3,
    hour: 10,
    minute: 2,
  }),
  createPreviewRecord({
    id: 'mock-history-11',
    desktopDeviceId: 'Mini4',
    displayName: 'openimdeMac-mini',
    filename: 'Poster-Pack.zip',
    mediaType: 'archive',
    fileSize: 35651584,
    dayOffset: 4,
    hour: 20,
    minute: 18,
  }),
  createPreviewRecord({
    id: 'mock-history-12',
    desktopDeviceId: 'Mini4',
    displayName: 'openimdeMac-mini',
    filename: 'IMG_5180.HEIC',
    mediaType: 'image',
    fileSize: 7340032,
    dayOffset: 4,
    hour: 20,
    minute: 4,
  }),
];

const PREVIEW_DURATION_BY_DESKTOP: Record<string, string> = {
  Mini4: '34m 14s',
  'studio-a': '1h 12m',
  'MacBook Pro': '16m 27s',
  'backup-b': '48m 05s',
};

function getDayLabel(isoString?: string) {
  if (!isoString) return '未知日期';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '未知日期';

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return '今天';
  if (date.toDateString() === yesterday.toDateString()) return '昨天';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getDate()).padStart(2, '0')}`;
}

function getRecordTime(isoString?: string) {
  if (!isoString) return 0;
  const time = new Date(isoString).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function buildHistoryGroups(
  records: DesktopSyncRecordDTO[],
  options: {
    previewMode: boolean;
    desktopIdentity?: DesktopHistoryIdentity | null;
  },
): HistoryDayGroup[] {
  const completedRecords = records
    .filter(item => item.status === 'completed')
    .sort((a, b) => getRecordTime(b.completedAt) - getRecordTime(a.completedAt));
  const groups: HistoryDayGroup[] = [];

  completedRecords.forEach(record => {
    const label = getDayLabel(record.completedAt);
    let group = groups.find(item => item.label === label);
    if (!group) {
      const showLiveCue = options.previewMode && label === '今天';
      group = {
        id: label,
        label,
        syncingLabel: showLiveCue ? '实时同步中' : undefined,
        transfers: [],
      };
      groups.push(group);
    }

    const summaryId = `${label}-${record.desktopDeviceId}`;
    const recordTime = getRecordTime(record.completedAt);
    let summary = group.transfers.find(item => item.id === summaryId);
    if (!summary) {
      const showLiveCue = options.previewMode && label === '今天';
      summary = {
        id: summaryId,
        deviceName: options.previewMode
          ? record.displayName || record.desktopDeviceId
          : options.desktopIdentity?.title || record.desktopDeviceId,
        deviceMeta: options.previewMode
          ? record.desktopDeviceId
          : options.desktopIdentity?.meta || record.desktopDeviceId,
        fileCount: 0,
        totalBytes: 0,
        duration: showLiveCue
          ? '实时'
          : PREVIEW_DURATION_BY_DESKTOP[record.desktopDeviceId] || '--',
        isSyncing: showLiveCue,
        sortTime: recordTime,
      };
      group.transfers.push(summary);
    }

    summary.fileCount += 1;
    summary.totalBytes += record.fileSize;
    summary.sortTime = Math.max(summary.sortTime, recordTime);
  });

  groups.forEach(group => {
    group.transfers.sort((a, b) => b.sortTime - a.sortTime);
  });

  return groups;
}

function TransferSummaryCard({ transfer }: { transfer: DailyTransferSummary }) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTopRow}>
        <View style={styles.summaryIcon}>
          <Icon name="desktop-outline" size={22} color="#FFFFFF" />
        </View>
        <View style={styles.summaryTitleWrap}>
          <Text style={styles.summaryDeviceName} numberOfLines={1}>
            {transfer.deviceName}
          </Text>
          <Text style={styles.summaryDeviceMeta} numberOfLines={1}>
            {transfer.deviceMeta}
          </Text>
        </View>
      </View>

      <View style={styles.summaryDivider} />

      <View style={styles.summaryStatsRow}>
        <View style={styles.summaryMainStat}>
          <Text style={styles.summaryLabel}>同步的媒体文件</Text>
          <View style={styles.summaryInlineStat}>
            <Text style={styles.summaryFileCount}>{transfer.fileCount}</Text>
            <Text style={styles.summaryUnit}>个文件</Text>
            <Text style={styles.summaryDot}>·</Text>
            <Text style={styles.summaryTotalSize}>
              {formatBytes(transfer.totalBytes)}
            </Text>
          </View>
        </View>
        <View style={styles.summaryDuration}>
          <Text style={styles.summaryLabel}>时长</Text>
          <Text style={styles.summaryDurationValue}>{transfer.duration}</Text>
        </View>
      </View>
    </View>
  );
}

function StateCard({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.stateCard}>
      <View style={styles.stateIcon}>
        <Icon name={icon} size={28} color="#4A99DE" />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={styles.stateAction}
          activeOpacity={0.72}
          onPress={onAction}
        >
          <Icon name="refresh-outline" size={16} color="#FFFFFF" />
          <Text style={styles.stateActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function HistoryGlobalScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [historyItems, setHistoryItems] = useState<DesktopSyncRecordDTO[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [desktopIdentity, setDesktopIdentity] =
    useState<DesktopHistoryIdentity | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setErrorMessage(null);
      const { NativeSyncEngine } = NativeModules;
      if (!NativeSyncEngine) {
        setPreviewMode(true);
        setDesktopIdentity(null);
        setHistoryItems(MOCK_HISTORY_ITEMS);
        return;
      }

      const binding =
        (await NativeSyncEngine.getBindingState()) as NativeBindingState | null;
      const host = firstNonEmptyString(binding?.host);
      if (!binding || !host) {
        setPreviewMode(false);
        setDesktopIdentity(null);
        setHistoryItems([]);
        return;
      }

      setPreviewMode(false);
      setDesktopIdentity(getDesktopHistoryIdentity(binding));
      const desktop = { host, port: 39394 };
      const result = await listHistory(desktop);
      const completedFiles = (result || []).filter(
        item => item.status === 'completed',
      );
      setHistoryItems(completedFiles);
    } catch (e) {
      console.warn('[HistoryScreen] Failed to load history:', e);
      setPreviewMode(false);
      setDesktopIdentity(null);
      setHistoryItems([]);
      setErrorMessage('无法加载同步历史，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadHistory();
    }, [loadHistory]),
  );

  const groups = useMemo(
    () =>
      buildHistoryGroups(historyItems, {
        previewMode,
        desktopIdentity,
      }),
    [desktopIdentity, historyItems, previewMode],
  );

  const handleRetry = useCallback(() => {
    setLoading(true);
    void loadHistory();
  }, [loadHistory]);
  const emptyTitle = t('history.emptyState.noRecords');

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerSection}>
          <ActivityIndicator size="large" color="#42A7E2" />
          <Text style={styles.loadingText}>正在加载同步历史</Text>
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.centerSection}>
          <StateCard
            icon="alert-circle-outline"
            title="历史加载失败"
            message={errorMessage}
            actionLabel="重试"
            onAction={handleRetry}
          />
        </View>
      );
    }

    if (groups.length === 0) {
      return (
        <View
          testID="history-empty-state-section"
          style={styles.emptySection}
        >
          <StateCard
            icon="cloud-download-outline"
            title={
              emptyTitle === 'history.emptyState.noRecords'
                ? '暂无同步记录'
                : emptyTitle
            }
            message="完成第一次自动同步后，记录会按电脑完成日期显示在这里。"
          />
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {groups.map(group => {
          const isSyncing = group.transfers.some(
            transfer => transfer.isSyncing,
          );
          return (
            <View key={group.id} style={styles.daySection}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>{group.label}</Text>
                {isSyncing && group.syncingLabel ? (
                  <View style={styles.syncingPill}>
                    <View style={styles.syncingOuterDot}>
                      <View style={styles.syncingDot} />
                    </View>
                    <Text style={styles.syncingText}>{group.syncingLabel}</Text>
                  </View>
                ) : null}
              </View>

              {group.transfers.map(transfer => (
                <TransferSummaryCard key={transfer.id} transfer={transfer} />
              ))}
            </View>
          );
        })}

        <View style={styles.paginationHint}>
          <Text style={styles.paginationHintText}>
            已展示最近 {groups.length} 天同步记录
          </Text>
        </View>
      </ScrollView>
    );
  };

  return (
    <GlobalGradientBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.65}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 30 }}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'SyncActivity' }],
                });
              }
            }}
            accessibilityLabel={t('common.back')}
          >
            <Icon name="chevron-back" size={20} color="#173B67" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('history.title') || '历史记录'}</Text>
        </View>

        {renderContent()}
      </SafeAreaView>
    </GlobalGradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#78ACD2',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#173B67',
    letterSpacing: 0,
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  emptySection: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 96,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '500',
    color: '#7D97B5',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 16,
  },
  daySection: {
    gap: 8,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4D6C90',
  },
  syncingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  syncingOuterDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#D6EAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4E9CE0',
  },
  syncingText: {
    fontSize: 9,
    fontWeight: '500',
    color: '#A0BAD4',
  },
  summaryCard: {
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: '#5191C5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 1,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#5AA2DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  summaryDeviceName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#203D63',
  },
  summaryDeviceMeta: {
    marginTop: 2,
    fontSize: 10,
    color: '#A0B7CE',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E3EDF7',
  },
  summaryStatsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 10,
    gap: 12,
  },
  summaryMainStat: {
    flex: 1,
    minWidth: 0,
  },
  summaryLabel: {
    marginBottom: 4,
    fontSize: 10,
    fontWeight: '500',
    color: '#B0C2D5',
  },
  summaryInlineStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  summaryFileCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A99DE',
  },
  summaryUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#C1D1E0',
  },
  summaryDot: {
    fontSize: 12,
    color: '#C1D1E0',
  },
  summaryTotalSize: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#203D63',
  },
  summaryDuration: {
    alignItems: 'flex-end',
  },
  summaryDurationValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A99DE',
  },
  stateCard: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
    shadowColor: '#5191C5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  stateIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#E4F5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  stateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#203D63',
    textAlign: 'center',
  },
  stateMessage: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 20,
    color: '#7D97B5',
    textAlign: 'center',
  },
  stateAction: {
    marginTop: 16,
    minHeight: 38,
    borderRadius: 19,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4A99DE',
  },
  stateActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  paginationHint: {
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.62)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  paginationHintText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8BA6C0',
  },
});
