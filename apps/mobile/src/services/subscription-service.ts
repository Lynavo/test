import { apiGet, apiPost } from './api';
import type { SubscriptionInfo } from '../stores/auth-store';

// ---------------------------------------------------------------------------
// Subscription API calls
// ---------------------------------------------------------------------------

interface SubscriptionStatusResponse {
  status: string;
  plan: string;
  expire_at: string | null;
  trial_end: string | null;
}

export async function getSubscriptionStatus(): Promise<SubscriptionInfo> {
  const data = await apiGet<SubscriptionStatusResponse>('/subscription/status');
  return {
    status: data.status as SubscriptionInfo['status'],
    plan: (data.plan || '') as SubscriptionInfo['plan'],
    expireAt: data.expire_at,
    trialEnd: data.trial_end,
  };
}

export async function verifyIapReceipt(
  receiptData: string,
  plan: string,
): Promise<void> {
  await apiPost<Record<string, never>>('/subscription/verify', {
    receipt_data: receiptData,
    plan,
  });
}
