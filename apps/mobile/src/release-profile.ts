export const mobileReleaseProfile = {
  name: 'source-default',
  market: 'source',
  review: false,
  apiBaseUrl: '',
} as const;

export const releaseApiBaseUrl = mobileReleaseProfile.apiBaseUrl.trim() || null;
