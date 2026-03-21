import { create } from 'zustand';
import type { DashboardDeviceDTO, DashboardSummaryDTO } from '@syncflow/contracts';
import type { DeviceDashboardStatus } from '@syncflow/contracts';

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

export interface DashboardState {
  summary: DashboardSummaryDTO;
  devices: DashboardDeviceDTO[];
  diskWarningDismissed: boolean;
  fetchDashboard(): Promise<void>;
  dismissDiskWarning(): void;
  updateSummary(summary: DashboardSummaryDTO): void;
  updateDevices(devices: DashboardDeviceDTO[]): void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  summary: {
    todayUploadCount: 0,
    todayOccupiedBytes: 0,
    remainingBytes: 0,
    isDiskLow: false,
  },
  devices: [],
  diskWarningDismissed: false,

  fetchDashboard: async () => {
    const api = window.electronAPI;
    if (!api) return;
    try {
      const [summary, devices] = await Promise.all([
        api.sidecar.getDashboardSummary(),
        api.sidecar.getDashboardDevices(),
      ]);
      set({ summary, devices: sortDevices(devices) });
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
    }
  },

  dismissDiskWarning: () => set({ diskWarningDismissed: true }),

  updateSummary: (summary) => set({ summary }),

  updateDevices: (devices) => set({ devices: sortDevices(devices) }),
}));
