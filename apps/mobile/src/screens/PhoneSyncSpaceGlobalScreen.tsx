import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  NativeModules,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import { SIDECAR_HTTP_PORT, type ReceivedLibraryItemDTO } from '@syncflow/contracts';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors } from '../theme/globalColors';
import { formatBytes } from '../utils/format';
import { Icon } from '../components/Icon';
import { GlobalGradientBackground } from '../components/GlobalGradientBackground';
import { ModalBlurBackdrop } from '../components/shared/ModalBlurBackdrop';
import { isVisualQaEnabled } from '../dev/visualQa';
import { listReceivedLibrary } from '../services/desktop-local-service';

type NavigationProp = StackNavigationProp<RootStackParamList, 'PhoneSyncSpace'>;
type ReceivedSection = {
  title: string;
  data: ReceivedLibraryItemDTO[];
};
type SortKey = 'time' | 'name' | 'size';

const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: 'time', label: '时间' },
  { id: 'name', label: '名称' },
  { id: 'size', label: '文件大小' },
];

const now = Date.now();
const MOCK_RECEIVED_ITEMS: ReceivedLibraryItemDTO[] = [
  {
    resourceId: 'mock-received-1',
    desktopDeviceId: '剪辑工作站-A',
    clientId: 'iphone-15-pro',
    displayName: 'IMG_8421.JPG',
    fileKey: 'mock/IMG_8421.JPG',
    filename: 'IMG_8421.JPG',
    mediaType: 'image',
    fileSize: 9017753,
    completedAt: new Date(now - 9 * 60 * 1000).toISOString(),
    shareStatus: 'shared',
  },
  {
    resourceId: 'mock-received-2',
    desktopDeviceId: '剪辑工作站-A',
    clientId: 'iphone-15-pro',
    displayName: 'IMG_8420.JPG',
    fileKey: 'mock/IMG_8420.JPG',
    filename: 'IMG_8420.JPG',
    mediaType: 'image',
    fileSize: 8283750,
    completedAt: new Date(now - 14 * 60 * 1000).toISOString(),
    shareStatus: 'shared',
  },
  {
    resourceId: 'mock-received-3',
    desktopDeviceId: '剪辑工作站-A',
    clientId: 'iphone-15-pro',
    displayName: 'VID_3018.MP4',
    fileKey: 'mock/VID_3018.MP4',
    filename: 'VID_3018.MP4',
    mediaType: 'video',
    fileSize: 1717986918,
    completedAt: new Date(now - 18 * 60 * 1000).toISOString(),
    shareStatus: 'missing',
  },
  {
    resourceId: 'mock-received-4',
    desktopDeviceId: 'MacBook Pro',
    clientId: 'iphone-15-pro',
    displayName: 'ScreenRecording_0615.mov',
    fileKey: 'mock/ScreenRecording_0615.mov',
    filename: 'ScreenRecording_0615.mov',
    mediaType: 'video',
    fileSize: 3006477107,
    completedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    shareStatus: 'missing',
  },
  {
    resourceId: 'mock-received-5',
    desktopDeviceId: 'MacBook Pro',
    clientId: 'iphone-15-pro',
    displayName: 'Contract-Final.pdf',
    fileKey: 'mock/Contract-Final.pdf',
    filename: 'Contract-Final.pdf',
    mediaType: 'document',
    fileSize: 6501171,
    completedAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
    shareStatus: 'shared',
  },
  {
    resourceId: 'mock-received-6',
    desktopDeviceId: '剪辑工作站-A',
    clientId: 'iphone-15-pro',
    displayName: 'IMG_8393.PNG',
    fileKey: 'mock/IMG_8393.PNG',
    filename: 'IMG_8393.PNG',
    mediaType: 'image',
    fileSize: 4299161,
    completedAt: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
    shareStatus: 'shared',
  },
  {
    resourceId: 'mock-received-7',
    desktopDeviceId: '剪辑工作站-A',
    clientId: 'iphone-15-pro',
    displayName: 'ProjectAssets.zip',
    fileKey: 'mock/ProjectAssets.zip',
    filename: 'ProjectAssets.zip',
    mediaType: 'document',
    fileSize: 3650722202,
    completedAt: new Date(now - 26 * 60 * 60 * 1000).toISOString(),
    shareStatus: 'missing',
  },
  {
    resourceId: 'mock-received-8',
    desktopDeviceId: '剪辑工作站-A',
    clientId: 'iphone-15-pro',
    displayName: 'VID_2981.MP4',
    fileKey: 'mock/VID_2981.MP4',
    filename: 'VID_2981.MP4',
    mediaType: 'video',
    fileSize: 1033895936,
    completedAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    shareStatus: 'shared',
  },
  {
    resourceId: 'mock-received-9',
    desktopDeviceId: 'Windows Workstation',
    clientId: 'iphone-15-pro',
    displayName: 'B-roll_Studio_A.heic',
    fileKey: 'mock/B-roll_Studio_A.heic',
    filename: 'B-roll_Studio_A.heic',
    mediaType: 'image',
    fileSize: 11240735,
    completedAt: new Date(now - 3 * 24 * 60 * 60 * 1000 - 90 * 60 * 1000).toISOString(),
    shareStatus: 'shared',
  },
];

