import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('desktop Electron identity', () => {
  it('sets the Lynavo userData path explicitly before Electron startup', () => {
    const source = readFileSync(resolve(__dirname, '../index.ts'), 'utf8');

    expect(source).toContain(
      "import { configureElectronStorageIdentity } from './storage-identity';",
    );
    expect(source.indexOf('configureElectronStorageIdentity(app')).toBeLessThan(
      source.indexOf('app.whenReady()'),
    );
    expect(source).not.toMatch(/app\.setName\(/);
  });
});
