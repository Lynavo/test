import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { SubscriptionInfo, UserProfile } from '../../stores/auth-store';

import { SettingsGlobalScreen } from '../SettingsGlobalScreen';
import {
  getAppInfo,
  getBindingState,
  getClientDisplayName,
  setClientDisplayName,
  wipeSyncIdentity,
} from '../../services/SyncEngineModule';
import {
  logout as serverLogout,
  deleteAccount,
} from '../../services/auth-service';
import { resetCurrentDesktopSidecarIfReachable } from '../../services/sidecar-reset-service';
import { clearUserScopedStorage } from '../../utils/clearUserScopedStorage';
import {
  resolveLanguagePreference,
  saveLanguagePreference,
} from '../../i18n/language-preference';
import i18n from '../../i18n';
import { iapService } from '../../services/iap-service';

jest.mock('react-native-localize', () => ({
  getLocales: jest.fn(() => [
    {
      languageCode: 'en',
      scriptCode: undefined,
      countryCode: 'US',
      languageTag: 'en-US',
      isRTL: false,
    },
  ]),
}));

const mockNavigate = jest.fn();
const mockClearAuth = jest.fn();
const mockSetSignedOutTransition = jest.fn();
const mockLoadSubscription = jest.fn();

const mockAuth: {
  user: UserProfile | null;
  subscription: SubscriptionInfo | null;
  refreshToken: string | null;
  clearAuth: jest.Mock;
  setSignedOutTransition: jest.Mock;
  loadSubscription: jest.Mock;
} = {
  user: null,
  subscription: null,
  refreshToken: 'refresh-token',
  clearAuth: mockClearAuth,
  setSignedOutTransition: mockSetSignedOutTransition,
  loadSubscription: mockLoadSubscription,
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../stores/auth-store', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('../../services/SyncEngineModule', () => ({
  getBindingState: jest.fn(),
  getClientDisplayName: jest.fn(),
  setClientDisplayName: jest.fn(),
  getAppInfo: jest.fn(),
  wipeSyncIdentity: jest.fn(),
}));

jest.mock('../../services/auth-service', () => ({
  logout: jest.fn(),
  deleteAccount: jest.fn(),
}));

jest.mock('../../services/sidecar-reset-service', () => ({
  resetCurrentDesktopSidecarIfReachable: jest.fn(),
}));

jest.mock('../../utils/clearUserScopedStorage', () => ({
  clearUserScopedStorage: jest.fn(),
}));

