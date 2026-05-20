import { resolveSubscriptionPaymentRoute } from '../subscriptionPaymentRouting';
import { isGlobalMarket } from '../../markets';

jest.mock('../../markets', () => ({
  isGlobalMarket: jest.fn(() => false),
}));

describe('resolveSubscriptionPaymentRoute', () => {
  beforeEach(() => {
    jest.mocked(isGlobalMarket).mockReturnValue(false);
  });

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

  it('routes Android users in Global market to Google Play billing without wallets', () => {
    jest.mocked(isGlobalMarket).mockReturnValue(true);
    expect(
      resolveSubscriptionPaymentRoute({
        os: 'android',
        countryCode: 'US',
      }),
    ).toEqual({
      kind: 'google_play_billing',
      catalogPlatform: 'android',
      useIapProducts: true,
      restorePurchases: false,
      walletMethods: [],
    });
  });
});
