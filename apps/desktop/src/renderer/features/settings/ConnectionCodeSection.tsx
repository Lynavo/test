import { useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@renderer/components/ui/button';
import { CopyButton } from '@renderer/components/shared/CopyButton';
import { useSettingsStore } from '@renderer/stores/settings-store';
import { useSidecarRuntimeStore } from '@renderer/stores/sidecar-runtime-store';
import { QRCodeSVG } from 'qrcode.react';

export function ConnectionCodeSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const code = settings.connectionCode;

  const sidecarRuntime = useSidecarRuntimeStore((s) => s.runtime);
  const advertisedIP = sidecarRuntime.bonjour.advertisedIP;
  const localIPs = window.electronAPI.platform.getLocalIPs();
  const currentIP = advertisedIP || localIPs[0] || '127.0.0.1';
  const deviceName = window.electronAPI.platform.getHostName();

  const qrPayload = JSON.stringify({
    ip: currentIP,
    port: 39393,
    code,
    name: deviceName,
  });

  const handleRegenerate = useCallback(async () => {
    if (!window.confirm(t('settings.connectionCode.regenerateConfirm'))) {
      return;
    }

    try {
      const result = await window.electronAPI.sidecar.regenerateConnectionCode();
      updateSettings({ ...settings, connectionCode: result.code });
    } catch {
      toast.error(t('errors.settings.regenerateCodeFailed'));
    }
  }, [settings, t, updateSettings]);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-row items-center justify-between gap-6">
      <div className="flex flex-col items-center flex-1">
        <div className="mb-4 flex items-center justify-center">
          <div className="flex items-center gap-1">
            {code.split('').map((digit, i) => (
              <div
                key={i}
                data-testid="code-digit"
                className="flex h-14 w-11 items-center justify-center rounded-xl bg-secondary text-xl font-bold text-foreground"
              >
                {digit}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center gap-3">
          <CopyButton
            text={code}
            label={t('common.actions.copy')}
            className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary"
          />
          <Button onClick={handleRegenerate} size="default">
            <RefreshCw className="h-4 w-4" />
            {t('settings.connectionCode.regenerate')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center shrink-0 rounded-xl bg-white p-2 border border-border shadow-sm">
        <QRCodeSVG value={qrPayload} size={110} level="M" />
      </div>
    </div>
  );
}
