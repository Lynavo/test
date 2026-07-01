const mockGetAutoUploadConfig = jest.fn();
const mockResumeAutoUpload = jest.fn();
const mockDisableAutoUpload = jest.fn();
const mockGetAlbumStats = jest.fn();
const mockRequestPhotoPermission = jest.fn();
const mockNotificationPermissionCheck = jest.fn();
const mockNotificationPermissionRequest = jest.fn();
const mockAsyncStorageGetItem = jest.fn();
const mockAsyncStorageSetItem = jest.fn();
const mockAsyncStorageRemoveItem = jest.fn();
let mockPlatformOS = 'ios';
let mockPlatformVersion: string | number = '17.0';

function readNativeSyncEngineSource(): string {
  const { readFileSync } = jest.requireActual('fs') as {
    readFileSync: (path: string, encoding: 'utf8') => string;
  };
  const { process } = globalThis as unknown as {
    process: { cwd: () => string };
  };
  return readFileSync(
    `${process.cwd()}/android/app/src/main/java/com/lynavo/drive/mobile/sync/NativeSyncEngineModule.kt`,
    'utf8',
  );
}

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
    get Version() {
      return mockPlatformVersion;
    },
  },
  PermissionsAndroid: {
    PERMISSIONS: {
      POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
    },
    RESULTS: {
      GRANTED: 'granted',
    },
    check: (...args: unknown[]) => mockNotificationPermissionCheck(...args),
    request: (...args: unknown[]) => mockNotificationPermissionRequest(...args),
  },
  NativeModules: {
    NativeSyncEngine: {
      getAutoUploadConfig: (...args: unknown[]) =>
        mockGetAutoUploadConfig(...args),
      resumeAutoUpload: (...args: unknown[]) => mockResumeAutoUpload(...args),
      disableAutoUpload: (...args: unknown[]) => mockDisableAutoUpload(...args),
      getAlbumStats: (...args: unknown[]) => mockGetAlbumStats(...args),
      requestPhotoPermission: (...args: unknown[]) =>
        mockRequestPhotoPermission(...args),
    },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockAsyncStorageGetItem(...args),
    setItem: (...args: unknown[]) => mockAsyncStorageSetItem(...args),
    removeItem: (...args: unknown[]) => mockAsyncStorageRemoveItem(...args),
  },
}));

import {
  clearAutoUploadSessionForTest,
  clearRememberedAutoUploadRoundProgressForTest,
} from '../../utils/autoUploadRoundProgress';
import { disableAutoUpload, enableAutoUpload } from '../SyncEngineModule';

describe('SyncEngineModule auto upload session baseline', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockPlatformOS = 'ios';
    mockPlatformVersion = '17.0';
    mockGetAutoUploadConfig.mockResolvedValue({
      enabled: false,
      state: 'disabled',
      timeRangeMode: 'all',
    });
    mockResumeAutoUpload.mockResolvedValue(undefined);
    mockDisableAutoUpload.mockResolvedValue(undefined);
    mockRequestPhotoPermission.mockResolvedValue('granted');
    mockGetAlbumStats.mockResolvedValue({
      totalCount: 10,
      transferredCount: 4,
      queuedCount: 0,
      pendingCount: 6,
    });
    mockAsyncStorageGetItem.mockResolvedValue(null);
    mockAsyncStorageSetItem.mockResolvedValue(undefined);
    mockAsyncStorageRemoveItem.mockResolvedValue(undefined);
    mockNotificationPermissionCheck.mockResolvedValue(true);
    mockNotificationPermissionRequest.mockResolvedValue('granted');
    await clearAutoUploadSessionForTest();
    clearRememberedAutoUploadRoundProgressForTest();
    jest.clearAllMocks();
  });

  it('still enables native auto upload when baseline persistence fails', async () => {
    mockAsyncStorageSetItem.mockRejectedValueOnce(new Error('disk full'));

    await expect(enableAutoUpload()).resolves.toBeUndefined();

    expect(mockResumeAutoUpload).toHaveBeenCalledTimes(1);
  });

  it('still enables native auto upload when config read fails', async () => {
    mockGetAutoUploadConfig.mockRejectedValueOnce(new Error('config busy'));

    await expect(enableAutoUpload()).resolves.toBeUndefined();

    expect(mockResumeAutoUpload).toHaveBeenCalledTimes(1);
  });

  it('requests Android photo permission before enabling native auto upload', async () => {
    mockPlatformOS = 'android';
    mockPlatformVersion = 33;

    await expect(enableAutoUpload()).resolves.toBeUndefined();

    expect(mockRequestPhotoPermission).toHaveBeenCalledTimes(1);
    expect(mockNotificationPermissionRequest).not.toHaveBeenCalled();
    expect(mockResumeAutoUpload).toHaveBeenCalledTimes(1);
    expect(mockRequestPhotoPermission.mock.invocationCallOrder[0]).toBeLessThan(
      mockResumeAutoUpload.mock.invocationCallOrder[0],
    );
  });

  it('does not enable native auto upload when Android photo permission is denied', async () => {
    mockPlatformOS = 'android';
    mockRequestPhotoPermission.mockResolvedValueOnce('denied');

    await expect(enableAutoUpload()).rejects.toThrow(
      'Android photo library access is required for auto upload',
    );

    expect(mockResumeAutoUpload).not.toHaveBeenCalled();
  });

  it('does not request Android notification permission before foreground LAN auto upload', async () => {
    mockPlatformOS = 'android';
    mockPlatformVersion = 33;
    mockNotificationPermissionCheck.mockResolvedValueOnce(false);
    mockNotificationPermissionRequest.mockResolvedValueOnce('denied');

    await expect(enableAutoUpload()).resolves.toBeUndefined();

    expect(mockNotificationPermissionCheck).not.toHaveBeenCalled();
    expect(mockNotificationPermissionRequest).not.toHaveBeenCalled();
    expect(mockResumeAutoUpload).toHaveBeenCalledTimes(1);
  });

  it('keeps native foreground LAN rounds running when Android foreground service is unavailable', () => {
    const nativeSource = readNativeSyncEngineSource();

    expect(nativeSource).toContain(
      'foreground service unavailable; continuing foreground LAN round',
    );
    expect(nativeSource).not.toContain(
      'round aborted reason=$reason foregroundServiceAvailable=false',
    );
  });

  it('still resolves disable when baseline cleanup fails after native disables', async () => {
    mockAsyncStorageRemoveItem.mockRejectedValueOnce(new Error('storage down'));

    await expect(disableAutoUpload()).resolves.toBeUndefined();

    expect(mockDisableAutoUpload).toHaveBeenCalledTimes(1);
  });
});
