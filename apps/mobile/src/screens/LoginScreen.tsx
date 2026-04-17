import React, { useState, useCallback } from 'react';
import {
  Alert,
  ActivityIndicator,
  Keyboard,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon } from '../components/Icon';
import { AUTH_COLORS, AuthScreenShell } from '../components/auth/AuthScreenShell';
import { isValidChinaPhone } from '../utils/phone-validation';
import { sendSmsCode } from '../services/auth-service';
import { ApiError, ERROR_CODE } from '../services/api';
import { PRIVACY_POLICY_URL, USER_AGREEMENT_URL } from '../constants/legal';

// ---------------------------------------------------------------------------
// Navigation types
// ---------------------------------------------------------------------------

type LoginNavProp = StackNavigationProp<RootStackParamList, 'Login'>;

// ---------------------------------------------------------------------------
// LoginScreen
// ---------------------------------------------------------------------------

export function LoginScreen() {
  const navigation = useNavigation<LoginNavProp>();

  const [phone, setPhone] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [sending, setSending] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [hasTouched, setHasTouched] = useState(false);

  // -----------------------------------------------------------------------
  // Derived state
  // -----------------------------------------------------------------------

  const phoneValid = isValidChinaPhone(phone);
  const buttonEnabled = phoneValid && agreed && !sending;

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handlePhoneChange = useCallback((value: string) => {
    // Only allow digits
    const digits = value.replace(/\D/g, '').slice(0, 11);
    setPhone(digits);
    setHasTouched(true);

    if (digits.length > 0 && digits.length === 11 && !isValidChinaPhone(digits)) {
      setPhoneError('请输入正确的手机号码');
    } else {
      setPhoneError(null);
    }
  }, []);

  const handlePhoneBlur = useCallback(() => {
    if (hasTouched && phone.length > 0 && !isValidChinaPhone(phone)) {
      setPhoneError('请输入正确的手机号码');
    }
  }, [hasTouched, phone]);

  const handleSendCode = useCallback(async () => {
    if (!buttonEnabled) return;

    Keyboard.dismiss();
    setSending(true);
    setPhoneError(null);

    try {
      await sendSmsCode(phone);
      setSending(false);
      navigation.navigate('SmsVerify', { phone });
    } catch (err) {
      setSending(false);

      if (err instanceof ApiError) {
        switch (err.code) {
          case ERROR_CODE.PHONE_FORMAT_INVALID:
            setPhoneError('手機號碼格式不正確');
            break;
          case ERROR_CODE.SMS_TOO_FREQUENT:
            Alert.alert('發送過於頻繁', '請稍後再試');
            break;
          case ERROR_CODE.SMS_SEND_FAILED:
            Alert.alert('發送失敗', '驗證碼發送失敗，請稍後重試');
            break;
          case ERROR_CODE.RATE_LIMITED:
            Alert.alert('請求過於頻繁', '請稍後再試');
            break;
          default:
            Alert.alert('發送失敗', err.message || '未知錯誤');
        }
      } else {
        Alert.alert('網路錯誤', '請檢查網路連線後重試');
      }
    }
  }, [buttonEnabled, phone, navigation]);

  const handleOpenUserAgreement = useCallback(() => {
    Linking.openURL(USER_AGREEMENT_URL);
  }, []);

  const handleOpenPrivacyPolicy = useCallback(() => {
    Linking.openURL(PRIVACY_POLICY_URL);
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <AuthScreenShell subtitle="手機號快捷登入">
      <View style={styles.card}>
        <Text style={styles.cardTitle}>首次登入將自動註冊帳號</Text>

        <View style={styles.fieldWrap}>
          <View
            style={[
              styles.phoneField,
              phoneError ? styles.phoneFieldError : null,
            ]}
          >
            <View style={styles.phonePrefix}>
              <Icon
                name="phone-portrait-outline"
                size={20}
                color={AUTH_COLORS.textMuted}
              />
              <Text style={styles.prefixText}>+86</Text>
            </View>
            <View style={styles.divider} />
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={handlePhoneChange}
              onBlur={handlePhoneBlur}
              keyboardType="phone-pad"
              maxLength={11}
              placeholder="請輸入手機號碼"
              placeholderTextColor={AUTH_COLORS.textFaint}
              editable={!sending}
              returnKeyType="done"
              selectionColor={AUTH_COLORS.primary}
            />
          </View>
          {phoneError && (
            <Text style={styles.phoneErrorText}>{phoneError}</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.agreementRow}
          onPress={() => setAgreed(!agreed)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed ? (
              <Icon name="checkmark" size={16} color="#ffffff" />
            ) : null}
          </View>
          <Text style={styles.agreementText}>
            我已閱讀並同意
            <Text style={styles.linkText} onPress={handleOpenUserAgreement}>
              《使用者協議》
            </Text>
            與
            <Text style={styles.linkText} onPress={handleOpenPrivacyPolicy}>
              《隱私政策》
            </Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.sendButton,
            !buttonEnabled ? styles.sendButtonDisabled : null,
            sending ? styles.sendButtonSending : null,
          ]}
          onPress={handleSendCode}
          activeOpacity={0.8}
          disabled={!buttonEnabled}
        >
          {sending ? <ActivityIndicator size="small" color="#ffffff" /> : null}
          <Text
            style={[
              styles.sendButtonText,
              !buttonEnabled ? styles.sendButtonTextDisabled : null,
            ]}
          >
            {sending ? '發送中...' : '獲取驗證碼'}
          </Text>
        </TouchableOpacity>
      </View>
    </AuthScreenShell>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: AUTH_COLORS.surfaceBorder,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
    shadowColor: '#66a9ff',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.14,
    shadowRadius: 30,
    elevation: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: AUTH_COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 28,
  },
  fieldWrap: {
    marginBottom: 20,
  },
  phoneField: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 70,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.inputBackground,
    paddingHorizontal: 18,
  },
  phoneFieldError: {
    borderColor: AUTH_COLORS.danger,
  },
  phonePrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prefixText: {
    fontSize: 17,
    fontWeight: '700',
    color: AUTH_COLORS.textMuted,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(154, 184, 214, 0.42)',
    marginHorizontal: 16,
  },
  phoneInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 18,
    fontWeight: '600',
    color: AUTH_COLORS.text,
    letterSpacing: 0.4,
  },
  phoneErrorText: {
    marginTop: 10,
    marginLeft: 6,
    fontSize: 13,
    color: AUTH_COLORS.danger,
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 24,
    paddingHorizontal: 2,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: AUTH_COLORS.checkBorder,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    borderColor: AUTH_COLORS.checkFill,
    backgroundColor: AUTH_COLORS.checkFill,
    shadowColor: AUTH_COLORS.checkFill,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 3,
  },
  agreementText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 24,
    color: AUTH_COLORS.textMuted,
  },
  linkText: {
    color: AUTH_COLORS.link,
  },
  sendButton: {
    minHeight: 64,
    borderRadius: 22,
    backgroundColor: AUTH_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: AUTH_COLORS.primary,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.26,
    shadowRadius: 22,
    elevation: 8,
  },
  sendButtonDisabled: {
    backgroundColor: AUTH_COLORS.primaryDisabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonSending: {
    backgroundColor: AUTH_COLORS.primaryPressed,
  },
  sendButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  sendButtonTextDisabled: {
    color: AUTH_COLORS.primaryTextDisabled,
  },
});
