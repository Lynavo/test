import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dialog } from 'electron';
import type { SidecarManager } from '../sidecar-manager';

async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }
  const stream = (blob as Blob & { stream?: () => ReadableStream<Uint8Array> }).stream?.();
  if (!stream) {
    type FileReaderLike = {
      error: Error | null;
      result: ArrayBuffer | string | null;
      onerror: (() => void) | null;
      onload: (() => void) | null;
      readAsArrayBuffer(value: Blob): void;
    };
    const FileReaderCtor = (globalThis as { FileReader?: new () => FileReaderLike }).FileReader;
    if (FileReaderCtor) {
      return await new Promise<Uint8Array>((resolve, reject) => {
        const reader = new FileReaderCtor();
        reader.onerror = () => reject(reader.error ?? new Error('failed to read bundle blob'));
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.readAsArrayBuffer(blob);
      });
    }
    throw new Error('bundle blob is not readable');
  }
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

const appState = vi.hoisted(() => ({
  isPackaged: false,
}));

const diagnosticsPaths = vi.hoisted(() => {
  const root = `/tmp/lynavo-drive-diagnostics-vitest-${process.pid}`;
  return {
    root,
    appPath: `${root}/app`,
    userData: `${root}/user-data`,
    desktopLog: `${root}/desktop/main.log`,
    rotatedDesktopLog: `${root}/desktop/main.log.1`,
    rendererLog: `${root}/desktop/renderer.log`,
  };
});
const legacyViviApiBaseEnv = ['VIVI', 'DROP_API_BASE_URL'].join('');
const legacySyncApiBaseEnv = ['SYNC', 'FLOW_API_BASE_URL'].join('');
const legacyViviUpdateEnv = ['VIVI', 'DROP_DESKTOP_UPDATE_URL'].join('');
const legacyViviDiagnosticsUploadEnv = ['VIVI', 'DROP_DIAGNOSTICS_UPLOAD_URL'].join('');
const legacyViviDiagnosticsTokenEnv = ['VIVI', 'DROP_DIAGNOSTICS_TOKEN'].join('');
const legacyViviApiTokenEnv = ['VIVI', 'DROP_API_TOKEN'].join('');

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return appState.isPackaged;
    },
    getAppPath: () => diagnosticsPaths.appPath,
    getName: () => 'Lynavo Drive',
    getPath: () => diagnosticsPaths.userData,
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
        getFile: () => ({ path: diagnosticsPaths.desktopLog }),
      },
    },
  },
}));

function resetDiagnosticsFs() {
  rmSync(diagnosticsPaths.root, { recursive: true, force: true });
}

function ensureDesktopLogDir() {
  mkdirSync(join(diagnosticsPaths.root, 'desktop'), { recursive: true });
}

describe('checkForUpdates', () => {
  const updateCheckQuery = `platform=${process.platform}&arch=${process.arch}&version=0.1.0`;

  beforeEach(() => {
    appState.isPackaged = false;
    delete process.env.LYNAVO_SUPPORT_API_BASE_URL;
    delete process.env.LYNAVO_API_BASE_URL;
    delete process.env.LYNAVO_DESKTOP_UPDATE_URL;
    delete process.env[legacyViviApiBaseEnv];
    delete process.env[legacySyncApiBaseEnv];
    delete process.env[legacyViviUpdateEnv];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the review API by default in development mode', async () => {
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
      `https://review-api.lynavo.com/api/v1/desktop/update-check?${updateCheckQuery}`,
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
      `https://api.lynavo.com/api/v1/desktop/update-check?${updateCheckQuery}`,
    );
  });

  it('prefers an explicit Lynavo support API base URL over the development default', async () => {
    process.env.LYNAVO_SUPPORT_API_BASE_URL = 'http://localhost:9090';
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

  it('ignores stale broad API base URL env when no support API base URL is configured', async () => {
    process.env.LYNAVO_API_BASE_URL = 'http://lynavo.localhost:9090';
    process.env[legacyViviApiBaseEnv] = 'http://legacy.localhost:9090';
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
      `https://review-api.lynavo.com/api/v1/desktop/update-check?${updateCheckQuery}`,
    );
  });

  it('ignores legacy API base URLs when no Lynavo base URL is configured', async () => {
    process.env[legacyViviApiBaseEnv] = 'http://legacy-vd.localhost:9090';
    process.env[legacySyncApiBaseEnv] = 'http://legacy-sf.localhost:9090';
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
      `https://review-api.lynavo.com/api/v1/desktop/update-check?${updateCheckQuery}`,
    );
  });

  it('ignores legacy desktop update URL env', async () => {
    process.env[legacyViviUpdateEnv] = 'https://legacy.example/update';
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
      `https://review-api.lynavo.com/api/v1/desktop/update-check?${updateCheckQuery}`,
    );
  });
});