type RemoteResourcesPreviewGlobal = typeof globalThis & {
  __SYNCFLOW_REMOTE_RESOURCES_PREVIEW__?: boolean;
};

function isRemoteResourcesPreviewMode() {
  return (
    isVisualQaEnabled() ||
    (globalThis as RemoteResourcesPreviewGlobal)
      .__SYNCFLOW_REMOTE_RESOURCES_PREVIEW__ === true
  );
}

function getPreviewReceivedItems() {
  return isRemoteResourcesPreviewMode() ? MOCK_RECEIVED_ITEMS : [];
}

function getSectionTitle(isoString: string) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '未知时间';

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

function getItemTimestamp(item: ReceivedLibraryItemDTO) {
  const timestamp = new Date(item.completedAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isVideo(mediaType: string, filename: string) {
  return mediaType === 'video' || /\.(mp4|mov|avi|mkv|webm)$/i.test(filename);
}

function isImage(mediaType: string, filename: string) {
  return mediaType === 'image' || /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(filename);
}

function getFileTypeText(mediaType: string, filename: string) {
  if (isVideo(mediaType, filename)) return '视频';
  if (isImage(mediaType, filename)) return '照片';
  return '文件';
}

function getFileIcon(mediaType: string, filename: string) {
  if (isVideo(mediaType, filename)) {
    return { name: 'play', color: '#746AA8', style: styles.videoIcon };
  }
  if (isImage(mediaType, filename)) {
    return { name: 'image', color: '#1677D2', style: styles.photoIcon };
  }
  return { name: 'document-text', color: '#16A34A', style: styles.fileIcon };
}

function formatClock(isoString: string) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function PhoneSyncSpaceGlobalScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReceivedLibraryItemDTO[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>('time');
  const [showSortSheet, setShowSortSheet] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { NativeSyncEngine } = NativeModules;
      if (!NativeSyncEngine) {
        setItems(getPreviewReceivedItems());
        setLoading(false);
        return;
      }

      const binding = await NativeSyncEngine.getBindingState();
      if (!binding || !binding.host) {
        setItems(getPreviewReceivedItems());
        setLoading(false);
        return;
      }

      const desktop = { host: binding.host, port: SIDECAR_HTTP_PORT };
      const result = await listReceivedLibrary(desktop);
      const receivedItems = result ?? [];
      const previewItems = getPreviewReceivedItems();
      setItems(receivedItems.length > 0 ? receivedItems : previewItems);
    } catch (e) {
      console.warn('[PhoneSyncSpaceScreen] Failed to load data:', e);
      setItems(getPreviewReceivedItems());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData]),
  );

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: 'SharedFiles' }] });
  }, [navigation]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sortBy === 'name') {
        return (a.displayName || a.filename).localeCompare(
          b.displayName || b.filename,
          'zh-CN',
        );
      }
      if (sortBy === 'size') return b.fileSize - a.fileSize;
      return getItemTimestamp(b) - getItemTimestamp(a);
    });
  }, [items, sortBy]);

  const sections = useMemo(
    () =>
      sortedItems.reduce<ReceivedSection[]>((acc, item) => {
        const title = getSectionTitle(item.completedAt);
        const section = acc.find(group => group.title === title);
        if (section) {
          section.data.push(item);
        } else {
          acc.push({ title, data: [item] });
        }
        return acc;
      }, []),
    [sortedItems],
  );

  const totalSizeLabel = formatBytes(
    items.reduce((total, item) => total + item.fileSize, 0),
  );
  const sortLabel = SORT_OPTIONS.find(option => option.id === sortBy)?.label ?? '时间';

  const renderItem = ({ item }: { item: ReceivedLibraryItemDTO }) => {
    const iconConfig = getFileIcon(item.mediaType, item.filename);
    const displayName = item.displayName || item.filename;
    const fileType = getFileTypeText(item.mediaType, item.filename);
    const clock = formatClock(item.completedAt);

    return (
      <View style={styles.card}>
        <View style={[styles.iconWrapper, iconConfig.style]}>
          <Icon name={iconConfig.name} size={22} color={iconConfig.color} />
        </View>
        <View style={styles.infoWrapper}>
          <Text style={styles.filename} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.metaText} numberOfLines={1}>
            {`${fileType} · ${formatBytes(item.fileSize)}${clock ? ` · ${clock}` : ''}`}
          </Text>
          <View style={styles.badgeRow}>
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceBadgeText} numberOfLines={1}>
                {item.desktopDeviceId || '未知设备'}
              </Text>
            </View>
            {item.shareStatus === 'missing' ? (
              <View style={styles.warningBadge}>
                <Text style={styles.warningBadgeText}>仅电脑端</Text>
              </View>
            ) : null}
          </View>
        </View>
        <TouchableOpacity style={styles.downloadButton} activeOpacity={0.7}>
          <Icon name="download-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <GlobalGradientBackground>
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="返回"
            onPress={goBack}
            activeOpacity={0.7}
          >
            <Icon name="chevron-back" size={22} color="#59616D" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {t('sharedFiles.phoneSyncSpace.title') || '手機同步空間'}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              已同步到电脑的手机素材
            </Text>
          </View>
        </View>

        <View style={styles.toolbarCard}>
          <TouchableOpacity
            style={styles.sortButton}
            activeOpacity={0.7}
            onPress={() => setShowSortSheet(true)}
          >
            <Icon name="list-outline" size={16} color={colors.primary} />
            <Text style={styles.sortButtonText}>{sortLabel}</Text>
          </TouchableOpacity>
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryText}>
              {items.length} 个 · {totalSizeLabel}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centeredCard}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.centeredTitle}>正在加载</Text>
            <Text style={styles.centeredSubtitle}>同步空间列表会在这里刷新。</Text>
          </View>
        ) : sortedItems.length === 0 ? (
          <View style={styles.centeredCard}>
            <Icon name="folder-open-outline" size={28} color="#9AA3AE" />
            <Text style={styles.centeredTitle}>
              {t('sharedFiles.phoneSyncSpace.empty') || '尚無同步檔案'}
            </Text>
            <Text style={styles.centeredSubtitle}>
              开启自动上传后，同步到电脑的素材会出现在这里。
            </Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={item => item.resourceId}
            renderItem={renderItem}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionCount}>
                  {section.data.length} 个文件
                </Text>
              </View>
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
          />
        )}
      </SafeAreaView>

      <SortSheet
        visible={showSortSheet}
        value={sortBy}
        options={SORT_OPTIONS}
        onClose={() => setShowSortSheet(false)}
        onSelect={value => {
          setSortBy(value);
          setShowSortSheet(false);
        }}
      />
    </GlobalGradientBackground>
  );
}

