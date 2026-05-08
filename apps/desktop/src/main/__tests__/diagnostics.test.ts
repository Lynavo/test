import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dialog } from 'electron';
import type { SidecarManager } from '../sidecar-manager';

const appState = vi.hoisted(() => ({
  isPackaged: false,
}));

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return appState.isPackaged;
    },
    getAppPath: () => '/tmp/vividrop-app',
    getName: () => 'Vivi Drop',
    getPath: () => '/tmp/vividrop-user-data',
    getVersion: () => '0.1.0',
  },
  dialog: {
    showSaveDialog: vi.fn(),
  },
  shell: {
    showItemInFolder: vi.fn(),
  },
}));

vi.mock('electron-log', () => ({
  default: {
    transports: {
      file: {
        getFile: () => ({ path: '/tmp/vividrop-main.log' }),
      },
    },
  },
}));

describe('checkForUpdates', () => {
  const updateCheckQuery = `platform=${process.platform}&arch=${process.arch}&version=0.1.0`;

  beforeEach(() => {
    appState.isPackaged = false;
    delete process.env.VIVIDROP_API_BASE_URL;
    delete process.env.SYNCFLOW_API_BASE_URL;
    delete process.env.VIVIDROP_DESKTOP_UPDATE_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the local Docker API by default in development mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        update_available: false,
        latest_version: '0.1.0',
        checked_at: '2026-05-08T08:00:00Z',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { checkForUpdates } = await import('../diagnostics');

    await checkForUpdates();

    const requestUrl = fetchMock.mock.calls[0]?.[0];
    expect(requestUrl).toEqual(
      `http://127.0.0.1:8080/api/v1/desktop/update-check?${updateCheckQuery}`,
    );
  });

  it('uses the production API by default in packaged builds', async () => {
    appState.isPackaged = true;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        update_available: false,
        latest_version: '0.1.0',
        checked_at: '2026-05-08T08:00:00Z',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { checkForUpdates } = await import('../diagnostics');

    await checkForUpdates();

    const requestUrl = fetchMock.mock.calls[0]?.[0];
    expect(requestUrl).toEqual(
      `https://api.vividrop.cn/api/v1/desktop/update-check?${updateCheckQuery}`,
    );
  });

  it('prefers an explicit API base URL over the development default', async () => {
    process.env.VIVIDROP_API_BASE_URL = 'http://localhost:9090';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        update_available: false,
        latest_version: '0.1.0',
        checked_at: '2026-05-08T08:00:00Z',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { checkForUpdates } = await import('../diagnostics');

    await checkForUpdates();

    const requestUrl = fetchMock.mock.calls[0]?.[0];
    expect(requestUrl).toEqual(
      `http://localhost:9090/api/v1/desktop/update-check?${updateCheckQuery}`,
    );
  });
});

describe('exportDiagnostics', () => {
  beforeEach(() => {
    appState.isPackaged = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes a non-empty app build in diagnostics.json', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'syncflow-diagnostics-test-'));
    const archivePath = join(tempRoot, 'diagnostics.zip');
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({
      canceled: false,
      filePath: archivePath,
    });

    const { exportDiagnostics } = await import('../diagnostics');

    await exportDiagnostics({
      getState: () => ({ status: 'healthy' }),
    } as unknown as SidecarManager);

    const entries = execFileSync('unzip', ['-Z1', archivePath], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    const diagnosticsEntry = entries.find((entry) => entry.endsWith('/diagnostics.json'));
    expect(diagnosticsEntry).toBeTruthy();

    const diagnosticsJson = execFileSync('unzip', ['-p', archivePath, diagnosticsEntry ?? ''], {
      encoding: 'utf8',
    });
    const diagnostics = JSON.parse(diagnosticsJson) as { app?: { build?: string } };
    expect(diagnostics.app?.build).toBeTruthy();

    rmSync(tempRoot, { recursive: true, force: true });
  });
});