describe('exportDiagnostics', () => {
  beforeEach(() => {
    appState.isPackaged = false;
    delete process.env.LYNAVO_SUPPORT_API_BASE_URL;
    delete process.env.LYNAVO_API_BASE_URL;
    delete process.env.LYNAVO_DESKTOP_UPDATE_URL;
    delete process.env.LYNAVO_DIAGNOSTICS_UPLOAD_URL;
    delete process.env[legacyViviApiBaseEnv];
    delete process.env[legacySyncApiBaseEnv];
    delete process.env[legacyViviUpdateEnv];
    delete process.env[legacyViviDiagnosticsUploadEnv];
    resetDiagnosticsFs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LYNAVO_SUPPORT_API_BASE_URL;
    delete process.env.LYNAVO_API_BASE_URL;
    delete process.env.LYNAVO_DESKTOP_UPDATE_URL;
    delete process.env.LYNAVO_DIAGNOSTICS_UPLOAD_URL;
    delete process.env[legacyViviApiBaseEnv];
    delete process.env[legacySyncApiBaseEnv];
    delete process.env[legacyViviUpdateEnv];
    delete process.env[legacyViviDiagnosticsUploadEnv];
    resetDiagnosticsFs();
  });

  it('writes a non-empty app build in diagnostics.json', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'lynavo-drive-diagnostics-test-'));
    const archivePath = join(tempRoot, 'diagnostics.zip');
    ensureDesktopLogDir();
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

  it('serializes a numeric packaged build number as a string in diagnostics.json', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'lynavo-drive-diagnostics-test-'));
    const archivePath = join(tempRoot, 'diagnostics.zip');
    ensureDesktopLogDir();
    mkdirSync(diagnosticsPaths.appPath, { recursive: true });
    writeFileSync(join(diagnosticsPaths.appPath, 'package.json'), '{"lynavoDriveBuildNumber":50}');
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
    const diagnostics = JSON.parse(diagnosticsJson) as { app?: { build?: unknown } };
    expect(diagnostics.app?.build).toBe('50');

    rmSync(diagnosticsPaths.appPath, { recursive: true, force: true });
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('includes issue description, runtime context, and available log files', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'lynavo-drive-diagnostics-test-'));
    const archivePath = join(tempRoot, 'diagnostics.zip');
    ensureDesktopLogDir();
    mkdirSync(join(diagnosticsPaths.userData, 'logs'), { recursive: true });
    writeFileSync(diagnosticsPaths.desktopLog, 'main log\n');
    writeFileSync(diagnosticsPaths.rotatedDesktopLog, 'rotated main log\n');
    writeFileSync(diagnosticsPaths.rendererLog, 'renderer log\n');
    writeFileSync(join(diagnosticsPaths.userData, 'logs', 'sidecar.log'), 'sidecar log\n');
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({
      canceled: false,
      filePath: archivePath,
    });

    const { exportDiagnostics } = await import('../diagnostics');

    await exportDiagnostics(
      {
        getState: () => ({ status: 'healthy' }),
      } as unknown as SidecarManager,
      'en',
      'Wi-Fi drops when the phone locks',
    );

    const entries = execFileSync('unzip', ['-Z1', archivePath], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    expect(entries.some((entry) => entry.endsWith('/files/main.log'))).toBe(true);
    expect(entries.some((entry) => entry.endsWith('/files/main.log.1'))).toBe(true);
    expect(entries.some((entry) => entry.endsWith('/files/renderer.log'))).toBe(true);
    expect(entries.some((entry) => entry.endsWith('/files/sidecar.log'))).toBe(true);

    const diagnosticsEntry = entries.find((entry) => entry.endsWith('/diagnostics.json'));
    expect(diagnosticsEntry).toBeTruthy();
    const diagnosticsJson = execFileSync('unzip', ['-p', archivePath, diagnosticsEntry ?? ''], {
      encoding: 'utf8',
    });
    const diagnostics = JSON.parse(diagnosticsJson) as {
      issue?: { description?: string };
      process?: { electron?: string; node?: string; chrome?: string };
      supportApi?: { updateCheckUrl?: string; diagnosticsUploadUrl?: string };
      paths?: { userData?: string; logs?: string[] };
    };
    expect(diagnostics.issue?.description).toBe('Wi-Fi drops when the phone locks');
    expect(diagnostics.process?.node).toBeTruthy();
    expect(diagnostics.supportApi?.updateCheckUrl).toContain('/api/v1/desktop/update-check');
    expect(diagnostics.supportApi?.diagnosticsUploadUrl).toContain('/api/v1/diagnostics/upload');
    expect('api' in diagnostics).toBe(false);
    expect(diagnostics.paths?.userData).toBe(diagnosticsPaths.userData);
    expect(diagnostics.paths?.logs).toContain(diagnosticsPaths.desktopLog);

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('omits stale rotated log files from diagnostics archives', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'lynavo-drive-diagnostics-test-'));
    const archivePath = join(tempRoot, 'diagnostics.zip');
    const staleDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    ensureDesktopLogDir();
    mkdirSync(join(diagnosticsPaths.userData, 'logs'), { recursive: true });
    writeFileSync(diagnosticsPaths.desktopLog, 'fresh main log\n');
    writeFileSync(diagnosticsPaths.rotatedDesktopLog, 'stale rotated main log\n');
    writeFileSync(diagnosticsPaths.rendererLog, 'stale renderer log\n');
    writeFileSync(join(diagnosticsPaths.userData, 'logs', 'sidecar.log'), 'fresh sidecar log\n');
    writeFileSync(
      join(diagnosticsPaths.userData, 'logs', 'sidecar.log.1'),
      'stale rotated sidecar log\n',
    );
    utimesSync(diagnosticsPaths.rotatedDesktopLog, staleDate, staleDate);
    utimesSync(diagnosticsPaths.rendererLog, staleDate, staleDate);
    utimesSync(join(diagnosticsPaths.userData, 'logs', 'sidecar.log.1'), staleDate, staleDate);
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
    expect(entries.some((entry) => entry.endsWith('/files/main.log'))).toBe(true);
    expect(entries.some((entry) => entry.endsWith('/files/sidecar.log'))).toBe(true);
    expect(entries.some((entry) => entry.endsWith('/files/main.log.1'))).toBe(false);
    expect(entries.some((entry) => entry.endsWith('/files/renderer.log'))).toBe(false);
    expect(entries.some((entry) => entry.endsWith('/files/sidecar.log.1'))).toBe(false);

    const diagnosticsEntry = entries.find((entry) => entry.endsWith('/diagnostics.json'));
    expect(diagnosticsEntry).toBeTruthy();
    const diagnosticsJson = execFileSync('unzip', ['-p', archivePath, diagnosticsEntry ?? ''], {
      encoding: 'utf8',
    });
    const diagnostics = JSON.parse(diagnosticsJson) as {
      paths?: { logs?: string[] };
    };
    expect(diagnostics.paths?.logs).not.toContain(diagnosticsPaths.rotatedDesktopLog);
    expect(diagnostics.paths?.logs).not.toContain(diagnosticsPaths.rendererLog);
    expect(diagnostics.paths?.logs).not.toContain(
      join(diagnosticsPaths.userData, 'logs', 'sidecar.log.1'),
    );

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('redacts credentials in API URLs written to diagnostics.json', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'lynavo-drive-diagnostics-test-'));
    const archivePath = join(tempRoot, 'diagnostics.zip');
    ensureDesktopLogDir();
    process.env.LYNAVO_DESKTOP_UPDATE_URL =
      'https://user:secret@example.test/update?token=abc&keep=ok';
    process.env.LYNAVO_DIAGNOSTICS_UPLOAD_URL = 'https://example.test/upload?api_key=abc&keep=ok';
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
    const diagnostics = JSON.parse(diagnosticsJson) as {
      supportApi?: { updateCheckUrl?: string; diagnosticsUploadUrl?: string };
    };
    expect(diagnostics.supportApi?.updateCheckUrl).toBe(
      'https://redacted:redacted@example.test/update?token=redacted&keep=ok',
    );
    expect(diagnostics.supportApi?.diagnosticsUploadUrl).toBe(
      'https://example.test/upload?api_key=redacted&keep=ok',
    );

    rmSync(tempRoot, { recursive: true, force: true });
  });
});

