import { getSubscriptionStatus } from '../subscription-service';
import { apiGet } from '../api';

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
});
