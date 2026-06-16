import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  type GestureResponderEvent,
  Image,
  Linking,
  Modal,
  NativeModules,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import {
  GLOBAL_AUTH_COLORS as AUTH_COLORS,
  GlobalAuthScreenShell,
} from '../components/auth/GlobalAuthScreenShell';
import { authTextScalingProps } from '../components/auth/authPlatformStyles';
import { appleLogin, googleLogin } from '../services/auth-service';
import { useAuth } from '../stores/auth-store';
import { PRIVACY_POLICY_URL, USER_AGREEMENT_URL } from '../constants/legal';
import { ModalBlurBackdrop } from '../components/shared/ModalBlurBackdrop';
import { getBaseUrl } from '../services/config';

const VIVIDROP_LOGO = require('../assets/icons/vividrop-logo.png');

type Provider = 'apple' | 'google';
type MediaKind = 'photo' | 'video' | 'file';

const APPLE_ANDROID_CALLBACK_TIMEOUT_MS = 120000;

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return typeof err === 'string' && err.length > 0 ? err : fallback;
}

function isProviderSignInCancelled(err: unknown): boolean {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? (err as { code?: unknown }).code
      : null;
  const message = getErrorMessage(err, '');

  return (
    code === 'SIGN_IN_CANCELLED' ||
    message === 'Sign in cancelled' ||
    message.toLowerCase().includes('cancel')
  );
}

function getGoogleIdToken(
  userInfo: Awaited<ReturnType<typeof GoogleSignin.signIn>>,
): string | null {
  if (userInfo.data?.idToken) return userInfo.data.idToken;
  if (
    typeof userInfo === 'object' &&
    userInfo !== null &&
    'idToken' in userInfo
  ) {
    const idToken = (userInfo as { idToken?: unknown }).idToken;
    if (typeof idToken === 'string' && idToken.length > 0) return idToken;
  }
  return null;
}

