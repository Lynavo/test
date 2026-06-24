/**
 * RootNavigator — global pairing invalidation routing
 *
 * Verifies the global build invariant:
 *   - native pairing invalidation resets any authenticated route to pairing
 *   - ordinary offline binding state remains an in-app update, not a pairing reset
 *   - cold-start persisted invalidation opens pairing with an explicit reason
 */
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { NativeEventEmitter, NativeModules } from 'react-native';

type NativeListener = (payload: unknown) => void;

let nativeListeners: Record<string, NativeListener> = {};

// ---------------------------------------------------------------------------
// react-native-gesture-handler — must be mocked before @react-navigation/stack
// ---------------------------------------------------------------------------
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) =>
    children,
  PanGestureHandler: ({ children }: { children: React.ReactNode }) => children,
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  State: {},
  Directions: {},
}));

jest.mock('react-native-localize', () => ({
  getLocales: () => [
    {
      languageCode: 'zh',
      scriptCode: 'Hans',
      countryCode: 'CN',
      languageTag: 'zh-Hans-CN',
      isRTL: false,
    },
  ],
}));

jest.mock('../../constants/features', () => ({
  FEATURES: {
    SUBSCRIPTION_ENFORCEMENT: false,
    IAP_ENABLED: false,
    IAP_RESTORE_ENABLED: false,
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const R = require('react');
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  const SafeAreaInsetsContext = R.createContext(insets);
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      R.createElement(
        SafeAreaInsetsContext.Provider,
        { value: insets },
        children,
      ),
    useSafeAreaInsets: () => insets,
    SafeAreaInsetsContext,
    initialWindowMetrics: {
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
      frame: { x: 0, y: 0, width: 390, height: 844 },
    },
  };
});

jest.mock('../../components/Icon', () => ({
  Icon: ({ name }: { name: string }) => {
    const R = require('react');
    const { Text: T } = require('react-native');
    return R.createElement(T, null, name);
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn().mockResolvedValue(false),
  setGenericPassword: jest.fn().mockResolvedValue(true),
  resetGenericPassword: jest.fn().mockResolvedValue(true),
  ACCESSIBLE: {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AfterFirstUnlockThisDeviceOnly',
  },
}));

jest.mock('../../services/iap-service', () => ({
  iapService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    teardown: jest.fn().mockResolvedValue(undefined),
    onOrphanPurchaseVerified: jest.fn(() => jest.fn()),
    checkEligibility: jest.fn().mockResolvedValue([]),
    restore: jest.fn().mockResolvedValue([]),
    getProductSummaries: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../services/SyncEngineModule', () => ({
  PAIRING_INVALIDATED_EVENT: 'onPairingInvalidated',
  PAIRING_INVALIDATED_ROUTE_REASON: 'pairing_invalidated',
  isPairingInvalidatedEvent: (payload: unknown) =>
    payload === null ||
    payload === undefined ||
    (typeof payload === 'object' && !Array.isArray(payload)),
  wipeSyncIdentity: jest.fn(),
  cancelAllManualUploads: jest.fn(),
  interruptAutoUpload: jest.fn(),
  enableAutoUpload: jest.fn(),
  browseAlbum: jest.fn().mockResolvedValue([]),
  getAlbumStats: jest.fn().mockResolvedValue({
    totalCount: 0,
    transferredCount: 0,
    queuedCount: 0,
    pendingCount: 0,
  }),
  submitManualUpload: jest.fn(),
  getAutoUploadConfig: jest.fn().mockResolvedValue({
    enabled: false,
    state: 'disabled',
    timeRangeMode: 'all',
    customTimeFrom: null,
  }),
  saveAutoUploadConfig: jest.fn(),
  getPhotoAuthorizationStatus: jest.fn().mockResolvedValue('authorized'),
  presentLimitedPhotoPicker: jest.fn(),
  getAlbumCollections: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../services/sidecar-reset-service', () => ({
  resetCurrentDesktopSidecarIfReachable: jest.fn(),
}));

jest.mock('../../utils/clearUserScopedStorage', () => ({
  clearUserScopedStorage: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Screen stubs — route params are surfaced as text for assertions.
// ---------------------------------------------------------------------------
jest.mock('../../screens/DeviceDiscoveryGlobalScreen', () => ({
  DeviceDiscoveryGlobalScreen: ({
    route,
  }: {
    route?: { params?: { mode?: string; reason?: string } };
  }) => {
    const R = require('react');
    const { Text } = require('react-native');
    return R.createElement(
      Text,
      { testID: 'global-device-discovery-screen' },
      `GlobalDeviceDiscovery reason=${String(
        route?.params?.reason,
      )} mode=${String(route?.params?.mode)}`,
    );
  },
}));

jest.mock('../../screens/SyncActivityGlobalScreen', () => ({
  SyncActivityGlobalScreen: () => {
    const R = require('react');
    const { Text } = require('react-native');
    return R.createElement(
      Text,
      { testID: 'global-sync-activity-screen' },
      'GlobalSyncActivity',
    );
  },
}));

jest.mock('../../screens/SharedFilesGlobalScreen', () => ({
  SharedFilesGlobalScreen: () => null,
}));
jest.mock('../../screens/PhoneSyncSpaceGlobalScreen', () => ({
  PhoneSyncSpaceGlobalScreen: () => null,
}));
jest.mock('../../screens/RemoteAccessGlobalScreen', () => ({
  RemoteAccessGlobalScreen: () => null,
}));
jest.mock('../../screens/DownloadRecordsGlobalScreen', () => ({
  DownloadRecordsGlobalScreen: () => null,
}));
jest.mock('../../screens/HistoryGlobalScreen', () => ({
  HistoryGlobalScreen: () => null,
}));
jest.mock('../../screens/SettingsGlobalScreen', () => ({
  SettingsGlobalScreen: () => null,
}));
jest.mock('../../screens/HelpGlobalScreen', () => ({
  HelpGlobalScreen: () => null,
}));
jest.mock('../../screens/SubscriptionGlobalScreen', () => ({
  SubscriptionGlobalScreen: () => null,
}));
jest.mock('../../screens/AutoUploadSettingsGlobalScreen', () => ({
  AutoUploadSettingsGlobalScreen: () => null,
}));

jest.mock('../../screens/LoginScreen', () => ({ LoginScreen: () => null }));
jest.mock('../../screens/LoginGlobalScreen', () => ({
  LoginGlobalScreen: () => null,
}));
jest.mock('../../screens/SmsVerifyScreen', () => ({
  SmsVerifyScreen: () => null,
}));
jest.mock('../../screens/DeviceDiscoveryScreen', () => ({
  DeviceDiscoveryScreen: () => null,
}));
jest.mock('../../screens/CodeVerifyScreen', () => ({
  CodeVerifyScreen: () => null,
}));
jest.mock('../../screens/ConnectionTutorialScreen', () => ({
  ConnectionTutorialScreen: () => null,
}));
jest.mock('../../screens/SyncActivityScreen', () => ({
  SyncActivityScreen: () => null,
}));
jest.mock('../../screens/AlbumWorkbenchScreen', () => ({
  AlbumWorkbenchScreen: () => null,
}));
jest.mock('../../screens/SharedFilesScreen', () => ({
  SharedFilesScreen: () => null,
}));
jest.mock('../../screens/PhoneSyncSpaceScreen', () => ({
  PhoneSyncSpaceScreen: () => null,
}));
jest.mock('../../screens/RemoteAccessScreen', () => ({
  RemoteAccessScreen: () => null,
}));
jest.mock('../../screens/HistoryScreen', () => ({ HistoryScreen: () => null }));
jest.mock('../../screens/SettingsScreen', () => ({
  SettingsScreen: () => null,
}));
jest.mock('../../screens/HelpScreen', () => ({ HelpScreen: () => null }));
jest.mock('../../screens/QRScannerScreen', () => ({
  QRScannerScreen: () => null,
}));
jest.mock('../../screens/SubscriptionScreen', () => ({
  SubscriptionScreen: () => null,
}));
jest.mock('../../screens/AutoUploadSettingsScreen', () => ({
  AutoUploadSettingsScreen: () => null,
}));

jest.mock('../../components/auth/AuthScreenShell', () => ({
  AUTH_COLORS: { primary: '#4e8ef7' },
  AuthScreenShell: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../components/GlobalBottomTabBar', () => ({
  GlobalBottomTabBar: () => null,
}));

jest.mock('../../stores/auth-store', () => {
  const actual = jest.requireActual('../../stores/auth-store');
  return {
    ...actual,
    useAuth: jest.fn(),
  };
});

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../../stores/auth-store';
import { RootNavigator } from '../RootNavigator';
import i18n from '../../i18n';

beforeAll(async () => {
  await i18n.changeLanguage('zh-Hans');
});

beforeEach(() => {
  jest.clearAllMocks();
  nativeListeners = {};
  (NativeModules as Record<string, unknown>).AppleAuthModule = {
    SYNCFLOW_MARKET: 'global',
  };
  (NativeModules as Record<string, unknown>).NativeSyncEngine = {
    SYNCFLOW_MARKET: 'global',
    getBindingState: jest.fn().mockResolvedValue({ deviceId: 'desktop-1' }),
    getBindingInvalidationState: jest.fn().mockResolvedValue(null),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  };
  jest
    .spyOn(NativeEventEmitter.prototype, 'addListener')
    .mockImplementation((eventName: string, listener: NativeListener) => {
      nativeListeners[eventName] = listener;
      return { remove: jest.fn() } as never;
    });
  (useAuth as jest.Mock).mockReturnValue({
    isLoggedIn: true,
    isLoading: false,
    user: { id: 1, status: 'subscribed' },
    subscription: {
      status: 'subscribed',
      plan: '',
      expireAt: null,
      trialEnd: null,
    },
    profileLoading: false,
    profileError: null,
    signedOutTransition: null,
    loadSubscription: jest.fn().mockResolvedValue(undefined),
    retryProfileLoad: jest.fn(),
    clearAuth: jest.fn(),
    setSignedOutTransition: jest.fn(),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function renderRootNavigator() {
  return render(
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>,
  );
}

describe('RootNavigator — pairing invalidation', () => {
  test('global authenticated navigation resets when native emits onPairingInvalidated', async () => {
    renderRootNavigator();

    await waitFor(() =>
      expect(screen.getByTestId('global-sync-activity-screen')).toBeTruthy(),
    );

    await act(async () => {
      nativeListeners.onPairingInvalidated?.({ reason: 'desktop_reset_code' });
    });

    await waitFor(() =>
      expect(screen.getByTestId('global-device-discovery-screen')).toBeTruthy(),
    );
    expect(screen.getByText(/reason=pairing_invalidated/)).toBeTruthy();
    expect(screen.queryByTestId('global-sync-activity-screen')).toBeNull();
  });

  test('ordinary offline binding updates do not reset navigation', async () => {
    renderRootNavigator();

    await waitFor(() =>
      expect(screen.getByTestId('global-sync-activity-screen')).toBeTruthy(),
    );

    await act(async () => {
      nativeListeners.onBindingStateChanged?.({
        deviceId: 'desktop-1',
        status: 'offline',
      });
    });

    expect(screen.getByTestId('global-sync-activity-screen')).toBeTruthy();
    expect(screen.queryByTestId('global-device-discovery-screen')).toBeNull();
  });

  test('cold-start native persisted invalidation routes to DeviceDiscovery with reason pairing_invalidated', async () => {
    (
      NativeModules.NativeSyncEngine.getBindingInvalidationState as jest.Mock
    ).mockResolvedValue({ reason: 'desktop_reset_code' });

    renderRootNavigator();

    await waitFor(() =>
      expect(screen.getByTestId('global-device-discovery-screen')).toBeTruthy(),
    );
    expect(screen.getByText(/reason=pairing_invalidated/)).toBeTruthy();
    expect(screen.queryByTestId('global-sync-activity-screen')).toBeNull();
  });
});
