import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';

const repoRoot = new URL('../../..', import.meta.url);
const ACTION_SHA = /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/;

function readRepoFile(path) {
  return readFileSync(new URL(path, repoRoot), 'utf8');
}

function workflow(path) {
  return parse(readRepoFile(path));
}

function assertCommonTriggers(config) {
  assert.ok(config.on?.pull_request !== undefined);
  assert.ok(config.on?.merge_group !== undefined);
  assert.deepEqual(config.on?.push?.branches, ['main']);
  assert.ok(config.on?.workflow_dispatch !== undefined);
}

function assertReadOnlyWorkflow(config) {
  assert.deepEqual(config.permissions, { contents: 'read' });
  assert.equal(config.concurrency?.['cancel-in-progress'], true);
  assert.match(config.concurrency?.group ?? '', /workflow/);
  assert.match(config.concurrency?.group ?? '', /pull_request/);
}

function assertActionsPinned(steps) {
  for (const step of steps) {
    if (step.uses) assert.match(step.uses, ACTION_SHA);
  }
}

function findStep(steps, name) {
  const step = steps.find(candidate => candidate.name === name);
  assert.ok(step, `missing workflow step: ${name}`);
  return step;
}

function allWorkflowSteps(config) {
  return Object.values(config.jobs ?? {}).flatMap(job => job.steps ?? []);
}

test('OSS Release Gate workflow is stable, read-only, and toolchain-pinned', () => {
  const config = workflow('.github/workflows/oss-release-gate.yml');
  const job = config.jobs?.['oss-release-gate'];

  assert.equal(config.name, 'OSS Release Gate');
  assertCommonTriggers(config);
  assertReadOnlyWorkflow(config);
  assert.equal(job?.name, 'OSS Release Gate');
  assert.equal(job?.['runs-on'], 'ubuntu-24.04');
  assert.equal(job?.['timeout-minutes'], 30);
  assertActionsPinned(job?.steps ?? []);

  const pnpm = findStep(job.steps, 'Setup pnpm');
  assert.equal(pnpm.with?.version, '10.32.1');

  const node = findStep(job.steps, 'Setup Node.js');
  assert.equal(node.with?.['node-version'], '22.12.0');
  assert.equal(node.with?.cache, 'pnpm');

  assert.equal(
    findStep(job.steps, 'Install dependencies').run,
    'pnpm install --frozen-lockfile',
  );
  assert.equal(findStep(job.steps, 'Run OSS release gate').run, 'pnpm gate:release');

  const commands = job.steps.map(step => step.run ?? '').join('\n');
  assert.doesNotMatch(commands, /\bpnpm build\b/);
  assert.doesNotMatch(commands, /\bpnpm package:/);
  assert.doesNotMatch(commands, /\bxcodebuild\b/);
  assert.doesNotMatch(commands, /\bgradlew\b/);
});

test('repository CI workflow runs TypeScript quality and Go tests', () => {
  const config = workflow('.github/workflows/ci.yml');
  const mobilePackage = JSON.parse(readRepoFile('apps/mobile/package.json'));
  const tsJob = config.jobs?.['ts-quality'];
  const goJob = config.jobs?.['go-tests'];

  assert.equal(config.name, 'CI');
  assert.equal(mobilePackage.scripts?.test, 'jest --no-watchman');
  assertCommonTriggers(config);
  assertReadOnlyWorkflow(config);

  assert.equal(tsJob?.name, 'TS Quality');
  assert.equal(tsJob?.['runs-on'], 'ubuntu-24.04');
  assert.equal(tsJob?.['timeout-minutes'], 45);
  assertActionsPinned(tsJob?.steps ?? []);
  assert.equal(findStep(tsJob.steps, 'Setup pnpm').with?.version, '10.32.1');
  const node = findStep(tsJob.steps, 'Setup Node.js');
  assert.equal(node.with?.['node-version'], '22.12.0');
  assert.equal(node.with?.cache, 'pnpm');

  const tsCommands = tsJob.steps.map(step => step.run).filter(Boolean);
  assert.deepEqual(tsCommands, [
    'pnpm install --frozen-lockfile',
    'pnpm build --filter=!@lynavo-drive/mobile',
    'pnpm format:check',
    'pnpm lint',
    'pnpm typecheck',
    'pnpm --filter @lynavo-drive/mobile exec tsc --noEmit',
    'pnpm test',
  ]);

  assert.equal(goJob?.name, 'Go Tests');
  assert.equal(goJob?.['runs-on'], 'ubuntu-24.04');
  assert.equal(goJob?.['timeout-minutes'], 20);
  assertActionsPinned(goJob?.steps ?? []);
  const go = findStep(goJob.steps, 'Setup Go');
  assert.equal(go.with?.['go-version'], '1.25.6');
  assert.equal(go.with?.cache, true);
  assert.equal(go.with?.['cache-dependency-path'], 'services/sidecar-go/go.sum');
  const goTest = findStep(goJob.steps, 'Run Go tests');
  assert.equal(goTest.run, 'go test ./...');
  assert.equal(goTest['working-directory'], 'services/sidecar-go');
});

