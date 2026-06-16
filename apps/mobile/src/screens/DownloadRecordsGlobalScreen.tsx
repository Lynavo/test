import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlobalGradientBackground } from '../components/GlobalGradientBackground';
import { Icon } from '../components/Icon';
import { getVisualQaDownloadRecords } from '../dev/visualQaMockData';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  listDownloadRecords,
  type DownloadRecord,
} from '../services/download-records-service';
import { colors } from '../theme/globalColors';
import { formatBytes } from '../utils/format';
import { GlobalMediaPreviewIcon } from './components/GlobalSyncActivityHomeSections';

type NavigationProp = StackNavigationProp<RootStackParamList, 'DownloadRecords'>;
type PreviewKind = 'photo' | 'video' | 'file';

const BLUE = colors.accent;

export function DownloadRecordsGlobalScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<DownloadRecord[]>([]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const nextRecords = await listDownloadRecords();
      setRecords(
        nextRecords.length > 0 ? nextRecords : getVisualQaDownloadRecords(),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRecords();
    }, [loadRecords]),
  );

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: 'SyncActivity' }] });
  }, [navigation]);

  return (
    <GlobalGradientBackground>
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.72}
            onPress={goBack}
          >
            <Icon name="chevron-back" size={22} color="#59616D" />
          </TouchableOpacity>
          <Text style={styles.title}>最近下载</Text>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={BLUE} />
          </View>
        ) : records.length === 0 ? (
          <View style={styles.emptySection}>
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Icon name="cloud-download-outline" size={24} color={BLUE} />
              </View>
              <Text style={styles.emptyTitle}>暂无最近下载</Text>
              <Text style={styles.emptyMessage}>
                从电脑下载到本机的文件会出现在这里。
              </Text>
            </View>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {records.map(record => (
              <View key={record.id} style={styles.recordCard}>
                <View style={styles.preview}>
                  <GlobalMediaPreviewIcon
                    type={getDownloadRecordPreviewKind(record)}
                  />
                </View>
                <View style={styles.recordInfo}>
                  <Text style={styles.recordName} numberOfLines={1}>
                    {record.filename}
                  </Text>
                  <Text style={styles.recordMeta}>
                    {getDownloadRecordTypeLabel(record)} ·{' '}
                    {formatBytes(record.fileSize ?? 0)}
                  </Text>
                  <Text style={styles.recordTime}>
                    {formatDownloadTime(record.downloadedAt)}
                  </Text>
                </View>
                <View style={styles.downloadIconButton}>
                  <Icon name="download-outline" size={18} color="#4C92E2" />
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </GlobalGradientBackground>
  );
}

function getDownloadRecordPreviewKind(record: DownloadRecord): PreviewKind {
  const mediaType = record.mediaType?.toLowerCase() ?? '';
  if (mediaType.includes('image') || /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(record.filename)) {
    return 'photo';
  }
  if (mediaType.includes('video') || /\.(mp4|mov|avi|mkv|webm)$/i.test(record.filename)) {
    return 'video';
  }
  return 'file';
}

function getDownloadRecordTypeLabel(record: DownloadRecord): string {
  const kind = getDownloadRecordPreviewKind(record);
  if (kind === 'photo') return '照片';
  if (kind === 'video') return '视频';
  return '文件';
}

function formatDownloadTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const time = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const dayDiff = Math.round(
    (today.getTime() - targetDay.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (dayDiff === 0) return `今天 ${time}`;
  if (dayDiff === 1) return `昨天 ${time}`;
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')} ${time}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    marginBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    color: '#17191C',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  emptyCard: {
    minHeight: 180,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: 'rgba(255,255,255,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 52,
    elevation: 6,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#E4F5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    color: '#203D63',
    textAlign: 'center',
  },
  emptyMessage: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 20,
    color: '#7B8490',
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: 'rgba(255,255,255,0.58)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 52,
    elevation: 6,
  },
  preview: {
    width: 58,
    height: 58,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#EDF4FB',
  },
  recordInfo: {
    flex: 1,
    minWidth: 0,
  },
  recordName: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#203D63',
  },
  recordMeta: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: '#7D97B5',
  },
  recordTime: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 14,
    color: '#9EB2C8',
  },
  downloadIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF5FD',
  },
});
