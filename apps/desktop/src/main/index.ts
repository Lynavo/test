import { app, BrowserWindow, powerSaveBlocker } from 'electron';
import log from 'electron-log';
import { join } from 'path';
import { registerIpcHandlers } from './ipc-handlers';
import { PowerSaveCoordinator } from './power-save-coordinator';
import { PowerSaveManager } from './power-save-manager';
import { PowerSavePreferences } from './power-save-preferences';
import { PowerSaveSettingsController } from './power-save-settings-controller';
import { requestMacFilesAndFoldersPermissionsOnStartup } from './macos-files-folders-permissions';
import { attachRendererLogging } from './renderer-logging';
import { SidecarManager } from './sidecar-manager';
import { sidecarClient } from './sidecar-client';
import { checkForUpdatesOnStartup } from './startup-update-check';
import { WsBridge } from './ws-bridge';
import type { SidecarRuntimeState } from '../shared/sidecar-runtime';
import { getProductName } from '../shared/market';

// Prevent crash on broken pipe (sidecar stdout/stderr)
process.on('uncaughtException', (err) => {
  if (err.message.includes('write EIO') || err.message.includes('EPIPE')) return;
  log.error('Uncaught exception:', err);
});

let mainWindow: BrowserWindow | null = null;

if (process.platform === 'darwin') {
  app.setName(getProductName());
}
const sidecar = new SidecarManager();
let wsBridge: WsBridge;
const powerSaveManager = new PowerSaveManager(powerSaveBlocker);
let powerSaveCoordinator: PowerSaveCoordinator | null = null;
const isDev = !app.isPackaged;

function broadcastSidecarRuntimeState(state: SidecarRuntimeState) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('sidecar:runtime-state', state);
    }
  }
}

function syncWsBridgeWithRuntimeState(state: SidecarRuntimeState) {
  if (!wsBridge || !powerSaveCoordinator) {
    return;
  }

  const action = powerSaveCoordinator.handleRuntimeState(state);
  if (action === 'connect') {
    wsBridge.connect();
    return;
  }

  wsBridge.disconnect();
}

sidecar.on('state', (state: SidecarRuntimeState) => {
  broadcastSidecarRuntimeState(state);
  syncWsBridgeWithRuntimeState(state);
});

export async function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: getProductName(),
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 800,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#f4f8fb',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  attachRendererLogging(mainWindow);

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  log.info(
    `[App] ready version=${app.getVersion()} packaged=${app.isPackaged} platform=${process.platform} arch=${process.arch}`,
  );
  void requestMacFilesAndFoldersPermissionsOnStartup();
  const powerSavePreferences = new PowerSavePreferences(app.getPath('userData'));
  powerSaveManager.setEnabled(powerSavePreferences.read().preventSleepDuringTransfer);
  const powerSaveSettingsController = new PowerSaveSettingsController(
    powerSaveManager,
    powerSavePreferences,
  );
  registerIpcHandlers(sidecar, powerSaveSettingsController);
  powerSaveCoordinator = new PowerSaveCoordinator(
    powerSaveManager,
    () => sidecarClient.getTransferActive(),
    (message, err) => log.warn(message, err),
  );
  wsBridge = new WsBridge(
    () => mainWindow,
    (event) => powerSaveCoordinator?.handleSidecarEvent(event),
  );
  void sidecar.start().catch((err) => {
    log.error('Failed to start sidecar:', err);
  });
  await createMainWindow();
  void checkForUpdatesOnStartup(() => mainWindow);

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

let isQuitting = false;
app.on('before-quit', (event) => {
  if (isQuitting) return;
  event.preventDefault();
  isQuitting = true;
  powerSaveManager.stop();
  wsBridge?.disconnect();
  sidecar.stop({ killExternal: true, killBonjourBroadcasts: true }).finally(() => app.quit());
});
