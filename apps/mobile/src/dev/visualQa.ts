import { NativeModules } from 'react-native';
import type { RootStackParamList } from '../navigation/RootNavigator';

declare const __DEV__: boolean | undefined;
declare const process: { env?: Record<string, string | undefined> } | undefined;

type VisualQaRoute = Extract<
  keyof RootStackParamList,
  | 'DeviceDiscovery'
  | 'QRScanner'
  | 'ConnectionTutorial'
  | 'SyncActivity'
  | 'AlbumWorkbench'
  | 'SharedFiles'
  | 'PhoneSyncSpace'
  | 'RemoteAccess'
  | 'DownloadRecords'
  | 'History'
  | 'Settings'
  | 'Help'
  | 'OpenSourceInfo'
  | 'AutoUploadSettings'
>;

type RemoteResourcesPreviewGlobal = typeof globalThis & {
  __LYNAVO_REMOTE_RESOURCES_PREVIEW__?: boolean;
};

type VisualQaNativeConstants = {
  LYNAVO_DEV_SKIP_AUTH?: unknown;
  LYNAVO_DEV_SKIP_AUTH_EMAIL?: unknown;
  LYNAVO_VISUAL_QA?: unknown;
  LYNAVO_VISUAL_QA_EMAIL?: unknown;
  LYNAVO_VISUAL_QA_HOME_EMPTY?: unknown;
  LYNAVO_VISUAL_QA_ROUTE?: unknown;
  LYNAVO_VISUAL_QA_REMOTE_PREVIEW?: unknown;
  getConstants?: () => VisualQaNativeConstants;
};

const DEFAULT_VISUAL_QA_EMAIL = 'qa@example.com';
const DEFAULT_DEV_SKIP_AUTH_EMAIL = 'qa@example.com';
const VISUAL_QA_REFRESH_TOKEN = 'mock-sandbox-refresh-token';
const VISUAL_QA_ROUTE_WHITELIST: ReadonlySet<string> = new Set<VisualQaRoute>([
  'DeviceDiscovery',
  'QRScanner',
  'ConnectionTutorial',
  'SyncActivity',
  'AlbumWorkbench',
  'SharedFiles',
  'PhoneSyncSpace',
  'RemoteAccess',
  'DownloadRecords',
  'History',
  'Settings',
  'Help',
  'OpenSourceInfo',
  'AutoUploadSettings',
]);

function getEnv(name: string): string | undefined {
  if (typeof process === 'undefined') return undefined;
  return process.env?.[name];
}

function readNativeValue(
  name: keyof VisualQaNativeConstants,
): string | undefined {
  const nativeMarketConfig = NativeModules.NativeMarketConfig as
    | VisualQaNativeConstants
    | undefined;
  const appleAuthModule = NativeModules.AppleAuthModule as
    | VisualQaNativeConstants
    | undefined;
  const nativeMarketConstants = nativeMarketConfig?.getConstants?.();
  const appleAuthConstants = appleAuthModule?.getConstants?.();
  const value =
    nativeMarketConfig?.[name] ??
    nativeMarketConstants?.[name] ??
    appleAuthModule?.[name] ??
    appleAuthConstants?.[name];
  return typeof value === 'string' ? value : undefined;
}

function getVisualQaValue(
  name: keyof VisualQaNativeConstants,
): string | undefined {
  return readNativeValue(name) ?? getEnv(name);
}

function isDevRuntime(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

export function isVisualQaEnabled(): boolean {
  const nativeValue = readNativeValue('LYNAVO_VISUAL_QA');
  if (nativeValue !== undefined) {
    return nativeValue === '1';
  }
  return isDevRuntime() ? getEnv('LYNAVO_VISUAL_QA') === '1' : false;
}

export function getVisualQaMockTokens(): {
  accessToken: string;
  refreshToken: string;
} | null {
  if (!isVisualQaEnabled()) return null;
  const email =
    getVisualQaValue('LYNAVO_VISUAL_QA_EMAIL') || DEFAULT_VISUAL_QA_EMAIL;
  return {
    accessToken: `mock-sandbox-access-token:${email}`,
    refreshToken: VISUAL_QA_REFRESH_TOKEN,
  };
}

export function isDevSkipAuthEnabled(): boolean {
  if (!isDevRuntime()) return false;
  return getVisualQaValue('LYNAVO_DEV_SKIP_AUTH') === '1';
}

export function getDevSkipAuthMockTokens(): {
  accessToken: string;
  refreshToken: string;
} | null {
  if (!isDevSkipAuthEnabled()) return null;
  const email =
    getVisualQaValue('LYNAVO_DEV_SKIP_AUTH_EMAIL') ||
    DEFAULT_DEV_SKIP_AUTH_EMAIL;
  return {
    accessToken: `mock-sandbox-access-token:${email}`,
    refreshToken: VISUAL_QA_REFRESH_TOKEN,
  };
}

export function resolveVisualQaInitialRoute(): VisualQaRoute | null {
  if (!isVisualQaEnabled()) return null;
  const route = getVisualQaValue('LYNAVO_VISUAL_QA_ROUTE');
  if (!route || !VISUAL_QA_ROUTE_WHITELIST.has(route)) return null;
  return route as VisualQaRoute;
}

export function isVisualQaHomeEmptyStateEnabled(): boolean {
  return (
    isVisualQaEnabled() &&
    getVisualQaValue('LYNAVO_VISUAL_QA_HOME_EMPTY') === '1'
  );
}

export function applyVisualQaRemotePreviewFlag(): void {
  if (
    isVisualQaEnabled() &&
    getVisualQaValue('LYNAVO_VISUAL_QA_REMOTE_PREVIEW') === '1'
  ) {
    (
      globalThis as RemoteResourcesPreviewGlobal
    ).__LYNAVO_REMOTE_RESOURCES_PREVIEW__ = true;
  }
}
