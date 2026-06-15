import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Eye,
  EyeOff,
  ChevronDown,
  Share2,
  FolderOpen,
  Wifi,
  Laptop,
  ArrowRightLeft,
  Smartphone,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDashboardStore } from '@renderer/stores/dashboard-store';
import { useSettingsStore } from '@renderer/stores/settings-store';
import { formatBytes } from '@renderer/lib/format';
import { Button } from '@renderer/components/ui/button';
import { GlassCard } from '@renderer/components/shared/GlassCard';

export function Dashboard() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const summary = useDashboardStore((s) => s.summary);
  const fetchDashboard = useDashboardStore((s) => s.fetchDashboard);

  const [masked, setMasked] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transferActive, setTransferActive] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    const api = window.electronAPI;
    if (!api) return;
    try {
      await api.files.copyToClipboard(settings.connectionCode || '000000');
      setCopied(true);
      toast.success('连接码已复制');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  };

  const [remoteAccess, setRemoteAccess] = useState(() => {
    return localStorage.getItem('remoteAccessEnabled') !== 'false';
  });

  // Load stats on mount
  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  // Subscribe to transfer active state
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    void api.sidecar.getTransferActive().then(
      (r) => setTransferActive(r.active),
      () => {},
    );

    const unsub = api.events.onSidecarEvent((event) => {
      if (event.type === 'transfer.active.changed') {
        setTransferActive((event.payload as { isActive: boolean }).isActive);
      }
    });
    return unsub;
  }, []);

  const toggleRemoteAccess = () => {
    const next = !remoteAccess;
    setRemoteAccess(next);
    localStorage.setItem('remoteAccessEnabled', String(next));
    toast.success(next ? '远端访问已开启' : '远端访问已关闭');
  };

  const handleDoubleClickCode = async () => {
    if (masked) {
      toast.error('请先显示连接码再双击修改');
      return;
    }
    const api = window.electronAPI;
    if (!api) return;
    try {
      const result = await api.sidecar.regenerateConnectionCode();
      useSettingsStore.getState().updateSettings({
        ...settings,
        connectionCode: result.code,
      });
      toast.success('连接码已重新生成！旧配对设备已失效');
    } catch (err) {
      console.error('Failed to regenerate code:', err);
      toast.error('重新生成连接码失败');
    }
  };

  const handleSelectFolder = async () => {
    if (transferActive) {
      toast.error('正在传输文件中，无法修改接收目录');
      return;
    }
    try {
      const selected = await window.electronAPI?.files.selectFolder();
      if (selected && selected !== settings.rootPath) {
        setSaving(true);
        const updated = await window.electronAPI?.sidecar.updateSettings({
          rootPath: selected,
        });
        if (updated) {
          useSettingsStore.getState().updateSettings(updated);
          void useSettingsStore.getState().refreshShareStatus(true);
          toast.success('接收目录修改成功');
        }
      }
    } catch {
      toast.error('储存接收目录失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadApp = () => {
    void window.electronAPI?.files.openExternal('https://vividrop.app');
  };

  return (
    <div className="flex-1 overflow-auto px-6 py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-xl font-bold text-[#1a2a3a]">共享管理</h1>

        <div className="flex flex-col gap-5">
          {/* Card 1: Connection Code */}
          <div className="rounded-2xl border border-white/60 bg-white/45 p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e6f4ff] text-[#1890ff] shadow-sm">
                <Laptop className="h-5 w-5" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">连接码</h2>
            </div>

            <div className="relative flex items-center justify-center bg-white/70 border border-slate-100 rounded-xl px-4 py-6 my-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)]">
              <div
                onDoubleClick={handleDoubleClickCode}
                className="text-2xl font-mono font-bold tracking-[0.4em] select-none cursor-pointer"
                style={{ color: '#1a2a3a' }}
              >
                {masked ? '••••••' : settings.connectionCode || '000000'}
              </div>
              <div className="absolute right-4 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMasked(!masked)}
                  className="p-1.5 hover:bg-slate-100/80 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="显示连接码"
                >
                  {masked ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-1.5 hover:bg-slate-100/80 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="复制"
                  title="复制"
                >
                  {copied ? <Check className="h-4.5 w-4.5 text-[#52c41a]" /> : <Copy className="h-4.5 w-4.5" />}
                </button>
                <ChevronDown className="h-4.5 w-4.5 text-slate-300" />
              </div>
            </div>

            <p className="text-center text-[11px] text-[#858b96]">
              显示连接码后可双击修改
            </p>
          </div>

          {/* Onboarding hint under card 1 */}
          <div className="flex items-center justify-center gap-1 text-xs text-[#858b96] py-1">
            <Smartphone className="h-4 w-4" />
            <span>下载 App · 在同一 Wi-Fi 下扫描，选择该设备，扫码或输入连接码连接设备</span>
          </div>

          {/* Card 2: Remote Access */}
          <div className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/45 p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f6ffed] text-[#52c41a] shadow-sm">
                <Share2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">远程访问</h2>
                <p className="mt-1 text-xs text-[#858b96]">
                  开启后手机可远程访问电脑的文件
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleRemoteAccess}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                remoteAccess ? 'bg-slate-900' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  remoteAccess ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Card 3: Receive Directory */}
          <div className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/45 p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff7e6] text-[#fa8c16] shadow-sm">
                <FolderOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-slate-800">接收目录</h2>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap min-w-0">
                  <span className="truncate text-xs text-[#525964] font-mono bg-white/50 px-2 py-0.5 rounded border border-white/60">
                    {settings.receivePath || '—'}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#f6ffed] border border-[#b7eb8f] px-2 py-0.5 text-[10px] font-semibold text-[#52c41a]">
                    剩余 {formatBytes(summary.remainingBytes)}
                  </span>
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleSelectFolder}
              disabled={saving}
              className="bg-[#0050b3] hover:bg-[#003a8c] text-white flex items-center gap-1.5 rounded-lg px-4 shadow-sm shrink-0 active:scale-[0.98]"
            >
              <FolderOpen className="h-4 w-4" />
              修改目录
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