function getUrlQueryParam(url: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = url.match(new RegExp(`[?&]${escapedName}=([^&#]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1].replace(/\+/g, ' '));
  } catch {
    return null;
  }
}

export function LoginGlobalScreen() {
  const [authProvider, setAuthProvider] = useState<Provider | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreementProvider, setAgreementProvider] = useState<Provider | null>(
    null,
  );
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const { login } = useAuth();

  useEffect(() => {
    try {
      GoogleSignin.configure({
        webClientId:
          '318131526906-jdsojdqh6057pn3fo5hhtgudht1bh6c8.apps.googleusercontent.com',
      });
    } catch (err) {
      console.warn('Failed to configure Google Sign-In:', err);
    }
  }, []);

  const beginProviderLogin = (provider: Provider) => {
    if (pendingProvider) return;

    if (!agreedToTerms) {
      setAgreementProvider(provider);
      return;
    }

    setAuthProvider(provider);
  };

  const handleProviderPress = async (provider: Provider) => {
    if (pendingProvider) return;
    setPendingProvider(provider);
    try {
      if (provider === 'apple') {
        if (Platform.OS === 'android') {
          const clientId = 'com.vividrop.global.signin';
          const baseUrl = getBaseUrl();
          const redirectUri = `${baseUrl}/api/v1/auth/apple/callback`;
          const state = Math.random().toString(36).substring(2);
          const nonce = Math.random().toString(36).substring(2);

          const appleAuthUrl = `https://appleid.apple.com/auth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
            redirectUri,
          )}&response_type=code%20id_token&response_mode=form_post&scope=name%20email&state=${state}&nonce=${nonce}`;

          await new Promise<void>((resolvePromise, rejectPromise) => {
            let settled = false;
            let timeout: ReturnType<typeof setTimeout> | null = null;
            let linkingSubscription: { remove: () => void } | null = null;

            const cleanup = () => {
              if (timeout) {
                clearTimeout(timeout);
                timeout = null;
              }
              linkingSubscription?.remove();
              linkingSubscription = null;
            };

            const settleResolve = () => {
              if (settled) return;
              settled = true;
              cleanup();
              resolvePromise();
            };

            const settleReject = (err: Error) => {
              if (settled) return;
              settled = true;
              cleanup();
              rejectPromise(err);
            };

            const handleDeepLink = async (event: { url: string }) => {
              if (event.url.includes('vividrop://auth/apple/callback')) {
                if (getUrlQueryParam(event.url, 'state') !== state) {
                  settleReject(new Error('Apple Sign-In state mismatch.'));
                  return;
                }

                const accessToken = getUrlQueryParam(event.url, 'access_token');
                const refreshToken = getUrlQueryParam(
                  event.url,
                  'refresh_token',
                );

                if (accessToken && refreshToken) {
                  try {
                    login(accessToken, refreshToken);
                    settleResolve();
                  } catch (err) {
                    settleReject(
                      err instanceof Error
                        ? err
                        : new Error(
                            getErrorMessage(err, 'Apple Sign-In failed.'),
                          ),
                    );
                  }
                } else {
                  settleReject(
                    new Error(
                      'Login failed: Did not receive tokens from server.',
                    ),
                  );
                }
              }
            };

            linkingSubscription = Linking.addEventListener(
              'url',
              handleDeepLink,
            );

            timeout = setTimeout(() => {
              settleReject(new Error('Apple Sign-In timed out.'));
            }, APPLE_ANDROID_CALLBACK_TIMEOUT_MS);

            Linking.openURL(appleAuthUrl).catch((err: unknown) => {
              settleReject(
                new Error(
                  `Failed to open Apple Sign-In browser: ${getErrorMessage(
                    err,
                    'Unknown error',
                  )}`,
                ),
              );
            });
          });
        } else {
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
        }
      } else {
        await GoogleSignin.hasPlayServices();
        const userInfo = await GoogleSignin.signIn();
        const idToken = getGoogleIdToken(userInfo);
        if (!idToken) {
          throw new Error('Google Sign-In failed: No ID token returned.');
        }
        const authRes = await googleLogin(idToken);
        login(authRes.accessToken, authRes.refreshToken);
      }
    } catch (err: unknown) {
      if (!isProviderSignInCancelled(err)) {
        Alert.alert('Sign In Failed', getErrorMessage(err, 'Unknown error'));
      }
    } finally {
      setPendingProvider(null);
      setAuthProvider(null);
    }
  };

  const handleOpenTerms = () => {
    Linking.openURL(USER_AGREEMENT_URL);
  };

  const handleOpenPrivacy = () => {
    Linking.openURL(PRIVACY_POLICY_URL);
  };

  return (
    <GlobalAuthScreenShell>
      <View style={styles.pageContent}>
        <View style={styles.heroSection}>
          <View style={styles.brandRow}>
            <View style={styles.logoBox}>
              <Image
                source={VIVIDROP_LOGO}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text {...authTextScalingProps} style={styles.brandTitle}>
                ViviDrop
              </Text>
              <Text {...authTextScalingProps} style={styles.brandSubtitle}>
                轻量同步素材到电脑端
              </Text>
            </View>
          </View>

          <Text {...authTextScalingProps} style={styles.heroTitle}>
            让手机素材同步变得更安静、更快。
          </Text>
          <Text {...authTextScalingProps} style={styles.heroCopy}>
            连接同一局域网中的电脑，自动上传照片、视频和文件。
          </Text>

          <View style={styles.featureGrid}>
            {[
              { type: 'photo' as const, label: '照片' },
              { type: 'video' as const, label: '视频' },
              { type: 'file' as const, label: '文件' },
            ].map(item => (
              <View key={item.type} style={styles.featureCard}>
                <MediaTypeIcon type={item.type} />
                <Text {...authTextScalingProps} style={styles.featureLabel}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.authCard}>
          <Text {...authTextScalingProps} style={styles.cardTitle}>
            登录或创建账号
          </Text>
          <Text {...authTextScalingProps} style={styles.cardDescription}>
            使用现有账号继续，稍后可连接电脑设备。
          </Text>

          <View style={styles.providerList}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="使用 Google 继续"
              disabled={pendingProvider !== null}
              onPress={() => beginProviderLogin('google')}
              testID="global-auth-google-provider-button"
              style={({ pressed }) => [
                styles.providerButton,
                pressed ? styles.providerButtonPressed : null,
                pendingProvider !== null ? styles.providerButtonDisabled : null,
              ]}
            >
              {pendingProvider === 'google' ? (
                <ActivityIndicator size="small" color={AUTH_COLORS.text} />
              ) : (
                <>
                  <Text {...authTextScalingProps} style={styles.googleMark}>
                    G
                  </Text>
                  <Text {...authTextScalingProps} style={styles.providerText}>
                    使用 Google 继续
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="使用 Apple 继续"
              disabled={pendingProvider !== null}
              onPress={() => beginProviderLogin('apple')}
              testID="global-auth-apple-provider-button"
              style={({ pressed }) => [
                styles.providerButton,
                pressed ? styles.providerButtonPressed : null,
                pendingProvider !== null ? styles.providerButtonDisabled : null,
              ]}
            >
              {pendingProvider === 'apple' ? (
                <ActivityIndicator size="small" color={AUTH_COLORS.text} />
              ) : (
                <>
                  <Text {...authTextScalingProps} style={styles.appleMark}>
                    
                  </Text>
                  <Text {...authTextScalingProps} style={styles.providerText}>
                    使用 Apple 继续
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.termsRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreedToTerms }}
              accessibilityLabel="Agree to terms"
              onPress={() => setAgreedToTerms(prev => !prev)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[
                styles.checkbox,
                agreedToTerms ? styles.checkboxChecked : null,
              ]}
            >
              {agreedToTerms ? <CheckGlyph /> : null}
            </Pressable>
            <Text {...authTextScalingProps} style={styles.termsText}>
              继续即表示你同意{' '}
              <Text style={styles.termsLink} onPress={handleOpenTerms}>
                服务条款
              </Text>
              {'\n'}和{' '}
              <Text style={styles.termsLink} onPress={handleOpenPrivacy}>
                隐私政策
              </Text>
              。
            </Text>
          </View>
        </View>
      </View>

      <ProviderConfirmModal
        provider={authProvider}
        pendingProvider={pendingProvider}
        onCancel={() => setAuthProvider(null)}
        onContinue={provider => void handleProviderPress(provider)}
      />

      <AgreementRequiredModal
        provider={agreementProvider}
        onCancel={() => setAgreementProvider(null)}
        onContinue={provider => {
          setAgreedToTerms(true);
          setAgreementProvider(null);
          setAuthProvider(provider);
        }}
      />
    </GlobalAuthScreenShell>
  );
}

function MediaTypeIcon({ type }: { type: MediaKind }) {
  if (type === 'photo') {
    return (
      <View style={[styles.mediaIcon, styles.photoIcon]}>
        <MediaIconGradient type="photo" />
        <View style={styles.photoSun} />
        <View style={styles.photoHillLeft} />
        <View style={styles.photoHillRight} />
        <PhotoGlyph />
      </View>
    );
  }

  if (type === 'video') {
    return (
      <View style={[styles.mediaIcon, styles.videoIcon]}>
        <MediaIconGradient type="video" />
        <View style={styles.videoDotRowTop}>
          {[0, 1, 2].map(item => (
            <View key={item} style={styles.videoDot} />
          ))}
        </View>
        <View style={styles.playCircle}>
          <VideoPlayGlyph />
        </View>
        <View style={styles.videoDotRowBottom}>
          {[0, 1, 2].map(item => (
            <View key={item} style={styles.videoDotFaint} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.mediaIcon, styles.fileIcon]}>
      <MediaIconGradient type="file" />
      <View style={styles.fileCorner} />
      <FileGlyph />
    </View>
  );
}

function MediaIconGradient({ type }: { type: MediaKind }) {
  const stops =
    type === 'photo'
      ? ['#F7FCFF', '#D8F0FF', '#9FD6FF']
      : type === 'video'
      ? ['#F8F6FF', '#E3E6FF', '#9AAEFF']
      : ['#FFFFFF', '#EFF5FB', '#D7E2F0'];

  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Defs>
        <LinearGradient
          id={`${type}MediaGradient`}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <Stop offset="0%" stopColor={stops[0]} />
          <Stop offset="56%" stopColor={stops[1]} />
          <Stop offset="100%" stopColor={stops[2]} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${type}MediaGradient)`} />
    </Svg>
  );
}

