import {
  hasGiftCardEntitlement,
  resolveSubscriptionDisplayState,
} from '../subscriptionStatusDisplay';

describe('resolveSubscriptionDisplayState', () => {
  const realNow = Date.now;

  beforeEach(() => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-04-18T00:00:00.000Z').getTime());
  });

  afterEach(() => {
    Date.now = realNow;
    jest.restoreAllMocks();
  });

  test('treats registered 7-day user trial as account_trial', () => {
    expect(
      resolveSubscriptionDisplayState({
        user: {
          status: 'trialing',
          plan: '',
          trialEnd: '2026-04-25T00:00:00.000Z',
        },
      }),
    ).toEqual({
      kind: 'account_trial',
      daysRemaining: 7,
    });
  });

  test('treats monthly intro period after subscribing as subscription_intro_trial', () => {
    expect(
      resolveSubscriptionDisplayState({
        subscription: {
          status: 'trialing',
          plan: 'monthly',
          trialEnd: '2026-04-25T00:00:00.000Z',
        },
        user: {
          status: 'trial_expired',
          plan: '',
          trialEnd: '2026-04-17T00:00:00.000Z',
        },
      }),
    ).toEqual({
      kind: 'subscription_intro_trial',
      daysRemaining: 7,
    });
  });

  test('prefers subscription snapshot over stale user status', () => {
    expect(
      resolveSubscriptionDisplayState({
        subscription: {
          status: 'subscribed',
          plan: 'yearly',
          trialEnd: null,
        },
        user: {
          status: 'trial_expired',
          plan: '',
          trialEnd: '2026-04-17T00:00:00.000Z',
        },
      }),
    ).toEqual({
      kind: 'subscribed',
      daysRemaining: 0,
    });
  });

  test('subscribed + autoRenewing false → subscribed_cancelled', () => {
    // User tapped Cancel in iOS Settings. Server flipped auto_renewing
    // to false; subscription row stays active until expireAt. UI needs
    // to render "Cancelled, valid until X" instead of plain Subscribed.
    expect(
      resolveSubscriptionDisplayState({
        subscription: {
          status: 'subscribed',
          plan: 'monthly',
          trialEnd: null,
          autoRenewing: false,
        },
      }),
    ).toEqual({ kind: 'subscribed_cancelled', daysRemaining: 0 });
  });

  test('subscribed + gift_card source takes precedence over autoRenewing false', () => {
    expect(
      resolveSubscriptionDisplayState({
        subscription: {
          status: 'subscribed',
          plan: 'monthly',
          trialEnd: null,
          autoRenewing: false,
          source: 'gift_card',
        },
      }),
    ).toEqual({ kind: 'gift_card_subscribed', daysRemaining: 0 });
  });

  test('subscribed + future gift card entitlement surfaces queued gift card state', () => {
    const subscription = {
      status: 'subscribed' as const,
      plan: 'monthly' as const,
      expireAt: '2026-05-18T00:00:00.000Z',
      trialEnd: null,
      autoRenewing: true,
      source: 'apple_iap',
      paymentProvider: 'apple' as const,
      renewalState: 'auto_renewing' as const,
      entitlementExpireAt: '2026-06-17T00:00:00.000Z',
      entitlementSource: 'gift_card',
    };

    expect(
      resolveSubscriptionDisplayState({
        subscription,
      }),
    ).toEqual({
      kind: 'gift_card_entitlement_queued',
      daysRemaining: 0,
      entitlementExpireAt: '2026-06-17T00:00:00.000Z',
    });
  });

  test('hasGiftCardEntitlement ignores expired gift card subscriptions', () => {
    expect(
      hasGiftCardEntitlement({
        status: 'sub_expired',
        source: 'gift_card',
        entitlementSource: null,
        entitlementExpireAt: null,
      }),
    ).toBe(false);
  });

  test('hasGiftCardEntitlement detects active and queued gift card access', () => {
    expect(
      hasGiftCardEntitlement({
        status: 'subscribed',
        source: 'gift_card',
        entitlementSource: null,
        entitlementExpireAt: null,
      }),
    ).toBe(true);

    expect(
      hasGiftCardEntitlement({
        status: 'subscribed',
        source: 'apple_iap',
        entitlementSource: 'gift_card',
        entitlementExpireAt: '2026-06-17T00:00:00.000Z',
      }),
    ).toBe(true);
  });

  test('mainland prepaid subscription does not render as subscribed_cancelled', () => {
    expect(
      resolveSubscriptionDisplayState({
        subscription: {
          status: 'subscribed',
          plan: 'monthly',
          trialEnd: null,
          autoRenewing: false,
          paymentProvider: 'mainland',
          renewalState: 'prepaid',
        },
      }),
    ).toEqual({ kind: 'subscribed', daysRemaining: 0 });
  });

  test('subscribed + autoRenewing true → plain subscribed', () => {
    expect(
      resolveSubscriptionDisplayState({
        subscription: {
          status: 'subscribed',
          plan: 'monthly',
          trialEnd: null,
          autoRenewing: true,
        },
      }),
    ).toEqual({ kind: 'subscribed', daysRemaining: 0 });
  });

  test('subscribed + autoRenewing undefined (legacy fixture) → plain subscribed', () => {
    // Backwards-compat: pre-deploy server payloads or old test fixtures
    // without the field must not fall into the cancelled branch.
    expect(
      resolveSubscriptionDisplayState({
        subscription: {
          status: 'subscribed',
          plan: 'monthly',
          trialEnd: null,
        },
      }),
    ).toEqual({ kind: 'subscribed', daysRemaining: 0 });
  });
});
