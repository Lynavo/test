import { apiGet, apiPost, apiPostNoAuth } from './api';
import type { UserProfile } from '../stores/auth-store';

// ---------------------------------------------------------------------------
// Module-level reference to auth store actions.
// Set once by AuthProvider on mount so we can update tokens / clear auth
// from the API layer without importing React context directly.
// ---------------------------------------------------------------------------

let _storeSetTokens: ((access: string, refresh: string) => void) | null = null;
let _storeClearAuth: (() => void) | null = null;

/**
 * Called by AuthProvider to wire up store actions that the API layer can invoke
 * during token refresh or forced logout.
 */
export function registerAuthStoreActions(
  setTokens: (access: string, refresh: string) => void,
  clearAuth: () => void,
) {
  _storeSetTokens = setTokens;
  _storeClearAuth = clearAuth;
}

/** @internal — used by api.ts during token refresh */
export function _setTokensFromApi(accessToken: string, refreshToken: string) {
  _storeSetTokens?.(accessToken, refreshToken);
}

/** @internal — used by api.ts when refresh fails */
export function _clearAuthFromApi() {
  _storeClearAuth?.();
}

// ---------------------------------------------------------------------------
// Auth API calls
// ---------------------------------------------------------------------------

export async function sendSmsCode(phone: string): Promise<void> {
  await apiPostNoAuth<Record<string, never>>('/auth/sms/send', { phone });
}

interface SmsLoginResponse {
  access_token: string;
  refresh_token: string;
  is_new_user: boolean;
}

export async function smsLogin(
  phone: string,
  code: string,
): Promise<{ accessToken: string; refreshToken: string; isNewUser: boolean }> {
  const data = await apiPostNoAuth<SmsLoginResponse>('/auth/sms/login', {
    phone,
    code,
  });
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    isNewUser: data.is_new_user,
  };
}

interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const data = await apiPostNoAuth<RefreshResponse>('/auth/refresh', {
    refresh_token: refreshToken,
  });
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

export async function logout(refreshToken: string): Promise<void> {
  // skipRefresh: a 401 here must NOT trigger silent token rotation, otherwise
  // the freshly-minted refresh token outlives the logout server-side.
  // timeoutMs: logout is best-effort; cap it short so we never block UI long
  // enough for the caller's "fire-and-forget" pattern to feel like a hang.
  await apiPost<Record<string, never>>(
    '/auth/logout',
    { refresh_token: refreshToken },
    { skipRefresh: true, timeoutMs: 5_000 },
  );
}

// ---------------------------------------------------------------------------
// User profile
// ---------------------------------------------------------------------------

interface UserProfileResponse {
  id: number;
  phone: string;
  status: string;
  plan: string;
  expire_at: string | null;
  trial_end: string | null;
}

export async function getUserProfile(): Promise<UserProfile> {
  const data = await apiGet<UserProfileResponse>('/user/profile');
  return {
    id: data.id,
    phone: data.phone,
    status: data.status as UserProfile['status'],
    plan: (data.plan || '') as UserProfile['plan'],
    expireAt: data.expire_at,
    trialEnd: data.trial_end,
  };
}