function PhotoGlyph() {
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
      <Rect
        x={5}
        y={4.5}
        width={14}
        height={15}
        rx={2.4}
        stroke="#1677D2"
        strokeWidth={2}
      />
      <Circle cx={15.2} cy={8.8} r={1.55} fill="#1677D2" />
      <Path
        d="M6.5 16.9l3.75-4.05a1.35 1.35 0 0 1 1.96-.02l1.28 1.33.62-.72a1.35 1.35 0 0 1 1.98-.05l1.4 1.42"
        stroke="#1677D2"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function VideoPlayGlyph() {
  return (
    <Svg width={15} height={15} viewBox="0 0 18 18">
      <Path d="M6.2 4.15v9.7l7.55-4.86-7.55-4.84z" fill="#746AA8" />
    </Svg>
  );
}

function FileGlyph() {
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 3.8h6.15L18 8.65V19a1.6 1.6 0 0 1-1.6 1.6H7A1.6 1.6 0 0 1 5.4 19V5.4A1.6 1.6 0 0 1 7 3.8z"
        stroke="#59616D"
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Path
        d="M13.1 3.9v4.75H18"
        stroke="#59616D"
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Path
        d="M8.5 12.4h7M8.5 15.7h5.4"
        stroke="#59616D"
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ShieldCheckGlyph() {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.15 5.35 5.62v5.2c0 4.3 2.72 8.36 6.65 9.97 3.93-1.61 6.65-5.67 6.65-9.97v-5.2L12 3.15z"
        stroke="#1677D2"
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Path
        d="m8.7 12.1 2.15 2.1 4.55-5"
        stroke="#1677D2"
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckGlyph() {
  return (
    <Svg width={11} height={11} viewBox="0 0 12 12" fill="none">
      <Path
        d="m2.4 6.25 2.1 2.05 5.1-5.25"
        stroke="#FFFFFF"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ProviderConfirmModal({
  provider,
  pendingProvider,
  onCancel,
  onContinue,
}: {
  provider: Provider | null;
  pendingProvider: Provider | null;
  onCancel: () => void;
  onContinue: (provider: Provider) => void;
}) {
  if (!provider) return null;

  const isGoogle = provider === 'google';

  return (
    <AuthModalFrame
      backdropTestID="global-auth-provider-modal-backdrop"
      cardTestID="global-auth-provider-modal-card"
      onCancel={onCancel}
    >
      <View style={styles.modalCardContent}>
        <View style={[styles.modalHeader, styles.providerModalHeader]}>
          <View
            style={[
              styles.modalProviderIcon,
              isGoogle ? styles.modalGoogleIcon : styles.modalAppleIcon,
            ]}
          >
            <Text
              style={[
                styles.modalProviderMark,
                isGoogle ? styles.modalGoogleMark : styles.modalAppleMark,
              ]}
            >
              {isGoogle ? 'G' : ''}
            </Text>
          </View>
          <View style={styles.modalHeaderText}>
            <Text {...authTextScalingProps} style={styles.modalTitle}>
              {isGoogle ? 'Google 授权登录' : 'Apple 授权登录'}
            </Text>
            <Text {...authTextScalingProps} style={styles.modalSubtitle}>
              {isGoogle
                ? '将打开 Google 完成账号授权。'
                : '将打开 Apple 完成账号授权。'}
            </Text>
          </View>
        </View>

        <View style={styles.modalInfoBox}>
          <Text {...authTextScalingProps} style={styles.modalInfoText}>
            {isGoogle
              ? '使用 Google 账号授权后，ViviDrop 只会用于识别账号和同步设备，不会读取你的密码。'
              : '使用 Apple ID 授权后，ViviDrop 只会用于识别账号和同步设备，不会读取你的密码。'}
          </Text>
        </View>

        <View style={styles.modalButtonRow}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.modalSecondaryButton,
              pressed ? styles.providerButtonPressed : null,
            ]}
            onPress={onCancel}
          >
            <Text style={styles.modalSecondaryText}>取消</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: pendingProvider !== null }}
            style={({ pressed }) => [
              styles.modalPrimaryButton,
              pendingProvider !== null ? styles.modalPrimaryButtonDisabled : null,
              pressed ? styles.providerButtonPressed : null,
            ]}
            onPress={() => onContinue(provider)}
            disabled={pendingProvider !== null}
          >
            {pendingProvider === provider ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.modalPrimaryText}>继续授权</Text>
            )}
          </Pressable>
        </View>
      </View>
    </AuthModalFrame>
  );
}

