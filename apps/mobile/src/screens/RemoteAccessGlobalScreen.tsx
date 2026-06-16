import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  NativeModules,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import { SIDECAR_HTTP_PORT, type DesktopSharedResourceDTO } from '@syncflow/contracts';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors } from '../theme/globalColors';
import { formatBytes } from '../utils/format';
import { Icon } from '../components/Icon';
import { GlobalGradientBackground } from '../components/GlobalGradientBackground';
import { ModalBlurBackdrop } from '../components/shared/ModalBlurBackdrop';
import { isVisualQaEnabled } from '../dev/visualQa';
import { listSharedResources, downloadResource } from '../services/desktop-local-service';
import { recordDownloadedFile } from '../services/download-records-service';

type NavigationProp = StackNavigationProp<RootStackParamList, 'RemoteAccess'>;
type LayoutMode = 'list' | 'grid';
type SortKey = 'name' | 'time' | 'size';
type RemoteResourceItem = DesktopSharedResourceDTO & {
  countLabel?: string;
  modifiedLabel?: string;
  preview?: 'blue' | 'dark' | 'settings';
};
type FolderCrumb = {
  id: string;
  name: string;
};

const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: 'name', label: '名称' },
  { id: 'time', label: '时间' },
  { id: 'size', label: '文件大小' },
];

const now = Date.now();

function resource(
  item: Omit<RemoteResourceItem, 'desktopDeviceId' | 'status' | 'addedAt' | 'downloadCount'> & {
    addedOffsetHours?: number;
    desktopDeviceId?: string;
    downloadCount?: number;
    status?: RemoteResourceItem['status'];
  },
): RemoteResourceItem {
  const { addedOffsetHours = 24, ...rest } = item;
  return {
    desktopDeviceId: rest.desktopDeviceId ?? 'MacBook Pro',
    status: rest.status ?? 'available',
    addedAt: new Date(now - addedOffsetHours * 60 * 60 * 1000).toISOString(),
    downloadCount: rest.downloadCount ?? 0,
    ...rest,
  };
}

const MOCK_ROOT_ITEMS: RemoteResourceItem[] = [
  resource({
    resourceId: 'codex',
    kind: 'shared_folder',
    displayName: 'Codex',
    countLabel: '文件夹',
    addedOffsetHours: 14,
  }),
  resource({
    resourceId: 'mac-manual',
    kind: 'shared_file',
    displayName: 'Mac 客户端安装手册-2506.docx',
    fileSize: 1992294,
    mediaType: 'document',
    modifiedLabel: '上次修改时间 1天前',
    preview: 'settings',
    addedOffsetHours: 24,
    downloadCount: 2,
  }),
  resource({
    resourceId: 'reply-template',
    kind: 'shared_file',
    displayName: 'REPLY_TEMPLATE_API.md',
    fileSize: 5120,
    mediaType: 'document',
    modifiedLabel: '上次修改时间 2天前',
    preview: 'settings',
    addedOffsetHours: 48,
  }),
  resource({
    resourceId: 'abc',
    kind: 'shared_file',
    displayName: 'abc.txt',
    fileSize: 13,
    mediaType: 'document',
    modifiedLabel: '上次修改时间 3天前',
    preview: 'blue',
    addedOffsetHours: 72,
  }),
  resource({
    resourceId: 'imsdk',
    kind: 'shared_file',
    displayName: 'imsdk.har',
    fileSize: 15728640,
    mediaType: 'document',
    modifiedLabel: '上次修改时间 1天前',
    preview: 'settings',
    addedOffsetHours: 25,
  }),
  resource({
    resourceId: 'vividrop-official',
    kind: 'shared_folder',
    displayName: 'vividrop-official',
    countLabel: '文件夹',
    addedOffsetHours: 30,
  }),
  resource({
    resourceId: 'promo-video',
    kind: 'shared_folder',
    displayName: 'vividrop 宣传视频',
    countLabel: '文件夹',
    addedOffsetHours: 38,
  }),
  resource({
    resourceId: 'ui-design',
    kind: 'shared_folder',
    displayName: '海外版 UI 设计',
    countLabel: '文件夹',
    addedOffsetHours: 42,
  }),
  resource({
    resourceId: 'empty-folder',
    kind: 'shared_folder',
    displayName: '待整理',
    countLabel: '空文件夹',
    addedOffsetHours: 96,
  }),
];

