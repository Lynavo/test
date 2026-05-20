import React, { useEffect, useState } from 'react';
import { Alert, NativeModules, Pressable, StyleSheet, Text, View } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { AUTH_COLORS, AuthScreenShell } from '../components/auth/AuthScreenShell';
import { appleLogin, googleLogin } from '../services/auth-service';
import { useAuth } from '../stores/auth-store';

type Provider = 'apple' | 'google';

export function LoginGlobalScreen() {
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const { login } = useAuth();

  useEffect(() => {
    try {
      GoogleSignin.configure();
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

  return (
    <AuthScreenShell subtitle="Connect your desktop and keep media in sync.">
      <View style={styles.card}>
        <Text style={styles.title}>Sign in to Vivi Drop</Text>
        <Pressable
          accessibilityRole="button"
          disabled={pendingProvider !== null}
          onPress={() => void handleProviderPress('apple')}
          style={styles.providerButton}
        >
          <Text style={styles.providerText}>Continue with Apple</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={pendingProvider !== null}
          onPress={() => void handleProviderPress('google')}
          style={styles.providerButton}
        >
          <Text style={styles.providerText}>Continue with Google</Text>
        </Pressable>
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
    padding: 20,
    gap: 14,
  },
  title: {
    color: AUTH_COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  providerButton: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  providerText: {
    color: AUTH_COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