describe('writePowerDiagnostics', () => {
  it('writes filtered macOS sleep and wake history into the diagnostics files directory', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'lynavo-drive-power-diagnostics-test-'));
    const filesDir = join(tempRoot, 'files');
    mkdirSync(filesDir, { recursive: true });
    const runCommand = vi.fn().mockResolvedValue({
      stdout: [
        '2026-06-11 09:59:58 +0800 Assertions            PID 123',
        '2026-06-11 10:00:00 +0800 Sleep                 Entering Sleep state due to Software Sleep',
        '2026-06-11 10:01:30 +0800 Wake                  Wake from Normal Sleep [CDNVA] : due to EC.LidOpen/UserActivity',
        '2026-06-11 10:01:31 +0800 Kernel Client Acks    Delays to Sleep notifications',
      ].join('\n'),
      stderr: '',
    });

    const { writePowerDiagnostics } = await import('../diagnostics');

    const result = await writePowerDiagnostics(filesDir, {
      platform: 'darwin',
      runCommand,
      now: new Date('2026-06-11T02:02:00.000Z'),
    });

    expect(result).toEqual({
      path: 'files/macos-power.log',
      source: 'pmset -g log',
    });
    expect(runCommand).toHaveBeenCalledWith(
      '/bin/sh',
      ['-c', expect.stringContaining('/usr/bin/pmset -g log')],
      {
        maxBuffer: 2 * 1024 * 1024,
        timeout: 1_500,
      },
    );
    const content = readFileSync(join(filesDir, 'macos-power.log'), 'utf8');
    expect(content).toContain('collectedAt=2026-06-11T02:02:00.000Z');
    expect(content).toContain('Entering Sleep state');
    expect(content).toContain('Wake from Normal Sleep');
    expect(content).not.toContain('Assertions');

    rmSync(tempRoot, { recursive: true, force: true });
  });
});

