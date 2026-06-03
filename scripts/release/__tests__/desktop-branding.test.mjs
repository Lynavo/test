import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../../..');

function readDesktopConfig(name) {
  return readFileSync(resolve(repoRoot, 'apps/desktop', name), 'utf8');
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
