import React, { useState, useCallback } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { isGlobalMarket } from '@renderer/../shared/market';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';

type AuthResult = {
  ok: boolean;
  message?: string;
  reason?: string;
  userId?: number;
  isNewUser?: boolean;
  merged?: boolean;
};

function getSMSSendErrorMessage(result: AuthResult, t: TFunction): string {
  switch (result.reason) {
    case 'phone_invalid':
      return t('errors.settings.phoneInvalid');
    case 'sms_too_frequent':
      return t('errors.settings.smsTooFrequent');
    case 'sms_send_failed':
      return t('errors.settings.smsSendFailed');
    default:
      return result.message || t('errors.settings.sendSMSCodeFailed');
  }
}

function getSMSLoginErrorMessage(result: AuthResult, t: TFunction): string {
  switch (result.reason) {
    case 'phone_invalid':
      return t('errors.settings.phoneInvalid');
    case 'sms_code_invalid':
      return t('errors.settings.smsCodeInvalid');
    case 'sms_code_expired':
      return t('errors.settings.smsCodeExpired');
    case 'sms_max_attempts':
      return t('errors.settings.smsMaxAttempts');
    case 'session_replaced':
      return t('errors.settings.sessionReplaced');
    default:
      return result.message || t('errors.settings.loginWithSMSCodeFailed');
  }
}

const COMMON_COUNTRY_CODES = [
  { code: '+86', labelKey: 'settings.giftCard.phoneLogin.countryCodes.china' },
  { code: '+1', labelKey: 'settings.giftCard.phoneLogin.countryCodes.northAmerica' },
  { code: '+886', labelKey: 'settings.giftCard.phoneLogin.countryCodes.taiwan' },
  { code: '+852', labelKey: 'settings.giftCard.phoneLogin.countryCodes.hongKong' },
  { code: '+81', labelKey: 'settings.giftCard.phoneLogin.countryCodes.japan' },
  { code: '+65', labelKey: 'settings.giftCard.phoneLogin.countryCodes.singapore' },
] as const;

type CountryCode = (typeof COMMON_COUNTRY_CODES)[number]['code'];
type OAuthProvider = 'google' | 'apple';

const COUNTRY_CODE_STORAGE_KEY = 'syncflow.desktop.login.countryCode';

function isSupportedCountryCode(value: string | null | undefined): value is CountryCode {
  return COMMON_COUNTRY_CODES.some((country) => country.code === value);
}

function getBrowserLanguages(): string[] {
  if (typeof navigator === 'undefined') {
    return [];
  }

  return navigator.languages?.length
    ? [...navigator.languages]
    : [navigator.language].filter(Boolean);
}

function getStoredCountryCode(): CountryCode | null {
  try {
    const value = window.localStorage.getItem(COUNTRY_CODE_STORAGE_KEY);
    return isSupportedCountryCode(value) ? value : null;
  } catch {
    return null;
  }
}