test('Dependabot proposes reviewed monthly dependency updates', () => {
  const config = workflow('.github/dependabot.yml');
  const updates = config.updates ?? [];
  const pnpm = updates.find(update => update['package-ecosystem'] === 'npm');
  const actions = updates.find(
    update => update['package-ecosystem'] === 'github-actions',
  );

  assert.equal(config.version, 2);
  for (const update of [pnpm, actions]) {
    assert.ok(update);
    assert.equal(update.directory, '/');
    assert.equal(update.schedule?.interval, 'monthly');
    assert.equal(update['open-pull-requests-limit'], 5);
  }
});

test('native build workflow is path-aware, unsigned, and platform-bounded', () => {
  const config = workflow('.github/workflows/native-builds.yml');
  const jobs = config.jobs ?? {};

  assert.equal(config.name, 'Native Builds');
  assertCommonTriggers(config);
  assert.ok(config.on?.workflow_call !== undefined);
  assertReadOnlyWorkflow(config);
  assert.equal(config.on?.pull_request_target, undefined);

  assert.equal(jobs.changes?.name, 'Detect Changes');
  assert.equal(jobs.ios?.name, 'iOS Build');
  assert.equal(jobs.android?.name, 'Android Build');
  assert.equal(jobs.macos?.name, 'macOS Package');
  assert.equal(jobs.windows?.name, 'Windows Package');
  assert.equal(jobs.aggregate?.name, 'Native Builds');

  const paths = findStep(jobs.changes?.steps ?? [], 'Filter changed paths');
  const filters = paths.with?.filters ?? '';
  for (const path of [
    'apps/mobile/**',
    'apps/desktop/**',
    'services/sidecar-go/**',
    'packages/contracts/**',
    'packages/design-tokens/**',
    'scripts/release/**',
    'pnpm-lock.yaml',
    '.github/workflows/native-builds.yml',
  ]) {
    assert.match(filters, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.equal(jobs.ios?.['runs-on'], 'macos-26');
  assert.equal(jobs.android?.['runs-on'], 'ubuntu-24.04');
  assert.equal(jobs.windows?.['runs-on'], 'windows-2025');
  assert.deepEqual(jobs.macos?.strategy?.matrix?.include, [
    { arch: 'arm64', runner: 'macos-26' },
    { arch: 'x64', runner: 'macos-26-intel' },
  ]);
  assert.equal(jobs.macos?.['runs-on'], '${{ matrix.runner }}');
  assert.equal(
    findStep(jobs.macos?.steps ?? [], 'Build macOS sidecar').run,
    'node apps/desktop/scripts/build-sidecar-mac.cjs ${{ matrix.arch }}',
  );

  const steps = allWorkflowSteps(config);
  assertActionsPinned(steps);
  const workflowText = readRepoFile('.github/workflows/native-builds.yml');
  assert.match(workflowText, /22\.12\.0/);
  assert.match(workflowText, /10\.32\.1/);
  assert.match(workflowText, /1\.25\.6/);
  assert.match(workflowText, /java-version:\s*['"]?17['"]?/);
  assert.match(workflowText, /CODE_SIGNING_ALLOWED=NO/);
  assert.match(workflowText, /retention-days:\s*7/);

  for (const artifact of [
    'native-macos-${{ matrix.arch }}',
    'native-windows-x64',
    'native-android',
    'LynavoDrive-${{ needs.changes.outputs.version }}-macos-${{ matrix.arch }}.dmg',
    'LynavoDrive-${{ needs.changes.outputs.version }}-windows-x64.exe',
    'LynavoDrive-${{ needs.changes.outputs.version }}-windows-x64.zip',
    'LynavoDrive-${{ needs.changes.outputs.version }}-android-arm64-x86_64.apk',
    'LynavoDrive-${{ needs.changes.outputs.version }}-android-arm64-x86_64.aab',
  ]) {
    assert.ok(workflowText.includes(artifact), `missing native artifact: ${artifact}`);
  }

  assert.equal(jobs.aggregate?.if, 'always()');
  assert.deepEqual(jobs.aggregate?.needs, [
    'changes',
    'ios',
    'android',
    'macos',
    'windows',
  ]);
  const aggregateStep = findStep(
    jobs.aggregate?.steps ?? [],
    'Verify native build results',
  );
  assert.equal(aggregateStep.env?.CHANGES_RESULT, '${{ needs.changes.result }}');
  const aggregateCommands = aggregateStep.run ?? '';
  assert.match(aggregateCommands, /CHANGES_RESULT.+success/s);
  assert.match(aggregateCommands, /success/);
  assert.match(aggregateCommands, /skipped/);
  assert.match(aggregateCommands, /No native build scope selected\./);

  assert.doesNotMatch(workflowText, /pull_request_target/);
  assert.doesNotMatch(workflowText, /ubuntu-(?:20\.04|22\.04)|runs-on:\s*.*linux/i);
  assert.doesNotMatch(workflowText, /(?:artifact|asset)[^\n]*linux|linux[^\n]*(?:artifact|asset)/i);
  assert.doesNotMatch(workflowText, /notari[sz]|apple-id|app-store|play-store|auto.?update/i);
  assert.doesNotMatch(workflowText, /secrets\.|CSC_LINK|APPLE_ID|signing-certificate/i);
  for (const step of steps.filter(candidate => candidate.uses?.startsWith('actions/upload-artifact@'))) {
    assert.doesNotMatch(String(step.with?.path ?? ''), /[*?]/);
  }
});
