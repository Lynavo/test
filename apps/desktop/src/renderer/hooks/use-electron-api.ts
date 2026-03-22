import type { SettingsDTO } from '@syncflow/contracts';
import type { ElectronAPI } from '../../preload/api';

const defaultSettings: SettingsDTO = {
  deviceName: 'SyncFlow',
  connectionCode: '000000',
  receivePath: '',
  shareAddress: '',
  shareStatus: 'unknown',
  shareName: 'SyncFlow',
};

const mockSidecar: ElectronAPI['sidecar'] = {
  getHealth: async () => ({ ok: true, service: 'syncflow-sidecar' }),
  getDashboardSummary: async () => ({
    todayUploadCount: 0,
    todayOccupiedBytes: 0,
    remainingBytes: 0,
    isDiskLow: false,
  }),
  getDashboardDevices: async () => [],
  getDeviceFiles: async () => [],
  getDeviceDates: async () => ({ dates: [] }),
  getSettings: async () => ({ ...defaultSettings }),
  updateSettings: async (s) =>
    ({ ...defaultSettings, ...s }) as SettingsDTO,
  regenerateConnectionCode: async () => ({ code: '000000' }),
  getShareStatus: async () => ({
    enabled: false,
    smbUrl: null,
    status: 'unknown' as const,
  }),
  validateShare: async () => ({
    enabled: false,
    smbUrl: null,
    status: 'unknown' as const,
  }),
};

const mockFiles: ElectronAPI['files'] = {
  openFolder: async () => {},
  openFile: async () => {},
  selectFolder: async () => null,
  copyToClipboard: async () => {},
};

const mockEvents: ElectronAPI['events'] = {
  onSidecarEvent: () => () => {},
};

const mockPlatform: ElectronAPI['platform'] = {
  isMac: () => true,
};

const mockAPI: ElectronAPI = {
  sidecar: mockSidecar,
  files: mockFiles,
  events: mockEvents,
  platform: mockPlatform,
};

export function useElectronAPI(): ElectronAPI {
  return window.electronAPI ?? mockAPI;
}