function persistCountryCode(countryCode: CountryCode): void {
  try {
    window.localStorage.setItem(COUNTRY_CODE_STORAGE_KEY, countryCode);
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

function resolveCountryCodeFromLocale(locale: string): CountryCode | null {
  const normalized = locale.trim().toLowerCase().replace(/_/g, '-');

  if (!normalized) {
    return null;
  }

  if (normalized.includes('-tw')) {
    return '+886';
  }

  if (normalized.includes('-hk') || normalized.includes('-mo')) {
    return '+852';
  }

  if (normalized.includes('-sg')) {
    return '+65';
  }

  if (normalized.includes('-cn') || normalized.startsWith('zh-hans')) {
    return '+86';
  }

  if (normalized.startsWith('zh-hant')) {
    return '+886';
  }

  if (normalized.startsWith('ja')) {
    return '+81';
  }

  if (normalized.startsWith('en')) {
    return '+1';
  }

  return null;
}

export function resolveDefaultCountryCode({
  isGlobal,
  language,
  navigatorLanguages = [],
  storedCountryCode,
}: {
  isGlobal: boolean;
  language?: string;
  navigatorLanguages?: readonly string[];
  storedCountryCode?: string | null;
}): CountryCode {
  if (!isGlobal) {
    return '+86';
  }

  if (isSupportedCountryCode(storedCountryCode)) {
    return storedCountryCode;
  }

  const localeCandidates = [language, ...navigatorLanguages].filter(Boolean) as string[];
  for (const locale of localeCandidates) {
    const countryCode = resolveCountryCodeFromLocale(locale);
    if (countryCode) {
      return countryCode;
    }
  }

  return '+1';
}

function getOAuthProviderLabel(provider: OAuthProvider, t: TFunction): string {
  return t(`settings.giftCard.phoneLogin.oauth.providers.${provider}`);
}

function getOAuthLoginErrorMessage(
  result: AuthResult,
  provider: OAuthProvider,
  t: TFunction,
): string {
  return (
    result.message ||
    t('errors.settings.oauthLoginFailed', { provider: getOAuthProviderLabel(provider, t) })
  );
}

function getErrorDescription(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

type LoginDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoginSuccess: () => void;
  title?: string;
  description?: string;
};

export function LoginDialog({
  open,
  onOpenChange,
  onLoginSuccess,
  title,
  description,
}: LoginDialogProps) {
  const { t, i18n } = useTranslation();
  const isGlobal = isGlobalMarket();

  const [countryCode, setCountryCode] = useState<CountryCode>(() =>
    resolveDefaultCountryCode({
      isGlobal,
      language: i18n.resolvedLanguage || i18n.language,
      navigatorLanguages: getBrowserLanguages(),
      storedCountryCode: getStoredCountryCode(),
    }),
  );
  const [phone, setPhone] = useState('');
  const [smsCode, setSMSCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  React.useEffect(() => {
    if (open) {
      setCountryCode(
        resolveDefaultCountryCode({
          isGlobal,
          language: i18n.resolvedLanguage || i18n.language,
          navigatorLanguages: getBrowserLanguages(),
          storedCountryCode: getStoredCountryCode(),
        }),
      );
      setPhone('');
      setSMSCode('');
    }
  }, [i18n.language, i18n.resolvedLanguage, isGlobal, open]);

  const handleCountryCodeChange = useCallback(
    (value: string) => {
      if (!isSupportedCountryCode(value)) {
        return;
      }

      setCountryCode(value);
      if (isGlobal) {
        persistCountryCode(value);
      }
    },
    [isGlobal],
  );

  const getFormattedPhone = useCallback(
    (rawPhone: string) => {
      const trimmed = rawPhone.trim();
      const digits = normalizePhoneDigits(trimmed);
      if (trimmed.startsWith('+')) {
        return '+' + digits;
      }

      if (isGlobal) {
        if (countryCode === '+86' && digits.startsWith('86') && digits.length > 11) {
          return '+' + digits;
        }
        const localDigits =
          countryCode === '+1' || countryCode === '+86' ? digits : digits.replace(/^0+/, '');
        return countryCode + localDigits;
      } else {
        if (digits.startsWith('86') && digits.length > 11) {
          return '+' + digits;
        }
        return '+86' + digits;
      }
    },
    [countryCode, isGlobal],
  );

  const handleSendSMSCode = useCallback(async () => {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      toast.error(t('errors.settings.phoneRequired'));
      return;
    }
    const fullPhone = getFormattedPhone(trimmedPhone);
    const auth = window.electronAPI?.auth;
    if (!auth?.sendSMSCode) {
      toast.error(t('errors.settings.authUnavailable'));
      return;
    }

    setIsSendingCode(true);
    try {
      const result: AuthResult = await auth.sendSMSCode({ phone: fullPhone });
      if (result.ok) {
        toast.success(t('settings.giftCard.phoneLogin.codeSent'));
      } else {
        toast.error(getSMSSendErrorMessage(result, t));
      }
    } catch (error: unknown) {
      toast.error(t('errors.settings.sendSMSCodeFailed'), {
        description: getErrorDescription(error),
      });
    } finally {
      setIsSendingCode(false);
    }
  }, [phone, getFormattedPhone, t]);

  const handleSMSLogin = useCallback(async () => {
    const trimmedPhone = phone.trim();
    const trimmedSMSCode = smsCode.trim();
    if (!trimmedPhone) {
      toast.error(t('errors.settings.phoneRequired'));
      return;
    }
    if (!trimmedSMSCode) {
      toast.error(t('errors.settings.smsCodeRequired'));
      return;
    }
    const fullPhone = getFormattedPhone(trimmedPhone);
    const auth = window.electronAPI?.auth;
    if (!auth?.loginWithSMSCode) {
      toast.error(t('errors.settings.authUnavailable'));
      return;
    }

    setIsLoggingIn(true);
    try {
      const result: AuthResult = await auth.loginWithSMSCode({
        phone: fullPhone,
        code: trimmedSMSCode,
      });
      if (result.ok) {
        toast.success(t('settings.giftCard.phoneLogin.loginSuccess'));
        onOpenChange(false);
        setSMSCode('');
        onLoginSuccess();
      } else {
        toast.error(getSMSLoginErrorMessage(result, t));
      }
    } catch (error: unknown) {
      toast.error(t('errors.settings.loginWithSMSCodeFailed'), {
        description: getErrorDescription(error),
      });
    } finally {
      setIsLoggingIn(false);
    }
  }, [phone, smsCode, getFormattedPhone, onOpenChange, onLoginSuccess, t]);

  const handleOAuthLogin = useCallback(
    async (provider: OAuthProvider) => {
      const auth = window.electronAPI?.auth;
      if (!auth?.loginWithOAuth) {
        toast.error(t('errors.settings.authUnavailable'));
        return;
      }

      setIsLoggingIn(true);
      try {
        const result: AuthResult = await auth.loginWithOAuth({ provider });
        if (result.ok) {
          toast.success(t('settings.giftCard.phoneLogin.loginSuccess'));
          onOpenChange(false);
          onLoginSuccess();
        } else {
          toast.error(getOAuthLoginErrorMessage(result, provider, t));
        }
      } catch (error: unknown) {
        toast.error(
          t('errors.settings.oauthLoginError', { provider: getOAuthProviderLabel(provider, t) }),
          {
            description: getErrorDescription(error),
          },
        );
      } finally {
        setIsLoggingIn(false);
      }
    },
    [onOpenChange, onLoginSuccess, t],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>
            {title ||
              (isGlobal
                ? t('settings.giftCard.phoneLogin.globalTitle')
                : t('settings.giftCard.phoneLogin.title'))}
          </DialogTitle>
          <DialogDescription>
            {description ||
              (isGlobal
                ? t('settings.giftCard.phoneLogin.globalDescription')
                : t('settings.giftCard.phoneLogin.description'))}
          </DialogDescription>
        </DialogHeader>

        {isGlobal && (
          <div className="flex flex-col gap-3 pb-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => void handleOAuthLogin('google')}
              disabled={isLoggingIn || isSendingCode}
              className="w-full flex items-center justify-center gap-2 h-10 border border-muted-foreground/20 hover:bg-muted/50"
            >
              {isLoggingIn ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('settings.giftCard.phoneLogin.oauth.continueWithGoogle')
              )}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => void handleOAuthLogin('apple')}
              disabled={isLoggingIn || isSendingCode}
              className="w-full flex items-center justify-center gap-2 h-10 border border-muted-foreground/20 hover:bg-muted/50"
            >
              {isLoggingIn ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('settings.giftCard.phoneLogin.oauth.continueWithApple')
              )}
            </Button>
            <div className="flex items-center my-2">
              <div className="flex-grow h-[1px] bg-border" />
              <span className="mx-3 text-[11px] font-semibold text-muted-foreground">
                {t('settings.giftCard.phoneLogin.oauth.divider')}
              </span>
              <div className="flex-grow h-[1px] bg-border" />
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-phone">{t('settings.giftCard.phoneLogin.phoneLabel')}</Label>
            <div className="flex gap-2">
              {isGlobal ? (
                <Select value={countryCode} onValueChange={handleCountryCodeChange}>
                  <SelectTrigger className="w-[150px] shrink-0">
                    <SelectValue
                      placeholder={t('settings.giftCard.phoneLogin.countryCodePlaceholder')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_COUNTRY_CODES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        <span className="font-medium">{c.code}</span>
                        <span className="text-muted-foreground">{t(c.labelKey)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center justify-center px-3 h-10 rounded-md border border-input bg-muted text-muted-foreground text-sm font-medium shrink-0">
                  +86
                </div>
              )}
              <Input
                id="login-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('settings.giftCard.phoneLogin.phonePlaceholder')}
                disabled={isLoggingIn}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-sms-code">{t('settings.giftCard.phoneLogin.codeLabel')}</Label>
            <div className="flex gap-2">
              <Input
                id="login-sms-code"
                value={smsCode}
                onChange={(e) => setSMSCode(e.target.value)}
                placeholder={t('settings.giftCard.phoneLogin.codePlaceholder')}
                disabled={isLoggingIn}
                maxLength={12}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleSendSMSCode()}
                disabled={isSendingCode || isLoggingIn || phone.trim().length === 0}
                className="shrink-0"
              >
                {isSendingCode ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t('settings.giftCard.phoneLogin.sendCode')
                )}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button
            type="button"
            className="w-full"
            onClick={() => void handleSMSLogin()}
            disabled={isLoggingIn || !phone.trim() || !smsCode.trim()}
          >
            {isLoggingIn ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('settings.giftCard.phoneLogin.login')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
