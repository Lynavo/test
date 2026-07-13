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
