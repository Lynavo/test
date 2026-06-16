import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { Icon } from '../components/Icon';
import { GlobalGradientBackground } from '../components/GlobalGradientBackground';
import { enableAutoUpload } from '../services/SyncEngineModule';

type AutoUploadRange = 'all' | 'now' | 'custom';

interface MockFile {
  name: string;
  size: number;
}

const BLUE = '#3B9FD8';
const DARK = '#1A3A5C';
const GLOBAL_COPY = {
  title: '自动上传',
  subtitle: '设置手机内容同步到电脑',
  planTitle: '同步计划',
  sourcesTitle: '同步来源',
  albumTitle: '照片和视频',
  albumDesc: '同步系统相册中的媒体内容',
  fileTitle: '指定文件',
  fileDescEmpty: '从系统文件中选择需要同步的内容',
  addFile: '添加',
  addMoreFiles: '继续添加',
  selectedFilesTitle: '已选文件',
  clearFiles: '清空',
  rangeTitle: '同步范围',
  rangeAllTitle: '全部内容',
  rangeAllDesc: '同步现有照片和视频',
  rangeNowTitle: '从现在开始',
  rangeNowDesc: '仅同步后续新增内容',
  rangeCustomTitle: '自定义时间',
  rangeCustomDesc: '按指定时间起点同步',
  confirmEnable: '开启自动上传',
  customPickerSave: '保存',
  infoAlbum: '相册照片和视频将同步到电脑。',
  infoEmpty: '请选择至少一个同步来源。',
};

export function AutoUploadSettingsGlobalScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();

  const [albumEnabled, setAlbumEnabled] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<MockFile[]>([]);
  const [uploadRange, setUploadRange] = useState<AutoUploadRange>('all');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDate, setCustomDate] = useState<Date>(new Date());
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const fileSourceSelected = selectedFiles.length > 0;
  const canConfirm = albumEnabled;

  const handleAddMockFile = () => {
    const mockFileNames = [
      'ViviDrop_Readme.pdf',
      'SyncFlow_Overview.docx',
      'SyncFlow_Logo.png',
      'Vacation_Photo.jpg',
      'Project_Spec.pdf',
    ];
    const randomName =
      mockFileNames[Math.floor(Math.random() * mockFileNames.length)];
    const randomSize =
      Math.floor(Math.random() * 10 * 1024 * 1024) + 100 * 1024; // 100KB - 10MB
    setSelectedFiles(prev => [...prev, { name: randomName, size: randomSize }]);
  };

  const handleClearFiles = () => {
    setSelectedFiles([]);
  };

  const handleRemoveFile = useCallback((indexToRemove: number) => {
    setSelectedFiles(prev =>
      prev.filter((_, index) => index !== indexToRemove),
    );
  }, []);

  const formatFileSize = (size: number) => {
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
    if (size >= 1024) return `${Math.round(size / 1024)} KB`;
    return `${size} B`;
  };
  const selectedFileSize = selectedFiles.reduce((total, file) => {
    return total + file.size;
  }, 0);
  const selectedFileSizeLabel =
    selectedFiles.length > 0 ? formatFileSize(selectedFileSize) : '0 B';
  const selectedSourceCount =
    (albumEnabled ? 1 : 0) + (fileSourceSelected ? 1 : 0);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'SyncActivity' }],
      }),
    );
  }, [navigation]);

  const handleRangeSelect = (range: AutoUploadRange) => {
    setUploadRange(range);
    if (range === 'custom') {
      setTempDate(customDate);
      setShowDatePicker(true);
    }
  };

  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'set' && selectedDate) {
        setCustomDate(selectedDate);
      }
    } else if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  const handleConfirmDatePicker = () => {
    setCustomDate(tempDate);
    setShowDatePicker(false);
  };

  const handleConfirmSettings = async () => {
    if (!canConfirm || savingRef.current) return;
    savingRef.current = true;
    try {
      setSaving(true);
      // Call native auto upload activation
      await enableAutoUpload();

      Alert.alert(
        t('common.confirm') || '確認',
        t('syncActivity.badges.autoEnabled') || '自動上傳已開啟',
        [
          {
            text: t('common.ok') || '好',
            onPress: () => {
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'SyncActivity' }],
                }),
              );
            },
          },
        ],
      );
    } catch (e) {
      console.warn('[AutoUploadSettings] enableAutoUpload failed:', e);
      Alert.alert(
        t('syncActivity.dialogs.enableAutoFailed.title') || '操作失敗',
        t('syncActivity.dialogs.enableAutoFailed.body') ||
          '無法開啟自動上傳，請稍後重試',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // Render dynamic explanation sentence
  const renderInfoText = () => {
    const fileCount = selectedFiles.length;
    if (albumEnabled && fileSourceSelected) {
      return `相册内容和 ${fileCount} 个文件将同步到电脑。`;
    } else if (albumEnabled) {
      return GLOBAL_COPY.infoAlbum;
    } else if (fileSourceSelected) {
      return `${fileCount} 个文件将同步到电脑。`;
    } else {
      return GLOBAL_COPY.infoEmpty;
    }
  };

  const activeRangeLabel =
    uploadRange === 'all'
      ? GLOBAL_COPY.rangeAllTitle
      : uploadRange === 'now'
        ? GLOBAL_COPY.rangeNowTitle
        : GLOBAL_COPY.rangeCustomTitle;
  const infoText = renderInfoText();

  return (
    <GlobalGradientBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            testID="auto-upload-back"
            style={styles.backButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="返回"
            onPress={handleBack}
          >
            <Icon name="chevron-back" size={20} color={DARK} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>
              {GLOBAL_COPY.title}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {GLOBAL_COPY.subtitle}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.planCard}>
            <View style={styles.planHeaderRow}>
              <View style={styles.planIconBox}>
                <Icon name="cloud-download-outline" size={24} color={BLUE} />
              </View>
              <View style={styles.planTextColumn}>
                <Text style={styles.planTitle}>{GLOBAL_COPY.planTitle}</Text>
                <Text style={styles.planDescription}>{infoText}</Text>
              </View>
            </View>
            <View style={styles.planStatsRow}>
              <View style={styles.planStatItem}>
                <Text style={styles.planStatLabel}>来源</Text>
                <Text style={styles.planStatValue}>{selectedSourceCount}</Text>
              </View>
              <View style={styles.planStatItem}>
                <Text style={styles.planStatLabel}>文件</Text>
                <Text style={styles.planStatValue}>{selectedFiles.length}</Text>
              </View>
              <View style={styles.planStatItem}>
                <Text style={styles.planStatLabel}>范围</Text>
                <Text style={styles.planStatValue} numberOfLines={1}>
                  {activeRangeLabel}
                </Text>
              </View>
            </View>
          </View>

          {/* Synchronize Source */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                {GLOBAL_COPY.sourcesTitle}
              </Text>
              <Text style={styles.sectionMetaText}>{selectedFileSizeLabel}</Text>
            </View>
            <View style={styles.cardContainer}>
              {/* Option 1: Album */}
              <TouchableOpacity
                style={[
                  styles.optionRow,
                  albumEnabled && styles.optionRowActive,
                ]}
                activeOpacity={0.8}
                testID="auto-upload-source-album"
                accessibilityRole="button"
                accessibilityState={{ selected: albumEnabled }}
                onPress={() => setAlbumEnabled(!albumEnabled)}
              >
                <View
                  style={[
                    styles.iconBox,
                    albumEnabled
                      ? styles.iconBoxActive
                      : styles.iconBoxInactive,
                  ]}
                >
                  <Icon
                    name="auto-upload-image"
                    size={20}
                    color={albumEnabled ? '#fff' : '#8AABBD'}
                  />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionTitle}>
                    {GLOBAL_COPY.albumTitle}
                  </Text>
                  <Text style={styles.optionDesc}>
                    {GLOBAL_COPY.albumDesc}
                  </Text>
                </View>
                {albumEnabled && (
                  <View style={styles.checkCircle}>
                    <Icon name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Option 2: Files */}
              <View
                style={[
                  styles.optionContainer,
                  fileSourceSelected && styles.optionRowActive,
                ]}
              >
                <View style={styles.optionRowHeader}>
                  <View
                    style={[
                      styles.iconBox,
                      fileSourceSelected
                        ? styles.iconBoxFileActive
                        : styles.iconBoxInactive,
                    ]}
                  >
                    <Icon
                      name="auto-upload-file"
                      size={20}
                      color={fileSourceSelected ? '#fff' : '#8AABBD'}
                    />
                  </View>
                  <View style={styles.optionInfo}>
                    <Text style={styles.optionTitle}>
                      {GLOBAL_COPY.fileTitle}
                    </Text>
                    <Text style={styles.optionDesc}>
                      {fileSourceSelected
                        ? `${selectedFiles.length} 个文件 · ${selectedFileSizeLabel}`
                        : GLOBAL_COPY.fileDescEmpty}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.addFileButton,
                      fileSourceSelected && styles.addFileButtonSecondary,
                    ]}
                    activeOpacity={0.8}
                    testID="auto-upload-add-file"
                    accessibilityRole="button"
                    onPress={handleAddMockFile}
                  >
                    <Text
                      style={[
                        styles.addFileButtonText,
                        fileSourceSelected &&
                          styles.addFileButtonTextSecondary,
                      ]}
                    >
                      {fileSourceSelected
                        ? GLOBAL_COPY.addMoreFiles
                        : GLOBAL_COPY.addFile}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Selected Files Preview List */}
                {fileSourceSelected && (
                  <View style={styles.filesPreviewCard}>
                    <View style={styles.previewHeader}>
                      <Text style={styles.previewHeaderTitle}>
                        {GLOBAL_COPY.selectedFilesTitle}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.6}
                        testID="auto-upload-clear-files"
                        accessibilityRole="button"
                        onPress={handleClearFiles}
                      >
                        <Text style={styles.clearButtonText}>
                          {GLOBAL_COPY.clearFiles}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.previewList}>
                      {selectedFiles.slice(0, 3).map((file, index) => (
                        <View key={index} style={styles.previewItem}>
                          <Icon
                            name="document-text"
                            size={14}
                            color="#746AA8"
                          />
                          <Text
                            style={styles.previewItemName}
                            numberOfLines={1}
                          >
                            {file.name}
                          </Text>
                          <Text style={styles.previewItemSize}>
                            {formatFileSize(file.size)}
                          </Text>
                          <TouchableOpacity
                            activeOpacity={0.65}
                            accessibilityRole="button"
                            accessibilityLabel="移除文件"
                            testID={`auto-upload-remove-file-${index}`}
                            onPress={() => handleRemoveFile(index)}
                            style={styles.previewRemoveButton}
                          >
                            <Icon name="close" size={12} color="#7B8490" />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {selectedFiles.length > 3 && (
                        <Text style={styles.previewMoreText}>
                          {`另有 ${selectedFiles.length - 3} 个文件`}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Upload Range */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, styles.standaloneSectionTitle]}>
              {GLOBAL_COPY.rangeTitle}
            </Text>
            <View style={styles.cardContainer}>
              {/* Option: All */}
              <TouchableOpacity
                style={styles.optionRow}
                activeOpacity={0.8}
                testID="auto-upload-range-all"
                accessibilityRole="button"
                accessibilityState={{ selected: uploadRange === 'all' }}
                onPress={() => handleRangeSelect('all')}
              >
                <View
                  style={[
                    styles.iconBox,
                    uploadRange === 'all'
                      ? styles.iconBoxActive
                      : styles.iconBoxInactive,
                  ]}
                >
                  <Icon
                    name="auto-upload-folder"
                    size={18}
                    color={uploadRange === 'all' ? '#fff' : '#8AABBD'}
                  />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionTitle}>
                    {GLOBAL_COPY.rangeAllTitle}
                  </Text>
                  <Text style={styles.optionDesc}>
                    {GLOBAL_COPY.rangeAllDesc}
                  </Text>
                </View>
                {uploadRange === 'all' && (
                  <View style={styles.checkCircle}>
                    <Icon name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Option: Now */}
              <TouchableOpacity
                style={styles.optionRow}
                activeOpacity={0.8}
                testID="auto-upload-range-now"
                accessibilityRole="button"
                accessibilityState={{ selected: uploadRange === 'now' }}
                onPress={() => handleRangeSelect('now')}
              >
                <View
                  style={[
                    styles.iconBox,
                    uploadRange === 'now'
                      ? styles.iconBoxActive
                      : styles.iconBoxInactive,
                  ]}
                >
                  <Icon
                    name="auto-upload-clock"
                    size={18}
                    color={uploadRange === 'now' ? '#fff' : '#8AABBD'}
                  />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionTitle}>
                    {GLOBAL_COPY.rangeNowTitle}
                  </Text>
                  <Text style={styles.optionDesc}>
                    {GLOBAL_COPY.rangeNowDesc}
                  </Text>
                </View>
                {uploadRange === 'now' && (
                  <View style={styles.checkCircle}>
                    <Icon name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Option: Custom */}
              <TouchableOpacity
                style={styles.optionRow}
                activeOpacity={0.8}
                testID="auto-upload-range-custom"
                accessibilityRole="button"
                accessibilityState={{ selected: uploadRange === 'custom' }}
                onPress={() => handleRangeSelect('custom')}
              >
                <View
                  style={[
                    styles.iconBox,
                    uploadRange === 'custom'
                      ? styles.iconBoxActive
                      : styles.iconBoxInactive,
                  ]}
                >
                  <Icon
                    name="auto-upload-calendar"
                    size={18}
                    color={uploadRange === 'custom' ? '#fff' : '#8AABBD'}
                  />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionTitle}>
                    {GLOBAL_COPY.rangeCustomTitle}
                  </Text>
                  <Text style={styles.optionDesc}>
                    {GLOBAL_COPY.rangeCustomDesc}
                  </Text>
                </View>
                {uploadRange === 'custom' ? (
                  <View style={styles.checkCircle}>
                    <Icon name="checkmark" size={12} color="#fff" />
                  </View>
                ) : (
                  <Icon name="chevron-forward" size={14} color="#8aabbd" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoIconBox}>
              <Icon
                name="shield-checkmark-outline"
                size={18}
                color="#AD761D"
              />
            </View>
            <Text style={styles.infoText}>{infoText}</Text>
          </View>

        </ScrollView>

        <View style={styles.bottomActionBar}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              (!canConfirm || saving) && styles.confirmButtonDisabled,
            ]}
            activeOpacity={0.8}
            disabled={!canConfirm || saving}
            testID="auto-upload-confirm"
            accessibilityRole="button"
            accessibilityState={{
              disabled: !canConfirm || saving,
              busy: saving,
            }}
            onPress={handleConfirmSettings}
          >
            <Text style={styles.confirmButtonText}>
              {GLOBAL_COPY.confirmEnable}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Date Picker Modal for iOS / Modal structure for Android */}
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="fade" visible={showDatePicker}>
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerCard}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.pickerCancelText}>
                    {t('common.cancel') || '取消'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={handleConfirmDatePicker}
                >
                  <Text style={styles.pickerConfirmText}>
                    {GLOBAL_COPY.customPickerSave}
                  </Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="datetime"
                display="spinner"
                onChange={handleDateChange}
                style={styles.datePicker}
              />
            </View>
          </View>
        </Modal>
      )}

      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={customDate}
          mode="datetime"
          display="default"
          onChange={handleDateChange}
        />
      )}
    </GlobalGradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: 'rgba(255,255,255,0.54)',
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 38,
    elevation: 2,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.62)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#17191C',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#59616D',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  planCard: {
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    padding: 16,
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    elevation: 2,
  },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  planIconBox: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#E4F5FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  planTextColumn: {
    flex: 1,
    minWidth: 0,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17191C',
  },
  planDescription: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 20,
    color: '#3F4A58',
  },
  planStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  planStatItem: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(255,255,255,0.62)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  planStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7B8490',
  },
  planStatValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#17191C',
  },
  section: {
    marginTop: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7B8490',
  },
  standaloneSectionTitle: {
    marginBottom: 10,
  },
  sectionMetaText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9AA3AE',
  },
  cardContainer: {
    gap: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: 'rgba(255,255,255,0.50)',
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 34,
    elevation: 1,
  },
  optionRowActive: {
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderColor: 'rgba(22,119,210,0.18)',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBoxActive: {
    backgroundColor: '#1677D2',
  },
  iconBoxFileActive: {
    backgroundColor: '#746AA8',
  },
  iconBoxInactive: {
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  optionInfo: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#17191C',
  },
  optionDesc: {
    fontSize: 11,
    lineHeight: 18,
    color: '#59616D',
    marginTop: 4,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#1677D2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionContainer: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: 'rgba(255,255,255,0.50)',
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 34,
    elevation: 1,
  },
  optionRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addFileButton: {
    backgroundColor: '#1677D2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexShrink: 0,
    alignSelf: 'flex-start',
    shadowColor: '#1677D2',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 2,
  },
  addFileButtonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    shadowOpacity: 0,
    elevation: 0,
  },
  addFileButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  addFileButtonTextSecondary: {
    color: '#1677D2',
  },
  filesPreviewCard: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.70)',
    paddingTop: 12,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 2,
  },
  previewHeaderTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3F4A58',
  },
  clearButtonText: {
    fontSize: 11,
    color: '#8AABBD',
    fontWeight: '500',
  },
  previewList: {
    gap: 8,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewItemName: {
    flex: 1,
    fontSize: 11,
    color: '#5A7A96',
  },
  previewItemSize: {
    fontSize: 11,
    color: '#8AABBD',
  },
  previewRemoveButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.58)',
  },
  previewMoreText: {
    fontSize: 11,
    color: '#8AABBD',
    marginTop: 4,
  },
  infoCard: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.50)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 34,
    elevation: 1,
  },
  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF6D8',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 22,
    color: '#3F4A58',
  },
  bottomActionBar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.60)',
    backgroundColor: 'rgba(247,251,255,0.78)',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  confirmButton: {
    backgroundColor: '#1677D2',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1677D2',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 3,
  },
  confirmButtonDisabled: {
    backgroundColor: '#A8B6CC',
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Date Picker iOS styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
  },
  pickerCancelText: {
    fontSize: 15,
    color: '#718096',
  },
  pickerConfirmText: {
    fontSize: 15,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  datePicker: {
    height: 200,
    width: '100%',
  },
});
