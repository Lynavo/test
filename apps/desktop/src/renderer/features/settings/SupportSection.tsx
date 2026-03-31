import { useEffect, useMemo, useState } from 'react';
import { ActivitySquare, Archive, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@renderer/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@renderer/components/ui/dialog';
import { formatDateTime } from '@renderer/lib/format';
import { useDashboardStore } from '@renderer/stores/dashboard-store';
import { useSettingsStore } from '@renderer/stores/settings-store';

export function SupportSection() {
  const summary = useDashboardStore((s) => s.summary);
  const hasActiveTransfer = useDashboardStore((s) =>
    s.devices.some((device) => device.status === 'transferring'),
  );
  const fetchDashboard = useDashboardStore((s) => s.fetchDashboard);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const [appInfo, setAppInfo] = useState<{
    name: string;
    version: string;
    buildNumber: string;
  } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    void api.support
      .getAppInfo()
      .then(setAppInfo)
      .catch(() => undefined);
  }, []);

  const lastSuccessfulSyncLabel = useMemo(() => {
    if (!summary.lastSuccessfulSyncAt) return '暂无记录';
    return `${formatDateTime(summary.lastSuccessfulSyncAt)} · ${summary.lastSuccessfulDeviceName ?? '未知设备'}`;
  }, [summary.lastSuccessfulDeviceName, summary.lastSuccessfulSyncAt]);

  const handleExport = async () => {
    const api = window.electronAPI;
    if (!api || exporting) return;

    try {
      setExporting(true);
      const archivePath = await api.support.exportDiagnostics();
      if (archivePath) {
        toast.success('诊断包已导出', {
          description: archivePath,
        });
      }
    } catch (error) {
      toast.error('诊断包导出失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleResetState = async () => {
    const api = window.electronAPI;
    if (!api || resetting) return;

    try {
      setResetting(true);
      await api.sidecar.resetState();
      await Promise.all([fetchDashboard(), fetchSettings()]);
      setResetDialogOpen(false);
      toast.success('状态已重置', {
        description: '已清空已传输数据、设备配对和同步历史，配置保持不变。',
      });
    } catch (error) {
      toast.error('重置状态失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">支持与诊断</h3>
            <p className="text-xs text-muted-foreground">
              内测阶段遇到同步、重连或共享问题时，建议先导出诊断包再反馈。
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={() => void handleExport()}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            导出诊断包
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-secondary/60 px-4 py-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              最近一次成功同步
            </div>
            <p className="text-sm font-medium text-foreground">{lastSuccessfulSyncLabel}</p>
          </div>

          <div className="rounded-xl bg-secondary/60 px-4 py-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ActivitySquare className="h-4 w-4 text-sky-500" />
              桌面端版本
            </div>
            <p className="text-sm font-medium text-foreground">
              {appInfo
                ? `${appInfo.name} v${appInfo.version}${appInfo.buildNumber ? ` (${appInfo.buildNumber})` : ''}`
                : '读取中…'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-foreground">重置状态</h4>
              <p className="text-xs leading-5 text-muted-foreground">
                清空所有已传输文件、设备配对、同步历史和统计数据，保留设备名称、连接码、接收路径与共享配置。
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                重置后桌面端会像新安装一样开始记录，已配对手机需要重新连接。
              </p>
              {hasActiveTransfer ? (
                <p className="text-xs leading-5 text-destructive">
                  当前有文件正在传输，传输完成后才能重置。
                </p>
              ) : null}
            </div>

            <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={resetting || hasActiveTransfer}
                >
                  <RotateCcw className="h-4 w-4" />
                  重置状态
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>确认重置状态？</DialogTitle>
                  <DialogDescription>
                    这个操作会删除桌面端所有已接收文件和同步历史，但不会改动设备名称、连接码、接收路径和共享配置。
                  </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
                  重置内容包括：设备列表、配对凭证、传输记录、统计数据，以及接收目录中的已传输文件。
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setResetDialogOpen(false)}
                    disabled={resetting}
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void handleResetState()}
                    disabled={resetting}
                  >
                    {resetting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    确认重置
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}