function AuthModalFrame({
  backdropTestID,
  cardTestID,
  children,
  onCancel,
}: {
  backdropTestID: string;
  cardTestID: string;
  children: React.ReactNode;
  onCancel: () => void;
}) {
  const stopModalPress = (event: GestureResponderEvent) => {
    event.stopPropagation();
  };

  return (
    <Modal animationType="fade" transparent visible onRequestClose={onCancel}>
      <Pressable
        style={styles.modalBackdrop}
        testID={backdropTestID}
        onPress={onCancel}
      >
        <ModalBlurBackdrop />
        <Pressable
          style={styles.modalCard}
          testID={cardTestID}
          onPress={stopModalPress}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AgreementRequiredModal({
  provider,
  onCancel,
  onContinue,
}: {
  provider: Provider | null;
  onCancel: () => void;
  onContinue: (provider: Provider) => void;
}) {
  if (!provider) return null;

  return (
    <AuthModalFrame
      backdropTestID="global-auth-agreement-modal-backdrop"
      cardTestID="global-auth-agreement-modal-card"
      onCancel={onCancel}
    >
      <View style={styles.modalCardContent}>
        <View style={[styles.modalHeader, styles.agreementModalHeader]}>
          <View style={styles.modalShieldIcon}>
            <ShieldCheckGlyph />
          </View>
          <View style={styles.modalHeaderText}>
            <Text {...authTextScalingProps} style={styles.modalTitle}>
              请先同意服务协议
            </Text>
            <Text {...authTextScalingProps} style={styles.modalBodyText}>
              登录前需要确认你已阅读并同意服务条款和隐私政策，之后可继续使用
              {provider === 'google' ? ' Google' : ' Apple'} 授权。
            </Text>
          </View>
        </View>

        <View style={[styles.modalInfoBox, styles.agreementModalInfoBox]}>
          <Text
            {...authTextScalingProps}
            style={[styles.modalInfoText, styles.agreementModalInfoText]}
          >
            <Text style={styles.termsLink}>服务条款</Text>
            <Text style={styles.modalDividerText}> / </Text>
            <Text style={styles.termsLink}>隐私政策</Text>
            <Text> 用于说明账号、设备连接和同步数据的处理方式。</Text>
          </Text>
        </View>

        <View style={styles.modalButtonRow}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.modalSecondaryButton,
              pressed ? styles.providerButtonPressed : null,
            ]}
            onPress={onCancel}
          >
            <Text style={styles.modalSecondaryText}>稍后</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.modalPrimaryButton,
              pressed ? styles.providerButtonPressed : null,
            ]}
            onPress={() => onContinue(provider)}
          >
            <Text style={styles.modalPrimaryText}>同意并继续</Text>
          </Pressable>
        </View>
      </View>
    </AuthModalFrame>
  );
}

