import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

declare const process: { env: Record<string, string | undefined> };

type TestGlobal = typeof globalThis & { __DEV__?: boolean };
const testGlobal = globalThis as TestGlobal;

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

jest.mock('../bootstrapAuthedSession', () =>
  jest.requireActual('../bootstrapAuthedSession'),
);

jest.mock('../../constants/features', () => ({
  FEATURES: {
    SUBSCRIPTION_ENFORCEMENT: false,
    IAP_ENABLED: false,
    IAP_RESTORE_ENABLED: false,
  },
}));

jest.mock('../../hooks/useIapLifecycle', () => ({
  useIapLifecycle: jest.fn(),
}));

jest.mock('../../services/auth-service', () => ({
  registerAuthStoreActions: jest.fn(),
  getUserProfile: jest.fn().mockResolvedValue({
    id: 7,
    primaryIdentity: { type: 'email', display: 'qa@example.com' },
    identities: [{ type: 'email', display: 'qa@example.com' }],
    status: 'subscribed',
    plan: 'monthly',
    expireAt: '2030-01-01T00:00:00.000Z',
    trialEnd: null,
  }),
}));

jest.mock('../../services/subscription-service', () => ({
  getSubscriptionStatus: jest.fn().mockResolvedValue({
    status: 'subscribed',
    plan: 'monthly',
    expireAt: '2030-01-01T00:00:00.000Z',
    trialEnd: null,
  }),
}));

jest.mock('../../services/SyncEngineModule', () => ({
  getOwnerUserId: jest.fn().mockResolvedValue('7'),
  setOwnerUserId: jest.fn().mockResolvedValue(undefined),
  wipeSyncIdentity: jest.fn().mockResolvedValue(undefined),
  setTunnelCredentials: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/sidecar-reset-service', () => ({
  resetCurrentDesktopSidecarIfReachable: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/clearUserScopedStorage', () => ({
  clearUserScopedStorage: jest.fn().mockResolvedValue(undefined),
}));

import { AuthProvider, useAuth } from '../auth-store';
import { getUserProfile } from '../../services/auth-service';

function AuthProbe() {
  const auth = useAuth();
  return (
    <Text testID="auth-state">
      {JSON.stringify({
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        userId: auth.user?.id ?? null,
      })}
    </Text>
  );
}

describe('AuthProvider visual QA bootstrap', () => {
  const originalDev = testGlobal.__DEV__;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    testGlobal.__DEV__ = true;
    process.env = { ...originalEnv };
    delete process.env.SYNCFLOW_VISUAL_QA;
    delete process.env.SYNCFLOW_VISUAL_QA_EMAIL;
    delete process.env.SYNCFLOW_DEV_SKIP_AUTH;
    delete process.env.SYNCFLOW_DEV_SKIP_AUTH_EMAIL;
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValue(false);
  });

  afterAll(() => {
    testGlobal.__DEV__ = originalDev;
    process.env = originalEnv;
  });

  test('hydrates mock tokens only when enabled and no persisted tokens exist', async () => {
    process.env.SYNCFLOW_VISUAL_QA = '1';
    process.env.SYNCFLOW_VISUAL_QA_EMAIL = 'designer@example.com';

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      const state = JSON.parse(
        screen.getByTestId('auth-state').props.children,
      ) as {
        accessToken: string | null;
        refreshToken: string | null;
        userId: number | null;
      };

      expect(state).toEqual({
        accessToken: 'mock-sandbox-access-token:designer@example.com',
        refreshToken: 'mock-sandbox-refresh-token',
        userId: 7,
      });
    });
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'tokens',
      JSON.stringify({
        access: 'mock-sandbox-access-token:designer@example.com',
        refresh: 'mock-sandbox-refresh-token',
      }),
      expect.any(Object),
    );
    expect(getUserProfile).toHaveBeenCalledTimes(1);
  });

  test('hydrates dev skip-auth tokens without enabling visual QA route mocks', async () => {
    process.env.SYNCFLOW_DEV_SKIP_AUTH = '1';
    process.env.SYNCFLOW_DEV_SKIP_AUTH_EMAIL = 'functional@example.com';
    process.env.SYNCFLOW_VISUAL_QA_ROUTE = 'DeviceDiscovery';

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      const state = JSON.parse(
        screen.getByTestId('auth-state').props.children,
      ) as {
        accessToken: string | null;
        refreshToken: string | null;
        userId: number | null;
      };

      expect(state).toEqual({
        accessToken: 'mock-sandbox-access-token:functional@example.com',
        refreshToken: 'mock-sandbox-refresh-token',
        userId: 7,
      });
    });
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'tokens',
      JSON.stringify({
        access: 'mock-sandbox-access-token:functional@example.com',
        refresh: 'mock-sandbox-refresh-token',
      }),
      expect.any(Object),
    );
  });

  test('does not replace existing persisted tokens', async () => {
    process.env.SYNCFLOW_VISUAL_QA = '1';
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValue({
      username: 'tokens',
      password: JSON.stringify({
        access: 'persisted-access',
        refresh: 'persisted-refresh',
      }),
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      const state = JSON.parse(
        screen.getByTestId('auth-state').props.children,
      ) as {
        accessToken: string | null;
        refreshToken: string | null;
      };

      expect(state.accessToken).toBe('persisted-access');
      expect(state.refreshToken).toBe('persisted-refresh');
    });
    expect(Keychain.setGenericPassword).not.toHaveBeenCalledWith(
      'tokens',
      expect.stringContaining('mock-sandbox-access-token'),
      expect.any(Object),
    );
  });
});
