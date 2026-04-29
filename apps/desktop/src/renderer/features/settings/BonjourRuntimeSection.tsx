import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@renderer/components/ui/button';
import {
  getBonjourInstallErrorMessage,
  getBonjourInstallSuccessMessage,
} from '@renderer/lib/bonjour-install';
import { getBonjourRuntimeMessage } from '@renderer/lib/runtime-messages';
import { useSidecarRuntimeStore } from '@renderer/stores/sidecar-runtime-store';
import { BONJOUR_WINDOWS_SUPPORT_URL } from '../../../shared/bonjour';

export function BonjourRuntimeSection() {
  const { t } = useTranslation();
  const runtime = useSidecarRuntimeStore((s) => s.runtime);
  const [retrying, setRetrying] = useState(false);
  const [installing, setInstalling] = useState(false);
  const isWindows = window.electronAPI?.platform.isWindows?.() ?? false;

  if (!isWindows) {
    return null;
  }

  const usingBonjour = runtime.bonjour.status === 'native';

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await window.electronAPI.sidecar.retryStart();
      toast.success(t('errors.settings.bonjourRetrySuccess'));
    } catch {
      toast.error(t('errors.settings.bonjourRetryFailed'));
    } finally {
      setRetrying(false);
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const result = await window.electronAPI.sidecar.installBonjour();
      toast.success(getBonjourInstallSuccessMessage(result.messageCode, t));
    } catch (error) {
      toast.error(t('errors.settings.bonjourInstallFailed'), {
        description: getBonjourInstallErrorMessage(error, t),
      });
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div
      className="rounded-2xl border p-5 shadow-sm"
      style={{
        borderColor: usingBonjour ? 'rgba(34,197,94,0.25)' : 'rgba(59,130,246,0.2)',
        background: usingBonjour ? 'rgba(240,253,244,0.9)' : 'rgba(239,246,255,0.9)',
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {usingBonjour ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-sky-600" />
              )}
              {t('settings.sections.bonjour')}
            </div>
            <p className="text-xs text-muted-foreground">
              {runtime.bonjour.status === 'not_applicable'
                ? t('settings.bonjour.defaultMessage')
                : getBonjourRuntimeMessage(
                    runtime.bonjour,
                    t,
                    'settings.bonjour.defaultMessage',
                  )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!usingBonjour && (
              <Button
                type="button"
                size="sm"
                disabled={installing || retrying}
                onClick={() => void handleInstall()}
              >
                {installing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('settings.bonjour.install')}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={retrying || runtime.status === 'starting' || installing}
              onClick={() => void handleRetry()}
            >
              {retrying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              {t('settings.bonjour.retry')}
            </Button>
            {!usingBonjour && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={installing}
                onClick={() =>
                  void window.electronAPI.files.openExternal(BONJOUR_WINDOWS_SUPPORT_URL)
                }
              >
                {t('settings.bonjour.openApplePage')}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-white/70 px-4 py-3">
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              {t('settings.bonjour.mode')}
            </div>
            <p className="text-sm font-medium text-foreground">
              {usingBonjour
                ? t('settings.bonjour.appleBonjour')
                : t('settings.bonjour.fallbackMode')}
            </p>
          </div>

          <div className="rounded-xl bg-white/70 px-4 py-3">
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              {t('settings.bonjour.advertisedIp')}
            </div>
            <p className="break-all text-sm font-medium text-foreground font-mono">
              {runtime.bonjour.advertisedIP ?? t('common.fallback.starting')}
            </p>
            {runtime.bonjour.advertisedIP ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('settings.bonjour.sameLanHint')}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl bg-white/70 px-4 py-3">
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              {t('settings.bonjour.runtimePath')}
            </div>
            <p className="break-all text-sm font-medium text-foreground">
              {runtime.bonjour.path ?? t('settings.bonjour.runtimeNotFound')}
            </p>
          </div>
        </div>

        {!usingBonjour && (
          <div className="rounded-xl bg-white/60 px-4 py-3 text-xs text-muted-foreground">
            {t('settings.bonjour.installHint')}
          </div>
        )}
      </div>
    </div>
  );
}
