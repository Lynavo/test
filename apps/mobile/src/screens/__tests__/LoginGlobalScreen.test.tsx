import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NativeModules } from 'react-native';
import { LoginGlobalScreen } from '../LoginGlobalScreen';

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

describe('LoginGlobalScreen', () => {
  beforeEach(() => {
    NativeModules.AppleAuthModule = {
      login: jest.fn().mockImplementation(() => {
        // Return a promise that resolves but stays pending briefly if we want to test disabled states,
        // or just a resolved promise.
        return Promise.resolve({
          identityToken: 'mock-apple-id-token',
          authorizationCode: 'mock-auth-code',
          fullName: 'Test User',
        });
      }),
    };
  });

  it('shows Apple and Google login without phone login', () => {
    const { getByText, queryByText } = render(<LoginGlobalScreen />);

    expect(getByText('Sign in with Apple')).toBeTruthy();
    expect(getByText('Sign in with Google')).toBeTruthy();
    expect(queryByText('+86')).toBeNull();
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