jest.mock('../../i18n/language-preference', () => ({
  loadStoredLanguagePreference: jest.fn().mockResolvedValue('system'),
  resolveLanguagePreference: jest.fn().mockReturnValue('en'),
  saveLanguagePreference: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../i18n', () => ({
  __esModule: true,
  default: {
    changeLanguage: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../services/iap-service', () => ({
  iapService: {
    restore: jest.fn(),
  },
}));

jest.mock('../../constants/features', () => ({
  FEATURES: {
    IAP_ENABLED: true,
    IAP_RESTORE_ENABLED: true,
  },
}));

jest.mock('../../components/Icon', () => ({
  Icon: ({ name }: { name: string }) => {
    const ReactInner = require('react');
    const { Text } = require('react-native');
    return ReactInner.createElement(Text, null, name);
  },
}));

jest.mock('lucide-react-native', () => {
  const ReactInner = require('react');
  const { View } = require('react-native');
  const createIcon =
    (fallbackTestID: string) =>
    ({ testID, ...props }: { testID?: string }) =>
      ReactInner.createElement(View, {
        testID: testID ?? fallbackTestID,
        ...props,
      });
  return {
    ArrowUpToLine: createIcon('mock-arrow-up-to-line-icon'),
    Check: createIcon('mock-check-icon'),
    ChevronLeft: createIcon('mock-chevron-left-icon'),
    ChevronRight: createIcon('mock-chevron-right-icon'),
    Crown: createIcon('mock-crown-icon'),
    FolderOpen: createIcon('mock-folder-open-icon'),
    HelpCircle: createIcon('mock-help-circle-icon'),
    Home: createIcon('mock-home-icon'),
    Laptop: createIcon('mock-laptop-icon'),
    Languages: createIcon('mock-languages-icon'),
    LogOut: createIcon('mock-log-out-icon'),
    MessageSquare: createIcon('mock-message-square-icon'),
    Monitor: createIcon('mock-monitor-icon'),
    Pencil: createIcon('mock-pencil-icon'),
    RefreshCw: createIcon('mock-refresh-cw-icon'),
    Smartphone: createIcon('mock-smartphone-icon'),
    Trash2: createIcon('mock-trash-icon'),
    User: createIcon('mock-user-icon'),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockedGetBindingState = getBindingState as jest.MockedFunction<
  typeof getBindingState
>;
const mockedGetClientDisplayName = getClientDisplayName as jest.MockedFunction<
  typeof getClientDisplayName
>;
const mockedSetClientDisplayName = setClientDisplayName as jest.MockedFunction<
  typeof setClientDisplayName
>;
const mockedGetAppInfo = getAppInfo as jest.MockedFunction<typeof getAppInfo>;
const mockedWipeSyncIdentity = wipeSyncIdentity as jest.MockedFunction<
  typeof wipeSyncIdentity
>;
const mockedServerLogout = serverLogout as jest.MockedFunction<
  typeof serverLogout
>;
const mockedDeleteAccount = deleteAccount as jest.MockedFunction<
  typeof deleteAccount
>;
const mockedResetSidecar =
  resetCurrentDesktopSidecarIfReachable as jest.MockedFunction<
    typeof resetCurrentDesktopSidecarIfReachable
  >;
const mockedClearUserScopedStorage =
  clearUserScopedStorage as jest.MockedFunction<typeof clearUserScopedStorage>;
const mockedSaveLanguagePreference =
  saveLanguagePreference as jest.MockedFunction<typeof saveLanguagePreference>;
const mockedResolveLanguagePreference =
  resolveLanguagePreference as jest.MockedFunction<
    typeof resolveLanguagePreference
  >;
const mockedChangeLanguage = i18n.changeLanguage as jest.Mock;
const mockedIapRestore = iapService.restore as jest.MockedFunction<
  typeof iapService.restore
>;

async function renderSettingsGlobalScreen() {
  const screen = render(<SettingsGlobalScreen />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return screen;
}

describe('SettingsGlobalScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.user = {
      id: 1,
      primaryIdentity: { type: 'email', display: 'creator@example.com' },
      identities: [{ type: 'email', display: 'creator@example.com' }],
      status: 'subscribed',
      plan: 'yearly',
      expireAt: '2027-04-01T00:00:00.000Z',
      trialEnd: null,
    };
    mockAuth.subscription = {
      status: 'subscribed',
      plan: 'yearly',
      expireAt: '2027-04-01T00:00:00.000Z',
      trialEnd: null,
    };
    mockAuth.refreshToken = 'refresh-token';
    mockedGetBindingState.mockResolvedValue({
      deviceId: 'desktop-1',
      deviceName: 'Studio Mac',
      deviceAlias: 'Edit Bay',
      host: '192.168.1.20',
      port: 39393,
      connectionState: 'connected',
      pairingId: 'pairing-1',
      shareEnabled: true,
      lastBoundAt: '2026-06-16T00:00:00.000Z',
    });
    mockedGetClientDisplayName.mockResolvedValue('Field iPhone');
    mockedSetClientDisplayName.mockResolvedValue(undefined);
    mockedGetAppInfo.mockResolvedValue({
      appName: 'Vivi Drop',
      version: '3.4.5',
      build: '67',
    });
    mockedWipeSyncIdentity.mockResolvedValue(undefined);
    mockedServerLogout.mockResolvedValue(undefined);
    mockedDeleteAccount.mockResolvedValue(undefined);
    mockedResetSidecar.mockResolvedValue(undefined);
    mockedClearUserScopedStorage.mockResolvedValue(undefined);
    mockedSaveLanguagePreference.mockResolvedValue(undefined);
    mockedResolveLanguagePreference.mockReturnValue('en');
    mockedChangeLanguage.mockResolvedValue(undefined);
    mockedIapRestore.mockResolvedValue([
      { productId: 'vividrop_yearly' } as never,
    ]);
    mockLoadSubscription.mockResolvedValue({
      status: 'subscribed',
      plan: 'yearly',
      expireAt: '2027-04-01T00:00:00.000Z',
      trialEnd: null,
    });
  });

  test('renders account, subscription, current desktop, device name, and version from real state', async () => {
    const { getByText, queryByText } = await renderSettingsGlobalScreen();

    await waitFor(() => expect(getByText('creator@example.com')).toBeTruthy());
    expect(getByText('已订阅 · 年度方案')).toBeTruthy();
    expect(getByText('Edit Bay')).toBeTruthy();
    expect(getByText('当前设备 · 已连接')).toBeTruthy();
    expect(getByText('Field iPhone')).toBeTruthy();
    expect(getByText('版本 3.4.5 (67)')).toBeTruthy();

    expect(queryByText('+1 206 **** 1234')).toBeNull();
    expect(queryByText('Pro Annual · 剩余 28 天')).toBeNull();
    expect(queryByText('MacBook Pro')).toBeNull();
    expect(queryByText('版本 2.1.0')).toBeNull();
  });

  test('uses lucide icons instead of legacy ionicon glyph names on the global settings page', async () => {
    const { queryByText } = await renderSettingsGlobalScreen();

    [
      'person-outline',
      'crown-outline',
      'refresh-outline',
      'phone-portrait-outline',
      'pencil-outline',
      'laptop-outline',
      'desktop-outline',
      'language-outline',
      'help-circle-outline',
      'message-square-outline',
      'cloud-upload-outline',
      'log-out-outline',
      'trash-outline',
      'chevron-forward',
    ].forEach(name => {
      expect(queryByText(name)).toBeNull();
    });
  });

  test('falls back to neutral desktop and version labels when bridge state is unavailable', async () => {
    mockedGetBindingState.mockResolvedValueOnce(null);
    mockedGetAppInfo.mockResolvedValueOnce(null);

    const { getByText } = await renderSettingsGlobalScreen();

    await waitFor(() => expect(getByText('未绑定电脑')).toBeTruthy());
    expect(getByText('尚未连接任何电脑')).toBeTruthy();
    expect(getByText('版本 --')).toBeTruthy();
  });

  test('renders trial, expired, and unknown subscription states from auth snapshots', async () => {
    mockAuth.subscription = {
      status: 'trialing',
      plan: '',
      expireAt: null,
      trialEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const trial = await renderSettingsGlobalScreen();
    expect(trial.getByText(/试用中 · 剩余 \d+ 天/)).toBeTruthy();

    trial.unmount();
    jest.clearAllMocks();
    mockAuth.user = {
      ...mockAuth.user!,
      status: 'sub_expired',
      plan: 'monthly',
      expireAt: '2026-01-01T00:00:00.000Z',
      trialEnd: null,
    };
    mockAuth.subscription = null;
    mockedGetBindingState.mockResolvedValue(null);
    mockedGetClientDisplayName.mockResolvedValue(null);
    mockedGetAppInfo.mockResolvedValue(null);

    const expired = await renderSettingsGlobalScreen();
    expect(expired.getByText('订阅已过期')).toBeTruthy();

    expired.unmount();
    jest.clearAllMocks();
    mockAuth.user = null;
    mockAuth.subscription = null;
    mockedGetBindingState.mockResolvedValue(null);
    mockedGetClientDisplayName.mockResolvedValue(null);
    mockedGetAppInfo.mockResolvedValue(null);

    const unknown = await renderSettingsGlobalScreen();
    expect(unknown.getByText('状态未知')).toBeTruthy();
    expect(unknown.getByText('未登录')).toBeTruthy();
  });

  test('keeps content bottom spacing aligned with the reference page padding', async () => {
    const { getByTestId } = await renderSettingsGlobalScreen();

    const contentStyle = StyleSheet.flatten(
      getByTestId('global-settings-scroll').props.contentContainerStyle,
    );

    expect(contentStyle.paddingBottom).toBe(24);
  });

  test('navigates from reference action rows', async () => {
    const { getByText } = await renderSettingsGlobalScreen();

    fireEvent.press(getByText('会员状态'));
    expect(mockNavigate).toHaveBeenCalledWith('Subscription');

    fireEvent.press(getByText('切换设备'));
    expect(mockNavigate).toHaveBeenCalledWith('DeviceDiscovery', {
      mode: 'switch',
    });

    fireEvent.press(getByText('常见问题'));
    expect(mockNavigate).toHaveBeenCalledWith('Help');
  });

  test('hydrates and persists the device display name through the native bridge', async () => {
    const { getByDisplayValue, getByTestId, getByText, queryByText } =
      await renderSettingsGlobalScreen();

    fireEvent.press(getByTestId('global-settings-edit-device-name'));

    expect(getByText('编辑设备名称')).toBeTruthy();
    fireEvent.changeText(
      getByDisplayValue('Field iPhone'),
      '  Studio iPhone  ',
    );

    await act(async () => {
      fireEvent.press(getByText('保存'));
    });

    expect(mockedSetClientDisplayName).toHaveBeenCalledWith('Studio iPhone');
    expect(getByText('Studio iPhone')).toBeTruthy();
    expect(queryByText('编辑设备名称')).toBeNull();
  });

  test('keeps the edit device modal open when saving the native display name fails', async () => {
    mockedSetClientDisplayName.mockRejectedValueOnce(new Error('bridge down'));
    const { getByDisplayValue, getByTestId, getByText } =
      await renderSettingsGlobalScreen();

    fireEvent.press(getByTestId('global-settings-edit-device-name'));
    fireEvent.changeText(getByDisplayValue('Field iPhone'), 'Studio iPhone');

    await act(async () => {
      fireEvent.press(getByText('保存'));
    });

    expect(getByText('编辑设备名称')).toBeTruthy();
    expect(getByText('保存失败，请稍后重试')).toBeTruthy();
    expect(getByText('Field iPhone')).toBeTruthy();
  });

  test('restores purchases through IAP service and refreshes subscription state', async () => {
    const { getByText, getByTestId } = await renderSettingsGlobalScreen();

    fireEvent.press(getByTestId('global-settings-restore-purchase'));
    await act(async () => {
      fireEvent.press(getByText('恢复购买'));
    });

    expect(mockedIapRestore).toHaveBeenCalledTimes(1);
    expect(mockLoadSubscription).toHaveBeenCalledTimes(1);
    expect(getByText('已恢复订阅并刷新会员状态。')).toBeTruthy();
  });

  test('shows restore purchase failures without pretending success', async () => {
    mockedIapRestore.mockRejectedValueOnce(new Error('store unavailable'));
    const { getByText, getByTestId } = await renderSettingsGlobalScreen();

    fireEvent.press(getByTestId('global-settings-restore-purchase'));
    await act(async () => {
      fireEvent.press(getByText('恢复购买'));
    });

    expect(mockLoadSubscription).not.toHaveBeenCalled();
    expect(getByText('恢复购买失败，请稍后重试。')).toBeTruthy();
  });

  test('only offers supported global languages and persists selected preference', async () => {
    const { getByText, getByTestId, queryByText } =
      await renderSettingsGlobalScreen();

    fireEvent.press(getByTestId('global-settings-language'));

    expect(getByText('跟随系统语言')).toBeTruthy();
    expect(getByText('手动选择语言')).toBeTruthy();
    fireEvent.press(getByText('手动选择语言'));

    expect(getByText('简体中文')).toBeTruthy();
    expect(getByText('繁体中文')).toBeTruthy();
    expect(getByText('English')).toBeTruthy();
    expect(queryByText('日本語')).toBeNull();
    expect(queryByText('한국어')).toBeNull();
    expect(queryByText('Français')).toBeNull();
    expect(queryByText('Español')).toBeNull();
    expect(queryByText('Русский')).toBeNull();

    await act(async () => {
      fireEvent.press(getByText('English'));
    });

    expect(mockedSaveLanguagePreference).toHaveBeenCalledWith('en');
    expect(mockedResolveLanguagePreference).toHaveBeenCalledWith(
      'en',
      expect.any(Array),
    );
    expect(mockedChangeLanguage).toHaveBeenCalledWith('en');

    fireEvent.press(getByTestId('global-language-back'));
    expect(getByText('English')).toBeTruthy();
  });

  test('runs the full logout cleanup flow instead of only clearing auth', async () => {
    const { getByText, getByTestId } = await renderSettingsGlobalScreen();

    fireEvent.press(getByTestId('global-settings-logout'));
    expect(getByText('确定要退出当前账号吗？')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('global-settings-confirm-logout'));
    });

    expect(mockedResetSidecar).toHaveBeenCalledTimes(1);
    expect(mockedWipeSyncIdentity).toHaveBeenCalledTimes(1);
    expect(mockedClearUserScopedStorage).toHaveBeenCalledTimes(1);
    expect(mockedServerLogout).toHaveBeenCalledWith('refresh-token');
    expect(mockSetSignedOutTransition).toHaveBeenCalledWith('logout');
    expect(mockClearAuth).toHaveBeenCalledTimes(1);
  });

  test('does not clear auth when logout cannot wipe native sync identity', async () => {
    mockedWipeSyncIdentity.mockRejectedValueOnce(new Error('wipe failed'));
    const { getByText, getByTestId } = await renderSettingsGlobalScreen();

    fireEvent.press(getByTestId('global-settings-logout'));
    await act(async () => {
      fireEvent.press(getByTestId('global-settings-confirm-logout'));
    });

    expect(mockClearAuth).not.toHaveBeenCalled();
    expect(getByText('退出登录失败，请稍后重试。')).toBeTruthy();
  });

  test('deletes the account on the server before local cleanup and keeps modal open on server failure', async () => {
    const { getByText, getByTestId, queryByText } =
      await renderSettingsGlobalScreen();

    fireEvent.press(getByTestId('global-settings-delete-account'));
    await act(async () => {
      fireEvent.press(getByTestId('global-settings-confirm-delete-account'));
    });

    expect(mockedDeleteAccount).toHaveBeenCalledTimes(1);
    expect(mockedResetSidecar).toHaveBeenCalledTimes(1);
    expect(mockedWipeSyncIdentity).toHaveBeenCalledTimes(1);
    expect(mockedClearUserScopedStorage).toHaveBeenCalledTimes(1);
    expect(mockSetSignedOutTransition).toHaveBeenCalledWith('account_deleted');
    expect(mockClearAuth).toHaveBeenCalledTimes(1);
    expect(queryByText('确定要注销当前账号吗？此操作不可撤销。')).toBeNull();

    mockedDeleteAccount.mockRejectedValueOnce(new Error('server down'));
    mockClearAuth.mockClear();
    const failed = await renderSettingsGlobalScreen();

    fireEvent.press(failed.getByTestId('global-settings-delete-account'));
    await act(async () => {
      fireEvent.press(
        failed.getByTestId('global-settings-confirm-delete-account'),
      );
    });

    expect(mockClearAuth).not.toHaveBeenCalled();
    expect(failed.getByText('注销账号失败，请稍后重试。')).toBeTruthy();
    expect(
      failed.getByText('确定要注销当前账号吗？此操作不可撤销。'),
    ).toBeTruthy();
  });
});
