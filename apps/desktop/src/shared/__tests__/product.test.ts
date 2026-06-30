import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  APP_STORAGE_IDENTITY_NAME,
  PRODUCT_DISTRIBUTION,
  PRODUCT_NAME,
  getProductName,
  getProductReleaseChannel,
  isLynavoGlobalProduct,
  resolveLynavoApiBaseUrl,
  shouldUseLynavoReviewTarget,
} from '../product';

describe('desktop product helper', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses Lynavo Drive as the visible product name', () => {
    expect(PRODUCT_NAME).toBe('Lynavo Drive');
    expect(getProductName()).toBe('Lynavo Drive');
  });

  it('uses Lynavo Drive as the Electron storage identity', () => {
    expect(APP_STORAGE_IDENTITY_NAME).toBe('Lynavo Drive');
    expect(APP_STORAGE_IDENTITY_NAME).toBe(getProductName());
  });

  it('does not let unrelated market env affect product identity', () => {
    vi.stubEnv('OTHER_PRODUCT_MARKET', 'cn');

    expect(getProductName()).toBe('Lynavo Drive');
    expect(isLynavoGlobalProduct()).toBe(true);
  });

  it('resolves release channel from Lynavo env only', () => {
    vi.stubEnv('OTHER_PRODUCT_MARKET', 'global');
    vi.stubEnv('LYNAVO_RELEASE_CHANNEL', 'review');

    expect(getProductReleaseChannel()).toBe('review');
    expect(PRODUCT_DISTRIBUTION).toBe('community');
  });

  it('resolves the plain API base from Lynavo env or the Lynavo default only', () => {
    expect(
      resolveLynavoApiBaseUrl({
        LYNAVO_API_BASE_URL: 'https://api.lynavo.example',
        OTHER_PRODUCT_API_BASE_URL: 'https://api.other-product.example',
      }),
    ).toBe('https://api.lynavo.example');

    expect(
      resolveLynavoApiBaseUrl({
        OTHER_PRODUCT_API_BASE_URL: 'https://api.other-product.example',
      }),
    ).toBe('https://api.lynavo.com');

    expect(
      resolveLynavoApiBaseUrl({
        OTHER_PRODUCT_API_BASE_URL: 'https://api.other-product.example',
      }),
    ).toBe('https://api.lynavo.com');
  });

  it('uses only Lynavo release channel or plain Lynavo API URL for review target selection', () => {
    expect(shouldUseLynavoReviewTarget({ LYNAVO_RELEASE_CHANNEL: 'review' })).toBe(true);
    expect(
      shouldUseLynavoReviewTarget({ LYNAVO_API_BASE_URL: 'https://review-api.lynavo.com' }),
    ).toBe(true);

    expect(
      shouldUseLynavoReviewTarget({
        OTHER_RELEASE_PROFILE: 'review',
        OTHER_PRODUCT_API_BASE_URL: 'https://review-api.other-product.example',
        OTHER_AUTH_BASE_URL: 'https://review-api.other-product.example',
      }),
    ).toBe(false);
  });
});
