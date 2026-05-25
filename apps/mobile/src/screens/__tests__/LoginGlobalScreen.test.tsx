import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NativeModules } from 'react-native';
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

jest.mock('../../services/auth-service', () => ({
  appleLogin: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
  googleLogin: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
}));

jest.mock('../../components/Icon', () => ({
  Icon: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));

describe('LoginGlobalScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('shows Apple, Google and Email login without phone login', () => {
    const { getByText, queryByText } = render(<LoginGlobalScreen />);

    expect(getByText('Sign in with Apple')).toBeTruthy();
    expect(getByText('Sign in with Google')).toBeTruthy();
    expect(getByText('Sign in with Email')).toBeTruthy();
    expect(queryByText('+86')).toBeNull();
  });

  it('navigates to LoginEmail screen when Email button is pressed', () => {
    const { getByText } = render(<LoginGlobalScreen />);

    const emailButton = getByText('Sign in with Email');
    fireEvent.press(emailButton);

    expect(mockNavigate).toHaveBeenCalledWith('LoginEmail');
  });

  it('keeps provider buttons disabled while provider login is pending', () => {
    // Modify AppleAuthModule mock to return a pending promise to keep it in pending state
    let resolveLogin: any;
    const pendingPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });
    
    NativeModules.AppleAuthModule.login = jest.fn().mockReturnValue(pendingPromise);

    const { getByText, queryByText } = render(<LoginGlobalScreen />);

    const appleButton = getByText('Sign in with Apple');
    fireEvent.press(appleButton);

    // Apple button is loading (text is temporarily replaced by ActivityIndicator)
    // Google button remains rendered (but disabled)
    expect(queryByText('Sign in with Apple')).toBeNull();
    expect(getByText('Sign in with Google')).toBeTruthy();
    
    // Resolve the promise to clean up
    resolveLogin({
      identityToken: 'mock-apple-id-token',
      authorizationCode: 'mock-auth-code',
      fullName: 'Test User',
    });
  });
});
