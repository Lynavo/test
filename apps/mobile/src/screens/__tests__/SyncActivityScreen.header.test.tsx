import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import { NativeModules, NativeEventEmitter } from 'react-native';

const mockNavigate = jest.fn();
const mockDispatch = jest.fn();
const originalConsoleError = console.error;
let consoleErrorSpy: jest.SpyInstance;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    dispatch: mockDispatch,
  }),
  useIsFocused: () => true,
  CommonActions: {
    reset: jest.fn(payload => payload),
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'syncActivity.header.help') return 'Help';
      return key;
    },
  }),
}));

jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../components/Icon', () => ({
  Icon: ({ name }: { name: string }) => {
    const ReactInner = require('react');
    const { Text } = require('react-native');
    return ReactInner.createElement(Text, null, name);
  },
}));

jest.mock('../../components/SubscriptionStatusIcon', () => ({
  SubscriptionStatusIcon: () => null,
}));

jest.mock('../../services/SyncEngineModule', () => ({
  cancelAllManualUploads: jest.fn().mockResolvedValue(undefined),
  disableAutoUpload: jest.fn().mockResolvedValue(undefined),
  enableAutoUpload: jest.fn().mockResolvedValue(undefined),
  retryLanReconnect: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../stores/auth-store', () => ({
  useAuth: () => ({
    isLoggedIn: true,
    user: {
      status: 'trialing',
      trialEnd: null,
    },
    subscription: {
      status: 'trialing',
      trialEnd: null,
    },
  }),
  isFeatureAccessAllowed: () => true,
}));

jest.mock('../../constants/features', () => ({
  FEATURES: {
    SUBSCRIPTION_ENFORCEMENT: false,
  },
}));

import { SyncActivityScreen } from '../SyncActivityScreen';
import { retryLanReconnect } from '../../services/SyncEngineModule';

beforeEach(() => {
  jest.clearAllMocks();
  consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation((message?: unknown, ...args: unknown[]) => {
      if (
        typeof message === 'string' &&
        message.includes('not wrapped in act')
      ) {
        return;
      }
      originalConsoleError(message, ...args);
    });

  (NativeModules as Record<string, unknown>).NativeSyncEngine = {
    getBindingState: jest.fn().mockResolvedValue({
      deviceId: 'desktop-1',
      deviceName: 'Mini4',
      connectionState: 'connected',
    }),
    getHistoryDays: jest.fn().mockResolvedValue({ items: [] }),
    getSyncOverview: jest.fn().mockResolvedValue({
      uploadState: 'idle',
      progressPercent: 0,
      currentSpeedMbps: 0,
      completedCount: 0,
      totalCount: 0,
      completedBytes: 0,
      totalBytes: 0,
      currentFileConfirmedBytes: 0,
      currentFileTotalBytes: 0,
      autoUploadState: 'disabled',
      manualPending: 0,
      autoPending: 0,
    }),
    startDiscovery: jest.fn().mockResolvedValue(undefined),
    triggerSync: jest.fn().mockResolvedValue(undefined),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  };

  (NativeEventEmitter as jest.Mock).mockImplementation(() => ({
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  }));
});

afterEach(() => {
  cleanup();
  if (jest.isMockFunction(setTimeout)) {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  }
  consoleErrorSpy.mockRestore();
});

describe('SyncActivityScreen header', () => {
  it('navigates to Help from the header help entry', async () => {
    const screen = render(<SyncActivityScreen />);

    fireEvent.press(screen.getByLabelText('Help'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Help');
    });
  });

  it('uses LAN-only retry when pressing offline reconnect', async () => {
    jest.useFakeTimers();
    (NativeModules.NativeSyncEngine.getBindingState as jest.Mock).mockResolvedValue({
      deviceId: 'desktop-1',
      deviceName: 'Mini4',
      connectionState: 'offline',
    });
    (NativeModules.NativeSyncEngine.getSyncOverview as jest.Mock).mockResolvedValue({
      uploadState: 'offline',
      progressPercent: 0,
      currentSpeedMbps: 0,
      completedCount: 0,
      totalCount: 0,
      completedBytes: 0,
      totalBytes: 0,
      currentFileConfirmedBytes: 0,
      currentFileTotalBytes: 0,
      autoUploadState: 'disabled',
      manualPending: 0,
      autoPending: 0,
      lastErrorCode: 'RECONNECT_EXHAUSTED',
    });

    const screen = render(<SyncActivityScreen />);
    await waitFor(() => {
      expect(screen.getByText('syncActivity.offline.reconnect')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('syncActivity.offline.reconnect'));

    await waitFor(() => {
      expect(retryLanReconnect).toHaveBeenCalledWith({ allowWake: true });
    });
  });
});
