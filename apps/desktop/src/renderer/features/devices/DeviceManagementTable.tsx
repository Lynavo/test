import { Smartphone, ShieldAlert, Ban, Unlock } from 'lucide-react';
import type { DesktopManagedDeviceDTO } from '@syncflow/contracts';
import { useDashboardStore } from '@renderer/stores/dashboard-store';
import { toast } from 'sonner';
import { Button } from '@renderer/components/ui/button';

export function DeviceManagementTable({
  devices,
  onUnblock,
}: {
  devices: DesktopManagedDeviceDTO[];
  onUnblock: (clientId: string) => void;
}) {
  const dashboardDevices = useDashboardStore((s) => s.devices);

  const getDeviceStatus = (device: DesktopManagedDeviceDTO) => {
    if (device.blockStatus === 'active') {
      return 'blocked';
    }
    const matched = dashboardDevices.find(
      (d) => d.stableDeviceId === device.clientId || d.deviceId === device.clientId,
    );
    if (matched && matched.status !== 'offline') {
      return 'connected';
    }
    return 'offline';
  };

  const handleManualBlock = () => {
    toast.info('安全限制：设备禁用需由连接密码输入错误超过 5 次自动触发。');
  };

  return (
    <div className="flex flex-col gap-3">
      {devices.map((device) => {
        const status = getDeviceStatus(device);
        return (
          <div
            key={`${device.desktopDeviceId}:${device.clientId}`}
            className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/45 p-4.5 shadow-[0_2px_12px_rgba(0,0,0,0.01)] transition hover:shadow-[0_4px_16px_rgba(0,0,0,0.02)]"
          >
            {/* Device Info */}
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

            {/* Middle Section: Connection Status and Block Reasons */}
            <div className="flex flex-1 items-center justify-center px-4 gap-4">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    status === 'connected'
                      ? 'bg-[#52c41a] shadow-[0_0_8px_rgba(82,196,26,0.5)] animate-pulse'
                      : status === 'blocked'
                        ? 'bg-[#ff4d4f]'
                        : 'bg-slate-300'
                  }`}
                />
                <span className="text-xs font-semibold text-slate-600">
                  {status === 'connected'
                    ? '已连接'
                    : status === 'blocked'
                      ? '已禁用'
                      : '未连接'}
                </span>
              </div>

              {/* Disabled Warning Reason */}
              {status === 'blocked' && (
                <div className="flex items-center gap-1.5 text-xs text-[#ff4d4f] font-semibold bg-[#fff2f0] border border-[#ffccc7] px-2.5 py-1 rounded-lg">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>输错连接码超过 5 次，已自动禁用</span>
                </div>
              )}
            </div>

            {/* Actions Button */}
            <div>
              {status === 'blocked' ? (
                <Button
                  type="button"
                  onClick={() => onUnblock(device.clientId)}
                  className="bg-[#e6f4ff] hover:bg-[#bae7ff] text-[#0050b3] border border-[#91caff]/40 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm active:scale-[0.98]"
                >
                  <Unlock className="h-3.5 w-3.5" />
                  取消禁用
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleManualBlock}
                  className="bg-[#fff1f0] hover:bg-[#ffccc7] text-[#cf1322] border border-[#ffa39e]/40 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm active:scale-[0.98]"
                >
                  <Ban className="h-3.5 w-3.5" />
                  禁用
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
