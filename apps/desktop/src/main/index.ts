import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { registerIpcHandlers } from './ipc-handlers';
import { SidecarManager } from './sidecar-manager';
import { WsBridge } from './ws-bridge';
import type { SidecarRuntimeState } from '../shared/sidecar-runtime';

// Prevent crash on broken pipe (sidecar stdout/stderr)
process.on('uncaughtException', (err) => {
  if (err.message.includes('write EIO') || err.message.includes('EPIPE')) return;
  console.error('Uncaught exception:', err);
});

let mainWindow: BrowserWindow | null = null;
const sidecar = new SidecarManager();
let wsBridge: WsBridge;
const isDev = !app.isPackaged;

function broadcastSidecarRuntimeState(state: SidecarRuntimeState) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('sidecar:runtime-state', state);
    }
  }
}

sidecar.on('state', (state: SidecarRuntimeState) => {
  broadcastSidecarRuntimeState(state);
});

async function createMainWindow() {
  mainWindow = new BrowserWindow({
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

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {

  registerIpcHandlers(sidecar);
  await createMainWindow();
  wsBridge = new WsBridge(() => mainWindow);
  wsBridge.connect();
  void sidecar.start().catch((err) => {
    console.error('Failed to start sidecar:', err);
  });

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

app.on('before-quit', async () => {
  wsBridge?.disconnect();
  await sidecar.stop();
});
