import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Skeleton } from '@renderer/components/ui/skeleton';
import { useAppStore } from '@renderer/stores/app-store';
import { useDashboardStore } from '@renderer/stores/dashboard-store';
import { useSettingsStore } from '@renderer/stores/settings-store';
import { useSidecarRuntimeStore } from '@renderer/stores/sidecar-runtime-store';
import { useResourcesStore } from '@renderer/stores/resources-store';
import { useAuthStore } from '@renderer/stores/auth-store';
import { AuthPage } from '@renderer/components/shared/AuthPage';
import { Sidebar } from './Sidebar';
import { SidecarStatusBanner } from './SidecarStatusBanner';

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
const HelpDialog = lazy(() =>
  import('@renderer/features/help/HelpDialog').then((m) => ({
    default: m.HelpDialog,
  })),
);
const DeviceDetailPage = lazy(() =>
  import('@renderer/features/device-detail/DeviceDetailPage').then((m) => ({
    default: m.DeviceDetailPage,
  })),
);
const DevicesPage = lazy(() =>
  import('@renderer/features/devices/DevicesPage').then((m) => ({
    default: m.DevicesPage,
  })),
);
const RecordsPage = lazy(() =>
  import('@renderer/features/records/RecordsPage').then((m) => ({
    default: m.RecordsPage,
  })),
);
const SharedResourcesPage = lazy(() =>
  import('@renderer/features/shared/SharedResourcesPage').then((m) => ({
    default: m.SharedResourcesPage,
  })),
);
const ReceivedLibraryPage = lazy(() =>
  import('@renderer/features/library/ReceivedLibraryPage').then((m) => ({
    default: m.ReceivedLibraryPage,
  })),
);

function PageFallback() {
  return <Skeleton className="flex-1" />;
}

