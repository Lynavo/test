import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { GlobalBottomTabBar } from '../components/GlobalBottomTabBar';
import { GlobalGradientBackground } from '../components/GlobalGradientBackground';
import { Icon } from '../components/Icon';
import { getVisualQaDownloadRecords } from '../dev/visualQaMockData';
import { isVisualQaHomeEmptyStateEnabled } from '../dev/visualQa';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors } from '../theme/globalColors';
import {
  GlobalSyncRecordTimelineSection,
  RecentDownloadsSection,
  type GlobalSyncRecordTimelineDay,
  type RecentDownloadRecord,
  type RecentDownloadPlaceholder,
} from './components/GlobalSyncActivityHomeSections';
import {
  listDownloadRecords,
  type DownloadRecord,
} from '../services/download-records-service';

type NavigationProp = StackNavigationProp<RootStackParamList, 'SyncActivity'>;

const BLUE = colors.accent;

interface SyncActivityGlobalScreenProps {
  showBottomTabBar?: boolean;
}

const GLOBAL_HOME_SYNC_RECORD_DAYS: GlobalSyncRecordTimelineDay[] = [
  {
    key: '2026-03-19',
    label: '今天',
    totalFiles: 18,
    totalSize: '18.4 GB',
    records: [
      {
        id: '2026-03-19-s1',
        deviceName: '剪辑工作站-A',
        duration: '34m 14s',
        fileCount: 15,
        status: 'syncing',
        totalSize: '16.3 GB',
      },
      {
        id: '2026-03-19-s2',
        deviceName: 'MacBook Pro',
        duration: '9m 18s',
        fileCount: 3,
        status: 'completed',
        totalSize: '2.1 GB',
      },
    ],
  },
  {
    key: '2026-03-18',
    label: '3月18日',
    totalFiles: 45,
    totalSize: '86.5 GB',
    records: [
      {
        id: '2026-03-18-s3',
        deviceName: '剪辑工作站-A',
        duration: '1h 12m',
        fileCount: 45,
        status: 'completed',
        totalSize: '86.5 GB',
      },
    ],
  },
  {
    key: '2026-03-17',
    label: '3月17日',
    totalFiles: 37,
    totalSize: '63.3 GB',
    records: [
      {
        id: '2026-03-17-s4',
        deviceName: '剪辑工作站-A',
        duration: '48m 05s',
        fileCount: 29,
        status: 'completed',
        totalSize: '51.0 GB',
      },
      {
        id: '2026-03-17-s5',
        deviceName: '备用机-B',
        duration: '16m 27s',
        fileCount: 8,
        status: 'completed',
        totalSize: '12.3 GB',
      },
    ],
  },
  {
    key: '2026-03-16',
    label: '3月16日',
    totalFiles: 31,
    totalSize: '62.5 GB',
    records: [
      {
        id: '2026-03-16-s6',
        deviceName: 'MacBook Pro',
        duration: '57m 40s',
        fileCount: 31,
        status: 'completed',
        totalSize: '62.5 GB',
      },
    ],
  },
];

const RECENT_DOWNLOAD_PLACEHOLDERS: RecentDownloadPlaceholder[] = [
  {
    key: 'photo',
    label: '照片',
    iconName: 'image-outline',
    iconColor: BLUE,
    iconBackground: '#B8DDF8',
    previewType: 'photo',
  },
  {
    key: 'video',
    label: '视频',
    iconName: 'play-circle-outline',
    iconColor: '#ffffff',
    iconBackground: '#AAB7FF',
    previewType: 'video',
  },
  {
    key: 'file-1',
    label: '文件',
    iconName: 'document-outline',
    iconColor: '#315E8C',
    iconBackground: '#EEF3FA',
    previewType: 'file',
  },
  {
    key: 'file-2',
    label: '文件',
    iconName: 'document-outline',
    iconColor: '#315E8C',
    iconBackground: '#EEF3FA',
    previewType: 'file',
  },
];

export function SyncActivityGlobalScreen({
  showBottomTabBar = true,
}: SyncActivityGlobalScreenProps) {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const showHomeEmptyState = isVisualQaHomeEmptyStateEnabled();
  const [downloadRecords, setDownloadRecords] = useState<DownloadRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void listDownloadRecords().then(records => {
        if (active) {
          setDownloadRecords(
            records.length > 0 ? records : getVisualQaDownloadRecords(),
          );
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const recentDownloadRecords = showHomeEmptyState
    ? []
    : downloadRecords.slice(0, 4).map(toRecentDownloadRecord);

  return (
    <GlobalGradientBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>同步工作台</Text>
            <Text style={styles.subtitle}>
              查看当前连接、传输进度和最近文件。
            </Text>
          </View>

          <View style={styles.autoCard}>
            <View style={styles.autoCardSurface}>
              <View style={styles.autoHeader}>
                <View style={styles.autoTitleRow}>
                  <View style={styles.autoIconBox}>
                    <Icon name="desktop-outline" size={22} color={BLUE} />
                  </View>
                  <View>
                    <Text style={styles.autoTitle}>自动同步</Text>
                    <Text style={styles.autoMeta}>未开启</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.autoButton}
                  activeOpacity={0.76}
                  onPress={() => navigation.navigate('AutoUploadSettings')}
                >
                  <Text style={styles.autoButtonText}>开启</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.phonePanel}>
                <Text style={styles.phoneTitle}>当前手机状态</Text>
                <Text style={styles.phoneStatus}>自动同步未开启</Text>
                <Text style={styles.latestSyncText}>最近同步时间：暂无</Text>
              </View>
            </View>
          </View>

          <RecentDownloadsSection
            records={recentDownloadRecords}
            placeholders={RECENT_DOWNLOAD_PLACEHOLDERS}
            t={t}
            onPressViewAll={() => navigation.navigate('DownloadRecords')}
            title="最近下载"
            viewAllLabel="查看全部"
            sectionIconColor={BLUE}
            sectionIconName="arrow-down-circle-outline"
            variant="globalPreview"
          />

          <GlobalSyncRecordTimelineSection
            days={showHomeEmptyState ? [] : GLOBAL_HOME_SYNC_RECORD_DAYS}
            totalSyncedSize={showHomeEmptyState ? '0 B' : '230.7 GB'}
          />
        </ScrollView>

        {showBottomTabBar ? <GlobalBottomTabBar activeTab="home" /> : null}
      </SafeAreaView>
    </GlobalGradientBackground>
  );
}

function toRecentDownloadRecord(record: DownloadRecord): RecentDownloadRecord {
  return {
    recordId: record.id,
    filename: record.filename,
    fileSize: record.fileSize,
    mediaType: record.mediaType,
    completedAt: record.downloadedAt,
  };
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '600',
    color: '#17191C',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 20,
    color: '#59616D',
  },
  autoCard: {
    marginHorizontal: 20,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: 'rgba(255,255,255,0.58)',
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 52,
    elevation: 3,
  },
  autoCardSurface: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.52)',
  },
  autoHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  autoTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  autoIconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.80)',
    backgroundColor: '#E4F5FF',
  },
  autoTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: '#17191C',
  },
  autoMeta: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 15,
    color: '#59616D',
  },
  autoButton: {
    minHeight: 36,
    minWidth: 54,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: BLUE,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 2,
  },
  autoButtonText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  phonePanel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.50)',
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 34,
    elevation: 1,
  },
  phoneTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#17191C',
  },
  phoneStatus: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 20,
    color: '#59616D',
  },
  latestSyncText: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 15,
    color: '#9AB0C6',
  },
});
