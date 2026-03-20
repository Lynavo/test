import type {
  DashboardDeviceDTO,
  DashboardSummaryDTO,
  DeviceFileLedgerDTO,
  SettingsDTO,
} from '@syncflow/contracts';

export interface ElectronAPI {
  getDashboardSummary(): Promise<DashboardSummaryDTO>;
  getDashboardDevices(): Promise<DashboardDeviceDTO[]>;
  getDeviceFiles(deviceId: string, dateKey: string): Promise<DeviceFileLedgerDTO[]>;
  getAvailableDates(deviceId: string): Promise<string[]>;
  getSettings(): Promise<SettingsDTO>;
  regenerateConnectionCode(): Promise<string>;
  openFolder(path: string): Promise<void>;
}

const mockAPI: ElectronAPI = {
  getDashboardSummary: async () => ({
    todayUploadCount: 0,
    todayOccupiedBytes: 0,
    remainingBytes: 0,
    isDiskLow: false,
  }),
  getDashboardDevices: async () => [],
  getDeviceFiles: async () => [],
  getAvailableDates: async () => [],
  getSettings: async () => ({
    connectionCode: '',
    receivePath: '',
    shareAddress: '',
    shareStatus: 'unknown' as const,
    shareName: '',
  }),
  regenerateConnectionCode: async () => '',
  openFolder: async () => {},
};

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export function useElectronAPI(): ElectronAPI {
  return window.electronAPI ?? mockAPI;
}
