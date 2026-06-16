import { Platform } from 'react-native';
import { apiGet, apiPost } from './api';
import type { SubscriptionInfo } from '../stores/auth-store';
import { recordDiagnosticsLog } from './diagnostics-log-service';

// ---------------------------------------------------------------------------
// Subscription API calls
// ---------------------------------------------------------------------------

interface SubscriptionStatusResponse {
  status: string;
  plan: string;
  expire_at: string | null;
  trial_end: string | null;
  /** Server emits this only when status === 'subscribed'; other states
   *  leave it absent/null (omitempty on the Go side). Client normalises
   *  to strict `boolean | null`. */
  auto_renewing?: boolean | null;
  source?: string | null;
  payment_provider?: string | null;
  renewal_state?: string | null;
  entitlement_expire_at?: string | null;
  entitlement_source?: string | null;
}

export async function getSubscriptionStatus(): Promise<SubscriptionInfo> {
  try {
    const data = await apiGet<SubscriptionStatusResponse>(
      '/subscription/status',
    );
    recordDiagnosticsLog('SubscriptionAPI', 'status loaded', {
      status: data.status,
      plan: data.plan || '',
      hasExpireAt: data.expire_at != null,
      hasTrialEnd: data.trial_end != null,
      autoRenewing:
        typeof data.auto_renewing === 'boolean'
          ? data.auto_renewing
          : undefined,
      source: data.source ?? undefined,
    });
    return {
      status: data.status as SubscriptionInfo['status'],
      plan: (data.plan || '') as SubscriptionInfo['plan'],
      expireAt: data.expire_at,
      trialEnd: data.trial_end,
      source: typeof data.source === 'string' ? data.source : null,
      autoRenewing:
        typeof data.auto_renewing === 'boolean' ? data.auto_renewing : null,
      paymentProvider:
        data.payment_provider === 'apple' ||
        data.payment_provider === 'google_play' ||
        data.payment_provider === 'mainland' ||
        data.payment_provider === 'gift_card'
          ? data.payment_provider
          : null,
      renewalState:
        data.renewal_state === 'auto_renewing' ||
        data.renewal_state === 'cancelled' ||
        data.renewal_state === 'prepaid'
          ? data.renewal_state
          : null,
      entitlementExpireAt: data.entitlement_expire_at ?? null,
      entitlementSource:
        typeof data.entitlement_source === 'string'
          ? data.entitlement_source
          : null,
    };
  } catch (error) {
    recordDiagnosticsLog('SubscriptionAPI', 'status failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function verifyIapReceipt(
  receiptData: string,
  plan: string,
  productId: string,
  transactionId = '',
): Promise<void> {
  recordDiagnosticsLog('SubscriptionAPI', 'verify request', {
    plan,
    hasReceipt: receiptData.length > 0,
    hasTransactionId: transactionId.length > 0,
    productId,
  });
  try {
    await apiPost<Record<string, never>>('/subscription/verify', {
      receipt_data: receiptData,
      plan,
      transaction_id: transactionId || undefined,
      product_id: productId,
      platform: Platform.OS === 'android' ? 'android' : 'ios',
    });
    recordDiagnosticsLog('SubscriptionAPI', 'verify success', { plan });
  } catch (error) {
    recordDiagnosticsLog('SubscriptionAPI', 'verify failed', {
      plan,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
