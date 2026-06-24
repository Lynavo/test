import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../../..');

test('signed macOS packaging builds DMGs one architecture at a time', () => {
  const script = readFileSync(
    resolve(repoRoot, 'apps/desktop/scripts/package-macos-signed.sh'),
    'utf8',
  );

  assert.doesNotMatch(script, /electron-builder --mac dmg --arm64 --x64/);
  assert.match(script, /for arch in x64 arm64/);
  assert.match(script, /electron-builder --mac "\$\{target\}" "--\$\{arch\}"/);
  assert.match(script, /-c\.dmg\.title=\$\{DMG_CREATE_VOLUME_NAME\}"/);
  assert.doesNotMatch(
    script,
    /-c\.dmg\.title=\$\{DESKTOP_PRODUCT_NAME\} \$\{DESKTOP_VERSION\}-\$\{arch\}/,
  );
  assert.match(script, /finalize_dmg_volume_name "\$\{arch\}"/);
  assert.match(script, /validate_dmg_payload "\$\{arch\}"/);
  assert.match(script, /DMG artifact does not contain \$\{DESKTOP_PRODUCT_NAME\}\.app/);
  assert.match(script, /rebuild_dmg_from_app "\$\{arch\}"/);
  assert.match(script, /remove_stale_dmg_blockmap "\$\{arch\}"/);
  assert.match(script, /DMG_CREATE_VOLUME_NAME="\$\{DESKTOP_PRODUCT_NAME\} DMG"/);
  assert.match(script, /diskutil rename "\$\{mount_dir\}" "\$\{DESKTOP_PRODUCT_NAME\}"/);
});

test('signed macOS packaging resolves App Store Connect key from release market', () => {
  const script = readFileSync(
    resolve(repoRoot, 'apps/desktop/scripts/package-macos-signed.sh'),
    'utf8',
  );

  assert.match(script, /\$\{SYNCFLOW_MARKET:-cn\}/);
  assert.match(script, /DEFAULT_GLOBAL_API_KEY_ID="AMY9XVV3LD"/);
  assert.match(script, /DEFAULT_CN_API_KEY_ID="HY8CAHGPW9"/);
  assert.match(script, /APPLE_API_KEY_ID="\$\{APPLE_API_KEY_ID:-\$\{DEFAULT_GLOBAL_API_KEY_ID\}\}"/);
  assert.match(script, /APPLE_API_KEY_ID="\$\{APPLE_API_KEY_ID:-\$\{DEFAULT_CN_API_KEY_ID\}\}"/);
  assert.match(script, /AuthKey_Global_\$\{APPLE_API_KEY_ID\}\.p8/);
  assert.match(script, /AuthKey_China_\$\{APPLE_API_KEY_ID\}\.p8/);
});

test('signed macOS packaging resolves Developer ID team from release market', () => {
  const script = readFileSync(
    resolve(repoRoot, 'apps/desktop/scripts/package-macos-signed.sh'),
    'utf8',
  );

  assert.match(script, /DEFAULT_GLOBAL_CSC_TEAM_ID="S44ANBLMF9"/);
  assert.match(script, /DEFAULT_CN_CSC_TEAM_ID="GKN7JQNCMC"/);
  assert.match(script, /list_certificates_for_team\(\)/);
  assert.match(script, /EXPECTED_CSC_TEAM_ID="\$\(resolve_expected_csc_team_id\)"/);
  assert.match(script, /detect_identity_for_team "\$\{EXPECTED_CSC_TEAM_ID\}"/);
  assert.match(script, /macOS DMG requires Developer ID Application/);
  assert.match(script, /not a usable Developer ID Application signing identity/);
  assert.match(script, /Selected CSC_NAME does not match expected Team ID/);
  assert.match(script, /Expected Team ID: \$\{EXPECTED_CSC_TEAM_ID\}/);
});
