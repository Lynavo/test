import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  APP_STORAGE_IDENTITY_NAME,
  PRODUCT_DISTRIBUTION,
  PRODUCT_NAME,
  getProductName,
  getProductReleaseChannel,
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

  it('resolves release channel from Lynavo env only', () => {
    vi.stubEnv('OTHER_RELEASE_PROFILE', 'external');
    vi.stubEnv('LYNAVO_RELEASE_CHANNEL', 'review');

    expect(getProductReleaseChannel()).toBe('review');
    expect(PRODUCT_DISTRIBUTION).toBe('community');
  });

  it('does not expose product-level API target helpers in the OSS shell', async () => {
    const product = await import('../product');

    expect('resolveLynavoApiBaseUrl' in product).toBe(false);
    expect('shouldUseLynavoReviewTarget' in product).toBe(false);
  });
});
