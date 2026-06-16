declare const process: { env: { [key: string]: string | undefined } };

import { NativeModules } from 'react-native';

import { mobileReleaseProfile } from '../release-profile';
import { cnMarketConfig } from './cn/config';
import { globalMarketConfig } from './global/config';
import type { Market, MobileMarketConfig } from './types';

type NativeMarketConstants = {
  SYNCFLOW_MARKET?: unknown;
  getConstants?: () => NativeMarketConstants;
};

function resolveNativeMarket(): unknown {
  const nativeMarketConfig = NativeModules?.NativeMarketConfig as
    | NativeMarketConstants
    | undefined;
  const appleAuth = NativeModules?.AppleAuthModule as
    | NativeMarketConstants
    | undefined;
  const nativeSyncEngine = NativeModules?.NativeSyncEngine as
    | NativeMarketConstants
    | undefined;
  return (
    nativeMarketConfig?.SYNCFLOW_MARKET ??
    nativeMarketConfig?.getConstants?.()?.SYNCFLOW_MARKET ??
    appleAuth?.SYNCFLOW_MARKET ??
    appleAuth?.getConstants?.()?.SYNCFLOW_MARKET ??
    nativeSyncEngine?.SYNCFLOW_MARKET ??
    nativeSyncEngine?.getConstants?.()?.SYNCFLOW_MARKET
  );
}

function normalizeMarket(value: unknown): Market | null {
  return value === 'global' || value === 'cn' ? value : null;
}

const nativeMarketConfig = NativeModules?.NativeMarketConfig;
const appleAuth = NativeModules?.AppleAuthModule;
const nativeSyncEngine = NativeModules?.NativeSyncEngine;
const nativeMarket = resolveNativeMarket();
const releaseMarket = mobileReleaseProfile.market;

console.log('[SYNCFLOW MARKET DEBUG]', {
  hasNativeMarketConfig: !!nativeMarketConfig,
  hasAppleAuthModule: !!appleAuth,
  hasNativeSyncEngine: !!nativeSyncEngine,
  nativeMarketConfigKeys: nativeMarketConfig
    ? Object.keys(nativeMarketConfig)
    : [],
  appleAuthKeys: appleAuth ? Object.keys(appleAuth) : [],
  nativeSyncEngineKeys: nativeSyncEngine ? Object.keys(nativeSyncEngine) : [],
  nativeMarket,
  processEnvMarket: process.env.SYNCFLOW_MARKET,
  releaseMarket,
});

function resolveActiveMarket(): Market {
  return (
    normalizeMarket(resolveNativeMarket()) ??
    normalizeMarket(process.env.SYNCFLOW_MARKET) ??
    normalizeMarket(releaseMarket) ??
    'cn'
  );
}

const rawMarket = nativeMarket || process.env.SYNCFLOW_MARKET || releaseMarket;

export const activeMarket: Market = normalizeMarket(rawMarket) ?? 'cn';

export const marketConfig: MobileMarketConfig =
  activeMarket === 'global' ? globalMarketConfig : cnMarketConfig;

export function isGlobalMarket(): boolean {
  return resolveActiveMarket() === 'global';
}

export function isChinaMarket(): boolean {
  return resolveActiveMarket() === 'cn';
}