const MOCK_FOLDER_CONTENTS: Record<string, RemoteResourceItem[]> = {
  codex: [
    resource({
      resourceId: 'codex-readme',
      kind: 'shared_file',
      displayName: 'README.md',
      fileSize: 12288,
      mediaType: 'document',
      modifiedLabel: '上次修改时间 1天前',
      preview: 'settings',
      addedOffsetHours: 28,
    }),
    resource({
      resourceId: 'codex-plan',
      kind: 'shared_file',
      displayName: 'project-plan.pdf',
      fileSize: 700416,
      mediaType: 'document',
      modifiedLabel: '上次修改时间 2天前',
      preview: 'blue',
      addedOffsetHours: 49,
    }),
    resource({
      resourceId: 'codex-shot',
      kind: 'shared_file',
      displayName: 'screen-recording.mov',
      fileSize: 1932735283,
      mediaType: 'video',
      modifiedLabel: '上次修改时间 1天前',
      preview: 'dark',
      addedOffsetHours: 21,
      downloadCount: 1,
    }),
    resource({
      resourceId: 'codex-archive',
      kind: 'shared_folder',
      displayName: 'Archive',
      countLabel: '文件夹',
      addedOffsetHours: 120,
    }),
  ],
  'codex-archive': [
    resource({
      resourceId: 'archive-backup',
      kind: 'shared_file',
      displayName: 'old-backup.tar.gz',
      fileSize: 104857600,
      mediaType: 'document',
      modifiedLabel: '上次修改时间 5天前',
      preview: 'settings',
      addedOffsetHours: 122,
    }),
  ],
  'vividrop-official': [
    resource({
      resourceId: 'official-guide',
      kind: 'shared_file',
      displayName: 'brand-guide.pdf',
      fileSize: 6710886,
      mediaType: 'document',
      modifiedLabel: '上次修改时间 3天前',
      preview: 'blue',
      addedOffsetHours: 72,
    }),
    resource({
      resourceId: 'official-release',
      kind: 'shared_file',
      displayName: 'release-note.docx',
      fileSize: 1258291,
      mediaType: 'document',
      modifiedLabel: '上次修改时间 1天前',
      preview: 'settings',
      addedOffsetHours: 24,
    }),
  ],
  'promo-video': [
    resource({
      resourceId: 'promo-launch',
      kind: 'shared_file',
      displayName: 'launch-trailer.mp4',
      fileSize: 897581056,
      mediaType: 'video',
      modifiedLabel: '上次修改时间 2天前',
      preview: 'dark',
      addedOffsetHours: 51,
      downloadCount: 4,
    }),
    resource({
      resourceId: 'promo-behind',
      kind: 'shared_file',
      displayName: 'behind-scenes.mov',
      fileSize: 1181116006,
      mediaType: 'video',
      modifiedLabel: '上次修改时间 4天前',
      preview: 'settings',
      addedOffsetHours: 99,
    }),
  ],
  'ui-design': [
    resource({
      resourceId: 'ui-home',
      kind: 'shared_file',
      displayName: 'home-screen.fig',
      fileSize: 29360128,
      mediaType: 'image',
      modifiedLabel: '上次修改时间 2天前',
      preview: 'blue',
      addedOffsetHours: 50,
    }),
    resource({
      resourceId: 'ui-history',
      kind: 'shared_file',
      displayName: 'history-screen.png',
      fileSize: 201728,
      mediaType: 'image',
      modifiedLabel: '上次修改时间 1天前',
      preview: 'settings',
      addedOffsetHours: 23,
    }),
    resource({
      resourceId: 'ui-settings',
      kind: 'shared_file',
      displayName: 'settings-screen.png',
      fileSize: 139264,
      mediaType: 'image',
      modifiedLabel: '上次修改时间 1天前',
      preview: 'blue',
      addedOffsetHours: 22,
    }),
  ],
  'empty-folder': [],
};

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

