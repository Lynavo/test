import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
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
      `https://review-api.vividrop.cn/api/v1/desktop/update-check?${updateCheckQuery}`,
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
    delete process.env.VIVIDROP_API_BASE_URL;
    delete process.env.SYNCFLOW_API_BASE_URL;
    delete process.env.VIVIDROP_DESKTOP_UPDATE_URL;
    delete process.env.VIVIDROP_DIAGNOSTICS_UPLOAD_URL;
    rmSync('/tmp/vividrop-user-data', { recursive: true, force: true });
    rmSync('/tmp/vividrop-main.log', { force: true });
    rmSync('/tmp/vividrop-main.log.1', { force: true });
    rmSync('/tmp/vividrop-renderer.log', { force: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.VIVIDROP_API_BASE_URL;
    delete process.env.SYNCFLOW_API_BASE_URL;
    delete process.env.VIVIDROP_DESKTOP_UPDATE_URL;
    delete process.env.VIVIDROP_DIAGNOSTICS_UPLOAD_URL;
    rmSync('/tmp/vividrop-user-data', { recursive: true, force: true });
    rmSync('/tmp/vividrop-main.log', { force: true });
    rmSync('/tmp/vividrop-main.log.1', { force: true });
    rmSync('/tmp/vividrop-renderer.log', { force: true });
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

  it('includes issue description, runtime context, and available log files', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'syncflow-diagnostics-test-'));
    const archivePath = join(tempRoot, 'diagnostics.zip');
    mkdirSync('/tmp/vividrop-user-data/logs', { recursive: true });
    writeFileSync('/tmp/vividrop-main.log', 'main log\n');
    writeFileSync('/tmp/vividrop-main.log.1', 'rotated main log\n');
    writeFileSync('/tmp/vividrop-renderer.log', 'renderer log\n');
    writeFileSync('/tmp/vividrop-user-data/logs/sidecar.log', 'sidecar log\n');
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
    expect(entries.some((entry) => entry.endsWith('/files/vividrop-main.log'))).toBe(true);
    expect(entries.some((entry) => entry.endsWith('/files/vividrop-main.log.1'))).toBe(true);
    expect(entries.some((entry) => entry.endsWith('/files/vividrop-renderer.log'))).toBe(true);
    expect(entries.some((entry) => entry.endsWith('/files/sidecar.log'))).toBe(true);

    const diagnosticsEntry = entries.find((entry) => entry.endsWith('/diagnostics.json'));
    expect(diagnosticsEntry).toBeTruthy();
    const diagnosticsJson = execFileSync('unzip', ['-p', archivePath, diagnosticsEntry ?? ''], {
      encoding: 'utf8',
    });
    const diagnostics = JSON.parse(diagnosticsJson) as {
      issue?: { description?: string };
      process?: { electron?: string; node?: string; chrome?: string };
      api?: { updateCheckUrl?: string; diagnosticsUploadUrl?: string };
      paths?: { userData?: string; logs?: string[] };
    };
    expect(diagnostics.issue?.description).toBe('Wi-Fi drops when the phone locks');
    expect(diagnostics.process?.node).toBeTruthy();
    expect(diagnostics.api?.updateCheckUrl).toContain('/api/v1/desktop/update-check');
    expect(diagnostics.api?.diagnosticsUploadUrl).toContain('/api/v1/diagnostics/upload');
    expect(diagnostics.paths?.userData).toBe('/tmp/vividrop-user-data');
    expect(diagnostics.paths?.logs).toContain('/tmp/vividrop-main.log');

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('omits stale rotated log files from diagnostics archives', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'syncflow-diagnostics-test-'));
    const archivePath = join(tempRoot, 'diagnostics.zip');
    const staleDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    mkdirSync('/tmp/vividrop-user-data/logs', { recursive: true });
    writeFileSync('/tmp/vividrop-main.log', 'fresh main log\n');
    writeFileSync('/tmp/vividrop-main.log.1', 'stale rotated main log\n');
    writeFileSync('/tmp/vividrop-renderer.log', 'stale renderer log\n');
    writeFileSync('/tmp/vividrop-user-data/logs/sidecar.log', 'fresh sidecar log\n');
    writeFileSync('/tmp/vividrop-user-data/logs/sidecar.log.1', 'stale rotated sidecar log\n');
    utimesSync('/tmp/vividrop-main.log.1', staleDate, staleDate);
    utimesSync('/tmp/vividrop-renderer.log', staleDate, staleDate);
    utimesSync('/tmp/vividrop-user-data/logs/sidecar.log.1', staleDate, staleDate);
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
    expect(entries.some((entry) => entry.endsWith('/files/vividrop-main.log'))).toBe(true);
    expect(entries.some((entry) => entry.endsWith('/files/sidecar.log'))).toBe(true);
    expect(entries.some((entry) => entry.endsWith('/files/vividrop-main.log.1'))).toBe(false);
    expect(entries.some((entry) => entry.endsWith('/files/vividrop-renderer.log'))).toBe(false);
    expect(entries.some((entry) => entry.endsWith('/files/sidecar.log.1'))).toBe(false);

    const diagnosticsEntry = entries.find((entry) => entry.endsWith('/diagnostics.json'));
    expect(diagnosticsEntry).toBeTruthy();
    const diagnosticsJson = execFileSync('unzip', ['-p', archivePath, diagnosticsEntry ?? ''], {
      encoding: 'utf8',
    });
    const diagnostics = JSON.parse(diagnosticsJson) as {
      paths?: { logs?: string[] };
    };
    expect(diagnostics.paths?.logs).not.toContain('/tmp/vividrop-main.log.1');
    expect(diagnostics.paths?.logs).not.toContain('/tmp/vividrop-renderer.log');
    expect(diagnostics.paths?.logs).not.toContain(
      '/tmp/vividrop-user-data/logs/sidecar.log.1',
    );

    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('redacts credentials in API URLs written to diagnostics.json', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'syncflow-diagnostics-test-'));
    const archivePath = join(tempRoot, 'diagnostics.zip');
    process.env.VIVIDROP_DESKTOP_UPDATE_URL =
      'https://user:secret@example.test/update?token=abc&keep=ok';
    process.env.VIVIDROP_DIAGNOSTICS_UPLOAD_URL = 'https://example.test/upload?api_key=abc&keep=ok';
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
      api?: { updateCheckUrl?: string; diagnosticsUploadUrl?: string };
    };
    expect(diagnostics.api?.updateCheckUrl).toBe(
      'https://redacted:redacted@example.test/update?token=redacted&keep=ok',
    );
    expect(diagnostics.api?.diagnosticsUploadUrl).toBe(
      'https://example.test/upload?api_key=redacted&keep=ok',
    );

    rmSync(tempRoot, { recursive: true, force: true });
  });
});