export function AppShell() {
  const { t } = useTranslation();
  const currentView = useAppStore((s) => s.currentView);
  const isHelpOpen = useAppStore((s) => s.isHelpOpen);
  const setHelpOpen = useAppStore((s) => s.setHelpOpen);
  const sidecarStatus = useSidecarRuntimeStore((s) => s.runtime.status);
  const session = useAuthStore((s) => s.session);
  const refreshSession = useAuthStore((s) => s.refreshSession);
  const [downloadPanelOpen, setDownloadPanelOpen] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    let active = true;
    void refreshSession().finally(() => {
      if (active) {
        setAuthInitialized(true);
      }
    });
    return () => {
      active = false;
    };
  }, [refreshSession]);

  useEffect(() => {
    if (!session) return;

    const api = window.electronAPI;
    if (!api) return;

    void api.sidecar.getRuntimeState().then((runtime) => {
      useSidecarRuntimeStore.getState().setRuntime(runtime);
      if (runtime.status === 'healthy') {
        useDashboardStore.getState().fetchDashboard();
        useSettingsStore.getState().fetchSettings();
        void useResourcesStore.getState().loadSharedResources();
        void useResourcesStore.getState().loadReceivedLibrary();
      }
    });

    const unsub = api.events.onSidecarRuntimeState((runtime) => {
      useSidecarRuntimeStore.getState().setRuntime(runtime);
      if (runtime.status === 'healthy') {
        useDashboardStore.getState().fetchDashboard();
        useSettingsStore.getState().fetchSettings();
        void useResourcesStore.getState().loadSharedResources();
        void useResourcesStore.getState().loadReceivedLibrary();
      }
    });

    return unsub;
  }, [session]);

  // Subscribe to sidecar events for real-time updates
  useEffect(() => {
    if (!session) return;

    const api = window.electronAPI;
    if (!api) return;
    const unsub = api.events.onSidecarEvent((event) => {
      switch (event.type) {
        case 'dashboard.updated':
          useDashboardStore.getState().updateSummary(event.payload);
          break;
        case 'upload.progress':
          useDashboardStore
            .getState()
            .updateDeviceProgress(
              event.payload.deviceId,
              event.payload.fileKey,
              event.payload.progress,
            );
          break;
        case 'device.state.changed':
          useDashboardStore
            .getState()
            .updateDeviceStatus(event.payload.deviceId, event.payload.status);
          break;
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
  }, [session]);

  // Periodic polling fallback in case WebSocket events are missed
  useEffect(() => {
    if (!session || sidecarStatus !== 'healthy') {
      return;
    }

    const interval = setInterval(() => {
      useDashboardStore.getState().fetchDashboard();
    }, 10_000);
    return () => clearInterval(interval);
  }, [session, sidecarStatus]);

  useEffect(() => {
    const openDownloadPanel = () => setDownloadPanelOpen(true);
    window.addEventListener('vividrop:open-download', openDownloadPanel);
    return () => {
      window.removeEventListener('vividrop:open-download', openDownloadPanel);
    };
  }, []);

  if (!authInitialized) {
    return (
      <div
        className="flex h-screen items-center justify-center text-[#17191c]"
        style={{
          backgroundColor: '#f7fbff',
          backgroundImage:
            'linear-gradient(135deg, rgba(255,252,247,0.98) 0%, rgba(247,252,255,0.92) 38%, rgba(239,248,255,0.92) 68%, rgba(255,248,220,0.72) 100%), repeating-linear-gradient(0deg, rgba(23,25,28,0.024) 0 1px, transparent 1px 3px)',
          backgroundBlendMode: 'normal, overlay',
        }}
      >
        <Skeleton className="h-10 w-44 rounded-lg bg-white/60" />
      </div>
    );
  }

  if (!session) {
    return <AuthPage onAuthenticated={refreshSession} />;
  }

  return (
    <div
      className="flex h-screen overflow-hidden text-[#17191c]"
      style={{
        backgroundColor: '#f7fbff',
        backgroundImage:
          'linear-gradient(135deg, rgba(255,252,247,0.98) 0%, rgba(247,252,255,0.92) 38%, rgba(239,248,255,0.92) 68%, rgba(255,248,220,0.72) 100%), repeating-linear-gradient(0deg, rgba(23,25,28,0.024) 0 1px, transparent 1px 3px)',
        backgroundBlendMode: 'normal, overlay',
      }}
    >
      <Sidebar />

      {/* Content area */}
      <main
        className="relative m-3 min-w-0 flex-1 overflow-hidden flex flex-col rounded-lg border border-white/60 bg-white/35 shadow-[0_30px_90px_rgba(70,96,138,0.12)] animate-in fade-in duration-300"
        style={{
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Global top-right header */}
        <div
          className="fixed right-7 top-6 z-50"
          style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
        >
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDownloadPanelOpen(false);
                setHelpOpen(true);
              }}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border border-white/70 bg-white/64 px-3 text-xs font-semibold text-[#4f5b68] shadow-[0_10px_26px_rgba(70,96,138,0.12)] backdrop-blur-xl transition hover:bg-white/88 hover:text-[#17191c] active:scale-[0.985] ${
                isHelpOpen ? 'border-[#746aa8] text-[#746aa8] bg-white' : ''
              }`}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              {t('layout.nav.help')}
            </button>
            <button
              type="button"
              onClick={() => setDownloadPanelOpen((open) => !open)}
              aria-expanded={downloadPanelOpen}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/70 bg-white/64 px-3 text-xs font-semibold text-[#4f5b68] shadow-[0_10px_26px_rgba(70,96,138,0.12)] backdrop-blur-xl transition hover:bg-white/88 hover:text-[#17191c] active:scale-[0.985]"
            >
              <Smartphone className="h-3.5 w-3.5" />
              下载移动端
            </button>
          </div>

          {downloadPanelOpen && (
            <div className="absolute right-0 top-10 w-[300px] rounded-lg border border-white/70 bg-[#f7fbff]/96 p-4 text-[#17191c] shadow-[0_30px_80px_rgba(70,96,138,0.22)] backdrop-blur-2xl">
              <p className="text-sm font-semibold text-[#17191c]">扫码下载移动端</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center gap-2 rounded-md border border-white/80 bg-white/60 p-2.5">
                  <div className="text-xs font-semibold text-[#17191c]">iOS</div>
                  <div className="flex h-[88px] w-[88px] items-center justify-center rounded-md border border-white/80 bg-white p-1.5">
                    <QRCodeSVG
                      value="https://vividrop.app/download/ios"
                      size={74}
                      bgColor="#ffffff"
                      fgColor="#17191c"
                      title="iOS 下载二维码"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void window.electronAPI?.files?.openExternal(
                        'https://vividrop.app/download/ios',
                      )
                    }
                    className="inline-flex min-h-7 w-full items-center justify-center rounded-md bg-white/70 px-2 text-[11px] font-semibold text-[#59616d] transition hover:bg-white/90 hover:text-[#17191c]"
                  >
                    App Store
                  </button>
                </div>
                <div className="flex flex-col items-center gap-2 rounded-md border border-white/80 bg-white/60 p-2.5">
                  <div className="text-xs font-semibold text-[#17191c]">Android</div>
                  <div className="flex h-[88px] w-[88px] items-center justify-center rounded-md border border-white/80 bg-white p-1.5">
                    <QRCodeSVG
                      value="https://vividrop.app/download/android"
                      size={74}
                      bgColor="#ffffff"
                      fgColor="#17191c"
                      title="Android 下载二维码"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void window.electronAPI?.files?.openExternal(
                        'https://vividrop.app/download/android',
                      )
                    }
                    className="inline-flex min-h-7 w-full items-center justify-center rounded-md bg-white/70 px-2 text-[11px] font-semibold text-[#59616d] transition hover:bg-white/90 hover:text-[#17191c]"
                  >
                    Android
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          className="shrink-0 px-6 pt-2 pb-2"
          style={{ WebkitAppRegion: 'drag' } as CSSProperties}
        />
        <SidecarStatusBanner />
        <Suspense fallback={<PageFallback />}>
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'device-detail' && <DeviceDetailPage />}
          {currentView === 'devices' && <DevicesPage />}
          {currentView === 'shared' && <SharedResourcesPage />}
          {currentView === 'library' && <ReceivedLibraryPage />}
          {currentView === 'records' && <RecordsPage />}
          {currentView === 'settings' && <SettingsPage />}
        </Suspense>
        <Suspense fallback={null}>
          <HelpDialog />
        </Suspense>
      </main>
    </div>
  );
}
