import type { Market } from './types';

export type MobileRuntimePlatform = 'ios' | 'android';

export type AndroidDistribution = 'china' | 'googlePlay';

export type BackgroundKeepaliveStrategy =
  | 'ios_background_urlsession'
  | 'android_cn_foreground_service_battery_whitelist'
  | 'android_global_foreground_service_play_compliant';

export interface BackgroundKeepalivePolicyInput {
  platform: MobileRuntimePlatform;
  market: Market;
  androidDistribution?: AndroidDistribution;
}

export interface BackgroundKeepalivePolicy {
  platform: MobileRuntimePlatform;
  market: Market;
  androidDistribution?: AndroidDistribution;
  strategy: BackgroundKeepaliveStrategy;
  usesSilentAudio: boolean;
  supportsScreenOffUpload: boolean;
  requiresUserVisibleForegroundService: boolean;
  mayRequestBatteryOptimizationExemption: boolean;
  requiresGooglePlayForegroundServiceDeclaration: boolean;
  nativeRequirements: readonly string[];
  userPrompts: readonly string[];
  fallbackBehavior: readonly string[];
}

export function resolveAndroidDistribution(
  market: Market,
): AndroidDistribution {
  return market === 'cn' ? 'china' : 'googlePlay';
}

export function resolveBackgroundKeepalivePolicy(
  input: BackgroundKeepalivePolicyInput,
): BackgroundKeepalivePolicy {
  if (input.platform === 'ios') {
    return {
      platform: 'ios',
      market: input.market,
      strategy: 'ios_background_urlsession',
      usesSilentAudio: false,
      supportsScreenOffUpload: true,
      requiresUserVisibleForegroundService: false,
      mayRequestBatteryOptimizationExemption: false,
      requiresGooglePlayForegroundServiceDeclaration: false,
      nativeRequirements: [
        'URLSessionConfiguration.background',
        'BGProcessingTask for queue wakeups',
      ],
      userPrompts: [],
      fallbackBehavior: [
        'foreground TCP continues for active sessions',
        'system scheduling may defer long transfers after screen lock',
      ],
    };
  }

  const androidDistribution =
    input.androidDistribution ?? resolveAndroidDistribution(input.market);

  if (androidDistribution === 'china') {
    return {
      platform: 'android',
      market: input.market,
      androidDistribution,
      strategy: 'android_cn_foreground_service_battery_whitelist',
      usesSilentAudio: false,
      supportsScreenOffUpload: true,
      requiresUserVisibleForegroundService: true,
      mayRequestBatteryOptimizationExemption: true,
      requiresGooglePlayForegroundServiceDeclaration: false,
      nativeRequirements: [
        'foreground service with dataSync service type',
        'persistent upload notification with stop action',
        'ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS after explicit user education',
        'vendor-specific autostart and battery guide entry points',
      ],
      userPrompts: [
        'explain that screen-off LAN sync needs foreground notification',
        'offer battery optimization whitelist only when auto sync is enabled',
        'show vendor-specific steps without blocking normal foreground sync',
      ],
      fallbackBehavior: [
        'continue while the foreground service is alive',
        'pause and persist queue when the OS kills the service',
        'resume from local pending queue when the app or service restarts',
      ],
    };
  }

  return {
    platform: 'android',
    market: input.market,
    androidDistribution,
    strategy: 'android_global_foreground_service_play_compliant',
    usesSilentAudio: false,
    supportsScreenOffUpload: true,
    requiresUserVisibleForegroundService: true,
    mayRequestBatteryOptimizationExemption: false,
    requiresGooglePlayForegroundServiceDeclaration: true,
    nativeRequirements: [
      'foreground service with dataSync service type',
      'Play Console foreground service declaration for user-initiated data sync',
      'persistent upload notification with stop action',
      'resumable local pending queue for OS-stopped sessions',
    ],
    userPrompts: [
      'request only runtime permissions needed for media and local network sync',
      'avoid asking users to disable battery optimization during normal onboarding',
      'surface retry/resume controls when Android stops the foreground service',
    ],
    fallbackBehavior: [
      'continue while the user-visible foreground service is running',
      'do not depend on hidden long-running background execution',
      'resume from local pending queue after app relaunch or explicit retry',
    ],
  };
}
