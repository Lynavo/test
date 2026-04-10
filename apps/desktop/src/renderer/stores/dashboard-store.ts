import { create } from 'zustand';
import { toast } from 'sonner';
import type { DashboardDeviceDTO, DashboardSummaryDTO } from '@syncflow/contracts';
import type { DeviceDashboardStatus } from '@syncflow/contracts';
import { useSidecarRuntimeStore } from './sidecar-runtime-store';

const STATUS_PRIORITY: Record<DeviceDashboardStatus, number> = {
  transferring: 0,
  connected_idle: 1,
  offline: 2,
};

function sortDevices(devices: DashboardDeviceDTO[]): DashboardDeviceDTO[] {
  return [...devices].sort(
    (a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status],
  );
}

function isSidecarHealthy(): boolean {
  return useSidecarRuntimeStore.getState().runtime.status === 'healthy';
}

export interface DashboardState {
  summary: DashboardSummaryDTO;
  devices: DashboardDeviceDTO[];
  diskWarningDismissed: boolean;
  error: string | null;
  fetchDashboard(): Promise<void>;
  dismissDiskWarning(): void;
  updateSummary(summary: DashboardSummaryDTO): void;
  updateDevices(devices: DashboardDeviceDTO[]): void;
  updateDeviceProgress(deviceId: string, fileKey: string, progress: number): void;
  updateDeviceStatus(deviceId: string, status: DeviceDashboardStatus): void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  summary: {
    todayUploadCount: 0,
    todayOccupiedBytes: 0,
    remainingBytes: 0,
    isDiskLow: false,
    lastSuccessfulSyncAt: undefined,
    lastSuccessfulDeviceName: undefined,
  },
  devices: [],
  diskWarningDismissed: false,
  error: null,

  fetchDashboard: async () => {
    const api = window.electronAPI;
    if (!api || !isSidecarHealthy()) return;
    set({ error: null });
    try {
      const [summary, devices] = await Promise.all([
        api.sidecar.getDashboardSummary(),
        api.sidecar.getDashboardDevices(),
      ]);
      if (summary) set({ summary });
      if (devices) {
        // Merge: preserve real-time WebSocket state over stale REST snapshots
        const current = get().devices;
        const merged = devices.map((d) => {
          const existing = current.find((c) => c.deviceId === d.deviceId);
          if (!existing) return d;
          const patched = { ...d };
          // Don't let REST downgrade status set by WebSocket event
          if (
            existing.status === 'transferring' &&
            d.status !== 'transferring'
          ) {
            patched.status = existing.status;
          }
          // Keep higher progress from WebSocket if API returns lower/zero
          if (existing.currentFile && existing.currentFile.progress > (d.currentFile?.progress ?? 0)) {
            patched.currentFile = existing.currentFile;
          }
          return patched;
        });
        set({ devices: sortDevices(merged) });
      }
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
      set({ error: '加载设备列表失败' });
      toast.error('加载设备列表失败', { description: '请检查网络连接后重试' });
    }
  },

  dismissDiskWarning: () => set({ diskWarningDismissed: true }),

  updateSummary: (summary) => { if (summary) set({ summary }); },

  updateDevices: (devices) => set({ devices: sortDevices(devices) }),

  updateDeviceProgress: (deviceId, fileKey, progress) => {
    if (progress <= 0) return; // ignore zero-progress events
    set((state) => ({
      devices: state.devices.map((d) =>
        d.deviceId === deviceId
          ? {
              ...d,
              currentFile: {
                filename: d.currentFile?.filename ?? fileKey,
                progress,
                fileSize: d.currentFile?.fileSize ?? 0,
              },
            }
          : d,
      ),
    }));
  },

  updateDeviceStatus: (deviceId, status) => {
    set((state) => ({
      devices: sortDevices(
        state.devices.map((d) =>
          d.deviceId === deviceId ? { ...d, status } : d,
        ),
      ),
    }));
  },
}));
