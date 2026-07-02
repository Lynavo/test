const ossKey = (parts) => parts.join('');
const legacySyncEnv = (suffix) => ossKey(['SYN', 'CFLOW', suffix]);
const legacyViviEnv = (suffix) => ossKey(['VIVI', 'DROP', suffix]);

const STALE_OSS_RUNTIME_ENV_KEYS = Object.freeze([
  legacySyncEnv('_RELEASE_PROFILE'),
  legacySyncEnv('_MARKET'),
  legacySyncEnv('_API_BASE_URL'),
  legacyViviEnv('_API_BASE_URL'),
  'LYNAVO_API_BASE_URL',
  'LYNAVO_SUPPORT_API_BASE_URL',
  ossKey(['LYNAVO_DESKTOP', '_UPDATE_URL']),
  ossKey(['LYNAVO_DIAGNOSTICS', '_UPLOAD_URL']),
  'LYNAVO_DIAGNOSTICS_TOKEN',
  'LYNAVO_API_TOKEN',
  'LYNAVO_CLIENT_CONFIG_BASE_URL',
  'LYNAVO_GIFTCARD_REDEEM_BASE_URL',
  'LYNAVO_AUTH_BASE_URL',
  legacySyncEnv('_CLIENT_CONFIG_BASE_URL'),
  legacySyncEnv('_GIFTCARD_REDEEM_BASE_URL'),
  legacySyncEnv('_AUTH_BASE_URL'),
  legacySyncEnv('_ANDROID_APP_ID'),
  legacySyncEnv('_ANDROID_INSTALL_TASK'),
  legacySyncEnv('_GOOGLE_CLIENT_CONFIG_FILE'),
  'GOOGLE_CLIENT_CONFIG_FILE',
  'GOOGLE_CLIENT_SECRET_FILE',
  legacySyncEnv('_GOOGLE_CLIENT_CONFIG_DIR'),
  'GOOGLE_CLIENT_CONFIG_DIR',
  legacySyncEnv('_GOOGLE_CLIENT_ID'),
  'GOOGLE_CLIENT_ID',
  legacySyncEnv('_GOOGLE_CLIENT_SECRET'),
  'GOOGLE_CLIENT_SECRET',
  legacySyncEnv('_APPLE_SIGN_CONFIG_FILE'),
  'APPLE_SIGN_CONFIG_FILE',
  legacySyncEnv('_APPLE_SIGN_CONFIG_DIR'),
  'APPLE_SIGN_CONFIG_DIR',
  legacySyncEnv('_APPLE_CLIENT_ID'),
  'APPLE_OAUTH_CLIENT_ID',
  'APPLE_CLIENT_ID',
  legacySyncEnv('_APPLE_REDIRECT_URI'),
  'APPLE_REDIRECT_URI',
  'APPLE_API_KEY',
  'APPLE_API_KEY_ID',
  'APPLE_API_ISSUER',
  'APPLE_APP_SPECIFIC_PASSWORD',
  'APPLE_ID',
  'APPLE_TEAM_ID',
  'ASC_KEY_ID',
  'ASC_ISSUER_ID',
  'CSC_KEY_PASSWORD',
  'CSC_LINK',
  'CSC_NAME',
  'CSC_IDENTITY_AUTO_DISCOVERY',
  'WIN_CSC_KEY_PASSWORD',
  'WIN_CSC_LINK',
  'WIN_CSC_NAME',
]);

function scrubOssRuntimeEnv(env) {
  for (const key of STALE_OSS_RUNTIME_ENV_KEYS) {
    delete env[key];
  }
  return env;
}

function buildOssChildEnv(parentEnv, profileEnv = {}) {
  const env = scrubOssRuntimeEnv({ ...parentEnv });
  return {
    ...env,
    ...profileEnv,
  };
}

module.exports = {
  STALE_OSS_RUNTIME_ENV_KEYS,
  buildOssChildEnv,
  scrubOssRuntimeEnv,
};
