const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

function buildCodesignArgs(identity, target, signOptions = {}, extraArgs = []) {
  const args = ['--force', '--sign', identity];

  if (signOptions.timestamp === false) {
    args.push('--timestamp=none');
  } else if (typeof signOptions.timestamp === 'string' && signOptions.timestamp.length > 0) {
    args.push(`--timestamp=${signOptions.timestamp}`);
  } else {
    args.push('--timestamp');
  }

  if (signOptions.hardenedRuntime) {
    args.push('--options', 'runtime');
  }

  if (signOptions.entitlements) {
    args.push('--entitlements', signOptions.entitlements);
  }

  if (signOptions.requirements) {
    args.push('--requirements', signOptions.requirements);
  }

  if (Array.isArray(signOptions.additionalArguments) && signOptions.additionalArguments.length > 0) {
    args.push(...signOptions.additionalArguments);
  }

  if (extraArgs.length > 0) {
    args.push(...extraArgs);
  }

  args.push(target);
  return args;
}

async function runCodesign(identity, target, signOptions, extraArgs = []) {
  const args = buildCodesignArgs(identity, target, signOptions, extraArgs);
  await execFileAsync('codesign', args, { maxBuffer: 10 * 1024 * 1024 });
}

module.exports = async function sign(opts) {
  if (!opts.identity || opts.identity === '-') {
    return;
  }

  const binaries = Array.isArray(opts.binaries) ? opts.binaries : [];
  for (const binary of binaries) {
    const binaryOptions = opts.optionsForFile ? opts.optionsForFile(binary) : {};
    await runCodesign(opts.identity, binary, binaryOptions);
  }

  const appOptions = opts.optionsForFile ? opts.optionsForFile(opts.app) : {};
  await runCodesign(opts.identity, opts.app, appOptions, ['--deep']);
};
