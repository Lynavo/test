import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const repoRoot = new URL('../../..', import.meta.url);
const token = (parts) => parts.join('');
const mobileBetaPackageScript = token(['package:mobile:', 'test', 'flight']);

function readRepoFile(path) {
  return readFileSync(new URL(path, repoRoot), 'utf8');
}

test('package scripts expose an OSS release gate without native builds', () => {
  const packageJson = JSON.parse(readRepoFile('package.json'));
  const scripts = packageJson.scripts ?? {};

  assert.equal(
    scripts['verify:oss-source-package:head'],
    'node scripts/verify-oss-source-package.mjs --git-ref HEAD',
  );
  assert.equal(
    scripts['gate:release'],
    [
      'pnpm sync:versions:check',
      'pnpm verify:oss-source-package:worktree',
      'pnpm verify:oss-source-package:head',
      'pnpm test:release',
      'pnpm release --profile review --targets ios,android,mac,win,linux --dry-run',
      'pnpm release --profile prod --targets ios,android,mac,win,linux --dry-run',
    ].join(' && '),
  );
  assert.match(scripts.check, /pnpm gate:release/);
  assert.doesNotMatch(scripts['gate:release'], /\b(package|build):desktop\b/);
  assert.doesNotMatch(scripts['gate:release'], /\bbuild:mobile\b/);
  assert.equal(scripts['gate:release'].includes(mobileBetaPackageScript), false);
  assert.equal(scripts[mobileBetaPackageScript], undefined);
  assert.equal(scripts[token([mobileBetaPackageScript, ':archive'])], undefined);
  assert.equal(scripts[token([mobileBetaPackageScript, ':upload'])], undefined);
  assert.equal(scripts[token(['package:desktop', ':signed'])], undefined);
  assert.equal(scripts[token(['package:desktop', ':signed:dir'])], undefined);
  assert.equal(scripts[token(['tag:', 'beta'])], undefined);
  assert.equal(scripts[token(['tag:', 'beta:push'])], undefined);
});

test('policy permits only secret-free unsigned GitHub-hosted verification builds', () => {
  const policyPaths = [
    'AGENTS.md',
    'README.md',
    'CONTRIBUTING.md',
    'docs/release/release-playbook.md',
    'docs/testing/oss-verification-matrix.md',
  ];
  const docs = policyPaths.map(readRepoFile);

  for (const doc of docs) {
    assert.match(doc, /GitHub-hosted/i);
    assert.match(doc, /unsigned/i);
  }

  const policy = docs.join('\n');
  assert.match(policy, /no repository secrets/i);
  assert.match(policy, /Linux.+local.+verification/is);
  assert.match(policy, /signing|code signing/i);
  assert.match(policy, /notarization/i);
  assert.match(policy, /store upload|app-store upload/i);
  assert.match(policy, /auto-update/i);
  assert.match(policy, /external.+build|third-party.+build/i);
});

test('iOS OSS build does not declare background audio capability', () => {
  const infoPlist = readRepoFile('apps/mobile/ios/LynavoDrive/Info.plist');
  const appDelegate = readRepoFile('apps/mobile/ios/LynavoDrive/AppDelegate.swift');

  assert.doesNotMatch(infoPlist, /UIBackgroundModes/);
  assert.doesNotMatch(infoPlist, /<string>audio<\/string>/);
  assert.doesNotMatch(appDelegate, /AVAudioSession/);
  assert.doesNotMatch(appDelegate, /\.playback/);
});
