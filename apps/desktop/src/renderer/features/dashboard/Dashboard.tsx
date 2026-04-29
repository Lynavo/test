import { FileVideo, HardDrive, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDashboardStore } from '@renderer/stores/dashboard-store';
import { useAppStore } from '@renderer/stores/app-store';
import { formatBytes, formatDateTime } from '@renderer/lib/format';
import { ErrorState } from '@renderer/components/shared/ErrorState';
import { DiskWarningBanner } from './DiskWarningBanner';
import { StatCard } from './StatCard';
import { DeviceCard } from './DeviceCard';

export function Dashboard() {
  const { t } = useTranslation();
  const { summary, devices, error, fetchDashboard } = useDashboardStore();
  const openDeviceDetail = useAppStore((s) => s.openDeviceDetail);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <DiskWarningBanner />

      <div className="px-6 pt-5 pb-1">
        <h1 className="text-xl font-bold">{t('dashboard.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {summary.lastSuccessfulSyncAt
            ? t('dashboard.lastSuccess.withDevice', {
                time: formatDateTime(summary.lastSuccessfulSyncAt),
                device: summary.lastSuccessfulDeviceName ?? t('common.fallback.unknownDevice'),
              })
            : t('dashboard.lastSuccess.none')}
        </p>
      </div>

      {/* Stat cards */}
      <div className="flex flex-wrap gap-4 px-6 pt-3 pb-4">
        <StatCard
          icon={FileVideo}
          iconGradient="linear-gradient(135deg, #3b82f6 0%, #60c4f0 100%)"
          label={t('dashboard.stats.todayMediaCount')}
          value={summary.todayUploadCount.toLocaleString()}
        />
        <StatCard
          icon={HardDrive}
          iconGradient="linear-gradient(135deg, #a855f7 0%, #c084fc 100%)"
          label={t('dashboard.stats.todayOccupied')}
          value={formatBytes(summary.todayOccupiedBytes)}
        />
        <StatCard
          icon={Database}
          iconGradient="linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)"
          label={t('dashboard.stats.remainingSpace')}
          value={formatBytes(summary.remainingBytes)}
          alert={summary.isDiskLow}
        />
      </div>

      {/* Error state */}
      {error && devices.length === 0 && (
        <div className="px-6">
          <ErrorState message={error} onRetry={fetchDashboard} />
        </div>
      )}

      {/* Device grid */}
      {!(error && devices.length === 0) && (
        <div className="px-6 pb-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {devices.map((device) => (
              <DeviceCard
                key={device.deviceId}
                device={device}
                onClick={() => openDeviceDetail(device)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
