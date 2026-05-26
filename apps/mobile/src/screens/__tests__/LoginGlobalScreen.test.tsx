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

  it('allows searching and filtering countries by name, code, or ISO', () => {
    const { getByRole, getByPlaceholderText, getByText, queryByText } = render(<LoginGlobalScreen />);
    
    // Open picker
    fireEvent.press(getByRole('combobox'));
    
    // Verify search input is rendered
    const searchInput = getByPlaceholderText('Search by country or code...');
    expect(searchInput).toBeTruthy();
    
    // Verify default list has China and Singapore
    expect(getByText('China', { exact: false })).toBeTruthy();
    expect(getByText('Singapore', { exact: false })).toBeTruthy();
    
    // Search for "Singapore"
    fireEvent.changeText(searchInput, 'Singapore');
    expect(getByText('Singapore', { exact: false })).toBeTruthy();
    expect(queryByText('China', { exact: false })).toBeNull();
    
    // Search for "+86" (China)
    fireEvent.changeText(searchInput, '+86');
    expect(getByText('China', { exact: false })).toBeTruthy();
    expect(queryByText('Singapore', { exact: false })).toBeNull();

    // Search for "JP" (Japan)
    fireEvent.changeText(searchInput, 'JP');
    expect(getByText('Japan', { exact: false })).toBeTruthy();
    expect(queryByText('China', { exact: false })).toBeNull();
  });

  it('resets search query when selecting a country or closing the modal', () => {
    const { getByRole, getByPlaceholderText, getByText } = render(<LoginGlobalScreen />);
    
    // 1. Reset on selecting country
    fireEvent.press(getByRole('combobox'));
    const searchInput = getByPlaceholderText('Search by country or code...');
    fireEvent.changeText(searchInput, 'Singapore');
    
    // Select Singapore
    fireEvent.press(getByText('Singapore', { exact: false }));
    
    // Reopen picker and check query is empty
    fireEvent.press(getByRole('combobox'));
    const searchInput2 = getByPlaceholderText('Search by country or code...');
    expect(searchInput2.props.value).toBe('');
    
    // 2. Reset on clicking "Done"
    fireEvent.changeText(searchInput2, 'Japan');
    fireEvent.press(getByText('Done'));
    
    // Reopen picker and check query is empty
    fireEvent.press(getByRole('combobox'));
    const searchInput3 = getByPlaceholderText('Search by country or code...');
    expect(searchInput3.props.value).toBe('');
  });
});