function SortSheet({
  visible,
  value,
  options,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: SortKey;
  options: Array<{ id: SortKey; label: string }>;
  onClose: () => void;
  onSelect: (value: SortKey) => void;
}) {
  return (
    <Modal
      animationType="fade"
      transparent
      statusBarTranslucent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.sheetLayer}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose}>
          <ModalBlurBackdrop overlayColor="rgba(23,25,28,0.18)" />
        </Pressable>
        <View style={styles.sheetCard}>
          <Text style={styles.sheetTitle}>排序方式</Text>
          {options.map(option => {
            const active = option.id === value;
            return (
              <TouchableOpacity
                key={option.id}
                style={styles.sheetOption}
                activeOpacity={0.7}
                onPress={() => onSelect(option.id)}
              >
                <Text style={styles.sheetOptionText}>{option.label}</Text>
                {active ? (
                  <Icon name="checkmark" size={18} color={colors.primary} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const glassShadow = {
  shadowColor: '#46608A',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.08,
  shadowRadius: 34,
  elevation: 3,
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 18,
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    ...glassShadow,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#59616D',
  },
  toolbarCard: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: 'rgba(255,255,255,0.50)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...glassShadow,
  },
  sortButton: {
    minHeight: 36,
    borderRadius: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.foreground,
  },
  summaryBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.62)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  summaryText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#7B8490',
  },
  listContent: {
    paddingBottom: 34,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#59616D',
  },
  sectionCount: {
    fontSize: 10,
    color: '#9AA3AE',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: 'rgba(255,255,255,0.50)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    ...glassShadow,
  },
  iconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  photoIcon: {
    backgroundColor: '#D8F0FF',
  },
  videoIcon: {
    backgroundColor: '#E3E6FF',
  },
  fileIcon: {
    backgroundColor: '#EAF8F0',
  },
  infoWrapper: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 8,
  },
  filename: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.foreground,
  },
  metaText: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 16,
    color: '#59616D',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  sourceBadge: {
    maxWidth: 130,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.62)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sourceBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#7B8490',
  },
  warningBadge: {
    borderRadius: 999,
    backgroundColor: '#FFF5E0',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  warningBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B7791F',
  },
  downloadButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.64)',
  },
  centeredCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: 'rgba(255,255,255,0.50)',
    paddingHorizontal: 24,
    paddingVertical: 34,
    alignItems: 'center',
    ...glassShadow,
  },
  centeredTitle: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
  },
  centeredSubtitle: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    color: '#59616D',
  },
  sheetLayer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    ...glassShadow,
  },
  sheetTitle: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.foreground,
  },
  sheetOption: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
  },
});
