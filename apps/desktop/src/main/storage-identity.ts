import { cpSync, existsSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { APP_STORAGE_IDENTITY_NAME } from '../shared/product';

const LEGACY_APP_STORAGE_IDENTITY_NAME = 'Vivi Drop';

type StorageIdentityApp = {
  getPath(name: 'appData'): string;
  setPath(name: 'userData', path: string): void;
};

type WarnLogger = (message: string, error: unknown) => void;

type StorageIdentityFs = {
  copyDirectory(from: string, to: string): void;
};

const defaultStorageIdentityFs: StorageIdentityFs = {
  copyDirectory(from, to) {
    cpSync(from, to, {
      errorOnExist: true,
      force: false,
      recursive: true,
    });
  },
};

export function configureElectronStorageIdentity(
  electronApp: StorageIdentityApp,
  warn: WarnLogger = () => {},
  fsOps: StorageIdentityFs = defaultStorageIdentityFs,
): void {
  const appDataPath = electronApp.getPath('appData');
  const userDataPath = join(appDataPath, APP_STORAGE_IDENTITY_NAME);
  const legacyUserDataPath = join(appDataPath, LEGACY_APP_STORAGE_IDENTITY_NAME);

  if (!existsSync(userDataPath) && existsSync(legacyUserDataPath)) {
    const tempUserDataPath = mkdtempSync(join(appDataPath, `${APP_STORAGE_IDENTITY_NAME}.copy-`));
    try {
      fsOps.copyDirectory(legacyUserDataPath, tempUserDataPath);
      renameSync(tempUserDataPath, userDataPath);
    } catch (error) {
      rmSync(tempUserDataPath, { force: true, recursive: true });
      warn('[App] failed to copy legacy userData into Lynavo Drive storage', error);
    }
  }

  electronApp.setPath('userData', userDataPath);
}
