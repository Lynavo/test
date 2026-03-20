import { ipcMain } from 'electron';
import { openFolder, openFile, selectFolder, copyToClipboard } from './file-operations';

// Channel constants — shared between main and preload
export const IPC = {
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

export function registerIpcHandlers(): void {
  // Sidecar stubs — return mock data; replaced with real HTTP calls in Phase 3
  ipcMain.handle(IPC.SIDECAR_HEALTH, async () => ({
    ok: true,
    service: 'syncflow-sidecar',
  }));
  ipcMain.handle(IPC.SIDECAR_DASHBOARD_SUMMARY, async () => ({
    todayUploadCount: 0,
    todayOccupiedBytes: 0,
    remainingBytes: 0,
    isDiskLow: false,
  }));
  ipcMain.handle(IPC.SIDECAR_DASHBOARD_DEVICES, async () => []);
  ipcMain.handle(
    IPC.SIDECAR_DEVICE_DETAIL,
    async (_e, _deviceId: string) => ({}),
  );
  ipcMain.handle(
    IPC.SIDECAR_DEVICE_FILES,
    async (_e, _deviceId: string, _date: string) => [],
  );
  ipcMain.handle(
    IPC.SIDECAR_DEVICE_DATES,
    async (_e, _deviceId: string) => ({ dates: [] }),
  );
  ipcMain.handle(IPC.SIDECAR_SETTINGS, async () => ({
    connectionCode: '000000',
    receivePath: '',
    shareAddress: '',
    shareStatus: 'unknown',
    shareName: '',
  }));
  ipcMain.handle(
    IPC.SIDECAR_UPDATE_SETTINGS,
    async (_e, _partial: Record<string, unknown>) => ({
      connectionCode: '000000',
      receivePath: '',
      shareAddress: '',
      shareStatus: 'unknown',
      shareName: '',
    }),
  );
  ipcMain.handle(IPC.SIDECAR_REGENERATE_CODE, async () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    return { code };
  });
  ipcMain.handle(IPC.SIDECAR_SHARE_STATUS, async () => ({
    enabled: false,
    smbUrl: null,
    status: 'unknown',
  }));
  ipcMain.handle(IPC.SIDECAR_VALIDATE_SHARE, async () => ({
    enabled: false,
    smbUrl: null,
    status: 'unknown',
  }));

  // File operations
  ipcMain.handle(IPC.FILES_OPEN_FOLDER, async (_e, path: string) =>
    openFolder(path),
  );
  ipcMain.handle(IPC.FILES_OPEN_FILE, async (_e, path: string) =>
    openFile(path),
  );
  ipcMain.handle(IPC.FILES_SELECT_FOLDER, async () => selectFolder());
  ipcMain.handle(IPC.FILES_COPY_CLIPBOARD, async (_e, text: string) => {
    copyToClipboard(text);
  });
}
