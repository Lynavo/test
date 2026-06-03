import { afterEach, describe, expect, it, vi } from 'vitest';

import { getProductName } from '../market';

describe('desktop market branding', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses Vivi Drop as the product name for the global market', () => {
    vi.stubEnv('SYNCFLOW_MARKET', 'global');

    expect(getProductName()).toBe('Vivi Drop');
  });

  it('uses Vivi Drop as the product name for the cn market', () => {
    vi.stubEnv('SYNCFLOW_MARKET', 'cn');

    expect(getProductName()).toBe('Vivi Drop');
  });
});
