import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeModules, Alert, Linking, Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { LoginGlobalScreen } from '../LoginGlobalScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

jest.mock('@react-navigation/stack', () => ({}));

jest.mock('../../services/config', () => ({
  getBaseUrl: () => 'https://api.vividrop.com',
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({
      data: { idToken: 'mock-google-id-token' },
    }),
  },
}));

const mockLogin = jest.fn();

jest.mock('../../stores/auth-store', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

const mockAppleLogin = jest.fn();
const mockGoogleLogin = jest.fn();

jest.mock('../../services/auth-service', () => ({
  appleLogin: (args: {
    identityToken: string;
    authorizationCode?: string;
    fullName?: string;
  }) => mockAppleLogin(args),
  googleLogin: (identityToken: string) => mockGoogleLogin(identityToken),
}));

describe('LoginGlobalScreen', () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockAppleLogin.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    mockGoogleLogin.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    NativeModules.AppleAuthModule = {
      login: jest.fn().mockResolvedValue({
        identityToken: 'mock-apple-id-token',
        authorizationCode: 'mock-auth-code',
        fullName: 'Test User',
      }),
    };
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatformOS,
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders the reference global auth landing without phone fallback', () => {
    const { getByText, queryByText, queryByPlaceholderText } = render(
      <LoginGlobalScreen />,
    );

    expect(getByText('ViviDrop')).toBeTruthy();
    expect(getByText('轻量同步素材到电脑端')).toBeTruthy();
    expect(getByText('让手机素材同步变得更安静、更快。')).toBeTruthy();
    expect(
      getByText('连接同一局域网中的电脑，自动上传照片、视频和文件。'),
    ).toBeTruthy();
    expect(getByText('照片')).toBeTruthy();
    expect(getByText('视频')).toBeTruthy();
    expect(getByText('文件')).toBeTruthy();
    expect(getByText('登录或创建账号')).toBeTruthy();
    expect(getByText('使用 Google 继续')).toBeTruthy();
    expect(getByText('使用 Apple 继续')).toBeTruthy();
    expect(getByText('继续即表示你同意', { exact: false })).toBeTruthy();

    expect(queryByText('OR')).toBeNull();
    expect(queryByText(/or phone/i)).toBeNull();
    expect(queryByText(/手机号|验证码|短信|邮箱/)).toBeNull();
    expect(queryByText('Continue')).toBeNull();
    expect(queryByPlaceholderText('Phone number')).toBeNull();
  });

  it('requires terms agreement before provider authorization', () => {
    const { getByText, getByTestId, queryByText } = render(
      <LoginGlobalScreen />,
    );

    fireEvent.press(getByText('使用 Google 继续'));

    expect(getByTestId('global-auth-agreement-modal-backdrop')).toBeTruthy();
    expect(getByTestId('global-auth-agreement-modal-card')).toBeTruthy();
    expect(getByText('请先同意服务协议')).toBeTruthy();
    expect(
      getByText(
        '登录前需要确认你已阅读并同意服务条款和隐私政策，之后可继续使用 Google 授权。',
      ),
    ).toBeTruthy();
    expect(queryByText('Google 授权登录')).toBeNull();
    expect(GoogleSignin.signIn).not.toHaveBeenCalled();
    expect(mockGoogleLogin).not.toHaveBeenCalled();
  });

  it('continues to provider confirmation after accepting terms from the gate', () => {
    const { getByRole, getByText, getByTestId } = render(
      <LoginGlobalScreen />,
    );

    fireEvent.press(getByText('使用 Apple 继续'));
    fireEvent.press(getByText('同意并继续'));

    expect(getByRole('checkbox').props.accessibilityState).toEqual({
      checked: true,
    });
    expect(getByTestId('global-auth-provider-modal-backdrop')).toBeTruthy();
    expect(getByTestId('global-auth-provider-modal-card')).toBeTruthy();
    expect(getByText('Apple 授权登录')).toBeTruthy();
    expect(getByText('将打开 Apple 完成账号授权。')).toBeTruthy();
    expect(NativeModules.AppleAuthModule.login).not.toHaveBeenCalled();
  });

  it('uses provider confirmation instead of direct auth after explicit agreement', () => {
    const { getByRole, getByText, getByTestId } = render(
      <LoginGlobalScreen />,
    );

    fireEvent.press(getByRole('checkbox'));
    fireEvent.press(getByText('使用 Google 继续'));

    expect(getByTestId('global-auth-provider-modal-backdrop')).toBeTruthy();
    expect(getByText('Google 授权登录')).toBeTruthy();
    expect(
      getByText(
        '使用 Google 账号授权后，ViviDrop 只会用于识别账号和同步设备，不会读取你的密码。',
      ),
    ).toBeTruthy();
    expect(GoogleSignin.signIn).not.toHaveBeenCalled();
    expect(mockGoogleLogin).not.toHaveBeenCalled();
  });

  it('logs in with Google after agreement and provider confirmation', async () => {
    const { getByRole, getByText } = render(<LoginGlobalScreen />);

    fireEvent.press(getByRole('checkbox'));
    fireEvent.press(getByText('使用 Google 继续'));
    fireEvent.press(getByText('继续授权'));

    await waitFor(() => {
      expect(mockGoogleLogin).toHaveBeenCalledWith('mock-google-id-token');
      expect(mockLogin).toHaveBeenCalledWith('a', 'r');
    });
  });

  it('logs in with Apple after agreement and provider confirmation', async () => {
    const { getByRole, getByText } = render(<LoginGlobalScreen />);

    fireEvent.press(getByRole('checkbox'));
    fireEvent.press(getByText('使用 Apple 继续'));
    fireEvent.press(getByText('继续授权'));

    await waitFor(() => {
      expect(mockAppleLogin).toHaveBeenCalledWith({
        identityToken: 'mock-apple-id-token',
        authorizationCode: 'mock-auth-code',
        fullName: 'Test User',
      });
      expect(mockLogin).toHaveBeenCalledWith('a', 'r');
    });
  });

  it('rejects Android Apple Sign-In callbacks with mismatched state and removes the listener', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    const removeListener = jest.fn();
    let deepLinkHandler: ((event: { url: string }) => void) | null = null;
    const linkingSubscription = {
      remove: removeListener,
    } as unknown as ReturnType<typeof Linking.addEventListener>;
    jest
      .spyOn(Linking, 'addEventListener')
      .mockImplementation((event, handler) => {
        expect(event).toBe('url');
        deepLinkHandler = handler as (event: { url: string }) => void;
        return linkingSubscription;
      });
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

    const { getByRole, getByText } = render(<LoginGlobalScreen />);
    fireEvent.press(getByRole('checkbox'));
    fireEvent.press(getByText('使用 Apple 继续'));
    fireEvent.press(getByText('继续授权'));

    await waitFor(() => expect(Linking.openURL).toHaveBeenCalledTimes(1));
    expect(deepLinkHandler).not.toBeNull();

    await act(async () => {
      deepLinkHandler?.({
        url: 'vividrop://auth/apple/callback?state=wrong&access_token=a&refresh_token=r',
      });
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Sign In Failed',
        'Apple Sign-In state mismatch.',
      );
    });
    expect(mockLogin).not.toHaveBeenCalled();
    expect(removeListener).toHaveBeenCalledTimes(1);
  });

  it('times out Android Apple Sign-In callbacks and removes the listener', async () => {
    jest.useFakeTimers();
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    const removeListener = jest.fn();
    const linkingSubscription = {
      remove: removeListener,
    } as unknown as ReturnType<typeof Linking.addEventListener>;
    jest
      .spyOn(Linking, 'addEventListener')
      .mockReturnValue(linkingSubscription);
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

    const { getByRole, getByText } = render(<LoginGlobalScreen />);
    fireEvent.press(getByRole('checkbox'));
    fireEvent.press(getByText('使用 Apple 继续'));
    fireEvent.press(getByText('继续授权'));

    await waitFor(() => expect(Linking.openURL).toHaveBeenCalledTimes(1));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(120000);
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Sign In Failed',
        'Apple Sign-In timed out.',
      );
    });
    expect(mockLogin).not.toHaveBeenCalled();
    expect(removeListener).toHaveBeenCalledTimes(1);
  });
});
