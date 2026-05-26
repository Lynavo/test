import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeModules, Alert } from 'react-native';
import { LoginGlobalScreen } from '../LoginGlobalScreen';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

jest.mock('@react-navigation/stack', () => ({}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({
      data: { idToken: 'mock-google-id-token' },
    }),
  },
}));

jest.mock('../../stores/auth-store', () => ({
  useAuth: () => ({
    login: jest.fn(),
  }),
}));

const mockSendEmailCode = jest.fn();
const mockSendSmsCode = jest.fn();

jest.mock('../../services/auth-service', () => ({
  appleLogin: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
  googleLogin: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
  sendEmailCode: (email: string) => mockSendEmailCode(email),
  sendSmsCode: (phone: string) => mockSendSmsCode(phone),
}));

describe('LoginGlobalScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    NativeModules.AppleAuthModule = {
      login: jest.fn().mockImplementation(() => {
        return Promise.resolve({
          identityToken: 'mock-apple-id-token',
          authorizationCode: 'mock-auth-code',
          fullName: 'Test User',
        });
      }),
    };
  });

  it('shows Google, Apple buttons and Phone input by default', () => {
    const { getByText, getByPlaceholderText } = render(<LoginGlobalScreen />);

    expect(getByText('Continue with Google')).toBeTruthy();
    expect(getByText('Continue with Apple')).toBeTruthy();
    expect(getByPlaceholderText('Phone number')).toBeTruthy();
  });

  it('submits phone and navigates to SmsVerify', async () => {
    mockSendSmsCode.mockResolvedValueOnce({ authBaseUrl: 'https://api.vivi.cn' });

    const { getByText, getByPlaceholderText } = render(<LoginGlobalScreen />);

    const input = getByPlaceholderText('Phone number');
    fireEvent.changeText(input, '13312345678');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(mockSendSmsCode).toHaveBeenCalledWith('+8613312345678');
      expect(mockNavigate).toHaveBeenCalledWith('SmsVerify', {
        phone: '+8613312345678',
        authBaseUrl: 'https://api.vivi.cn',
      });
    });
  });

  it('keeps provider buttons disabled while provider login is pending', () => {
    let resolveLogin: any;
    const pendingPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });
    
    NativeModules.AppleAuthModule.login = jest.fn().mockReturnValue(pendingPromise);

    const { getByText, queryByText } = render(<LoginGlobalScreen />);

    const appleButton = getByText('Continue with Apple');
    fireEvent.press(appleButton);

    expect(queryByText('Continue with Apple')).toBeNull();
    expect(getByText('Continue with Google')).toBeTruthy();
    
    resolveLogin({
      identityToken: 'mock-apple-id-token',
      authorizationCode: 'mock-auth-code',
      fullName: 'Test User',
    });
  });
});
