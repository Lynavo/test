import { useCallback, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import vividropLogo from '@renderer/assets/vividrop-logo-cutout.png';

type AuthProvider = 'google' | 'apple';

type AuthResult = {
  ok: boolean;
  message?: string;
  reason?: string;
};

type AuthPageProps = {
  onAuthenticated: () => void | Promise<void>;
};

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.16-3.16A11 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.86-3.08.41-1.09-.47-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.41C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
    </svg>
  );
}

function getOAuthErrorMessage(result: AuthResult, provider: AuthProvider): string {
  if (result.message) {
    return result.message;
  }
  return provider === 'google' ? 'Google 登录失败' : 'Apple 登录失败';
}

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [showAgreementHint, setShowAgreementHint] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<AuthProvider | null>(null);

  const handleProviderClick = useCallback(
    async (provider: AuthProvider) => {
      if (!agreedToPrivacy) {
        setShowAgreementHint(true);
        return;
      }

      const auth = window.electronAPI?.auth;
      if (!auth?.loginWithOAuth) {
        toast.error('登录服务暂不可用');
        return;
      }

      setLoadingProvider(provider);
      try {
        const result: AuthResult = await auth.loginWithOAuth({ provider });
        if (result.ok) {
          toast.success('登录成功');
          await onAuthenticated();
        } else {
          toast.error(getOAuthErrorMessage(result, provider));
        }
      } catch (error) {
        toast.error(provider === 'google' ? 'Google 登录失败' : 'Apple 登录失败', {
          description: error instanceof Error ? error.message : undefined,
        });
      } finally {
        setLoadingProvider(null);
      }
    },
    [agreedToPrivacy, onAuthenticated],
  );

  return (
    <div
      className="relative flex h-screen items-center justify-center overflow-hidden px-6 text-[#17191c]"
      style={{
        backgroundColor: '#f7fbff',
        backgroundImage:
          'linear-gradient(135deg, rgba(255,252,247,0.98) 0%, rgba(247,252,255,0.92) 38%, rgba(239,248,255,0.92) 68%, rgba(255,248,220,0.72) 100%), repeating-linear-gradient(0deg, rgba(23,25,28,0.024) 0 1px, transparent 1px 3px)',
        backgroundBlendMode: 'normal, overlay',
      }}
    >
      <div className="absolute left-10 top-10 flex items-center gap-3">
        <img src={vividropLogo} alt="" draggable={false} className="h-9 w-auto object-contain" />
        <p className="text-[18px] font-semibold leading-none text-[#17191c]">ViviDrop</p>
      </div>

      <div className="w-full max-w-[440px]">
        <section className="rounded-lg border border-white/70 bg-white/54 p-5 shadow-[0_30px_90px_rgba(70,96,138,0.16)] backdrop-blur-2xl">
          <div className="mb-5 text-center">
            <h1 className="text-xl font-semibold text-[#17191c]">登录</h1>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => void handleProviderClick('google')}
              disabled={loadingProvider !== null}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/70 bg-white/58 text-sm font-semibold text-[#17191c] shadow-[0_10px_30px_rgba(90,120,170,0.08)] transition hover:bg-white/82 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loadingProvider === 'google' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon className="h-4 w-4 shrink-0" />
              )}
              使用 Google 继续
            </button>
            <button
              type="button"
              onClick={() => void handleProviderClick('apple')}
              disabled={loadingProvider !== null}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/70 bg-white/58 text-sm font-semibold text-[#17191c] shadow-[0_10px_30px_rgba(90,120,170,0.08)] transition hover:bg-white/82 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loadingProvider === 'apple' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <AppleIcon className="h-4 w-4 shrink-0 text-[#17191c]" />
              )}
              使用 Apple 继续
            </button>
          </div>

          <div className="mt-5 flex items-start gap-2 text-xs leading-5 text-[#7b8490]">
            <button
              type="button"
              role="checkbox"
              aria-checked={agreedToPrivacy}
              aria-label="我已阅读并同意《隐私政策》和《用户协议》"
              onClick={() => {
                setAgreedToPrivacy((prev) => !prev);
                setShowAgreementHint(false);
              }}
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition ${
                agreedToPrivacy
                  ? 'border-[#17191c] bg-[#17191c] text-white'
                  : 'border-[#cfd6df] bg-white/70 text-transparent'
              }`}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </button>
            <span>
              我已阅读并同意
              <button
                type="button"
                className="font-semibold text-[#17191c] underline-offset-2 hover:underline"
              >
                《隐私政策》
              </button>
              和
              <button
                type="button"
                className="font-semibold text-[#17191c] underline-offset-2 hover:underline"
              >
                《用户协议》
              </button>
            </span>
          </div>

          {showAgreementHint ? (
            <p className="mt-2 text-center text-xs font-medium text-[#d92d20]">
              请先勾选同意隐私政策后再登录
            </p>
          ) : null}

          <p className="mt-4 text-center text-xs text-[#7b8490]">未注册的账号将自动注册</p>
        </section>
      </div>
    </div>
  );
}
