import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = new URL('../../..', import.meta.url);

function runVerifier(args) {
  return spawnSync(process.execPath, ['scripts/verify-oss-boundary.mjs', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

test('blocks unallowlisted commercial and remote-access boundary terms by default', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'oss-boundary-'));
  try {
    const sourceDir = join(fixtureRoot, 'apps', 'mobile', 'src');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(
      join(sourceDir, 'bad.ts'),
      [
        'const oldScreen = "RemoteAccess";',
        'const tunnel = "remote tunnel";',
        'const gate = "paywall";',
        'const urlScheme = "com.googleusercontent.apps.example";',
      ].join('\n'),
    );
    writeFileSync(join(sourceDir, 'RemoteAccessScreen.tsx'), 'export const ok = true;\n');

    const result = runVerifier(['--root', fixtureRoot]);

    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /Unallowlisted OSS boundary hits: 5/);
    assert.match(result.stdout, /apps\/mobile\/src\/RemoteAccessScreen\.tsx:0 RemoteAccess/);
    assert.match(result.stdout, /apps\/mobile\/src\/bad\.ts:1 RemoteAccess/);
    assert.match(result.stdout, /apps\/mobile\/src\/bad\.ts:2 remote tunnel/);
    assert.match(result.stdout, /apps\/mobile\/src\/bad\.ts:3 paywall/);
    assert.match(result.stdout, /apps\/mobile\/src\/bad\.ts:4 googleusercontent/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('keeps unallowlisted OSS boundary hits advisory when requested', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'oss-boundary-'));
  try {
    const sourceDir = join(fixtureRoot, 'services', 'sidecar-go');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, 'bad.go'), 'const flag = "canUseRemoteTunnel"\n');

    const result = runVerifier(['--root', fixtureRoot, '--advisory']);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Unallowlisted OSS boundary hits: 1/);
    assert.match(result.stdout, /Unallowlisted hits \(advisory\):/);
    assert.match(result.stdout, /services\/sidecar-go\/bad\.go:1 canUseRemoteTunnel/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('scans code targets while leaving docs and generated artifacts out of the default gate', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'oss-boundary-'));
  try {
    mkdirSync(join(fixtureRoot, 'apps', 'mobile', 'src'), { recursive: true });
    mkdirSync(join(fixtureRoot, 'docs', 'commercial'), { recursive: true });
    mkdirSync(join(fixtureRoot, 'apps', 'mobile', '.turbo'), { recursive: true });
    writeFileSync(join(fixtureRoot, 'apps', 'mobile', 'src', 'clean.ts'), 'export const ok = true;\n');
    writeFileSync(join(fixtureRoot, 'docs', 'commercial', 'history.md'), 'RemoteAccess\n');
    writeFileSync(join(fixtureRoot, 'apps', 'mobile', '.turbo', 'turbo-test.log'), 'RemoteAccess\n');

    const result = runVerifier(['--root', fixtureRoot]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Unallowlisted OSS boundary hits: 0/);
    assert.doesNotMatch(result.stdout, /docs\/commercial/);
    assert.doesNotMatch(result.stdout, /\.turbo/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('does not treat React Native event subscription handles as commercial subscription state', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'oss-boundary-'));
  try {
    const sourceDir = join(fixtureRoot, 'apps', 'mobile', 'src', 'screens');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(
      join(sourceDir, 'DeviceDiscoveryScreen.tsx'),
      [
        'let subscription: { remove: () => void } | undefined;',
        "subscription = emitter.addListener('changed', () => {});",
        'subscription?.remove();',
      ].join('\n'),
    );

    const result = runVerifier(['--root', fixtureRoot]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Allowed OSS boundary hits: 3/);
    assert.match(result.stdout, /Unallowlisted OSS boundary hits: 0/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('allows existing OSS env scrubber to name commercial auth inputs it removes', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'oss-boundary-'));
  try {
    const scriptDir = join(fixtureRoot, 'scripts', 'dev');
    mkdirSync(scriptDir, { recursive: true });
    writeFileSync(join(scriptDir, 'oss-env-scrubber.cjs'), "delete env.LYNAVO_AUTH_BASE_URL;\n");

    const result = runVerifier(['--root', fixtureRoot]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Allowed OSS boundary hits: 1/);
    assert.match(result.stdout, /Unallowlisted OSS boundary hits: 0/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
