const mockGetAndroidBackgroundKeepaliveStatus = jest.fn();
const mockIsIgnoringBatteryOptimizations = jest.fn();
const mockRequestIgnoreBatteryOptimizations = jest.fn();

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
  NativeModules: {
    NativeSyncEngine: {
      getAndroidBackgroundKeepaliveStatus: (...args: unknown[]) =>
        mockGetAndroidBackgroundKeepaliveStatus(...args),
      isIgnoringBatteryOptimizations: (...args: unknown[]) =>
        mockIsIgnoringBatteryOptimizations(...args),
      requestIgnoreBatteryOptimizations: (...args: unknown[]) =>
        mockRequestIgnoreBatteryOptimizations(...args),
    },
  },
}));

import {
  getAndroidBackgroundKeepaliveStatus,
  isIgnoringBatteryOptimizations,
  requestIgnoreBatteryOptimizations,
} from '../SyncEngineModule';

describe('SyncEngineModule Android keepalive bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns foreground service and policy diagnostics from native', async () => {
    mockGetAndroidBackgroundKeepaliveStatus.mockResolvedValueOnce({
      backgroundKeepaliveStrategy:
        'android_cn_foreground_service_battery_whitelist',
      foregroundServiceActive: true,
      foregroundServiceStopRequested: false,
      batteryOptimizationIgnored: true,
      postNotificationsGranted: true,
      lastBackgroundStopReason: null,
    });

    await expect(getAndroidBackgroundKeepaliveStatus()).resolves.toEqual({
      backgroundKeepaliveStrategy:
        'android_cn_foreground_service_battery_whitelist',
      foregroundServiceActive: true,
      foregroundServiceStopRequested: false,
      batteryOptimizationIgnored: true,
      postNotificationsGranted: true,
      lastBackgroundStopReason: null,
    });
  });

  it('normalizes battery optimization bridge results to booleans', async () => {
    mockIsIgnoringBatteryOptimizations.mockResolvedValueOnce(1);
    mockRequestIgnoreBatteryOptimizations.mockResolvedValueOnce(0);

    await expect(isIgnoringBatteryOptimizations()).resolves.toBe(true);
    await expect(requestIgnoreBatteryOptimizations()).resolves.toBe(false);
  });
});
