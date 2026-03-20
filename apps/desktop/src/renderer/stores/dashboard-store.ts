import { create } from 'zustand';
import type { DashboardDeviceDTO, DashboardSummaryDTO } from '@syncflow/contracts';
import type { DeviceDashboardStatus } from '@syncflow/contracts';
import { mockDashboardSummary } from '../mocks/dashboard';
import { mockDevices } from '../mocks/devices';

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
  dismissDiskWarning(): void;
  updateSummary(summary: DashboardSummaryDTO): void;
  updateDevices(devices: DashboardDeviceDTO[]): void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  summary: mockDashboardSummary,
  devices: sortDevices(mockDevices),
  diskWarningDismissed: false,

  dismissDiskWarning: () => set({ diskWarningDismissed: true }),

  updateSummary: (summary) => set({ summary }),

  updateDevices: (devices) => set({ devices: sortDevices(devices) }),
}));
