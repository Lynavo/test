import React from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

const mockDispatch = jest.fn();
const mockHasSeenUnconnectedGuide = jest.fn().mockResolvedValue(false);
const mockMarkUnconnectedGuideSeen = jest.fn().mockResolvedValue(undefined);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    canGoBack: jest.fn(() => false),
    goBack: jest.fn(),
    navigate: jest.fn(),
    dispatch: mockDispatch,
  }),
  useRoute: () => ({
    params: { mode: 'initial' },
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
  isVisualQaEnabled: jest.fn(() => false),
}));

import { DeviceDiscoveryGlobalScreen } from '../DeviceDiscoveryGlobalScreen';

const mockNativeSyncEngine = {
  startDiscovery: jest.fn().mockResolvedValue(undefined),
  stopDiscovery: jest.fn().mockResolvedValue(undefined),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};

describe('DeviceDiscoveryGlobalScreen onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasSeenUnconnectedGuide.mockResolvedValue(false);
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

    expect(screen.getByText('1/8')).toBeTruthy();
    expect(screen.getByText('继续预览')).toBeTruthy();
    expect(screen.getByText('Studio Mac')).toBeTruthy();
    expect(screen.getByText('已发现 1 台')).toBeTruthy();
    expect(screen.queryByText('扫描中...')).toBeNull();
    expect(screen.queryByText('开始使用 Vivi Drop')).toBeNull();
  });
});
