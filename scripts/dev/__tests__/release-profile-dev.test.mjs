import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDevRunPlan,
  buildSourceDefaultMobileReleaseProfileSource,
} from '../release-profile-dev.mjs';

test('builds global-prod desktop dev env from the release profile', () => {
  const plan = buildDevRunPlan({
    profileName: 'global-prod',
    target: 'desktop',
  });

  assert.equal(plan.command, 'pnpm');
  assert.deepEqual(plan.args, ['--filter', '@syncflow/desktop', 'dev']);
  assert.equal(plan.env.SYNCFLOW_RELEASE_PROFILE, 'global-prod');
  assert.equal(plan.env.SYNCFLOW_MARKET, 'global');
  assert.equal(plan.env.SYNCFLOW_API_BASE_URL, 'https://global-api.vividrop.cn');
  assert.equal(plan.env.VIVIDROP_API_BASE_URL, 'https://global-api.vividrop.cn');
  assert.equal(plan.env.SYNCFLOW_CLIENT_CONFIG_BASE_URL, 'https://global-api.vividrop.cn');
  assert.equal(plan.env.SYNCFLOW_GIFTCARD_REDEEM_BASE_URL, 'https://global-api.vividrop.cn');
  assert.equal(Object.hasOwn(plan.env, 'SYNCFLOW_AUTH_BASE_URL'), false);
  assert.equal(plan.writeMobileReleaseProfile, false);
});

test('builds global-prod iOS dev command with global scheme and mobile profile', () => {
  const plan = buildDevRunPlan({
    profileName: 'global-prod',
    target: 'mobile-ios',
    extraArgs: ['--simulator', 'iPhone 17 Pro'],
  });

  assert.equal(plan.command, 'corepack');
  assert.deepEqual(plan.args, [
    'pnpm',
    '--filter',
    '@syncflow/mobile',
    'exec',
    'react-native',
    'run-ios',
    '--scheme',
    'SyncFlowMobileGlobal',
    '--mode',
    'DebugGlobal',
    '--simulator',
    'iPhone 17 Pro',
  ]);
  assert.equal(plan.env.SYNCFLOW_MARKET, 'global');
  assert.equal(plan.writeMobileReleaseProfile, true);
  assert.match(plan.mobileReleaseProfileSource, /name: 'global-prod'/);
  assert.match(plan.mobileReleaseProfileSource, /apiBaseUrl: 'https:\/\/global-api\.vividrop\.cn'/);
});

test('builds global-prod Android dev command for the global app id', () => {
  const plan = buildDevRunPlan({
    profileName: 'global-prod',
    target: 'mobile-android',
  });

  assert.equal(plan.command, 'bash');
  assert.deepEqual(plan.args, ['scripts/dev/run-mobile-android-device.sh']);
  assert.equal(plan.env.SYNCFLOW_ANDROID_APP_ID, 'com.vividrop.mobile.global');
  assert.equal(plan.env.SYNCFLOW_ANDROID_INSTALL_TASK, ':app:installGlobalDebug');
  assert.equal(plan.writeMobileReleaseProfile, true);
});

test('can generate the source-default mobile release profile for reset', () => {
  assert.equal(
    buildSourceDefaultMobileReleaseProfileSource(),
    `export const mobileReleaseProfile = {
  name: 'source-default',
  market: 'source',
  review: false,
  apiBaseUrl: '',
} as const;

export const releaseApiBaseUrl = mobileReleaseProfile.apiBaseUrl.trim() || null;
`,
  );
});