describe('uploadDiagnostics', () => {
  beforeEach(() => {
    appState.isPackaged = false;
    delete process.env.VIVIDROP_API_BASE_URL;
    delete process.env.SYNCFLOW_API_BASE_URL;
    delete process.env.VIVIDROP_DESKTOP_UPDATE_URL;
    delete process.env.VIVIDROP_DIAGNOSTICS_UPLOAD_URL;
    rmSync('/tmp/vividrop-user-data', { recursive: true, force: true });
    rmSync('/tmp/vividrop-main.log', { force: true });
    rmSync('/tmp/vividrop-main.log.1', { force: true });
    rmSync('/tmp/vividrop-renderer.log', { force: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.VIVIDROP_API_BASE_URL;
    delete process.env.SYNCFLOW_API_BASE_URL;
    delete process.env.VIVIDROP_DESKTOP_UPDATE_URL;
    delete process.env.VIVIDROP_DIAGNOSTICS_UPLOAD_URL;
    rmSync('/tmp/vividrop-user-data', { recursive: true, force: true });
    rmSync('/tmp/vividrop-main.log', { force: true });
    rmSync('/tmp/vividrop-main.log.1', { force: true });
    rmSync('/tmp/vividrop-renderer.log', { force: true });
  });

  it('uploads a compact diagnostics bundle when fresh logs and the database are large', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'syncflow-diagnostics-upload-test-'));
    const archivePath = join(tempRoot, 'uploaded.zip');
    const uploaded: { bundle?: Uint8Array } = {};
    mkdirSync('/tmp/vividrop-user-data/logs', { recursive: true });
    writeFileSync('/tmp/vividrop-main.log', randomBytes(1024 * 1024));
    writeFileSync('/tmp/vividrop-user-data/logs/sidecar.log', randomBytes(2 * 1024 * 1024));
    writeFileSync('/tmp/vividrop-user-data/sidecar.db', randomBytes(2 * 1024 * 1024));
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
    expect(entries).toContain('files/vividrop-main.log');
    expect(entries).toContain('files/sidecar.log');
    expect(entries).not.toContain('files/sidecar.db');
    expect(entries).toContain('files/sidecar.db.omitted.txt');
    const uploadedSidecarLog = execFileSync('unzip', ['-p', archivePath, 'files/sidecar.log']);
    expect(uploadedSidecarLog.byteLength).toBeLessThan(280 * 1024);

    rmSync(tempRoot, { recursive: true, force: true });
  });
});
