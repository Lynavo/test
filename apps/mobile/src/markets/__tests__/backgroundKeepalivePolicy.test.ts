import {
  resolveAndroidDistribution,
  resolveBackgroundKeepalivePolicy,
} from '../backgroundKeepalivePolicy';

describe('background keepalive policy', () => {
  it('allows China Android to use foreground service plus battery whitelist guidance', () => {
    const policy = resolveBackgroundKeepalivePolicy({
      platform: 'android',
      market: 'cn',
    });

    expect(resolveAndroidDistribution('cn')).toBe('china');
    expect(policy.strategy).toBe(
      'android_cn_foreground_service_battery_whitelist',
    );
    expect(policy.androidDistribution).toBe('china');
    expect(policy.requiresUserVisibleForegroundService).toBe(true);
    expect(policy.mayRequestBatteryOptimizationExemption).toBe(true);
    expect(policy.requiresGooglePlayForegroundServiceDeclaration).toBe(false);
    expect(policy.userPrompts).toContain(
      'offer battery optimization whitelist only when auto sync is enabled',
    );
    expect(policy.nativeRequirements).toContain(
      'vendor-specific autostart and battery guide entry points',
    );
  });

  it('keeps global Android Play-compliant and avoids battery whitelist as a default requirement', () => {
    const policy = resolveBackgroundKeepalivePolicy({
      platform: 'android',
      market: 'global',
    });

    expect(resolveAndroidDistribution('global')).toBe('googlePlay');
    expect(policy.strategy).toBe(
      'android_global_foreground_service_play_compliant',
    );
    expect(policy.androidDistribution).toBe('googlePlay');
    expect(policy.requiresUserVisibleForegroundService).toBe(true);
    expect(policy.mayRequestBatteryOptimizationExemption).toBe(false);
    expect(policy.requiresGooglePlayForegroundServiceDeclaration).toBe(true);
    expect(policy.fallbackBehavior).toContain(
      'do not depend on hidden long-running background execution',
    );
  });
});
