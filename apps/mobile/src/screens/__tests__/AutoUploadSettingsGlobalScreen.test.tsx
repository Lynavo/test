import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Text, TouchableOpacity } from 'react-native';
import { enableAutoUpload } from '../../services/SyncEngineModule';

const mockGoBack = jest.fn();
const mockDispatch = jest.fn();
const mockCanGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    reset: jest.fn(payload => ({ type: 'RESET', payload })),
  },
  useNavigation: () => ({
    goBack: mockGoBack,
    dispatch: mockDispatch,
    canGoBack: mockCanGoBack,
  }),
}));

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../components/GlobalGradientBackground', () => ({
  GlobalGradientBackground: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock('../../components/GlobalBottomTabBar', () => ({
  GlobalBottomTabBar: () => {
    const React = require('react');
    const { Text: MockText } = require('react-native');
    return React.createElement(
      MockText,
      { testID: 'mock-bottom-tab-bar' },
      'GlobalBottomTabBar',
    );
  },
}));

jest.mock('../../components/Icon', () => ({
  Icon: ({ name }: { name: string }) => {
    const React = require('react');
    const { Text: MockText } = require('react-native');
    return React.createElement(MockText, null, name);
  },
}));

jest.mock('../../services/SyncEngineModule', () => ({
  enableAutoUpload: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const count = String(params?.count ?? '');
      const size = String(params?.size ?? '');
      const copy: Record<string, string> = {
        'syncActivity.autoUploadSettings.title': '自动上传',
        'syncActivity.autoUploadSettings.confirmEnable': '开启自动上传',
        'syncActivity.autoUploadSettings.sourceAlbumTitle': '照片和视频',
        'syncActivity.autoUploadSettings.sourceAlbumDesc':
          '同步系统相册中的媒体内容',
        'syncActivity.autoUploadSettings.sourceFileTitle': '指定文件',
        'syncActivity.autoUploadSettings.sourceFileDescEmpty':
          '从系统文件中选择需要同步的内容',
        'syncActivity.autoUploadSettings.sourceFileDescSelected': `${count} 个文件 · ${size}`,
        'syncActivity.autoUploadSettings.sourcesTitle': '同步来源',
        'syncActivity.autoUploadSettings.addFile': '添加',
        'syncActivity.autoUploadSettings.addMoreFiles': '继续添加',
        'syncActivity.autoUploadSettings.clearFiles': '清空',
        'syncActivity.autoUploadSettings.addedFilesSummary': '已选文件',
        'syncActivity.autoUploadSettings.addedFilesMore': `另有 ${count} 个文件`,
        'syncActivity.autoUploadSettings.rangeTitle': '同步范围',
        'syncActivity.autoUploadSettings.rangeAllTitle': '全部内容',
        'syncActivity.autoUploadSettings.rangeAllDesc': '同步现有照片和视频',
        'syncActivity.autoUploadSettings.rangeNowTitle': '从现在开始',
        'syncActivity.autoUploadSettings.rangeNowDesc': '仅同步后续新增内容',
        'syncActivity.autoUploadSettings.rangeCustomTitle': '自定义时间',
        'syncActivity.autoUploadSettings.rangeCustomDesc': '按指定时间起点同步',
        'syncActivity.autoUploadSettings.customPickerSave': '保存',
        'syncActivity.autoUploadSettings.infoAlbumAndFileAll': `相册内容和 ${count} 个文件将同步到电脑。`,
        'syncActivity.autoUploadSettings.infoAlbumAll':
          '相册照片和视频将同步到电脑。',
        'syncActivity.autoUploadSettings.infoFileAll': `${count} 个文件将同步到电脑。`,
        'syncActivity.autoUploadSettings.infoEmpty':
          '请选择至少一个同步来源。',
        common: '',
        'common.confirm': '确认',
      };
      return copy[key] ?? '';
    },
  }),
}));

import { AutoUploadSettingsGlobalScreen } from '../AutoUploadSettingsGlobalScreen';

function renderScreen() {
  let tree: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<AutoUploadSettingsGlobalScreen />);
  });
  return tree!;
}

function getTextValues(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.findAllByType(Text).flatMap(node => {
    const value = node.props.children;
    return typeof value === 'string' || typeof value === 'number'
      ? [value]
      : [];
  });
}