describe('uploadDiagnostics', () => {
  beforeEach(() => {
    appState.isPackaged = false;
    delete process.env.LYNAVO_SUPPORT_API_BASE_URL;
    delete process.env.LYNAVO_API_BASE_URL;
    delete process.env.LYNAVO_DESKTOP_UPDATE_URL;
    delete process.env.LYNAVO_DIAGNOSTICS_UPLOAD_URL;
    delete process.env.LYNAVO_DIAGNOSTICS_TOKEN;
    delete process.env.LYNAVO_API_TOKEN;
    delete process.env[legacyViviApiBaseEnv];
    delete process.env[legacySyncApiBaseEnv];
    delete process.env[legacyViviUpdateEnv];
    delete process.env[legacyViviDiagnosticsUploadEnv];
    delete process.env[legacyViviDiagnosticsTokenEnv];
    delete process.env[legacyViviApiTokenEnv];
    resetDiagnosticsFs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.LYNAVO_SUPPORT_API_BASE_URL;
    delete process.env.LYNAVO_API_BASE_URL;
    delete process.env.LYNAVO_DESKTOP_UPDATE_URL;
    delete process.env.LYNAVO_DIAGNOSTICS_UPLOAD_URL;
    delete process.env.LYNAVO_DIAGNOSTICS_TOKEN;
    delete process.env.LYNAVO_API_TOKEN;
    delete process.env[legacyViviApiBaseEnv];
    delete process.env[legacySyncApiBaseEnv];
    delete process.env[legacyViviUpdateEnv];
    delete process.env[legacyViviDiagnosticsUploadEnv];
    delete process.env[legacyViviDiagnosticsTokenEnv];
    delete process.env[legacyViviApiTokenEnv];
    resetDiagnosticsFs();
  });

  it('uploads a compact diagnostics bundle when fresh logs and the database are large', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'lynavo-drive-diagnostics-upload-test-'));
    const archivePath = join(tempRoot, 'uploaded.zip');
    const uploaded: { bundle?: Uint8Array } = {};
    ensureDesktopLogDir();
    mkdirSync(join(diagnosticsPaths.userData, 'logs'), { recursive: true });
    writeFileSync(diagnosticsPaths.desktopLog, randomBytes(1024 * 1024));
    writeFileSync(
      join(diagnosticsPaths.userData, 'logs', 'sidecar.log'),
      randomBytes(2 * 1024 * 1024),
    );
    writeFileSync(join(diagnosticsPaths.userData, 'sidecar.db'), randomBytes(2 * 1024 * 1024));
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const form = init?.body as FormData;
      const bundle = form.get('bundle');
      if (!(bundle instanceof Blob)) {
        throw new Error('bundle field missing');
      }
      uploaded.bundle = await readBlobBytes(bundle);
      return new Response(
        JSON.stringify({ ref_id: 'DIA1234', uploaded_at: '2026-05-18T09:00:00Z' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const { uploadDiagnostics } = await import('../diagnostics');

    await uploadDiagnostics(
      {
        getState: () => ({ status: 'healthy' }),
      } as unknown as SidecarManager,
      { description: 'Upload fails with 413', locale: 'en' },
    );

    const bundleBytes = uploaded.bundle;
    if (!bundleBytes) {
      throw new Error('uploaded bundle was not captured');
    }
    expect(bundleBytes.byteLength).toBeLessThan(900 * 1024);
    writeFileSync(archivePath, bundleBytes);
    const entries = execFileSync('unzip', ['-Z1', archivePath], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    expect(entries).toContain('files/main.log');
    expect(entries).toContain('files/sidecar.log');
    expect(entries).not.toContain('files/sidecar.db');
    expect(entries).toContain('files/sidecar.db.omitted.txt');
    const uploadedSidecarLog = execFileSync('unzip', ['-p', archivePath, 'files/sidecar.log']);
    expect(uploadedSidecarLog.byteLength).toBeLessThan(280 * 1024);

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('ignores legacy diagnostics upload URL and broad token env', async () => {
    process.env[legacyViviDiagnosticsUploadEnv] = 'https://legacy.example/diagnostics';
    process.env[legacyViviApiTokenEnv] = 'legacy-token';
    process.env.LYNAVO_API_TOKEN = 'broad-token';
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({ ref_id: 'DIA-LEGACY', uploaded_at: '2026-05-18T09:00:00Z' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const { uploadDiagnostics } = await import('../diagnostics');

    await uploadDiagnostics(
      {
        getState: () => ({ status: 'healthy' }),
      } as unknown as SidecarManager,
      { description: 'legacy env ignored', locale: 'en' },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://review-api.lynavo.com/api/v1/diagnostics/upload',
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers;
    const authorization =
      headers instanceof Headers
        ? headers.get('Authorization')
        : (headers as Record<string, string> | undefined)?.Authorization;
    expect(authorization).toBeUndefined();
  });
});
