import { NativeModules } from 'react-native';
import {
  applyVisualQaSharedFilesPreviewFlag,
  getDevSkipAuthMockTokens,
  getVisualQaMockTokens,
  isVisualQaHomeEmptyStateEnabled,
  resolveVisualQaInitialRoute,
} from '../visualQa';

declare const process: { env: Record<string, string | undefined> };

type TestGlobal = typeof globalThis & {
  __DEV__?: boolean;
  __LYNAVO_SHARED_FILES_PREVIEW__?: boolean;
};

const testGlobal = globalThis as TestGlobal;

describe('visual QA dev bootstrap', () => {
  const originalDev = testGlobal.__DEV__;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    testGlobal.__DEV__ = true;
    delete NativeModules.NativeMarketConfig;
    delete NativeModules.AppleAuthModule;
    delete testGlobal.__LYNAVO_SHARED_FILES_PREVIEW__;
    process.env = { ...originalEnv };
    delete process.env.LYNAVO_VISUAL_QA;
    delete process.env.LYNAVO_VISUAL_QA_EMAIL;
    delete process.env.LYNAVO_VISUAL_QA_ROUTE;
    delete process.env.LYNAVO_VISUAL_QA_SHARED_FILES_PREVIEW;
    delete process.env.LYNAVO_VISUAL_QA_HOME_EMPTY;
    delete process.env.LYNAVO_DEV_SKIP_AUTH;
    delete process.env.LYNAVO_DEV_SKIP_AUTH_EMAIL;
  });

  afterAll(() => {
    testGlobal.__DEV__ = originalDev;
    process.env = originalEnv;
    delete testGlobal.__LYNAVO_SHARED_FILES_PREVIEW__;
  });

  test('stays disabled outside dev even when env is present', () => {
    testGlobal.__DEV__ = false;
    process.env.LYNAVO_VISUAL_QA = '1';
    process.env.LYNAVO_VISUAL_QA_EMAIL = 'person@example.com';
    process.env.LYNAVO_VISUAL_QA_ROUTE = 'History';
    process.env.LYNAVO_VISUAL_QA_SHARED_FILES_PREVIEW = '1';

    expect(getVisualQaMockTokens()).toBeNull();
    expect(resolveVisualQaInitialRoute()).toBeNull();
    applyVisualQaSharedFilesPreviewFlag();
    expect(testGlobal.__LYNAVO_SHARED_FILES_PREVIEW__).toBeUndefined();
  });

  test('allows native visual QA constants outside dev runtime', () => {
    testGlobal.__DEV__ = false;
    NativeModules.AppleAuthModule = {
      LYNAVO_VISUAL_QA: '1',
      LYNAVO_VISUAL_QA_ROUTE: 'History',
      LYNAVO_VISUAL_QA_SHARED_FILES_PREVIEW: '1',
    };

    expect(getVisualQaMockTokens()).toEqual({
      accessToken: 'mock-sandbox-access-token:qa@example.com',
      refreshToken: 'mock-sandbox-refresh-token',
    });
    expect(resolveVisualQaInitialRoute()).toBe('History');
    applyVisualQaSharedFilesPreviewFlag();
    expect(testGlobal.__LYNAVO_SHARED_FILES_PREVIEW__).toBe(true);
  });

  test('stays disabled in dev when enable env is missing', () => {
    expect(getVisualQaMockTokens()).toBeNull();
    expect(resolveVisualQaInitialRoute()).toBeNull();
  });

  test('builds mock tokens from enabled env and default email', () => {
    process.env.LYNAVO_VISUAL_QA = '1';

    expect(getVisualQaMockTokens()).toEqual({
      accessToken: 'mock-sandbox-access-token:qa@example.com',
      refreshToken: 'mock-sandbox-refresh-token',
    });
  });

  test('prefers native visual QA constants over process env fallback', () => {
    NativeModules.NativeMarketConfig = {
      LYNAVO_VISUAL_QA: '1',
      LYNAVO_VISUAL_QA_EMAIL: 'native@example.com',
      LYNAVO_VISUAL_QA_ROUTE: 'History',
      LYNAVO_VISUAL_QA_SHARED_FILES_PREVIEW: '1',
    };
    process.env.LYNAVO_VISUAL_QA = '0';
    process.env.LYNAVO_VISUAL_QA_EMAIL = 'process@example.com';
    process.env.LYNAVO_VISUAL_QA_ROUTE = 'Settings';

    expect(getVisualQaMockTokens()).toEqual({
      accessToken: 'mock-sandbox-access-token:native@example.com',
      refreshToken: 'mock-sandbox-refresh-token',
    });
    expect(resolveVisualQaInitialRoute()).toBe('History');
    applyVisualQaSharedFilesPreviewFlag();
    expect(testGlobal.__LYNAVO_SHARED_FILES_PREVIEW__).toBe(true);
  });

  test('falls back to AppleAuthModule visual QA constants when market config is absent', () => {
    NativeModules.AppleAuthModule = {
      LYNAVO_VISUAL_QA: '1',
      LYNAVO_VISUAL_QA_ROUTE: 'Settings',
    };

    expect(getVisualQaMockTokens()).toEqual({
      accessToken: 'mock-sandbox-access-token:qa@example.com',
      refreshToken: 'mock-sandbox-refresh-token',
    });
    expect(resolveVisualQaInitialRoute()).toBe('Settings');
  });

  test('reads AppleAuthModule getConstants visual QA constants', () => {
    NativeModules.AppleAuthModule = {
      getConstants: () => ({
        LYNAVO_VISUAL_QA: '1',
        LYNAVO_VISUAL_QA_ROUTE: 'History',
      }),
    };

    expect(getVisualQaMockTokens()).toEqual({
      accessToken: 'mock-sandbox-access-token:qa@example.com',
      refreshToken: 'mock-sandbox-refresh-token',
    });
    expect(resolveVisualQaInitialRoute()).toBe('History');
  });

  test('reads native dev skip-auth constants without enabling visual QA mocks', () => {
    NativeModules.AppleAuthModule = {
      LYNAVO_DEV_SKIP_AUTH: '1',
      LYNAVO_DEV_SKIP_AUTH_EMAIL: 'functional@example.com',
      LYNAVO_VISUAL_QA: '0',
      LYNAVO_VISUAL_QA_ROUTE: 'DeviceDiscovery',
    };

    expect(getDevSkipAuthMockTokens()).toEqual({
      accessToken: 'mock-sandbox-access-token:functional@example.com',
      refreshToken: 'mock-sandbox-refresh-token',
    });
    expect(getVisualQaMockTokens()).toBeNull();
    expect(resolveVisualQaInitialRoute()).toBeNull();
  });

  test('uses requested visual QA email for mock access token', () => {
    process.env.LYNAVO_VISUAL_QA = '1';
    process.env.LYNAVO_VISUAL_QA_EMAIL = 'designer@example.com';

    expect(getVisualQaMockTokens()?.accessToken).toBe(
      'mock-sandbox-access-token:designer@example.com',
    );
  });

  test('accepts only whitelisted authed initial routes', () => {
    process.env.LYNAVO_VISUAL_QA = '1';

    process.env.LYNAVO_VISUAL_QA_ROUTE = 'History';
    expect(resolveVisualQaInitialRoute()).toBe('History');

    process.env.LYNAVO_VISUAL_QA_ROUTE = 'Settings';
    expect(resolveVisualQaInitialRoute()).toBe('Settings');

    process.env.LYNAVO_VISUAL_QA_ROUTE = 'Login';
    expect(resolveVisualQaInitialRoute()).toBeNull();

    process.env.LYNAVO_VISUAL_QA_ROUTE = 'NotARoute';
    expect(resolveVisualQaInitialRoute()).toBeNull();
  });

  test('sets shared files preview flag only when explicitly enabled', () => {
    process.env.LYNAVO_VISUAL_QA = '1';
    applyVisualQaSharedFilesPreviewFlag();
    expect(testGlobal.__LYNAVO_SHARED_FILES_PREVIEW__).toBeUndefined();

    process.env.LYNAVO_VISUAL_QA_SHARED_FILES_PREVIEW = '1';
    applyVisualQaSharedFilesPreviewFlag();
    expect(testGlobal.__LYNAVO_SHARED_FILES_PREVIEW__).toBe(true);
  });

  test('enables home empty-state visual QA only when explicitly requested', () => {
    process.env.LYNAVO_VISUAL_QA = '1';
    expect(isVisualQaHomeEmptyStateEnabled()).toBe(false);

    process.env.LYNAVO_VISUAL_QA_HOME_EMPTY = '1';
    expect(isVisualQaHomeEmptyStateEnabled()).toBe(true);
  });
});
