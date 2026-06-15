import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  User,
  Crown,
  Globe,
  Power,
  Wifi,
  CheckCircle2,
  RefreshCw,
  Mail,
  FileText,
  ChevronRight,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@renderer/stores/auth-store';
import { useSettingsStore } from '@renderer/stores/settings-store';
import { persistLocale } from '@renderer/i18n';
import {
  isSupportedLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '@renderer/i18n/locale-resolver';
import type { PowerSaveState } from '../../../preload/api';
import { Button } from '@renderer/components/ui/button';

const localeLabels: Record<SupportedLocale, string> = {
  en: 'English',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
};

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const session = useAuthStore((s) => s.session);
  const settings = useSettingsStore((s) => s.settings);

  // States
  const [localIps, setLocalIps] = useState<string[]>([]);
  const [powerState, setPowerState] = useState<PowerSaveState | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [uploadingLogs, setUploadingLogs] = useState(false);
  const [powerLoading, setPowerLoading] = useState(true);

  // Current locale resolver
  const currentLocale = isSupportedLocale(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : 'en';

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!isSupportedLocale(value)) return;
    persistLocale(value);
    void i18n.changeLanguage(value);
    toast.success('界面语言修改成功');
  };

  // Fetch local IP address
  useEffect(() => {
    const ips = window.electronAPI?.platform.getLocalIPs?.() ?? [];
    setLocalIps(ips);
  }, []);

  // Fetch power save state
  const refreshPowerState = useCallback(async () => {
    try {
      const state = await window.electronAPI?.power.getState();
      if (state) setPowerState(state);
    } catch {
      console.warn('Failed to load power state');
    }
  }, []);

  useEffect(() => {
    refreshPowerState().finally(() => setPowerLoading(false));

    // Listen to transfer active events to refresh sleep block status
    const unsub = window.electronAPI?.events.onSidecarEvent((event) => {
      if (event.type === 'transfer.active.changed') {
        void refreshPowerState();
      }
    });
    return unsub;
  }, [refreshPowerState]);

  const togglePreventSleep = async () => {
    if (powerLoading) return;
    const currentEnabled = powerState?.preventSleepDuringTransfer ?? false;
    try {
      const nextState = await window.electronAPI?.power.setPreventSleepDuringTransfer(!currentEnabled);
      if (nextState) {
        setPowerState(nextState);
        toast.success(!currentEnabled ? '防止电脑待机已启用' : '防止电脑待机已关闭');
      }
    } catch {
      toast.error('修改防止待机配置失败');
    }
  };

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    try {
      await window.electronAPI?.support.checkForUpdates();
      toast.success('已是最新版本');
    } catch {
      toast.error('检查更新失败，请稍后重试');
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleUploadLogs = async () => {
    setUploadingLogs(true);
    try {
      await window.electronAPI?.support.uploadDiagnostics({
        description: 'Manual upload from desktop settings',
      });
      toast.success('诊断包上传成功！感谢您的反馈');
    } catch {
      toast.error('上传诊断包失败，请检查网络连接');
    } finally {
      setUploadingLogs(false);
    }
  };

  const handleMailFeedback = () => {
    void window.electronAPI?.files.openExternal('mailto:developer@vividrop.app');
  };

  const accountEmail = session?.email || session?.phone || 'vividrop@studio.example';
  const preventStandbyVal = powerState?.preventSleepDuringTransfer ?? false;

  return (
    <div className="flex-1 overflow-auto px-6 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="mb-6 text-xl font-bold text-[#1a2a3a]">我的</h1>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Column 1 */}
          <div className="flex flex-col gap-5">
            {/* Group 1: 我的账户 */}
            <div className="rounded-2xl border border-white/60 bg-white/45 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
              <h2 className="mb-3 text-[11px] font-bold text-[#858b96] uppercase tracking-wider">我的账户</h2>
              <div className="flex flex-col divide-y divide-slate-100/50">
                {/* Item 1: Account Info */}
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff2e8] text-[#fa541c] shadow-sm">
                      <User className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">账户</p>
                      <p className="mt-0.5 text-xs text-[#858b96] font-medium truncate max-w-48">
                        {accountEmail}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </div>

                {/* Item 2: Membership Status */}
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#feffe6] text-[#d4b106] shadow-sm border border-[#fffb8f]/50">
                      <Crown className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">会员状态</p>
                      <p className="mt-0.5 text-xs text-[#858b96] font-medium">免费版</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded bg-[#e6f7ff] border border-[#91d5ff] px-2 py-0.5 text-[10px] font-bold text-[#1890ff] shadow-sm">
                    Pro
                  </span>
                </div>
              </div>
            </div>

            {/* Group 2: 本机 info */}
            <div className="rounded-2xl border border-white/60 bg-white/45 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
              <h2 className="mb-3 text-[11px] font-bold text-[#858b96] uppercase tracking-wider">本机</h2>
              <div className="flex items-center gap-3 py-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6f4ff] text-[#1890ff] shadow-sm">
                  <Wifi className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">本机 IP</p>
                  <p className="mt-0.5 text-xs font-mono font-bold text-slate-700">
                    {localIps[0] || '192.168.0.227'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2 */}
          <div className="flex flex-col gap-5">
            {/* Group 3: 通用 settings */}
            <div className="rounded-2xl border border-white/60 bg-white/45 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
              <h2 className="mb-3 text-[11px] font-bold text-[#858b96] uppercase tracking-wider">通用</h2>
              <div className="flex flex-col divide-y divide-slate-100/50">
                {/* Language selection dropdown */}
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f9f0ff] text-[#722ed1] shadow-sm">
                      <Globe className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">界面语言</p>
                    </div>
                  </div>
                  <select
                    value={currentLocale}
                    onChange={handleLanguageChange}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none shadow-sm focus:border-slate-400 transition"
                  >
                    {SUPPORTED_LOCALES.map((locale) => (
                      <SelectItem key={locale} value={locale}>
                        {localeLabels[locale]}
                      </SelectItem>
                    ))}
                  </select>
                </div>

                {/* Prevent sleep switch */}
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6fffb] text-[#13c2c2] shadow-sm">
                      <Power className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">防止待机</p>
                      <p className="mt-0.5 text-[10px] text-[#858b96] font-medium leading-none">
                        传输任务运行时保持电脑唤醒
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={togglePreventSleep}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      preventStandbyVal ? 'bg-slate-900' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        preventStandbyVal ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Group 4: 版本 settings */}
            <div className="rounded-2xl border border-white/60 bg-white/45 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
              <h2 className="mb-3 text-[11px] font-bold text-[#858b96] uppercase tracking-wider">版本</h2>
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f6ffed] text-[#52c41a] shadow-sm">
                    <CheckCircle2 className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">ViviDrop Desktop</p>
                    <p className="mt-0.5 text-xs text-[#858b96] font-semibold leading-none">
                      v0.1.0 - 当前版本已安装
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCheckUpdates}
                  disabled={checkingUpdates}
                  className="bg-white/80 border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm active:scale-[0.98]"
                >
                  {checkingUpdates ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  检查更新
                </Button>
              </div>
            </div>

            {/* Group 5: 支持 settings */}
            <div className="rounded-2xl border border-white/60 bg-white/45 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
              <h2 className="mb-3 text-[11px] font-bold text-[#858b96] uppercase tracking-wider">支持</h2>
              <div className="flex flex-col divide-y divide-slate-100/50">
                {/* Feedback email */}
                <div
                  className="flex items-center justify-between py-3 cursor-pointer group"
                  onClick={handleMailFeedback}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff0f6] text-[#eb2f96] shadow-sm">
                      <Mail className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">问题反馈</p>
                      <p className="mt-0.5 text-[10px] text-[#858b96] font-semibold leading-none">
                        developer@vividrop.app
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>

                {/* Upload logs */}
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f0f5ff] text-[#2f54eb] shadow-sm">
                      <FileText className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">上传诊断包</p>
                      <p className="mt-0.5 text-[10px] text-[#858b96] font-medium leading-none">
                        上传运行日志，帮助排查问题
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUploadLogs}
                    disabled={uploadingLogs}
                    className="bg-white/80 border-slate-200 hover:bg-slate-50 text-[#0050b3] flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm active:scale-[0.98]"
                  >
                    {uploadingLogs ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    上传
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// React Option Helper to avoid warnings
function SelectItem({ children, value }: { children: React.ReactNode; value: string }) {
  return <option value={value}>{children}</option>;
}