function getPreviewRootItems() {
  return isRemoteResourcesPreviewMode() ? MOCK_ROOT_ITEMS : [];
}

function isFolder(item: RemoteResourceItem) {
  return item.kind === 'shared_folder';
}

function isVideo(item: RemoteResourceItem) {
  return item.mediaType === 'video' || /\.(mp4|mov|m4v|avi|mkv|webm)$/i.test(item.displayName);
}

function isImage(item: RemoteResourceItem) {
  return (
    item.mediaType === 'image' ||
    /\.(jpg|jpeg|png|gif|webp|heic|fig)$/i.test(item.displayName)
  );
}

function getItemIcon(item: RemoteResourceItem) {
  if (isFolder(item)) {
    return { name: 'folder', color: '#D6A21D', style: styles.folderIcon };
  }
  if (isVideo(item)) {
    return { name: 'play', color: '#746AA8', style: styles.videoIcon };
  }
  if (isImage(item)) {
    return { name: 'image', color: '#1677D2', style: styles.photoIcon };
  }
  return { name: 'document-text', color: '#16A34A', style: styles.fileIcon };
}

function getItemSize(item: RemoteResourceItem) {
  return isFolder(item) ? Number.POSITIVE_INFINITY : item.fileSize ?? 0;
}

function getItemTime(item: RemoteResourceItem) {
  const timestamp = new Date(item.addedAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getItemMeta(item: RemoteResourceItem) {
  if (isFolder(item)) return item.countLabel ?? '文件夹';
  const size = formatBytes(item.fileSize ?? 0);
  const modified = item.modifiedLabel?.replace('上次修改时间 ', '') ?? '刚刚';
  return `${size} · ${modified}`;
}

export function RemoteAccessGlobalScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [networkDisconnected, setNetworkDisconnected] = useState(false);
  const [rootItems, setRootItems] = useState<RemoteResourceItem[]>([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [folderStack, setFolderStack] = useState<FolderCrumb[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('list');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  const currentFolder = folderStack[folderStack.length - 1] ?? null;

  const loadData = useCallback(async () => {
    setNetworkDisconnected(false);
    try {
      const { NativeSyncEngine } = NativeModules;
      if (!NativeSyncEngine) {
        const previewItems = getPreviewRootItems();
        setPreviewMode(previewItems.length > 0);
        setRootItems(previewItems);
        setLoading(false);
        return;
      }

      const binding = await NativeSyncEngine.getBindingState();
      if (!binding || !binding.host) {
        const previewItems = getPreviewRootItems();
        setPreviewMode(previewItems.length > 0);
        setRootItems(previewItems);
        setLoading(false);
        return;
      }

      const desktop = { host: binding.host, port: SIDECAR_HTTP_PORT };
      const result = await listSharedResources(desktop);
      const remoteItems = result ?? [];
      const previewItems = getPreviewRootItems();
      if (remoteItems.length > 0 || previewItems.length === 0) {
        setPreviewMode(false);
        setRootItems(remoteItems);
      } else {
        setPreviewMode(true);
        setRootItems(previewItems);
      }
    } catch (e) {
      console.warn('[RemoteAccessScreen] Failed to load data:', e);
      const previewItems = getPreviewRootItems();
      if (previewItems.length > 0) {
        setPreviewMode(true);
        setRootItems(previewItems);
      } else {
        setPreviewMode(false);
        setRootItems([]);
        setNetworkDisconnected(true);
      }
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

  const resetSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds([]);
    setShowShareSheet(false);
  }, []);

  const handleDownload = useCallback(
    async (item: RemoteResourceItem) => {
      if (downloadingId) return;
      setDownloadingId(item.resourceId);

      try {
        const { NativeSyncEngine } = NativeModules;
        const binding = await NativeSyncEngine?.getBindingState();
        if (!binding || !binding.host) {
          Alert.alert(t('sharedFiles.deviceUnavailable.title') || '設備不可用');
          return;
        }

        const desktop = { host: binding.host, port: SIDECAR_HTTP_PORT };
        const result = await downloadResource(desktop, item.resourceId);
        await recordDownloadedFile({
          resourceId: item.resourceId,
          filename: item.displayName,
          fileSize: item.fileSize,
          mediaType: item.mediaType,
          localPath: result.localPath,
          savedToPhotos: result.savedToPhotos,
        });

        Alert.alert(
          t('sharedFiles.dialogs.downloadComplete') || '下載完成',
          t('sharedFiles.dialogs.downloadSavedToPhotos', {
            name: item.displayName,
          }) || `${item.displayName} 已儲存至相簿`,
        );
      } catch (err) {
        console.warn('[RemoteAccessScreen] Download failed:', err);
        Alert.alert(
          t('sharedFiles.dialogs.downloadFailed') || '下載失敗',
          t('sharedFiles.dialogs.downloadFailedMessage') ||
            '無法下載檔案，請稍後重試',
        );
      } finally {
        setDownloadingId(null);
      }
    },
    [downloadingId, t],
  );

  const currentItems = useMemo(() => {
    if (!currentFolder) return rootItems;
    return previewMode ? MOCK_FOLDER_CONTENTS[currentFolder.id] ?? [] : [];
  }, [currentFolder, previewMode, rootItems]);

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? currentItems.filter(item => item.displayName.toLowerCase().includes(query))
      : currentItems;

    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.displayName.localeCompare(b.displayName, 'zh-CN');
      if (sortBy === 'size') return getItemSize(b) - getItemSize(a);
      if (isFolder(a) && !isFolder(b)) return -1;
      if (!isFolder(a) && isFolder(b)) return 1;
      return getItemTime(b) - getItemTime(a);
    });
  }, [currentItems, searchQuery, sortBy]);

  const selectedItems = useMemo(
    () => currentItems.filter(item => selectedIds.includes(item.resourceId) && !isFolder(item)),
    [currentItems, selectedIds],
  );

  const openFolder = useCallback((item: RemoteResourceItem) => {
    setFolderStack(stack => [...stack, { id: item.resourceId, name: item.displayName }]);
    setLayoutMode('list');
    setSearchQuery('');
    resetSelection();
  }, [resetSelection]);

  const goBack = useCallback(() => {
    if (currentFolder) {
      setFolderStack(stack => stack.slice(0, -1));
      setSearchQuery('');
      resetSelection();
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: 'SharedFiles' }] });
  }, [currentFolder, navigation, resetSelection]);

  const toggleSelection = useCallback((item: RemoteResourceItem) => {
    if (isFolder(item)) return;
    setSelectedIds(prev =>
      prev.includes(item.resourceId)
        ? prev.filter(id => id !== item.resourceId)
        : [...prev, item.resourceId],
    );
  }, []);

  const handleSelectionButton = useCallback(() => {
    if (selectionMode) {
      resetSelection();
      return;
    }
    setSelectionMode(true);
    setSelectedIds([]);
  }, [resetSelection, selectionMode]);

  const handleSelectedDownload = useCallback(() => {
    const first = selectedItems[0];
    if (!first) return;
    handleDownload(first);
  }, [handleDownload, selectedItems]);

  const handleSelectedShare = useCallback(() => {
    if (selectedItems.length > 0) setShowShareSheet(true);
  }, [selectedItems.length]);

  const retryLoadData = useCallback(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const sortLabel = SORT_OPTIONS.find(option => option.id === sortBy)?.label ?? '名称';
  const queryActive = searchQuery.trim().length > 0;
  const title = currentFolder
    ? currentFolder.name
    : t('sharedFiles.remoteAccess.title') || '遠端訪問電腦';
  const subtitle = currentFolder ? `MacBook Pro / ${currentFolder.name}` : 'MacBook Pro / 用户目录';

  const renderItem = ({ item }: { item: RemoteResourceItem }) => {
    return layoutMode === 'grid'
      ? renderGridItem({
          item,
          downloadingId,
          onDownload: handleDownload,
          onOpenFolder: openFolder,
          onToggleSelection: toggleSelection,
          selected: selectedIds.includes(item.resourceId),
          selectionMode,
        })
      : renderListItem({
          item,
          downloadingId,
          onDownload: handleDownload,
          onOpenFolder: openFolder,
          onToggleSelection: toggleSelection,
          selected: selectedIds.includes(item.resourceId),
          selectionMode,
        });
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
              {title}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.selectionButton,
              selectionMode ? styles.selectionButtonActive : null,
            ]}
            onPress={handleSelectionButton}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.selectionButtonText,
                selectionMode ? styles.selectionButtonActiveText : null,
              ]}
            >
              {selectionMode ? '完成' : t('sharedFiles.remoteAccess.select') || '選擇'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Icon name="search-outline" size={16} color="#7B8490" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={currentFolder ? '搜索当前文件夹' : '搜索电脑文件'}
            placeholderTextColor="#9AA3AE"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
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

          {selectionMode ? (
            <View style={styles.selectionActions}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  selectedItems.length === 0 ? styles.actionButtonDisabled : null,
                ]}
                disabled={selectedItems.length === 0}
                activeOpacity={0.7}
                onPress={handleSelectedDownload}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    selectedItems.length === 0 ? styles.actionButtonDisabledText : null,
                  ]}
                >
                  下载
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButtonSecondary,
                  selectedItems.length === 0 ? styles.actionButtonDisabled : null,
                ]}
                disabled={selectedItems.length === 0}
                activeOpacity={0.7}
                onPress={handleSelectedShare}
              >
                <Text
                  style={[
                    styles.actionButtonSecondaryText,
                    selectedItems.length === 0 ? styles.actionButtonDisabledText : null,
                  ]}
                >
                  分享
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.layoutToggle}>
              <TouchableOpacity
                style={[
                  styles.layoutButton,
                  layoutMode === 'list' ? styles.layoutButtonActive : null,
                ]}
                accessibilityLabel="列表视图"
                activeOpacity={0.7}
                onPress={() => setLayoutMode('list')}
              >
                <Icon
                  name="list-outline"
                  size={17}
                  color={layoutMode === 'list' ? colors.primary : '#7B8490'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.layoutButton,
                  layoutMode === 'grid' ? styles.layoutButtonActive : null,
                ]}
                accessibilityLabel="网格视图"
                activeOpacity={0.7}
                onPress={() => setLayoutMode('grid')}
              >
                <Icon
                  name="grid-outline"
                  size={17}
                  color={layoutMode === 'grid' ? colors.primary : '#7B8490'}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.centeredCard}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.centeredTitle}>远程资源加载中</Text>
            <Text style={styles.centeredSubtitle}>正在读取电脑端共享目录。</Text>
          </View>
        ) : networkDisconnected ? (
          <NetworkDisconnectedState onRetry={retryLoadData} />
        ) : visibleItems.length === 0 ? (
          <EmptyState queryActive={queryActive} currentFolder={currentFolder} />
        ) : (
          <FlatList
            key={layoutMode}
            data={visibleItems}
            keyExtractor={item => item.resourceId}
            renderItem={renderItem}
            numColumns={layoutMode === 'grid' ? 3 : 1}
            columnWrapperStyle={layoutMode === 'grid' ? styles.gridRow : undefined}
            contentContainerStyle={[
              styles.listContent,
              layoutMode === 'grid' ? styles.gridContent : null,
            ]}
            showsVerticalScrollIndicator={false}
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
      <ShareSheet
        visible={showShareSheet}
        selectedCount={selectedItems.length}
        onClose={() => setShowShareSheet(false)}
      />
    </GlobalGradientBackground>
  );
}

