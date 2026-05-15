jest.mock('react-native', () => ({
  NativeModules: {
    NativeSyncEngine: {
      getAppInfo: jest.fn().mockResolvedValue({ version: '1.0.0', build: '9' }),
    },
  },
  Platform: { OS: 'android' },
}));

jest.mock('../../stores/auth-store', () => ({
  getAccessToken: () => 'access-token',
  getRefreshToken: () => null,
}));

jest.mock('../auth-device-id', () => ({
  getOrCreateAuthDeviceId: jest.fn().mockResolvedValue('device-1'),
}));

jest.mock('../config', () => ({
  getBaseUrl: () => 'https://api.test',
  describeInsecureBaseUrl: () => null,
}));

import { clientInfoHeaders } from '../api';

describe('api client headers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('builds app version headers for API requests', async () => {
    await expect(clientInfoHeaders()).resolves.toEqual({
      'X-Client-App': 'vividrop-mobile',
      'X-Client-Platform': 'android',
      'X-Client-Version': '1.0.0',
      'X-Client-Build': '9',
    });
  });
});