const glassShadow = {
  shadowColor: '#46608A',
  shadowOffset: { width: 0, height: 18 },
  shadowOpacity: 0.12,
  shadowRadius: 52,
  elevation: 6,
};

const panelShadow = {
  shadowColor: '#46608A',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.08,
  shadowRadius: 34,
  elevation: 4,
};

const styles = StyleSheet.create({
  pageContent: {
    flex: 1,
  },
  heroSection: {
    paddingTop: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: 'rgba(255,255,255,0.64)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 34,
    elevation: 4,
  },
  logoImage: {
    width: 36,
    height: 36,
  },
  brandTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '600',
    color: AUTH_COLORS.text,
  },
  brandSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 20,
    color: AUTH_COLORS.textMuted,
  },
  heroTitle: {
    marginTop: 24,
    maxWidth: 300,
    fontSize: 26,
    lineHeight: 29,
    fontWeight: '600',
    color: AUTH_COLORS.text,
  },
  heroCopy: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 24,
    color: AUTH_COLORS.textMuted,
  },
  featureGrid: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 10,
  },
  featureCard: {
    flex: 1,
    height: 91,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: 'rgba(255,255,255,0.50)',
    alignItems: 'center',
    paddingTop: 12,
    ...panelShadow,
  },
  featureLabel: {
    marginTop: 8,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    color: AUTH_COLORS.textMuted,
  },
  mediaIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 3,
  },
  photoIcon: {
    backgroundColor: '#D8F0FF',
  },
  photoSun: {
    position: 'absolute',
    left: 9,
    top: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  photoHillLeft: {
    position: 'absolute',
    left: 3,
    bottom: -2,
    width: 28,
    height: 16,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.62)',
    transform: [{ rotate: '-8deg' }],
  },
  photoHillRight: {
    position: 'absolute',
    right: -1,
    bottom: -2,
    width: 30,
    height: 19,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: 'rgba(191,227,255,0.78)',
    transform: [{ rotate: '10deg' }],
  },
  videoIcon: {
    backgroundColor: '#E3E6FF',
  },
  videoDotRowTop: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  videoDotRowBottom: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  videoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  videoDotFaint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.54)',
  },
  playCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.74)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIcon: {
    backgroundColor: '#EFF5FB',
  },
  fileCorner: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 12,
    height: 12,
    borderBottomLeftRadius: 8,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#C6D2DF',
    backgroundColor: 'rgba(255,255,255,0.76)',
  },
  authCard: {
    marginTop: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: 'rgba(255,255,255,0.58)',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    ...glassShadow,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '600',
    color: AUTH_COLORS.text,
  },
  cardDescription: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 20,
    color: AUTH_COLORS.textMuted,
  },
  providerList: {
    marginTop: 20,
    gap: 12,
  },
  providerButton: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: 'rgba(255,255,255,0.64)',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 2,
  },
  providerButtonPressed: {
    transform: [{ translateY: 1 }],
  },
  providerButtonDisabled: {
    opacity: 0.5,
  },
  googleMark: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: '#4285F4',
  },
  appleMark: {
    fontSize: 19,
    lineHeight: 22,
    fontWeight: '600',
    color: AUTH_COLORS.text,
  },
  providerText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
    color: AUTH_COLORS.text,
  },
  termsRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    marginTop: 2,
    width: 16,
    height: 16,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#C9D6E4',
    backgroundColor: 'rgba(255,255,255,0.70)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: AUTH_COLORS.primary,
    backgroundColor: AUTH_COLORS.primary,
  },
  termsText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 20,
    color: '#7B8490',
  },
  termsLink: {
    fontWeight: '600',
    color: AUTH_COLORS.link,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.90)',
    backgroundColor: 'rgba(248,251,255,0.98)',
    overflow: 'hidden',
    shadowColor: '#23344D',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.24,
    shadowRadius: 70,
    elevation: 12,
  },
  modalCardContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  providerModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  agreementModalHeader: {
    alignItems: 'flex-start',
  },
  modalProviderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.80)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalGoogleIcon: {
    backgroundColor: '#EEF4FF',
  },
  modalAppleIcon: {
    backgroundColor: '#F4F5F7',
  },
  modalProviderMark: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '600',
  },
  modalGoogleMark: {
    color: '#4285F4',
  },
  modalAppleMark: {
    color: AUTH_COLORS.text,
  },
  modalShieldIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.80)',
    backgroundColor: '#E4F5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    color: AUTH_COLORS.text,
  },
  modalSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 18,
    color: AUTH_COLORS.textMuted,
  },
  modalBodyText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 24,
    color: '#3F4A58',
  },
  modalInfoBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DDE8F4',
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 2,
  },
  agreementModalInfoBox: {
    marginTop: 16,
  },
  modalInfoText: {
    fontSize: 13,
    lineHeight: 24,
    color: '#3F4A58',
  },
  agreementModalInfoText: {
    fontSize: 12,
    lineHeight: 20,
  },
  modalDividerText: {
    color: '#C5CED8',
  },
  modalButtonRow: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 12,
  },
  modalSecondaryButton: {
    flex: 0.78,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDE8F4',
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#46608A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 2,
  },
  modalSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3F4A58',
  },
  modalPrimaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 8,
    backgroundColor: AUTH_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AUTH_COLORS.primary,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 3,
  },
  modalPrimaryButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  modalPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
