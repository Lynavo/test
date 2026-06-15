import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  HardDrive,
  Database,
  Smartphone,
  FolderOpen,
  Laptop,
} from 'lucide-react';
import { toast } from 'sonner';
import { useResourcesStore } from '@renderer/stores/resources-store';
import { useDashboardStore } from '@renderer/stores/dashboard-store';
import { useManagementStore } from '@renderer/stores/management-store';
import { useSettingsStore } from '@renderer/stores/settings-store';
import { formatBytes } from '@renderer/lib/format';
import { Skeleton } from '@renderer/components/ui/skeleton';

export function ReceivedLibraryPage() {
  const { t } = useTranslation();
  const { receivedItems, receivedLoading, receivedError, loadReceivedLibrary } =
    useResourcesStore();

  const settings = useSettingsStore((s) => s.settings);
  const summary = useDashboardStore((s) => s.summary);
  const managedDevices = useManagementStore((s) => s.devices);
  const loadDevices = useManagementStore((s) => s.loadDevices);
  const fetchDashboard = useDashboardStore((s) => s.fetchDashboard);

  useEffect(() => {
    void loadReceivedLibrary();
    void loadDevices();
    void fetchDashboard();
  }, [loadReceivedLibrary, loadDevices, fetchDashboard]);

  // Calculations for stats cards
  const totalFiles = receivedItems.length;
  const totalOccupiedSpace = receivedItems.reduce((sum, item) => sum + item.fileSize, 0);

  // Group received items by device (clientId)
  const statsByDevice = receivedItems.reduce((acc, item) => {
    const cid = item.clientId;
    if (!acc[cid]) {
      acc[cid] = {
        photoCount: 0,
        fileCount: 0,
        totalBytes: 0,
      };
    }
    const isMedia =
      item.mediaType === 'image' ||
      item.mediaType === 'video' ||
      item.mediaType?.startsWith('image/') ||
      item.mediaType?.startsWith('video/');
    if (isMedia) {
      acc[cid].photoCount += 1;
    } else {
      acc[cid].fileCount += 1;
    }
    acc[cid].totalBytes += item.fileSize;
    return acc;
  }, {} as Record<string, { photoCount: number; fileCount: number; totalBytes: number }>);

  // Fallback to managed devices or dashboard devices, unified into list
  const deviceList = managedDevices.map((d) => {
    const stats = statsByDevice[d.clientId] || {
      photoCount: 0,
      fileCount: 0,
      totalBytes: 0,
    };
    return {
      clientId: d.clientId,
      displayName: d.displayName,
      platform: d.platform,
      // Attempt to find receiveDirName
      devicePath: d.stableDeviceId || d.clientIdShort || d.clientId,
      ...stats,
    };
  });

  const handleOpenFolder = (devicePath?: string) => {
    if (!settings.receivePath) {
      toast.error('未配置接收目录');
      return;
    }
    const path = devicePath ? `${settings.receivePath}/${devicePath}` : settings.receivePath;
    void window.electronAPI?.files.openFolder(path).catch(() => {
      // fallback to main received folder
      void window.electronAPI?.files.openFolder(settings.receivePath);
    });
  };

  return (
    <div className="flex-1 overflow-auto px-6 py-8">
      <div className="mx-auto w-full max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-[#1a2a3a]">同步记录</h1>
          <span className="text-xs font-semibold text-[#858b96] bg-slate-100 px-2.5 py-1 rounded-full">
            {deviceList.length} 台设备
          </span>
        </div>

        {/* 3 Overview Stat Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Card 1: Total Files */}
          <div className="flex items-center gap-4 rounded-2xl border border-blue-100 bg-white/60 p-4 shadow-[0_2px_12px_rgba(100,160,210,0.04)]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm border border-blue-100/50">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-[#858b96]">总接收文件数</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{totalFiles}</p>
            </div>
          </div>

          {/* Card 2: Total Space */}
          <div className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-white/60 p-4 shadow-[0_2px_12px_rgba(100,160,210,0.04)]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm border border-emerald-100/50">
              <HardDrive className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-[#858b96]">占用总空间</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">
                {formatBytes(totalOccupiedSpace)}
              </p>
            </div>
          </div>

          {/* Card 3: Remaining Space */}
          <div className="flex items-center gap-4 rounded-2xl border border-sky-100 bg-white/60 p-4 shadow-[0_2px_12px_rgba(100,160,210,0.04)]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 shadow-sm border border-sky-100/50">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-[#858b96]">磁盘剩余空间</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">
                {formatBytes(summary.remainingBytes)}
              </p>
            </div>
          </div>
        </div>

        {/* Sync Device List */}
        <div className="flex flex-col gap-3">
          {receivedLoading && deviceList.length === 0 && (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          )}

          {receivedError && !receivedLoading && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
              {receivedError}
            </div>
          )}

          {!receivedLoading && !receivedError && deviceList.length === 0 && (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/45 px-6 py-10 text-center shadow-[0_2px_12px_rgba(0,0,0,0.01)]">
              <FolderOpen className="h-8 w-8 text-slate-400" />
              <h2 className="mt-3 text-sm font-bold text-slate-800">尚无同步记录</h2>
              <p className="mt-1 text-xs text-slate-400">
                设备同步传输后的文件历史会汇总在这里。
              </p>
            </div>
          )}

          {!receivedError &&
            deviceList.map((device) => (
              <div
                key={device.clientId}
                className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/45 p-4.5 shadow-[0_2px_12px_rgba(0,0,0,0.01)] transition hover:shadow-[0_4px_16px_rgba(0,0,0,0.02)]"
              >
                {/* Device Icon and Info */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e6f4ff] text-[#1890ff] shadow-sm">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      {device.displayName || '未命名设备'}
                    </h3>
                    <p className="mt-0.5 text-xs text-[#858b96]">
                      {device.platform || 'iPhone'}
                    </p>
                  </div>
                </div>

                {/* Statistics counts in middle */}
                <div className="flex flex-1 items-center justify-center px-4 text-xs text-slate-500 font-semibold gap-6">
                  <span className="flex items-center gap-1">
                    📷 相册上传 {device.photoCount}
                  </span>
                  <span className="flex items-center gap-1">
                    📁 文件上传 {device.fileCount}
                  </span>
                  <span className="flex items-center gap-1">
                    💾 {formatBytes(device.totalBytes)}
                  </span>
                </div>

                {/* Open Folder Button */}
                <button
                  type="button"
                  onClick={() => handleOpenFolder(device.devicePath)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e6f4ff] hover:bg-[#bae7ff] text-[#0050b3] border border-[#91caff]/40 shadow-sm transition active:scale-[0.97]"
                  title="打开目录"
                >
                  <FolderOpen className="h-4.5 w-4.5" />
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
