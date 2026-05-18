import type {
  AccountStatus,
  SubscriptionInfo,
  SubscriptionPlan,
  UserProfile,
} from '../stores/auth-store';

export type SubscriptionDisplayKind =
  | 'account_trial'
  | 'subscription_intro_trial'
  | 'subscribed'
  | 'gift_card_subscribed'
  | 'gift_card_entitlement_queued'
  /** status=subscribed + autoRenewing=false: user cancelled in iOS
   *  Settings, access continues until expireAt. UI should surface
   *  "Cancelled, valid until X" copy instead of plain "Subscribed". */
  | 'subscribed_cancelled'
  | 'trial_expired'
  | 'sub_expired'
  | 'unknown';

export interface SubscriptionDisplayState {
  kind: SubscriptionDisplayKind;
  daysRemaining: number;
  entitlementExpireAt?: string | null;
}

type EntitlementSnapshot = Pick<UserProfile, 'status' | 'plan' | 'trialEnd'>;
type SubscriptionSnapshot = Pick<
  SubscriptionInfo,
  'status' | 'plan' | 'trialEnd'
> &
  Partial<
    Pick<
      SubscriptionInfo,
      | 'expireAt'
      | 'autoRenewing'
      | 'source'
      | 'paymentProvider'
      | 'renewalState'
      | 'entitlementExpireAt'
      | 'entitlementSource'
    >
  >;

function getRemainingDays(trialEnd: string | null | undefined): number {
  if (!trialEnd) return 0;
  const end = new Date(trialEnd).getTime();
  const diff = end - Date.now();
  if (Number.isNaN(end) || diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function isFutureDate(value: string | null | undefined): boolean {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

export function hasGiftCardEntitlement(
  subscription?: Pick<
    SubscriptionInfo,
    'status' | 'source' | 'entitlementSource' | 'entitlementExpireAt'
  > | null,
): boolean {
  if (!subscription || subscription.status !== 'subscribed') return false;
  if (subscription.source === 'gift_card') return true;
  return (
    subscription.entitlementSource === 'gift_card' &&
    isFutureDate(subscription.entitlementExpireAt)
  );
}

function classifySnapshot(snapshot: {
  status: AccountStatus;
  plan: SubscriptionPlan;
  trialEnd: string | null;
  expireAt?: string | null;
  autoRenewing?: boolean | null;
  source?: string | null;
  paymentProvider?: SubscriptionInfo['paymentProvider'];
  renewalState?: SubscriptionInfo['renewalState'];
  entitlementExpireAt?: string | null;
  entitlementSource?: string | null;
}): SubscriptionDisplayState | null {
  switch (snapshot.status) {
    case 'trialing':
      if (snapshot.plan === 'monthly') {
        return {
          kind: 'subscription_intro_trial',
          daysRemaining: getRemainingDays(snapshot.trialEnd),
        };
      }
      return {
        kind: 'account_trial',
        daysRemaining: getRemainingDays(snapshot.trialEnd),
      };
    case 'subscribed':
      if (snapshot.source === 'gift_card') {
        return { kind: 'gift_card_subscribed', daysRemaining: 0 };
      }
      if (
        snapshot.entitlementSource === 'gift_card' &&
        isFutureDate(snapshot.entitlementExpireAt)
      ) {
        return {
          kind: 'gift_card_entitlement_queued',
          daysRemaining: 0,
          entitlementExpireAt: snapshot.entitlementExpireAt,
        };
      }
      // Only the subscription snapshot carries autoRenewing; user
      // entitlement snapshots don't, so legacy code paths that only
      // pass user still hit the plain "subscribed" branch.
      if (
        snapshot.renewalState === 'cancelled' ||
        (snapshot.autoRenewing === false &&
          snapshot.paymentProvider !== 'mainland' &&
          snapshot.renewalState !== 'prepaid')
      ) {
        return { kind: 'subscribed_cancelled', daysRemaining: 0 };
      }
      return { kind: 'subscribed', daysRemaining: 0 };
    case 'trial_expired':
      return {
        kind: snapshot.plan === 'monthly' ? 'sub_expired' : 'trial_expired',
        daysRemaining: 0,
      };
    case 'sub_expired':
      return { kind: 'sub_expired', daysRemaining: 0 };
    default:
      return null;
  }
}

export function resolveSubscriptionDisplayState(input: {
  subscription?: SubscriptionSnapshot | null;
  user?: EntitlementSnapshot | null;
}): SubscriptionDisplayState {
  const subscription = input.subscription;
  if (subscription?.status) {
    return (
      classifySnapshot({
        status: subscription.status,
        plan: subscription.plan,
        trialEnd: subscription.trialEnd,
        expireAt: subscription.expireAt,
        autoRenewing: subscription.autoRenewing,
        source: subscription.source,
        paymentProvider: subscription.paymentProvider,
        renewalState: subscription.renewalState,
        entitlementExpireAt: subscription.entitlementExpireAt,
        entitlementSource: subscription.entitlementSource,
      }) ?? { kind: 'unknown', daysRemaining: 0 }
    );
  }

  const user = input.user;
  if (user?.status) {
    return (
      classifySnapshot({
        status: user.status,
        plan: user.plan,
        trialEnd: user.trialEnd,
      }) ?? { kind: 'unknown', daysRemaining: 0 }
    );
  }

  return { kind: 'unknown', daysRemaining: 0 };
}
