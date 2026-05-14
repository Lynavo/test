import type { SubscriptionPlanPlatform } from '@syncflow/contracts';

export type MainlandPaymentMethod = 'wechat' | 'alipay';

export type SubscriptionPaymentRouteKind =
  | 'apple_iap'
  | 'android_cn_wallets'
  | 'google_play_billing';

export interface SubscriptionPaymentRoute {
  kind: SubscriptionPaymentRouteKind;
  catalogPlatform: SubscriptionPlanPlatform;
  useIapProducts: boolean;
  restorePurchases: boolean;
  walletMethods: MainlandPaymentMethod[];
}

export interface ResolveSubscriptionPaymentRouteInput {
  os: string;
  countryCode?: string | null;
}

export function resolveSubscriptionPaymentRoute({
  os,
}: ResolveSubscriptionPaymentRouteInput): SubscriptionPaymentRoute {
  if (os === 'ios') {
    return {
      kind: 'apple_iap',
      catalogPlatform: 'ios',
      useIapProducts: true,
      restorePurchases: true,
      walletMethods: [],
    };
  }

  if (os === 'android') {
    return {
      kind: 'android_cn_wallets',
      catalogPlatform: 'android',
      useIapProducts: false,
      restorePurchases: false,
      walletMethods: ['wechat', 'alipay'],
    };
  }

  return {
    kind: 'google_play_billing',
    catalogPlatform: 'android',
    useIapProducts: true,
    restorePurchases: false,
    walletMethods: [],
  };
}
