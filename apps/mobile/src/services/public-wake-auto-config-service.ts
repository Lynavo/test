import { NativeModules } from 'react-native';
import { recordDiagnosticsLog } from './diagnostics-log-service';
import { getSuggestedPublicWakeHost } from './public-wake-service';
import { savePublicWakeTarget } from './SyncEngineModule';

type BindingRecord = Record<string, unknown>;
type WakeRecord = Record<string, unknown>;

export type PublicWakeAutoConfigResult =
  | {
      status: 'saved';
      host: string;
      port: number;
    }
  | {
      status: 'skipped';
      reason:
        | 'binding_unavailable'
        | 'lan_context_unconfirmed'
        | 'lan_wake_targets_unavailable'
        | 'public_target_exists'
        | 'public_host_unavailable'
        | 'native_bridge_unavailable';
    }
  | {
      status: 'failed';
      error: unknown;
    };

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function getWakeRecord(binding: unknown): WakeRecord | null {
  return asRecord(asRecord(binding)?.wake);
}

function isPrivateIPv4(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const parts = value.trim().split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map(part => {
    if (!/^\d{1,3}$/.test(part)) return null;
    const parsed = Number(part);
    return parsed >= 0 && parsed <= 255 ? parsed : null;
  });
  if (octets.some(octet => octet === null)) return false;
  const [a, b] = octets as [number, number, number, number];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function hasConfirmedLanContext(binding: BindingRecord): boolean {
  const reachability = asRecord(binding.sharedFilesReachability);
  const route =
    typeof reachability?.route === 'string' ? reachability.route.trim() : '';
  const routeAllowsLanAutoConfig = route.length === 0 || route === 'lan';
  return (
    binding.connectionState === 'connected' &&
    isPrivateIPv4(binding.host) &&
    routeAllowsLanAutoConfig
  );
}

function hasLanWakeTargets(wake: WakeRecord | null): boolean {
  return Array.isArray(wake?.targets) && wake.targets.length > 0;
}

function hasEnabledPublicTarget(wake: WakeRecord | null): boolean {
  const publicTarget = asRecord(wake?.publicTarget);
  const host =
    typeof publicTarget?.host === 'string' ? publicTarget.host.trim() : '';
  return publicTarget?.enabled === true && host.length > 0;
}

function getExistingPublicTarget(
  wake: WakeRecord | null,
): { host: string; port: number } | null {
  const publicTarget = asRecord(wake?.publicTarget);
  const host =
    typeof publicTarget?.host === 'string' ? publicTarget.host.trim() : '';
  if (!host) return null;
  const port =
    typeof publicTarget?.port === 'number' &&
    Number.isInteger(publicTarget.port) &&
    publicTarget.port >= 1 &&
    publicTarget.port <= 65535
      ? publicTarget.port
      : resolveSuggestedPort(wake);
  return { host, port };
}

function resolveSuggestedPort(wake: WakeRecord | null): number {
  const targets = Array.isArray(wake?.targets) ? wake.targets : [];
  for (const target of targets) {
    const targetRecord = asRecord(target);
    const ports = Array.isArray(targetRecord?.ports) ? targetRecord.ports : [];
    const port = ports.find(
      value =>
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= 65535,
    );
    if (typeof port === 'number') return port;
  }
  return 9;
}

export async function autoConfigurePublicWakeTargetFromBinding(
  binding: unknown,
): Promise<PublicWakeAutoConfigResult> {
  const bindingRecord = asRecord(binding);
  const wake = getWakeRecord(binding);
  if (!bindingRecord || !bindingRecord.deviceId || !wake) {
    console.log('[public-wake] auto-config skipped reason=binding_unavailable');
    recordDiagnosticsLog('PublicWake', 'auto-config skipped', {
      reason: 'binding_unavailable',
    });
    return { status: 'skipped', reason: 'binding_unavailable' };
  }

  if (!hasConfirmedLanContext(bindingRecord)) {
    console.log(
      `[public-wake] auto-config skipped reason=lan_context_unconfirmed connectionState=${String(
        bindingRecord.connectionState ?? 'nil',
      )} host=${String(bindingRecord.host ?? 'nil')}`,
    );
    recordDiagnosticsLog('PublicWake', 'auto-config skipped', {
      reason: 'lan_context_unconfirmed',
      connectionState: String(bindingRecord.connectionState ?? 'nil'),
      host: String(bindingRecord.host ?? 'nil'),
      route: String(
        asRecord(bindingRecord.sharedFilesReachability)?.route ?? 'nil',
      ),
    });
    return { status: 'skipped', reason: 'lan_context_unconfirmed' };
  }

  if (!hasLanWakeTargets(wake)) {
    console.log(
      '[public-wake] auto-config skipped reason=lan_wake_targets_unavailable',
    );
    recordDiagnosticsLog('PublicWake', 'auto-config skipped', {
      reason: 'lan_wake_targets_unavailable',
    });
    return { status: 'skipped', reason: 'lan_wake_targets_unavailable' };
  }

  if (hasEnabledPublicTarget(wake)) {
    console.log(
      '[public-wake] auto-config skipped reason=public_target_exists',
    );
    recordDiagnosticsLog('PublicWake', 'auto-config skipped', {
      reason: 'public_target_exists',
    });
    return { status: 'skipped', reason: 'public_target_exists' };
  }

  try {
    const existingTarget = getExistingPublicTarget(wake);
    const host = existingTarget?.host ?? (await getSuggestedPublicWakeHost());
    if (!host) {
      console.log(
        '[public-wake] auto-config skipped reason=public_host_unavailable',
      );
      recordDiagnosticsLog('PublicWake', 'auto-config skipped', {
        reason: 'public_host_unavailable',
      });
      return { status: 'skipped', reason: 'public_host_unavailable' };
    }

    const port = existingTarget?.port ?? resolveSuggestedPort(wake);
    await savePublicWakeTarget({ host, port, enabled: true });
    console.log(
      `[public-wake] auto-config saved enabled target host=${host} port=${port}`,
    );
    recordDiagnosticsLog('PublicWake', 'auto-config saved enabled target', {
      host,
      port,
    });
    return { status: 'saved', host, port };
  } catch (error) {
    console.warn('[public-wake] auto-config failed', error);
    recordDiagnosticsLog('PublicWake', 'auto-config failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: 'failed', error };
  }
}

export async function autoConfigurePublicWakeTargetFromNativeBinding(): Promise<PublicWakeAutoConfigResult> {
  const nativeSyncEngine = NativeModules.NativeSyncEngine as
    | {
        getBindingState?: () => Promise<unknown>;
      }
    | undefined;
  if (typeof nativeSyncEngine?.getBindingState !== 'function') {
    console.log(
      '[public-wake] auto-config skipped reason=native_bridge_unavailable',
    );
    recordDiagnosticsLog('PublicWake', 'auto-config skipped', {
      reason: 'native_bridge_unavailable',
    });
    return { status: 'skipped', reason: 'native_bridge_unavailable' };
  }

  try {
    const binding = await nativeSyncEngine.getBindingState();
    return await autoConfigurePublicWakeTargetFromBinding(binding);
  } catch (error) {
    console.warn('[public-wake] auto-config failed', error);
    recordDiagnosticsLog('PublicWake', 'auto-config failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: 'failed', error };
  }
}
