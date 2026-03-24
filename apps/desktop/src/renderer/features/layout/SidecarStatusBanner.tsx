import { useState } from 'react';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@renderer/components/ui/button';
import { useSidecarRuntimeStore } from '@renderer/stores/sidecar-runtime-store';

export function SidecarStatusBanner() {
  const runtime = useSidecarRuntimeStore((s) => s.runtime);
  const [retrying, setRetrying] = useState(false);

  if (runtime.status === 'healthy' || runtime.status === 'stopped') {
    return null;
  }

  const isStarting = runtime.status === 'starting';
  const title = isStarting
    ? runtime.restartCount > 0
      ? '后台服务正在重试'
      : '后台服务启动中'
    : '后台服务启动失败';
  const detail =
    runtime.message ??
    (isStarting
      ? '桌面应用正在等待本地 sidecar 服务就绪。'
      : '本地 sidecar 未能成功启动。');

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await window.electronAPI.sidecar.retryStart();
    } catch {
      toast.error('重试启动后台服务失败');
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      className="mx-6 mt-5 flex items-start gap-3 rounded-2xl border px-4 py-3"
      style={{
        background: isStarting ? 'rgba(255,247,237,0.9)' : 'rgba(254,226,226,0.9)',
        borderColor: isStarting ? 'rgba(251,191,36,0.45)' : 'rgba(252,165,165,0.55)',
        color: isStarting ? '#92400e' : '#b91c1c',
        backdropFilter: 'blur(10px)',
      }}
      role="alert"
    >
      {isStarting ? (
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}

      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-sm opacity-90">{detail}</div>
        {runtime.lastExitCode !== null && (
          <div className="mt-1 text-xs opacity-80">
            最近退出码：{runtime.lastExitCode}
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleRetry}
        disabled={retrying || isStarting}
        className="shrink-0"
      >
        <RotateCcw className="h-4 w-4" />
        重试
      </Button>
    </div>
  );
}
