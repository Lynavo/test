import type { ElectronAPI } from '../../preload/api';

const mockSidecar: ElectronAPI['sidecar'] = {
  getHealth: async () => ({ ok: true, service: 'syncflow-sidecar' }),
  getDashboardSummary: async () => ({
    todayUploadCount: 0,
    todayOccupiedBytes: 0,
    remainingBytes: 0,
    isDiskLow: false,
  }),
  getDashboardDevices: async () => [],
  getDeviceDetail: async () => ({
    deviceId: '',
    clientName: '',
    ip: '',
    status: 'offline' as const,
    todayFileCount: 0,
    todayBytes: 0,
    storageLeft: '—',
    storagePath: '',
  }),
  getDeviceFiles: async () => [],
  getDeviceDates: async () => ({ dates: [] }),
  getSettings: async () => ({
    connectionCode: '000000',
    receivePath: '',
    shareAddress: '',
    shareStatus: 'unknown' as const,
    shareName: 'SyncFlow',
  }),
  updateSettings: async (s) => ({
    connectionCode: '000000',
    receivePath: '',
    shareAddress: '',
    shareStatus: 'unknown' as const,
    shareName: 'SyncFlow',
    ...s,
  }) as any,
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
