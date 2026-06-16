import { Platform } from 'react-native';
import {
  getSubscriptionStatus,
  verifyIapReceipt,
} from '../subscription-service';
import { apiGet, apiPost } from '../api';

jest.mock('../api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}));

jest.mock('../diagnostics-log-service', () => ({
  recordDiagnosticsLog: jest.fn(),
}));

describe('getSubscriptionStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('maps server source into SubscriptionInfo', async () => {
    (apiGet as jest.Mock).mockResolvedValueOnce({
      status: 'subscribed',
      plan: 'monthly',
      expire_at: '2026-06-11T00:00:00.000Z',
      trial_end: null,
      auto_renewing: false,
      source: 'gift_card',
      payment_provider: 'gift_card',
    });

    await expect(getSubscriptionStatus()).resolves.toMatchObject({
      status: 'subscribed',
      plan: 'monthly',
      expireAt: '2026-06-11T00:00:00.000Z',
      trialEnd: null,
      autoRenewing: false,
      source: 'gift_card',
      paymentProvider: 'gift_card',
    });
  });

  test('maps Google Play payment provider into SubscriptionInfo', async () => {
    (apiGet as jest.Mock).mockResolvedValueOnce({
      status: 'subscribed',
      plan: 'monthly',
      expire_at: '2026-06-11T00:00:00.000Z',
      trial_end: null,
      auto_renewing: true,
      source: 'google_play',
      payment_provider: 'google_play',
    });

    await expect(getSubscriptionStatus()).resolves.toMatchObject({
      status: 'subscribed',
      plan: 'monthly',
      source: 'google_play',
      paymentProvider: 'google_play',
    });
  });
});

describe('verifyIapReceipt', () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatformOS,
    });
  });

  test('sends android platform for Google Play receipt verification', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    (apiPost as jest.Mock).mockResolvedValueOnce({});

    await verifyIapReceipt(
      'purchase-token',
      'monthly',
      'com.vividrop.mobile.global.monthly.999',
      'order-1',
    );

    expect(apiPost).toHaveBeenCalledWith('/subscription/verify', {
      receipt_data: 'purchase-token',
      plan: 'monthly',
      transaction_id: 'order-1',
      product_id: 'com.vividrop.mobile.global.monthly.999',
      platform: 'android',
    });
  });
});
