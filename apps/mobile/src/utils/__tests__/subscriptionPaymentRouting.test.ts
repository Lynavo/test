import { resolveSubscriptionPaymentRoute } from '../subscriptionPaymentRouting';

describe('resolveSubscriptionPaymentRoute', () => {
  it('routes iOS to Apple in-app purchase', () => {
    expect(
      resolveSubscriptionPaymentRoute({
        os: 'ios',
        countryCode: 'CN',
      }),
    ).toEqual({
      kind: 'apple_iap',
      catalogPlatform: 'ios',
      useIapProducts: true,
      restorePurchases: true,
      walletMethods: [],
    });
  });

  it('routes Android users in mainland China to wallet payments', () => {
    expect(
      resolveSubscriptionPaymentRoute({
        os: 'android',
        countryCode: 'CN',
      }),
    ).toEqual({
      kind: 'android_cn_wallets',
      catalogPlatform: 'android',
      useIapProducts: false,
      restorePurchases: false,
      walletMethods: ['wechat', 'alipay'],
    });
  });

  it('routes Android users outside mainland China to wallet payments for the China build', () => {
    expect(
      resolveSubscriptionPaymentRoute({
        os: 'android',
        countryCode: 'US',
      }),
    ).toEqual({
      kind: 'android_cn_wallets',
      catalogPlatform: 'android',
      useIapProducts: false,
      restorePurchases: false,
      walletMethods: ['wechat', 'alipay'],
    });
  });

  it('routes Android users without a country signal to wallet payments', () => {
    expect(
      resolveSubscriptionPaymentRoute({
        os: 'android',
        countryCode: null,
      }),
    ).toEqual({
      kind: 'android_cn_wallets',
      catalogPlatform: 'android',
      useIapProducts: false,
      restorePurchases: false,
      walletMethods: ['wechat', 'alipay'],
    });
  });
});
