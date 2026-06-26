import { buildReleasePlan } from '../release/release-profiles.mjs';

const DEV_TARGETS = new Set([
  'desktop',
  'mobile-metro',
  'mobile-ios',
  'mobile-ios-device',
  'mobile-android',
]);

export function buildDevRunPlan({ profileName, target, extraArgs = [] }) {
  if (!DEV_TARGETS.has(target)) {
    throw new Error(
      `Unsupported dev target "${target}". Supported targets: ${[...DEV_TARGETS].join(', ')}`,
    );
  }

  const releaseTarget =
    target === 'mobile-android' ? 'android' : target.startsWith('mobile-') ? 'ios' : 'mac';
  const releasePlan = buildReleasePlan({
    profileName,
    targets: [releaseTarget],
  });
  const env = {
    ...releasePlan.env,
    ...buildTargetEnv(releasePlan.profile, target),
  };

  return {
    profile: releasePlan.profile,
    target,
    env,
    command: buildTargetCommand(releasePlan.profile, target).command,
    args: [...buildTargetCommand(releasePlan.profile, target).args, ...extraArgs],
    writeMobileReleaseProfile: target.startsWith('mobile-'),
    mobileReleaseProfileSource: releasePlan.mobileReleaseProfileSource,
  };
}

export function buildSourceDefaultMobileReleaseProfileSource() {
  return `export const mobileReleaseProfile = {
  name: 'source-default',
  market: 'source',
  review: false,
  apiBaseUrl: '',
} as const;

export const releaseApiBaseUrl = mobileReleaseProfile.apiBaseUrl.trim() || null;
`;
}

function buildTargetCommand(profile, target) {
  if (target === 'desktop') {
    return {
      command: 'pnpm',
      args: ['--filter', '@syncflow/desktop', 'dev'],
    };
  }

  if (target === 'mobile-metro') {
    return {
      command: 'pnpm',
      args: ['--filter', '@syncflow/mobile', 'start'],
    };
  }

  if (target === 'mobile-ios') {
    const isGlobal = profile.market === 'global';
    return {
      command: 'corepack',
      args: [
        'pnpm',
        '--filter',
        '@syncflow/mobile',
        'exec',
        'react-native',
        'run-ios',
        '--scheme',
        isGlobal ? 'SyncFlowMobileGlobal' : 'SyncFlowMobile',
        '--mode',
        isGlobal ? 'DebugGlobal' : 'Debug',
      ],
    };
  }

  if (target === 'mobile-ios-device') {
    return {
      command: 'bash',
      args: ['scripts/dev/run-mobile-ios-device.sh'],
    };
  }

  return {
    command: 'bash',
    args: ['scripts/dev/run-mobile-android-device.sh'],
  };
}

function buildTargetEnv(profile, target) {
  if (target !== 'mobile-android') {
    return {};
  }

  if (profile.market === 'global') {
    return {
      SYNCFLOW_ANDROID_APP_ID: 'com.vividrop.mobile.global',
      SYNCFLOW_ANDROID_INSTALL_TASK: ':app:installGlobalDebug',
    };
  }

  return {
    SYNCFLOW_ANDROID_APP_ID: 'com.vividrop.mobile.china',
    SYNCFLOW_ANDROID_INSTALL_TASK: ':app:installCnDebug',
  };
}