function NetworkDisconnectedState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.centeredCard}>
      <View style={styles.disconnectedIcon}>
        <Icon name="cloud-offline-outline" size={28} color="#DC2626" />
      </View>
      <Text style={styles.centeredTitle}>网络断开</Text>
      <Text style={styles.centeredSubtitle}>
        当前路径会保留，恢复网络或电脑端在线后可以继续访问。
      </Text>
      <TouchableOpacity
        style={styles.retryButton}
        activeOpacity={0.75}
        accessibilityRole="button"
        onPress={onRetry}
      >
        <Text style={styles.retryButtonText}>重试连接</Text>
      </TouchableOpacity>
    </View>
  );
}

function renderListItem({
  item,
  downloadingId,
  onDownload,
  onOpenFolder,
  onToggleSelection,
  selected,
  selectionMode,
}: {
  item: RemoteResourceItem;
  downloadingId: string | null;
  onDownload: (item: RemoteResourceItem) => void;
  onOpenFolder: (item: RemoteResourceItem) => void;
  onToggleSelection: (item: RemoteResourceItem) => void;
  selected: boolean;
  selectionMode: boolean;
}) {
  const folder = isFolder(item);
  const iconConfig = getItemIcon(item);
  const downloading = downloadingId === item.resourceId;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={folder || selectionMode ? 0.7 : 1}
      onPress={() => {
        if (folder) onOpenFolder(item);
        if (!folder && selectionMode) onToggleSelection(item);
      }}
    >
      <View style={[styles.iconWrapper, iconConfig.style]}>
        <Icon name={iconConfig.name} size={22} color={iconConfig.color} />
      </View>
      <View style={styles.infoWrapper}>
        <Text style={styles.filename} numberOfLines={1}>
          {item.displayName}
        </Text>
        <Text style={styles.metaText} numberOfLines={1}>
          {getItemMeta(item)}
        </Text>
      </View>
      {selectionMode && !folder ? (
        <SelectionMark selected={selected} onPress={() => onToggleSelection(item)} />
      ) : folder ? (
        <TouchableOpacity
          style={styles.iconActionButton}
          activeOpacity={0.7}
          onPress={() => onOpenFolder(item)}
        >
          <Icon name="chevron-forward" size={16} color="#9AA3AE" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.iconActionButton}
          activeOpacity={0.7}
          disabled={downloading}
          onPress={() => onDownload(item)}
        >
          {downloading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Icon name="download-outline" size={18} color={colors.primary} />
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function renderGridItem({
  item,
  downloadingId,
  onDownload,
  onOpenFolder,
  onToggleSelection,
  selected,
  selectionMode,
}: {
  item: RemoteResourceItem;
  downloadingId: string | null;
  onDownload: (item: RemoteResourceItem) => void;
  onOpenFolder: (item: RemoteResourceItem) => void;
  onToggleSelection: (item: RemoteResourceItem) => void;
  selected: boolean;
  selectionMode: boolean;
}) {
  const folder = isFolder(item);
  const iconConfig = getItemIcon(item);
  const downloading = downloadingId === item.resourceId;

  return (
    <View style={styles.gridCard}>
      <TouchableOpacity
        style={styles.gridPreview}
        activeOpacity={folder || selectionMode ? 0.7 : 1}
        onPress={() => {
          if (folder) onOpenFolder(item);
          if (!folder && selectionMode) onToggleSelection(item);
        }}
      >
        <View style={[styles.gridIconWrapper, iconConfig.style]}>
          <Icon name={iconConfig.name} size={26} color={iconConfig.color} />
        </View>
        {selectionMode && !folder ? (
          <SelectionMark
            selected={selected}
            onPress={() => onToggleSelection(item)}
            style={styles.gridSelectionMark}
          />
        ) : null}
        {!selectionMode && !folder ? (
          <TouchableOpacity
            style={styles.gridDownloadButton}
            activeOpacity={0.7}
            disabled={downloading}
            onPress={() => onDownload(item)}
          >
            {downloading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Icon name="download-outline" size={15} color={colors.primary} />
            )}
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
      <Text style={styles.gridName} numberOfLines={2}>
        {item.displayName}
      </Text>
      <Text style={styles.gridMeta} numberOfLines={1}>
        {folder ? getItemMeta(item) : formatBytes(item.fileSize ?? 0)}
      </Text>
    </View>
  );
}

function SelectionMark({
  selected,
  onPress,
  style,
}: {
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      style={[styles.selectionMark, selected ? styles.selectionMarkActive : null, style]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {selected ? <Icon name="checkmark" size={14} color="#FFFFFF" /> : null}
    </TouchableOpacity>
  );
}

function EmptyState({
  queryActive,
  currentFolder,
}: {
  queryActive: boolean;
  currentFolder: FolderCrumb | null;
}) {
  if (queryActive) {
    return (
      <View style={styles.centeredCard}>
        <Icon name="search-outline" size={24} color="#9AA3AE" />
        <Text style={styles.centeredTitle}>没有匹配结果</Text>
        <Text style={styles.centeredSubtitle}>换个关键词再试一次</Text>
      </View>
    );
  }

  if (currentFolder) {
    return (
      <View style={styles.centeredCard}>
        <Icon name="folder-open-outline" size={28} color="#9AA3AE" />
        <Text style={styles.centeredTitle}>空文件夹</Text>
        <Text style={styles.centeredSubtitle}>
          这个目录暂时没有可下载或分享的文件。
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.centeredCard}>
      <Icon name="document-outline" size={28} color="#9AA3AE" />
      <Text style={styles.centeredTitle}>暂无文件</Text>
      <Text style={styles.centeredSubtitle}>
        电脑端还没有开放可访问的文件目录。
      </Text>
    </View>
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

function ShareSheet({
  visible,
  selectedCount,
  onClose,
}: {
  visible: boolean;
  selectedCount: number;
  onClose: () => void;
}) {
  const targets = ['微信', 'QQ', '企业微信', '更多'];

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
        <View style={styles.shareCard}>
          <Text style={styles.shareTitle}>分享所选文件</Text>
          <Text style={styles.shareSubtitle}>已选择 {selectedCount} 个文件</Text>
          <View style={styles.shareTargets}>
            {targets.map(target => (
              <TouchableOpacity
                key={target}
                style={styles.shareTarget}
                activeOpacity={0.7}
                onPress={onClose}
              >
                <View style={styles.shareTargetIcon}>
                  <Text style={styles.shareTargetMark}>{target.slice(0, 2)}</Text>
                </View>
                <Text style={styles.shareTargetText}>{target}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
    gap: 12,
    marginTop: 18,
    marginBottom: 14,
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
  selectionButton: {
    minWidth: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: 'rgba(255,255,255,0.58)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    ...glassShadow,
  },
  selectionButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  selectionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#59616D',
  },
  selectionButtonActiveText: {
    color: '#FFFFFF',
  },
  searchBox: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: 'rgba(255,255,255,0.50)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    ...glassShadow,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    padding: 0,
    fontSize: 13,
    color: colors.foreground,
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
  layoutToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.58)',
    padding: 4,
  },
  layoutButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  layoutButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonSecondary: {
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.74)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonDisabled: {
    backgroundColor: '#E5ECF4',
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionButtonSecondaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  actionButtonDisabledText: {
    color: '#9AA3AE',
  },
  listContent: {
    paddingBottom: 34,
  },
  gridContent: {
    gap: 10,
  },
  gridRow: {
    gap: 10,
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
  gridCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: 'rgba(255,255,255,0.50)',
    padding: 8,
    ...glassShadow,
  },
  gridPreview: {
    position: 'relative',
    aspectRatio: 1,
    marginBottom: 8,
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
  gridIconWrapper: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  folderIcon: {
    backgroundColor: '#FFF2C7',
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
    color: '#59616D',
  },
  iconActionButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.64)',
  },
  selectionMark: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C9D6E4',
    backgroundColor: 'rgba(255,255,255,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionMarkActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  gridSelectionMark: {
    position: 'absolute',
    right: 4,
    top: 4,
  },
  gridDownloadButton: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  gridName: {
    minHeight: 32,
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  gridMeta: {
    marginTop: 2,
    fontSize: 9,
    color: '#7B8490',
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
  disconnectedIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  retryButton: {
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 3,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
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
  shareCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    ...glassShadow,
  },
  shareTitle: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  shareSubtitle: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 11,
    color: '#59616D',
  },
  shareTargets: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  shareTarget: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  shareTargetIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E4F5FF',
  },
  shareTargetMark: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  shareTargetText: {
    fontSize: 11,
    color: '#59616D',
  },
});
