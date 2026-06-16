import React from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockDispatch = jest.fn();
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn(() => false);
const mockHasSeenUnconnectedGuide = jest.fn().mockResolvedValue(false);
const mockMarkUnconnectedGuideSeen = jest.fn().mockResolvedValue(undefined);
const mockIsVisualQaEnabled = jest.fn(() => false);
let mockRouteParams: { mode?: 'initial' | 'switch' } | undefined = {
  mode: 'initial',
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    canGoBack: mockCanGoBack,
    goBack: mockGoBack,
    navigate: mockNavigate,
    dispatch: mockDispatch,
  }),
  useRoute: () => ({
    params: mockRouteParams,
  }),
  CommonActions: {
    reset: jest.fn(payload => ({ type: 'RESET', payload })),
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-svg', () => {
  const ReactInner = require('react');
  const { View } = require('react-native');
  const createSvgMock =
    (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactInner.createElement(View, { ...props, mockSvgType: name }, children);

  return {
    __esModule: true,
    default: createSvgMock('Svg'),
    Defs: createSvgMock('Defs'),
    Mask: createSvgMock('Mask'),
    Rect: createSvgMock('Rect'),
  };
});

jest.mock('../../components/GlobalGradientBackground', () => ({
  GlobalGradientBackground: ({ children }: { children: React.ReactNode }) => {
    const ReactInner = require('react');
    const { View } = require('react-native');
    return ReactInner.createElement(View, null, children);
  },
}));

jest.mock('../../components/Icon', () => ({
  Icon: ({ name }: { name: string }) => {
    const ReactInner = require('react');
    const { Text } = require('react-native');
    return ReactInner.createElement(Text, null, name);
  },
}));

jest.mock('../../components/shared/NativeModalBlurView', () => ({
  NativeModalBlurView: ({ children, style }: { children?: React.ReactNode; style?: object }) => {
    const ReactInner = require('react');
    const { View } = require('react-native');
    return ReactInner.createElement(View, { style }, children);
  },
}));

jest.mock('../../components/shared/ModalBlurBackdrop', () => ({
  ModalBlurBackdrop: () => {
    const ReactInner = require('react');
    const { View } = require('react-native');
    return ReactInner.createElement(View);
  },
}));

jest.mock('../../utils/onboardingStorage', () => ({
  hasSeenUnconnectedGuide: () => mockHasSeenUnconnectedGuide(),
  markUnconnectedGuideSeen: () => mockMarkUnconnectedGuideSeen(),
}));

jest.mock('../../stores/recent-desktops-store', () => ({
  useRecentDesktops: () => ({
    recentDesktops: [
      {
        desktopDeviceId: 'studio-mac',
        desktopName: 'Studio Mac',
        host: '192.168.31.8',
        port: 39393,
        authorizationStatus: 'authorized',
      },
    ],
    isLoading: false,
    addDesktop: jest.fn(),
    forgetDesktop: jest.fn(),
    updateAuthStatus: jest.fn(),
  }),
}));

jest.mock('../../dev/visualQa', () => ({
  isVisualQaEnabled: () => mockIsVisualQaEnabled(),
}));

import {
  DeviceDiscoveryGlobalScreen,
  resolveConnectionGuideCardPosition,
} from '../DeviceDiscoveryGlobalScreen';

const mockNativeSyncEngine = {
  startDiscovery: jest.fn().mockResolvedValue(undefined),
  stopDiscovery: jest.fn().mockResolvedValue(undefined),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};

function expectPreviewText(screen: ReturnType<typeof render>, text: string) {
  expect(
    screen.getAllByText(text, { includeHiddenElements: true }).length,
  ).toBeGreaterThan(0);
}

