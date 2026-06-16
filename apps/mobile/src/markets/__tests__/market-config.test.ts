import { cnMarketConfig } from '../cn/config';
import { globalMarketConfig } from '../global/config';

const importMarketModuleWithNativeModules = (
  nativeModules: Record<string, unknown>,
): typeof import('../index') => {
  jest.resetModules();
  jest.doMock('react-native', () => ({
    NativeModules: nativeModules,
  }));
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../index') as typeof import('../index');
};

afterEach(() => {
  jest.dontMock('react-native');
  jest.restoreAllMocks();
});

describe('mobile market configs', () => {
  it('keeps China build on phone login and China endpoints', () => {
    expect(cnMarketConfig.market).toBe('cn');
    expect(cnMarketConfig.loginProviders).toEqual(['phone']);
    expect(cnMarketConfig.apiBaseUrl).toBe('https://api.vividrop.cn');
    expect(cnMarketConfig.reviewApiBaseUrl).toBe(
      'https://review-api.vividrop.cn',
    );
    expect(cnMarketConfig.privacyUrl).toBe('https://www.vividrop.cn/privacy');
    expect(cnMarketConfig.termsUrl).toBe('https://www.vividrop.cn/terms');
    expect(cnMarketConfig.downloadUrl).toBe('https://www.vividrop.cn');
    expect(cnMarketConfig.supportEmail).toBe('support@vividrop.cn');
  });

  it('keeps global build on Apple and Google login with global production endpoints', () => {
    expect(globalMarketConfig.market).toBe('global');
    expect(globalMarketConfig.loginProviders).toEqual(['apple', 'google']);
    expect(globalMarketConfig.apiBaseUrl).toBe(
      'https://global-api.vividrop.cn',
    );
    expect(globalMarketConfig.reviewApiBaseUrl).toBe(
      'https://review-api.vividrop.cn',
    );
    expect(globalMarketConfig.privacyUrl).toBe(
      'https://www.vividrop.cn/privacy',
    );
    expect(globalMarketConfig.termsUrl).toBe('https://www.vividrop.cn/terms');
    expect(globalMarketConfig.downloadUrl).toBe('https://www.vividrop.cn');
    expect(globalMarketConfig.supportEmail).toBe('support@vividrop.cn');
  });

  it('uses Android NativeMarketConfig before the source release fallback', () => {
    const marketModule = importMarketModuleWithNativeModules({
      NativeMarketConfig: { SYNCFLOW_MARKET: 'global' },
    });

    expect(marketModule.activeMarket).toBe('global');
    expect(marketModule.isGlobalMarket()).toBe(true);
    expect(marketModule.marketConfig.loginProviders).toEqual([
      'apple',
      'google',
    ]);
  });

  it('keeps iOS AppleAuthModule market fallback for existing builds', () => {
    const marketModule = importMarketModuleWithNativeModules({
      AppleAuthModule: { SYNCFLOW_MARKET: 'global' },
    });

    expect(marketModule.activeMarket).toBe('global');
    expect(marketModule.isGlobalMarket()).toBe(true);
  });

  it('reads iOS AppleAuthModule getConstants market fallback', () => {
    const marketModule = importMarketModuleWithNativeModules({
      AppleAuthModule: {
        getConstants: () => ({ SYNCFLOW_MARKET: 'global' }),
      },
    });

    expect(marketModule.activeMarket).toBe('global');
    expect(marketModule.isGlobalMarket()).toBe(true);
  });
});
