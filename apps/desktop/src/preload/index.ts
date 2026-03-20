import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from './api';

// IPC channel constants — duplicated from main/ipc-handlers.ts
// because electron-vite builds preload and main as separate targets.
const IPC = {
  SIDECAR_HEALTH: 'sidecar:health',
  SIDECAR_DASHBOARD_SUMMARY: 'sidecar:dashboard-summary',
  SIDECAR_DASHBOARD_DEVICES: 'sidecar:dashboard-devices',
  SIDECAR_DEVICE_DETAIL: 'sidecar:device-detail',
  SIDECAR_DEVICE_FILES: 'sidecar:device-files',
  SIDECAR_DEVICE_DATES: 'sidecar:device-dates',
  SIDECAR_SETTINGS: 'sidecar:settings',
  SIDECAR_UPDATE_SETTINGS: 'sidecar:update-settings',
  SIDECAR_REGENERATE_CODE: 'sidecar:regenerate-code',
  SIDECAR_SHARE_STATUS: 'sidecar:share-status',
  SIDECAR_VALIDATE_SHARE: 'sidecar:validate-share',
  FILES_OPEN_FOLDER: 'files:open-folder',
  FILES_OPEN_FILE: 'files:open-file',
  FILES_SELECT_FOLDER: 'files:select-folder',
  FILES_COPY_CLIPBOARD: 'files:copy-clipboard',
} as const;

const electronAPI: ElectronAPI = {
  sidecar: {
    getHealth: () => ipcRenderer.invoke(IPC.SIDECAR_HEALTH),
    getDashboardSummary: () => ipcRenderer.invoke(IPC.SIDECAR_DASHBOARD_SUMMARY),
    getDashboardDevices: () => ipcRenderer.invoke(IPC.SIDECAR_DASHBOARD_DEVICES),
    getDeviceDetail: (deviceId: string) =>
      ipcRenderer.invoke(IPC.SIDECAR_DEVICE_DETAIL, deviceId),
    getDeviceFiles: (deviceId: string, date: string) =>
      ipcRenderer.invoke(IPC.SIDECAR_DEVICE_FILES, deviceId, date),
    getDeviceDates: (deviceId: string) =>
      ipcRenderer.invoke(IPC.SIDECAR_DEVICE_DATES, deviceId),
    getSettings: () => ipcRenderer.invoke(IPC.SIDECAR_SETTINGS),
    updateSettings: (settings) =>
      ipcRenderer.invoke(IPC.SIDECAR_UPDATE_SETTINGS, settings),
    regenerateConnectionCode: () => ipcRenderer.invoke(IPC.SIDECAR_REGENERATE_CODE),
    getShareStatus: () => ipcRenderer.invoke(IPC.SIDECAR_SHARE_STATUS),
    validateShare: () => ipcRenderer.invoke(IPC.SIDECAR_VALIDATE_SHARE),
  },
  files: {
    openFolder: (path: string) => ipcRenderer.invoke(IPC.FILES_OPEN_FOLDER, path),
    openFile: (path: string) => ipcRenderer.invoke(IPC.FILES_OPEN_FILE, path),
    selectFolder: () => ipcRenderer.invoke(IPC.FILES_SELECT_FOLDER),
    copyToClipboard: (text: string) =>
      ipcRenderer.invoke(IPC.FILES_COPY_CLIPBOARD, text),
  },
  events: {
    onSidecarEvent: (_callback) => {
      // Stub — real WebSocket bridge comes in Phase 3
      return () => {
        // no-op unsubscribe
      };
    },
  },
  platform: {
    isMac: () => process.platform === 'darwin',
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
