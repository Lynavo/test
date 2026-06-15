import { useEffect } from 'react';
import { Smartphone, Shield, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useManagementStore } from '@renderer/stores/management-store';
import { useDashboardStore } from '@renderer/stores/dashboard-store';
import { DeviceManagementTable } from './DeviceManagementTable';
import { GlassCard } from '@renderer/components/shared/GlassCard';
import { Skeleton } from '@renderer/components/ui/skeleton';

export function DevicesPage() {
  const { t } = useTranslation();
  const devices = useManagementStore((state) => state.devices);
  const loading = useManagementStore((state) => state.devicesLoading);
  const error = useManagementStore((state) => state.devicesError);
  const loadDevices = useManagementStore((state) => state.loadDevices);
  const unblockDevice = useManagementStore((state) => state.unblockDevice);

  const dashboardDevices = useDashboardStore((state) => state.devices);
  const fetchDashboard = useDashboardStore((state) => state.fetchDashboard);

  useEffect(() => {
    void loadDevices();
    void fetchDashboard();
  }, [loadDevices, fetchDashboard]);

  const totalDevices = devices.length;
  const blockedDevices = devices.filter((d) => d.blockStatus === 'active').length;

  const connectedDevices = devices.filter((d) => {
    const matched = dashboardDevices.find(
      (dd) => dd.stableDeviceId === d.clientId || dd.deviceId === d.clientId,
    );
    return matched && matched.status !== 'offline';
  }).length;

  return (
    <div className="flex flex-1 flex-col overflow-auto px-6 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="mb-6 text-xl font-bold text-[#1a2a3a]">设备管理</h1>

        {/* 3 Overview Stat Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Card 1: Total Devices */}
          <div className="flex items-center gap-4 rounded-2xl border border-blue-100 bg-white/60 p-4 shadow-[0_2px_12px_rgba(100,160,210,0.04)]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm border border-blue-100/50">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-[#858b96]">总设备</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{totalDevices}</p>
            </div>
          </div>

          {/* Card 2: Blocked/Disabled */}
          <div className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-white/60 p-4 shadow-[0_2px_12px_rgba(100,160,210,0.04)]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm border border-emerald-100/50">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-[#858b96]">已禁用</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{blockedDevices}</p>
            </div>
          </div>

          {/* Card 3: Connected */}
          <div className="flex items-center gap-4 rounded-2xl border border-sky-100 bg-white/60 p-4 shadow-[0_2px_12px_rgba(100,160,210,0.04)]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 shadow-sm border border-sky-100/50">
              <Wifi className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-[#858b96]">已连接</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{connectedDevices}</p>
            </div>
          </div>
        </div>

        {/* Device List Container */}
        <div className="flex flex-col gap-3">
          {loading && devices.length === 0 && (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
              {error}
            </div>
          )}

          {!loading && !error && devices.length === 0 && (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/45 px-6 py-10 text-center shadow-[0_2px_12px_rgba(0,0,0,0.01)]">
              <Smartphone className="h-8 w-8 text-slate-400" />
              <h2 className="mt-3 text-sm font-bold text-slate-800">尚无设备</h2>
              <p className="mt-1 text-xs text-slate-400">
                通过连接码授权后的移动端设备会显示在这里。
              </p>
            </div>
          )}

          {!error && devices.length > 0 && (
            <DeviceManagementTable
              devices={devices}
              onUnblock={(clientId) => {
                void unblockDevice(clientId);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