function hasTextStartingWith(
  tree: ReactTestRenderer.ReactTestRenderer,
  prefix: string,
) {
  return getTextValues(tree).some(
    value => typeof value === 'string' && value.startsWith(prefix),
  );
}

const mockedEnableAutoUpload = enableAutoUpload as jest.Mock;

describe('AutoUploadSettingsGlobalScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack.mockReturnValue(true);
    mockedEnableAutoUpload.mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the reference-style sync plan summary before source controls', () => {
    const tree = renderScreen();
    const textValues = getTextValues(tree);

    expect(textValues).toContain('同步计划');
    expect(textValues).toContain('相册照片和视频将同步到电脑。');
    expect(textValues).toContain('来源');
    expect(textValues).toContain('文件');
    expect(textValues).toContain('范围');
    expect(textValues).toContain('全部内容');
    expect(textValues).toContain('同步来源');
    expect(textValues).toContain('照片和视频');
    expect(textValues).toContain('同步系统相册中的媒体内容');
    expect(textValues).toContain('指定文件');
    expect(textValues).toContain('从系统文件中选择需要同步的内容');
    expect(textValues).toContain('添加');
    expect(textValues).toContain('同步范围');
    expect(textValues).toContain('同步现有照片和视频');
    expect(textValues).toContain('仅同步后续新增内容');
    expect(textValues).toContain('自定义时间');
    expect(textValues).toContain('按指定时间起点同步');
    expect(textValues).toContain('shield-checkmark-outline');
    expect(textValues).toContain('开启自动上传');
  });

  it('keeps the file add action inline with the specified-file source row', () => {
    const tree = renderScreen();
    const addButton = tree.root.findByProps({
      testID: 'auto-upload-add-file',
    });

    expect(addButton.parent?.props.style).toMatchObject({
      flexDirection: 'row',
      alignItems: 'center',
    });
  });

  it('uses reference-style source and range icons instead of generic ionicons', () => {
    const tree = renderScreen();
    const textValues = getTextValues(tree);

    expect(textValues).toContain('auto-upload-image');
    expect(textValues).toContain('auto-upload-file');
    expect(textValues).toContain('auto-upload-folder');
    expect(textValues).toContain('auto-upload-clock');
    expect(textValues).toContain('auto-upload-calendar');
    expect(textValues).not.toContain('image-outline');
    expect(textValues).not.toContain('folder-outline');
    expect(textValues).not.toContain('time-outline');
    expect(textValues).not.toContain('calendar-outline');
  });

  it('does not render the main tabbar on the auto upload child page', () => {
    const tree = renderScreen();

    expect(
      tree.root.findAllByProps({ testID: 'mock-bottom-tab-bar' }),
    ).toHaveLength(0);
  });

  it('falls back to the sync activity screen when there is no back stack', () => {
    mockCanGoBack.mockReturnValue(false);
    const tree = renderScreen();
    const backButton = tree.root.findAllByType(TouchableOpacity)[0];

    ReactTestRenderer.act(() => {
      backButton.props.onPress();
    });

    expect(mockGoBack).not.toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'RESET',
      payload: {
        index: 0,
        routes: [{ name: 'SyncActivity' }],
      },
    });
  });

  it('exposes the back button for automation and accessibility', () => {
    const tree = renderScreen();

    expect(
      tree.root.findByProps({ testID: 'auto-upload-back' }).props,
    ).toMatchObject({
      accessibilityRole: 'button',
      accessibilityLabel: '返回',
    });
  });

  it('toggles the album source and disables confirm when no real source remains', () => {
    const tree = renderScreen();
    const albumSource = tree.root.findByProps({
      testID: 'auto-upload-source-album',
    });
    const confirmButton = tree.root.findByProps({
      testID: 'auto-upload-confirm',
    });

    expect(albumSource.props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(confirmButton.props.disabled).toBe(false);

    ReactTestRenderer.act(() => {
      albumSource.props.onPress();
    });

    const updatedAlbumSource = tree.root.findByProps({
      testID: 'auto-upload-source-album',
    });
    const updatedConfirmButton = tree.root.findByProps({
      testID: 'auto-upload-confirm',
    });
    expect(updatedAlbumSource.props.accessibilityState).toMatchObject({
      selected: false,
    });
    expect(updatedConfirmButton.props.disabled).toBe(true);
    expect(updatedConfirmButton.props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('keeps mock file rows UI-only and does not enable native auto upload from mock-only state', async () => {
    const tree = renderScreen();

    ReactTestRenderer.act(() => {
      tree.root
        .findByProps({ testID: 'auto-upload-source-album' })
        .props.onPress();
    });
    ReactTestRenderer.act(() => {
      tree.root.findByProps({ testID: 'auto-upload-add-file' }).props.onPress();
    });

    const textValues = getTextValues(tree);
    expect(textValues).toContain('已选文件');
    expect(textValues).toContain('继续添加');
    expect(hasTextStartingWith(tree, '1 个文件 · ')).toBe(true);

    const confirmButton = tree.root.findByProps({
      testID: 'auto-upload-confirm',
    });
    expect(confirmButton.props.disabled).toBe(true);

    await ReactTestRenderer.act(async () => {
      await confirmButton.props.onPress();
    });

    expect(mockedEnableAutoUpload).not.toHaveBeenCalled();
  });

  it('adds and clears mock file rows without changing the real confirm source requirement', () => {
    const tree = renderScreen();

    ReactTestRenderer.act(() => {
      tree.root.findByProps({ testID: 'auto-upload-add-file' }).props.onPress();
    });
    ReactTestRenderer.act(() => {
      tree.root.findByProps({ testID: 'auto-upload-add-file' }).props.onPress();
    });

    expect(getTextValues(tree)).toContain('已选文件');
    expect(hasTextStartingWith(tree, '2 个文件 · ')).toBe(true);

    ReactTestRenderer.act(() => {
      tree.root.findByProps({ testID: 'auto-upload-clear-files' }).props.onPress();
    });

    expect(getTextValues(tree)).not.toContain('已选文件');
    expect(
      tree.root.findByProps({ testID: 'auto-upload-confirm' }).props.disabled,
    ).toBe(false);
  });

  it('removes a single selected file without clearing the rest', () => {
    const tree = renderScreen();

    ReactTestRenderer.act(() => {
      tree.root.findByProps({ testID: 'auto-upload-add-file' }).props.onPress();
    });
    ReactTestRenderer.act(() => {
      tree.root.findByProps({ testID: 'auto-upload-add-file' }).props.onPress();
    });

    expect(hasTextStartingWith(tree, '2 个文件 · ')).toBe(true);

    ReactTestRenderer.act(() => {
      tree.root
        .findByProps({ testID: 'auto-upload-remove-file-0' })
        .props.onPress();
    });

    expect(hasTextStartingWith(tree, '1 个文件 · ')).toBe(true);
    expect(hasTextStartingWith(tree, '2 个文件 · ')).toBe(false);
  });

  it('opens the custom range picker UI when custom range is selected', () => {
    const tree = renderScreen();

    ReactTestRenderer.act(() => {
      tree.root
        .findByProps({ testID: 'auto-upload-range-custom' })
        .props.onPress();
    });

    expect(
      tree.root.findByProps({
        testID: 'auto-upload-range-custom',
      }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(getTextValues(tree)).toContain('保存');
    expect(
      tree.root.findAllByType(
        'DateTimePicker' as unknown as React.ComponentType,
      ),
    ).toHaveLength(1);
  });

  it('guards saving against rapid double submit while enabling auto upload', async () => {
    let resolveEnable: (() => void) | undefined;
    mockedEnableAutoUpload.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveEnable = resolve;
        }),
    );
    const tree = renderScreen();
    const confirmButton = tree.root.findByProps({
      testID: 'auto-upload-confirm',
    });

    await ReactTestRenderer.act(async () => {
      void confirmButton.props.onPress();
      void confirmButton.props.onPress();
      await Promise.resolve();
    });

    expect(mockedEnableAutoUpload).toHaveBeenCalledTimes(1);
    expect(
      tree.root.findByProps({ testID: 'auto-upload-confirm' }).props
        .accessibilityState,
    ).toMatchObject({ busy: true, disabled: true });

    await ReactTestRenderer.act(async () => {
      resolveEnable?.();
      await Promise.resolve();
    });
  });

  it('enables native auto upload with no arguments when the real album source is selected', async () => {
    const tree = renderScreen();

    await ReactTestRenderer.act(async () => {
      await tree.root.findByProps({ testID: 'auto-upload-confirm' }).props.onPress();
    });

    expect(mockedEnableAutoUpload).toHaveBeenCalledTimes(1);
    expect(mockedEnableAutoUpload.mock.calls[0]).toEqual([]);
  });
});
