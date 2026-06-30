import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { configureElectronStorageIdentity } from '../storage-identity';

type MockElectronApp = {
  getPath: (name: 'appData') => string;
  setPath: (name: 'userData', path: string) => void;
};

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe('configureElectronStorageIdentity', () => {
  let tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots = [];
    vi.restoreAllMocks();
  });

  function createMockApp(appData: string): MockElectronApp & { userDataPath?: string } {
    return {
      getPath: () => appData,
      setPath(name, path) {
        expect(name).toBe('userData');
        this.userDataPath = path;
      },
    };
  }

  it('copies legacy Vivi Drop userData into Lynavo Drive without deleting legacy data', async () => {
    const appData = mkdtempSync(join(tmpdir(), 'lynavo-app-data-'));
    tempRoots.push(appData);
    const legacyUserData = join(appData, 'Vivi Drop');
    const newUserData = join(appData, 'Lynavo Drive');
    await mkdir(join(legacyUserData, 'settings'), { recursive: true });
    writeFileSync(join(legacyUserData, 'settings', 'prefs.json'), '{"theme":"light"}');

    const electronApp = createMockApp(appData);
    await configureElectronStorageIdentity(electronApp);

    expect(electronApp.userDataPath).toBe(newUserData);
    expect(readFileSync(join(newUserData, 'settings', 'prefs.json'), 'utf8')).toBe(
      '{"theme":"light"}',
    );
    expect(readFileSync(join(legacyUserData, 'settings', 'prefs.json'), 'utf8')).toBe(
      '{"theme":"light"}',
    );
  });

  it('does not overwrite existing Lynavo Drive userData with legacy data', async () => {
    const appData = mkdtempSync(join(tmpdir(), 'lynavo-app-data-'));
    tempRoots.push(appData);
    const legacyUserData = join(appData, 'Vivi Drop');
    const newUserData = join(appData, 'Lynavo Drive');
    await mkdir(legacyUserData, { recursive: true });
    await mkdir(newUserData, { recursive: true });
    writeFileSync(join(legacyUserData, 'prefs.json'), '{"source":"legacy"}');
    writeFileSync(join(newUserData, 'prefs.json'), '{"source":"new"}');

    const electronApp = createMockApp(appData);
    await configureElectronStorageIdentity(electronApp);

    expect(electronApp.userDataPath).toBe(newUserData);
    expect(readFileSync(join(newUserData, 'prefs.json'), 'utf8')).toBe('{"source":"new"}');
    expect(readFileSync(join(legacyUserData, 'prefs.json'), 'utf8')).toBe('{"source":"legacy"}');
  });

  it('sets Lynavo Drive userData even when there is no legacy directory to copy', async () => {
    const appData = mkdtempSync(join(tmpdir(), 'lynavo-app-data-'));
    tempRoots.push(appData);

    const electronApp = createMockApp(appData);
    await configureElectronStorageIdentity(electronApp);

    expect(electronApp.userDataPath).toBe(join(appData, 'Lynavo Drive'));
    expect(await pathExists(join(appData, 'Vivi Drop'))).toBe(false);
  });

  it('removes temporary copied data and leaves no partial final tree when copy fails', async () => {
    const appData = mkdtempSync(join(tmpdir(), 'lynavo-app-data-'));
    tempRoots.push(appData);
    const legacyUserData = join(appData, 'Vivi Drop');
    const newUserData = join(appData, 'Lynavo Drive');
    await mkdir(legacyUserData, { recursive: true });
    writeFileSync(join(legacyUserData, 'prefs.json'), '{"source":"legacy"}');

    const electronApp = createMockApp(appData);
    configureElectronStorageIdentity(electronApp, () => {}, {
      copyDirectory(_from, to) {
        mkdirSync(join(to, 'partial'), { recursive: true });
        writeFileSync(join(to, 'partial', 'prefs.json'), '{"partial":true}');
        throw new Error('copy failed');
      },
    });

    expect(electronApp.userDataPath).toBe(newUserData);
    expect(await pathExists(newUserData)).toBe(false);
    expect(readFileSync(join(legacyUserData, 'prefs.json'), 'utf8')).toBe('{"source":"legacy"}');
    expect(readdirSync(appData).filter((entry) => entry.startsWith('Lynavo Drive.copy-'))).toEqual(
      [],
    );
  });
});
