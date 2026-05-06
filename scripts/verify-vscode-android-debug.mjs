import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(root, relativePath), 'utf8'));
}

const launch = readJson('.vscode/launch.json');
const tasks = readJson('.vscode/tasks.json');
const mobilePackage = readJson('apps/mobile/package.json');
const androidBuildGradle = readFileSync(
  resolve(root, 'apps/mobile/android/app/build.gradle'),
  'utf8',
);

const [defaultConfig] = launch.configurations;

assert.equal(defaultConfig?.name, 'Mobile: Android Debug (F5)');
assert.equal(defaultConfig.type, 'reactnative');
assert.equal(defaultConfig.request, 'launch');
assert.equal(defaultConfig.platform, 'android');
assert.equal(defaultConfig.target, 'device');
assert.equal(defaultConfig.cwd, '${workspaceFolder}/apps/mobile');
assert.equal(defaultConfig.variant, 'debug');
assert.equal(defaultConfig.preLaunchTask, 'mobile: start metro');
assert.deepEqual(defaultConfig.logCatArguments, ['*:S', 'ReactNative:V', 'ReactNativeJS:V']);

assert.equal(
  launch.configurations.some(
    (configuration) => configuration.name === 'Mobile: Android (quick launch)',
  ),
  false,
  'Mobile: Android (quick launch) should not be present; F5 is the Android debug entry point',
);

const metroTask = tasks.tasks.find((task) => task.label === 'mobile: start metro');

assert.ok(metroTask, 'mobile: start metro task should exist');
assert.equal(metroTask.isBackground, true);
assert.deepEqual(metroTask.args, ['pnpm', '--filter', '@syncflow/mobile', 'start:reset']);
assert.equal(metroTask.problemMatcher.background.beginsPattern, '.*Welcome to React Native.*');
assert.match(metroTask.problemMatcher.background.endsPattern, /Welcome to Metro/);
assert.equal(mobilePackage.scripts?.['start:reset'], 'react-native start --reset-cache');

assert.match(
  androidBuildGradle,
  /missingDimensionStrategy\s+["']store["']\s*,\s*["']play["']/,
  'Android debug builds should resolve react-native-iap to the Play store flavor',
);
