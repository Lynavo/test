declare const process: { cwd(): string };

type FsModule = {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: 'utf8'): string;
};

type PathModule = {
  join(...paths: string[]): string;
};

const fs = require('fs') as FsModule;
const path = require('path') as PathModule;

const BATTERY_OPTIMIZATION_PERMISSION =
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS';

function readManifest(sourceSet: 'main' | 'cn' | 'global'): string | null {
  const manifestPath = path.join(
    process.cwd(),
    'android',
    'app',
    'src',
    sourceSet,
    'AndroidManifest.xml',
  );

  return fs.existsSync(manifestPath)
    ? fs.readFileSync(manifestPath, 'utf8')
    : null;
}

describe('Android manifest market policy', () => {
  it('keeps battery optimization exemption permission out of the shared manifest', () => {
    expect(readManifest('main') ?? '').not.toContain(
      BATTERY_OPTIMIZATION_PERMISSION,
    );
  });

  it('declares battery optimization exemption permission only for China Android', () => {
    expect(readManifest('cn')).toContain(BATTERY_OPTIMIZATION_PERMISSION);
    expect(readManifest('global') ?? '').not.toContain(
      BATTERY_OPTIMIZATION_PERMISSION,
    );
  });
});
