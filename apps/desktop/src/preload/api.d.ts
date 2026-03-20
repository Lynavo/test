import type {
  DashboardSummaryDTO,
  DashboardDeviceDTO,
  DeviceFileLedgerDTO,
  SettingsDTO,
  ShareStatusDTO,
} from '@syncflow/contracts';
import type { SidecarEvent } from '@syncflow/contracts';

export interface ElectronAPI {
  sidecar: {
    getHealth(): Promise<{ ok: boolean; service: string }>;
    getDashboardSummary(): Promise<DashboardSummaryDTO>;
    getDashboardDevices(): Promise<DashboardDeviceDTO[]>;
    getDeviceDetail(deviceId: string): Promise<DashboardDeviceDTO>;
    getDeviceFiles(deviceId: string, date: string): Promise<DeviceFileLedgerDTO[]>;
    getDeviceDates(deviceId: string): Promise<{ dates: string[] }>;
    getSettings(): Promise<SettingsDTO>;
    updateSettings(settings: Partial<SettingsDTO>): Promise<SettingsDTO>;
    regenerateConnectionCode(): Promise<{ code: string }>;
    getShareStatus(): Promise<ShareStatusDTO>;
    validateShare(): Promise<ShareStatusDTO>;
  };
  files: {
    openFolder(path: string): Promise<void>;
    openFile(path: string): Promise<void>;
    selectFolder(): Promise<string | null>;
    copyToClipboard(text: string): Promise<void>;
  };
  events: {
    onSidecarEvent(callback: (event: SidecarEvent) => void): () => void;
  };
  platform: {
    isMac(): boolean;
  };
}