describe('DeviceDiscoveryGlobalScreen onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack.mockReturnValue(false);
    mockRouteParams = { mode: 'initial' };
    mockHasSeenUnconnectedGuide.mockResolvedValue(false);
    mockMarkUnconnectedGuideSeen.mockResolvedValue(undefined);
    mockIsVisualQaEnabled.mockReturnValue(false);
    NativeModules.NativeSyncEngine = mockNativeSyncEngine;
    jest
      .spyOn(NativeEventEmitter.prototype, 'addListener')
      .mockReturnValue({ remove: jest.fn() } as any);
  });

  it('keeps the connection device card visible under the first guide step', async () => {
    const screen = render(<DeviceDiscoveryGlobalScreen />);

    await waitFor(() => {
      expect(screen.getByText('先连接电脑')).toBeTruthy();
    });

    expect(screen.getByText('1/6')).toBeTruthy();
    expect(screen.getByText('继续预览')).toBeTruthy();
    expect(screen.getByText('Studio Mac')).toBeTruthy();
    expect(screen.getByText('已发现 1 台')).toBeTruthy();
    expect(screen.queryByText('扫描中...')).toBeNull();
    expect(screen.queryByText('开始使用 Vivi Drop')).toBeNull();
  });

  it('hides the back button in the initial post-login connection flow', async () => {
    const screen = render(<DeviceDiscoveryGlobalScreen />);

    await waitFor(() => {
      expect(screen.getByText('连接你的电脑')).toBeTruthy();
    });

    expect(screen.queryByLabelText('返回')).toBeNull();
    expect(screen.queryByText('chevron-back')).toBeNull();
  });

  it('keeps the back button when switching desktops from an existing session', async () => {
    mockRouteParams = { mode: 'switch' };

    const screen = render(<DeviceDiscoveryGlobalScreen />);

    await waitFor(() => {
      expect(screen.getByText('切换电脑')).toBeTruthy();
    });

    const backButton = screen.getByLabelText('返回');
    expect(backButton).toBeTruthy();
    fireEvent.press(backButton);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('uses formal demo device names in visual QA mode', async () => {
    mockIsVisualQaEnabled.mockReturnValue(true);

    const screen = render(<DeviceDiscoveryGlobalScreen />);

    await waitFor(
      () => {
        expect(screen.getByText('ViviDrop 演示 Mac Studio')).toBeTruthy();
      },
      { timeout: 2000 },
    );

    expect(screen.getByText('ViviDrop 演示 MacBook Pro')).toBeTruthy();
    expect(screen.getByText('ViviDrop 演示 Windows 工作站')).toBeTruthy();
    expect(screen.queryByText('openimdeMac-mini')).toBeNull();
    expect(mockNativeSyncEngine.stopDiscovery).not.toHaveBeenCalled();
    expect(mockNativeSyncEngine.startDiscovery).not.toHaveBeenCalled();
  });

  it('steps through the six feature-entry guide without navigating real pages', async () => {
    const screen = render(<DeviceDiscoveryGlobalScreen />);

    await waitFor(() => {
      expect(screen.getByText('先连接电脑')).toBeTruthy();
    });

    expect(screen.getByText('1/6')).toBeTruthy();
    expect(screen.getByText('继续预览')).toBeTruthy();

    fireEvent.press(screen.getByText('继续预览'));
    await waitFor(() => {
      expect(screen.getByText('开启自动上传')).toBeTruthy();
    });
    expect(screen.getByText('2/6')).toBeTruthy();
    expectPreviewText(screen, '自动同步');
    expectPreviewText(screen, '当前手机状态');
    expectPreviewText(screen, '开启');

    fireEvent.press(screen.getByText('下一步'));
    expect(screen.getByText('选择同步内容和范围')).toBeTruthy();
    expect(screen.getByText('3/6')).toBeTruthy();
    expectPreviewText(screen, '同步计划');
    expectPreviewText(screen, '同步来源');
    expectPreviewText(screen, '照片和视频');
    expectPreviewText(screen, '同步范围');
    expectPreviewText(screen, '全部内容');

    fireEvent.press(screen.getByText('下一步'));
    expect(screen.getByText('查看同步状态')).toBeTruthy();
    expect(screen.getByText('4/6')).toBeTruthy();
    expectPreviewText(screen, '上传中 · 本次传输进度');
    expectPreviewText(screen, '已上传96/128');
    expectPreviewText(screen, '传输速度');
    expectPreviewText(screen, '68.5 MB/s');
    expectPreviewText(screen, '传输进度');
    expectPreviewText(screen, '文件大小');
    expectPreviewText(screen, '剩余时间');
    expectPreviewText(screen, '24 秒');
    expect(screen.queryAllByText('剪辑工作站-A')).toHaveLength(0);

    fireEvent.press(screen.getByText('下一步'));
    expect(screen.getByText('最近下载和同步记录')).toBeTruthy();
    expect(screen.getByText('5/6')).toBeTruthy();
    expectPreviewText(screen, '最近下载');
    expectPreviewText(screen, '查看全部');
    expectPreviewText(screen, '品牌手册.pdf');
    expectPreviewText(screen, 'download-outline');
    expect(screen.queryAllByText('arrow-down-circle-outline')).toHaveLength(0);

    fireEvent.press(screen.getByText('下一步'));
    expect(screen.getByText('远程资源 / 访问电脑')).toBeTruthy();
    expect(screen.getByText('6/6')).toBeTruthy();
    expect(screen.getByText('完成')).toBeTruthy();
    expectPreviewText(screen, '手机同步空间');
    expectPreviewText(screen, '远程访问电脑');

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockMarkUnconnectedGuideSeen).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('完成'));

    await waitFor(() => {
      expect(mockMarkUnconnectedGuideSeen).toHaveBeenCalledTimes(1);
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('marks the guide seen when skipping', async () => {
    const screen = render(<DeviceDiscoveryGlobalScreen />);

    await waitFor(() => {
      expect(screen.getByText('跳过引导')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('跳过引导'));

    await waitFor(() => {
      expect(mockMarkUnconnectedGuideSeen).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText('先连接电脑')).toBeNull();
  });

  it('does not show the guide in switch-desktop mode', async () => {
    mockRouteParams = { mode: 'switch' };

    const screen = render(<DeviceDiscoveryGlobalScreen />);

    await waitFor(() => {
      expect(mockHasSeenUnconnectedGuide).not.toHaveBeenCalled();
    });
    expect(screen.queryByText('先连接电脑')).toBeNull();
  });

  it('does not let guide touches pass through to a real device', async () => {
    const screen = render(<DeviceDiscoveryGlobalScreen />);

    await waitFor(() => {
      expect(screen.getByText('Studio Mac')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Studio Mac'));

    expect(mockMarkUnconnectedGuideSeen).not.toHaveBeenCalled();
    expect(screen.getByText('先连接电脑')).toBeTruthy();
    expect(screen.queryByText('选择连接方式')).toBeNull();
  });

  it('opens the connection modal after the guide is dismissed', async () => {
    const screen = render(<DeviceDiscoveryGlobalScreen />);

    await waitFor(() => {
      expect(screen.getByText('跳过引导')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('跳过引导'));

    await waitFor(() => {
      expect(mockMarkUnconnectedGuideSeen).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(screen.getByText('Studio Mac'));

    expect(screen.queryByText('先连接电脑')).toBeNull();
    expect(screen.getByText('选择连接方式')).toBeTruthy();
  });

  it('places the guide card above a tall spotlight when there is not enough room below', () => {
    const position = resolveConnectionGuideCardPosition({
      hole: {
        x: 8,
        y: 248,
        width: 352,
        height: 400,
      },
      viewportHeight: 800,
      bottomInset: 34,
    });

    expect(position).toMatchObject({
      position: 'absolute',
      left: 16,
      right: 16,
      top: 20,
    });
    expect(position).not.toHaveProperty('bottom');
  });
});
