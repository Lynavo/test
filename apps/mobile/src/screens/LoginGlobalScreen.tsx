import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  NativeModules,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Svg, { Path } from 'react-native-svg';

import { AUTH_COLORS, AuthScreenShell } from '../components/auth/AuthScreenShell';
import { appleLogin, googleLogin } from '../services/auth-service';
import { useAuth } from '../stores/auth-store';
import { PRIVACY_POLICY_URL, USER_AGREEMENT_URL } from '../constants/legal';

type Provider = 'apple' | 'google';

// ---------------------------------------------------------------------------
// Native SVG Icons for premium branding
// ---------------------------------------------------------------------------

function AppleIcon({ color = '#ffffff' }: { color?: string }) {
  return (
    <Svg width={16} height={19} viewBox="0 0 170 170">
      <Path
        d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.37.13-9.13-1.92-14.3-6.15-3.57-2.85-7.39-7.51-11.47-13.98-7.98-12.63-14.15-27.15-18.52-43.54-4.37-16.39-6.56-31.9-6.56-46.54 0-16.92 4.19-31.11 12.57-42.57 8.38-11.47 19.14-17.29 32.29-17.47 6.42 0 13.1 1.95 20.07 5.85 6.97 3.9 11.28 5.85 12.92 5.85 1.51 0 5.69-1.9 12.54-5.7 6.85-3.8 13.4-5.6 19.64-5.4 15.02.6 26.68 6.13 35 16.59-13.2 8.02-19.69 19.22-19.46 33.6.26 10.8 4.29 19.8 12.08 27 7.79 7.2 17.11 11.06 27.97 11.58-2.6 7.6-5.83 14.8-9.68 21.6zM119.22 32.4c0-7.85 2.8-15.11 8.4-21.79 5.6-6.68 12.35-10.74 20.25-12.2 1.34 8.2-1.4 15.93-8.2 23.2-6.8 7.27-14.4 11.07-22.8 11.4-.4-.8-.65-2-.65-3.6z"
        fill={color}
      />
    </Svg>
  );
}

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </Svg>
  );
}

export function LoginGlobalScreen() {
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const { login } = useAuth();

  useEffect(() => {
    try {
      GoogleSignin.configure({
        webClientId: '318131526906-jdsojdqh6057pn3fo5hhtgudht1bh6c8.apps.googleusercontent.com',
      });
    } catch (err) {
      console.warn('Failed to configure Google Sign-In:', err);
    }
  }, []);

  const handleProviderPress = async (provider: Provider) => {
    if (pendingProvider) return;
    setPendingProvider(provider);
    try {
      if (provider === 'apple') {
        const { AppleAuthModule } = NativeModules;
        if (!AppleAuthModule) {
          throw new Error('Apple Sign-In is only supported on iOS devices.');
        }
        const res = await AppleAuthModule.login();
        const authRes = await appleLogin({
          identityToken: res.identityToken,
          authorizationCode: res.authorizationCode,
          fullName: res.fullName,
        });
        login(authRes.accessToken, authRes.refreshToken);
      } else {
        await GoogleSignin.hasPlayServices();
        const userInfo = await GoogleSignin.signIn();
        const idToken = userInfo.data?.idToken || (userInfo as any).idToken;
        if (!idToken) {
          throw new Error('Google Sign-In failed: No ID token returned.');
        }
        const authRes = await googleLogin(idToken);
        login(authRes.accessToken, authRes.refreshToken);
      }
    } catch (err: any) {
      // Don't show alert if user cancelled explicitly
      const isCancelled =
        err.code === 'SIGN_IN_CANCELLED' ||
        err.message === 'Sign in cancelled' ||
        err.message?.includes('cancel');

      if (!isCancelled) {
        Alert.alert('Sign In Failed', err.message || String(err));
      }
    } finally {
      setPendingProvider(null);
    }
  };

  const handleOpenTerms = useCallback(() => {
    Linking.openURL(USER_AGREEMENT_URL);
  }, []);

  const handleOpenPrivacy = useCallback(() => {
    Linking.openURL(PRIVACY_POLICY_URL);
  }, []);

  return (
    <AuthScreenShell subtitle="Connect your desktop and keep media in sync.">
      <View style={styles.card}>
        <Text style={styles.title}>Sign in to Vivi Drop</Text>
        <Text style={styles.subtitle}>Choose a service to continue with your account.</Text>

        <Pressable
          accessibilityRole="button"
          disabled={pendingProvider !== null}
          onPress={() => void handleProviderPress('apple')}
          style={({ pressed }) => [
            styles.providerButton,
            styles.appleButton,
            pendingProvider !== null ? styles.buttonDisabled : null,
            pressed ? { opacity: 0.9 } : null,
          ]}
        >
          {pendingProvider === 'apple' ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <View style={styles.buttonContent}>
              <AppleIcon color="#ffffff" />
              <Text style={[styles.providerText, styles.appleText]}>Sign in with Apple</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={pendingProvider !== null}
          onPress={() => void handleProviderPress('google')}
          style={({ pressed }) => [
            styles.providerButton,
            styles.googleButton,
            pendingProvider !== null ? styles.buttonDisabled : null,
            pressed ? { opacity: 0.9 } : null,
          ]}
        >
          {pendingProvider === 'google' ? (
            <ActivityIndicator size="small" color={AUTH_COLORS.text} />
          ) : (
            <View style={styles.buttonContent}>
              <GoogleIcon />
              <Text style={[styles.providerText, styles.googleText]}>Sign in with Google</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.legalFooter}>
          <Text style={styles.legalText}>
            By signing in, you agree to our{' '}
            <Text style={styles.legalLink} onPress={handleOpenTerms}>
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text style={styles.legalLink} onPress={handleOpenPrivacy}>
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 32,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    padding: 24,
    gap: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  title: {
    color: AUTH_COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: AUTH_COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  providerButton: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  appleButton: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  googleButton: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0,0,0,0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  providerText: {
    fontSize: 16,
    fontWeight: '700',
  },
  appleText: {
    color: '#ffffff',
  },
  googleText: {
    color: '#1f2937',
  },
  legalFooter: {
    marginTop: 8,
    paddingHorizontal: 8,
  },
  legalText: {
    fontSize: 12,
    lineHeight: 18,
    color: AUTH_COLORS.textFaint,
    textAlign: 'center',
  },
  legalLink: {
    color: AUTH_COLORS.link,
    fontWeight: '600',
  },
});
