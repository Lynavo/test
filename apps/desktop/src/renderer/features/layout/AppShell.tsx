import { lazy, Suspense, useEffect } from 'react';
import { Skeleton } from '@renderer/components/ui/skeleton';
import { useAppStore } from '@renderer/stores/app-store';
import { useDashboardStore } from '@renderer/stores/dashboard-store';
import { useSettingsStore } from '@renderer/stores/settings-store';
import { Sidebar } from './Sidebar';

const Dashboard = lazy(() =>
  import('@renderer/features/dashboard/Dashboard').then((m) => ({
    default: m.Dashboard,
  })),
);
const SettingsPage = lazy(() =>
  import('@renderer/features/settings/SettingsPage').then((m) => ({
    default: m.SettingsPage,
  })),
);
const DeviceDetailModal = lazy(() =>
  import('@renderer/features/device-detail/DeviceDetailModal').then((m) => ({
    default: m.DeviceDetailModal,
  })),
);

function PageFallback() {
  return <Skeleton className="flex-1" />;
}

export function AppShell() {
  const currentView = useAppStore((s) => s.currentView);
  const isModalOpen = useAppStore((s) => s.isModalOpen);

  // Fetch data on mount
  useEffect(() => {
    useDashboardStore.getState().fetchDashboard();
    useSettingsStore.getState().fetchSettings();
  }, []);

  // Subscribe to sidecar events for real-time updates
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    const unsub = api.events.onSidecarEvent((event) => {
      switch (event.type) {
        case 'dashboard.updated':
          useDashboardStore.getState().updateSummary(event.payload);
          break;
        case 'device.state.changed':
        case 'upload.progress':
        case 'upload.completed':
        case 'upload.failed':
          useDashboardStore.getState().fetchDashboard();
          break;
        case 'disk.low':
          useDashboardStore.getState().updateSummary({
            ...useDashboardStore.getState().summary,
            isDiskLow: true,
            remainingBytes: event.payload.remainingBytes,
          });
          break;
        case 'share.status.changed':
          useSettingsStore.getState().fetchSettings();
          break;
      }
    });
    return unsub;
  }, []);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, #daeef8 0%, #e8f5fb 40%, #f0f8fd 70%, #f8fbff 100%)',
      }}
    >
      <Sidebar />

      {/* Content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Suspense fallback={<PageFallback />}>
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'settings' && <SettingsPage />}
        </Suspense>
      </div>

      {/* Device detail overlay */}
      {isModalOpen && (
        <Suspense fallback={null}>
          <DeviceDetailModal />
        </Suspense>
      )}
    </div>
  );
}
