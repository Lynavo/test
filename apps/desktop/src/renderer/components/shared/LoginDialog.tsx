import React, { useState, useCallback } from 'react';
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
};

function getSMSSendErrorMessage(result: AuthResult, t: (key: string) => string): string {
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

function getSMSLoginErrorMessage(result: AuthResult, t: (key: string) => string): string {
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
  { code: '+86', label: '🇨🇳 China (+86)' },
  { code: '+1', label: '🇺🇸/🇨🇦 North America (+1)' },
  { code: '+886', label: '🇹🇼 Taiwan (+886)' },
  { code: '+852', label: '🇭🇰 Hong Kong (+852)' },
  { code: '+81', label: '🇯🇵 Japan (+81)' },
  { code: '+65', label: '🇸🇬 Singapore (+65)' },
];

type LoginDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoginSuccess: () => void;
};

export function LoginDialog({ open, onOpenChange, onLoginSuccess }: LoginDialogProps) {
  const { t } = useTranslation();
  const isGlobal = isGlobalMarket();

  const [countryCode, setCountryCode] = useState('+86');
  const [phone, setPhone] = useState('');
  const [smsCode, setSMSCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSendSMSCode = useCallback(async () => {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      toast.error(t('errors.settings.phoneRequired'));
      return;
    }
    const fullPhone = isGlobal ? (countryCode + trimmedPhone) : trimmedPhone;
    const auth = (window as any).electronAPI?.auth;
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
    } catch (error: any) {
      toast.error(t('errors.settings.sendSMSCodeFailed'), { description: error.message });
    } finally {
      setIsSendingCode(false);
    }
  }, [phone, countryCode, isGlobal, t]);

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
    const fullPhone = isGlobal ? (countryCode + trimmedPhone) : trimmedPhone;
    const auth = (window as any).electronAPI?.auth;
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
    } catch (error: any) {
      toast.error(t('errors.settings.loginWithSMSCodeFailed'), { description: error.message });
    } finally {
      setIsLoggingIn(false);
    }
  }, [phone, smsCode, countryCode, isGlobal, onOpenChange, onLoginSuccess, t]);

  const handleOAuthLogin = useCallback(async (provider: 'google' | 'apple') => {
    const auth = (window as any).electronAPI?.auth;
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
        toast.error(result.message || `${provider} Sign-in failed`);
      }
    } catch (error: any) {
      toast.error(`${provider} Sign-in error`, { description: error.message });
    } finally {
      setIsLoggingIn(false);
    }
  }, [onOpenChange, onLoginSuccess, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>
            {isGlobal ? t('settings.giftCard.phoneLogin.title', { defaultValue: '登入或註冊' }) : t('settings.giftCard.phoneLogin.title')}
          </DialogTitle>
          <DialogDescription>
            {isGlobal ? t('settings.giftCard.phoneLogin.description', { defaultValue: '登入後可解鎖遠端同步與更多功能' }) : t('settings.giftCard.phoneLogin.description')}
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
              {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue with Google'}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => void handleOAuthLogin('apple')}
              disabled={isLoggingIn || isSendingCode}
              className="w-full flex items-center justify-center gap-2 h-10 border border-muted-foreground/20 hover:bg-muted/50"
            >
              {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue with Apple'}
            </Button>
            <div className="flex items-center my-2">
              <div className="flex-grow h-[1px] bg-border" />
              <span className="mx-3 text-[11px] font-semibold text-muted-foreground">OR</span>
              <div className="flex-grow h-[1px] bg-border" />
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-phone">
              {t('settings.giftCard.phoneLogin.phoneLabel')}
            </Label>
            <div className="flex gap-2">
              {isGlobal && (
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger className="w-[110px] shrink-0">
                    <SelectValue placeholder="Code" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_COUNTRY_CODES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            <Label htmlFor="login-sms-code">
              {t('settings.giftCard.phoneLogin.codeLabel')}
            </Label>
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
