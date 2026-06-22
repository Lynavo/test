import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../../..');

function readDesktopConfig(name) {
  return readFileSync(resolve(repoRoot, 'apps/desktop', name), 'utf8');
}

function readTopLevelSection(config, sectionName) {
  const startMarker = `${sectionName}:`;
  const startIndex = config.indexOf(startMarker);

  if (startIndex === -1) {
    return '';
  }

  const rest = config.slice(startIndex);
  const nextSectionMatch = rest.slice(startMarker.length).match(/\n[a-z][\w-]*:/);

  if (nextSectionMatch?.index === undefined) {
    return rest;
  }

  return rest.slice(0, startMarker.length + nextSectionMatch.index);
}

test('global desktop builder config uses Vivi Drop for visible package branding', () => {
  const config = readDesktopConfig('electron-builder.global.yml');

  assert.match(config, /^productName: Vivi Drop$/m);
  assert.match(config, /^  artifactName: ViviDrop-\$\{version\}-\$\{arch\}\.\$\{ext\}$/m);
  assert.match(config, /^  executableName: Vivi Drop$/m);
  assert.match(config, /^  shortcutName: Vivi Drop$/m);
  assert.doesNotMatch(config, /^productName: SyncFlow$/m);
  assert.doesNotMatch(config, /^  artifactName: SyncFlow-/m);
});

test('windows installer uses Vivi Drop in visible firewall rule text', () => {
  const installer = readDesktopConfig('resources/installer.nsh');

  assert.match(installer, /Vivi Drop Sidecar TCP/);
  assert.match(installer, /Configuring Windows Firewall rules for Vivi Drop/);
  assert.doesNotMatch(installer, /add rule name="SyncFlow/);
  assert.doesNotMatch(installer, /description="SyncFlow/);
  assert.doesNotMatch(installer, /DetailPrint ".*SyncFlow/);
});

test('windows installer removes legacy SyncFlow firewall rules during upgrade', () => {
  const installer = readDesktopConfig('resources/installer.nsh');

  assert.match(installer, /!define SF_LEGACY_RULE_TCP\s+"SyncFlow Sidecar TCP"/);
  assert.match(installer, /!define SF_LEGACY_RULE_HTTP\s+"SyncFlow Sidecar HTTP"/);
  assert.match(installer, /!define SF_LEGACY_RULE_MDNS\s+"SyncFlow mDNS UDP"/);
  assert.match(installer, /delete rule name="\$\{SF_LEGACY_RULE_TCP\}"/);
  assert.match(installer, /delete rule name="\$\{SF_LEGACY_RULE_HTTP\}"/);
  assert.match(installer, /delete rule name="\$\{SF_LEGACY_RULE_MDNS\}"/);
});

test('desktop builder configs define Linux deb packaging', () => {
  for (const name of [
    'electron-builder.yml',
    'electron-builder.cn.yml',
    'electron-builder.global.yml',
  ]) {
    const linuxConfig = readTopLevelSection(readDesktopConfig(name), 'linux');

    assert.match(linuxConfig, /^linux:$/m);
    assert.match(linuxConfig, /^  artifactName: ViviDrop-\$\{version\}-linux-\$\{arch\}\.\$\{ext\}$/m);
    assert.match(linuxConfig, /^  executableName: Vivi Drop$/m);
    assert.match(linuxConfig, /^  category: Utility$/m);
    assert.match(linuxConfig, /^  icon: resources\/icon-1024\.png$/m);
    assert.match(linuxConfig, /^    - target: deb$/m);
    assert.match(linuxConfig, /^        - x64$/m);
    assert.match(linuxConfig, /^        - arm64$/m);
    assert.match(linuxConfig, /^    - from: resources\/syncflow-sidecar$/m);
    assert.match(linuxConfig, /^      to: syncflow-sidecar$/m);
  }
});
