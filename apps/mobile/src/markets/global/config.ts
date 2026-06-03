import type { MobileMarketConfig } from '../types';

export const globalMarketConfig: MobileMarketConfig = {
  market: 'global',
  appName: 'Vivi Drop',
  bundleId: 'com.vividrop.mobile.global',
  apiBaseUrl: 'https://global-api.vividrop.cn',
  reviewApiBaseUrl: 'https://review-api.vividrop.cn',
  appReviewPhone: '17000000002',
  privacyUrl: 'https://www.vividrop.cn/privacy',
  termsUrl: 'https://www.vividrop.cn/terms',
  loginProviders: ['apple', 'google'],
  theme: {
    primary: '#3f5fdb',
    primaryForeground: '#ffffff',
    background: '#f7f8fb',
    foreground: '#172033',
    accent: '#18a999',
  },
  downloadUrl: 'https://www.vividrop.com',
  supportEmail: 'support@vividrop.com',
};
