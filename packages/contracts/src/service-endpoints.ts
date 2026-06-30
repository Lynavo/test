export const LYNAVO_ROOT_DOMAIN = 'lynavo.com';
export const LYNAVO_WEB_BASE_URL = `https://www.${LYNAVO_ROOT_DOMAIN}`;
export const LYNAVO_API_BASE_URL = `https://api.${LYNAVO_ROOT_DOMAIN}`;
export const LYNAVO_REVIEW_API_BASE_URL = `https://review-api.${LYNAVO_ROOT_DOMAIN}`;
export const LYNAVO_SUPPORT_EMAIL = `support@${LYNAVO_ROOT_DOMAIN}`;
export const LYNAVO_REVIEW_EMAIL = `review@${LYNAVO_ROOT_DOMAIN}`;
export const LYNAVO_APPLE_REDIRECT_URI = `${LYNAVO_API_BASE_URL}/auth/apple/callback`;

export const LYNAVO_SERVICE_ENDPOINTS = Object.freeze({
  webBaseUrl: LYNAVO_WEB_BASE_URL,
  apiBaseUrl: LYNAVO_API_BASE_URL,
  reviewApiBaseUrl: LYNAVO_REVIEW_API_BASE_URL,
  supportEmail: LYNAVO_SUPPORT_EMAIL,
  reviewEmail: LYNAVO_REVIEW_EMAIL,
  appleRedirectUri: LYNAVO_APPLE_REDIRECT_URI,
});
