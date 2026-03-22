import { useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@renderer/components/ui/button';
import { CopyButton } from '@renderer/components/shared/CopyButton';
import { useSettingsStore } from '@renderer/stores/settings-store';

export function ConnectionCodeSection() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const code = settings.connectionCode;

  const handleRegenerate = useCallback(async () => {
    try {
      const result = await window.electronAPI.sidecar.regenerateConnectionCode();
      updateSettings({ ...settings, connectionCode: result.code });
    } catch {
      toast.error('重新生成连接码失败');
    }
  }, [settings, updateSettings]);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
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
          label="复制"
          className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary"
        />
        <Button onClick={handleRegenerate} size="default">
          <RefreshCw className="h-4 w-4" />
          重新生成
        </Button>
      </div>
    </div>
  );
}
