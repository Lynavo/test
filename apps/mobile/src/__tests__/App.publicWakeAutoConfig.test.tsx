import React from 'react';
import { AppState, NativeEventEmitter, NativeModules } from 'react-native';
import type { EmitterSubscription } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { App } from '../App';
import { refreshNativeAppFeatureSettings } from '../services/app-config-service';
import {
  autoConfigurePublicWakeTargetFromBinding,
  autoConfigurePublicWakeTargetFromNativeBinding,
} from '../services/public-wake-auto-config-service';

jest.mock('react-native-localize', () => ({
  getLocales: () => [
    {
      languageCode: 'zh',
      scriptCode: 'Hant',
      countryCode: 'TW',
      languageTag: 'zh-Hant-TW',
      isRTL: false,
    },
  ],
}));

jest.mock('../services/config', () => ({
  loadDebugBaseUrlOverride: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/app-config-service', () => ({
  refreshNativeAppFeatureSettings: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/public-wake-auto-config-service', () => ({
  autoConfigurePublicWakeTargetFromBinding: jest
    .fn()
    .mockResolvedValue({ status: 'skipped', reason: 'binding_unavailable' }),
  autoConfigurePublicWakeTargetFromNativeBinding: jest
    .fn()
    .mockResolvedValue({ status: 'skipped', reason: 'binding_unavailable' }),
}));

jest.mock('../stores/auth-store', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../navigation/RootNavigator', () => ({
  RootNavigator: () => null,
}));

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) =>
    children,
}));

jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) =>
    children,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../i18n/language-preference', () => ({
  loadStoredLanguagePreference: jest.fn().mockResolvedValue('system'),
  resolveLanguagePreference: jest.fn().mockReturnValue('zh-Hant'),
}));

jest.mock('../i18n', () => ({
  __esModule: true,
  default: {
    language: 'zh-Hant',
    changeLanguage: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('App public wake auto config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    NativeModules.NativeSyncEngine = {
      addListener: jest.fn(),
      removeListeners: jest.fn(),
    };
  });

  it('auto-configures public wake target on launch and when the app becomes active', async () => {
    let appStateListener: ((state: AppStateStatus) => void) | null = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(
      (_event, listener) => {
        appStateListener = listener;
        return { remove: jest.fn() } as unknown as EmitterSubscription;
      },
    );

    render(<App />);

    await waitFor(() => {
      expect(refreshNativeAppFeatureSettings).toHaveBeenCalledTimes(1);
      expect(autoConfigurePublicWakeTargetFromNativeBinding).toHaveBeenCalledTimes(
        1,
      );
    });

    await act(async () => {
      appStateListener?.('active');
    });

    await waitFor(() => {
      expect(refreshNativeAppFeatureSettings).toHaveBeenCalledTimes(2);
      expect(autoConfigurePublicWakeTargetFromNativeBinding).toHaveBeenCalledTimes(
        2,
      );
    });
  });

  it('still auto-configures public wake target when feature refresh fails', async () => {
    (refreshNativeAppFeatureSettings as jest.Mock).mockRejectedValueOnce(
      new Error('config unavailable'),
    );

    render(<App />);

    await waitFor(() => {
      expect(refreshNativeAppFeatureSettings).toHaveBeenCalledTimes(1);
      expect(autoConfigurePublicWakeTargetFromNativeBinding).toHaveBeenCalledTimes(
        1,
      );
    });
  });

  it('auto-configures public wake target when native binding becomes LAN connected', async () => {
    let bindingListener: ((state: unknown) => void) | null = null;
    jest.spyOn(NativeEventEmitter.prototype, 'addListener').mockImplementation(
      (eventName, listener) => {
        if (eventName === 'onBindingStateChanged') {
          bindingListener = listener as (state: unknown) => void;
        }
        return { remove: jest.fn() } as unknown as EmitterSubscription;
      },
    );

    render(<App />);

    await waitFor(() => {
      expect(autoConfigurePublicWakeTargetFromNativeBinding).toHaveBeenCalledTimes(
        1,
      );
    });

    const connectedBinding = {
      deviceId: 'desktop-1',
      host: '192.168.1.20',
      connectionState: 'connected',
      wake: {
        supported: true,
        targets: [
          {
            macAddress: 'aa:bb:cc:dd:ee:ff',
            broadcastAddress: '192.168.1.255',
            ports: [9],
          },
        ],
        publicTarget: null,
      },
    };

    await act(async () => {
      bindingListener?.(connectedBinding);
    });

    await waitFor(() => {
      expect(autoConfigurePublicWakeTargetFromNativeBinding).toHaveBeenCalledTimes(
        1,
      );
      expect(autoConfigurePublicWakeTargetFromBinding).toHaveBeenCalledWith(
        connectedBinding,
      );
    });
  });
});
