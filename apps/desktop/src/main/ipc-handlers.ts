import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';
import { sidecarClient, supportsPairingRevocationOnCodeRotation, syncCredentialsToSidecar } from './sidecar-client';
import {
  openFolder,
  openFile,
  openExternal,
  selectFolder,
  copyToClipboard,
} from './file-operations';
import type { SidecarManager } from './sidecar-manager';
import {
  checkForUpdates,
  exportDiagnostics,
  getAppInfo,
  uploadDiagnostics,
  type DiagnosticsUploadRequest,
} from './diagnostics';
import { installBonjourForWindows } from './bonjour-installer';

// Channel constants — shared between main and preload
export const IPC = {
  SIDECAR_HEALTH: 'sidecar:health',
  SIDECAR_DASHBOARD_SUMMARY: 'sidecar:dashboard-summary',
  SIDECAR_DASHBOARD_DEVICES: 'sidecar:dashboard-devices',
  SIDECAR_DEVICE_FILES: 'sidecar:device-files',
  SIDECAR_DEVICE_DATES: 'sidecar:device-dates',
  SIDECAR_SETTINGS: 'sidecar:settings',
  SIDECAR_UPDATE_SETTINGS: 'sidecar:update-settings',
  SIDECAR_RESET_STATE: 'sidecar:reset-state',
  SIDECAR_CLIENT_CONFIG: 'sidecar:client-config',
  SIDECAR_REDEEM_GIFT_CARD: 'sidecar:redeem-gift-card',
  AUTH_SEND_SMS_CODE: 'auth:send-sms-code',
  AUTH_LOGIN_WITH_SMS_CODE: 'auth:login-with-sms-code',
  AUTH_GET_SESSION: 'auth:get-session',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_LOGIN_WITH_OAUTH: 'auth:login-with-oauth',
  SIDECAR_REGENERATE_CODE: 'sidecar:regenerate-code',
  SIDECAR_RUNTIME_STATE: 'sidecar:runtime-state',
  SIDECAR_RETRY_START: 'sidecar:retry-start',
  SIDECAR_INSTALL_BONJOUR: 'sidecar:install-bonjour',
  SIDECAR_SHARE_STATUS: 'sidecar:share-status',
  SIDECAR_VALIDATE_SHARE: 'sidecar:validate-share',
  SIDECAR_TRANSFER_ACTIVE: 'sidecar:transfer-active',
  SIDECAR_SHARED_LIST: 'sidecar:shared-list',
  SUPPORT_UPLOAD_DIAGNOSTICS: 'support:upload-diagnostics',
  SUPPORT_EXPORT_DIAGNOSTICS: 'support:export-diagnostics',
  SUPPORT_CHECK_FOR_UPDATES: 'support:check-for-updates',
  SUPPORT_APP_INFO: 'support:app-info',
  FILES_OPEN_FOLDER: 'files:open-folder',
  FILES_OPEN_FILE: 'files:open-file',
  FILES_OPEN_EXTERNAL: 'files:open-external',
  FILES_SELECT_FOLDER: 'files:select-folder',
  FILES_COPY_CLIPBOARD: 'files:copy-clipboard',
} as const;

async function regenerateConnectionCodeSafely(
  sidecarManager: SidecarManager,
): Promise<{ code: string }> {
  let health = null;
  try {
    health = await sidecarClient.getHealth();
  } catch {
    // Regeneration is a foreground user action; recover the sidecar here so
    // the UI cannot report a fresh code from a stale or missing service.
  }
  if (!supportsPairingRevocationOnCodeRotation(health)) {
    await sidecarManager.retryStart();
  }
  return sidecarClient.regenerateConnectionCode();
}

export function registerIpcHandlers(sidecarManager: SidecarManager): void {
  // Sidecar — real HTTP calls
  ipcMain.handle(IPC.SIDECAR_HEALTH, () => sidecarClient.getHealth());
  ipcMain.handle(IPC.SIDECAR_DASHBOARD_SUMMARY, () => sidecarClient.getDashboardSummary());
  ipcMain.handle(IPC.SIDECAR_DASHBOARD_DEVICES, () => sidecarClient.getDashboardDevices());
  ipcMain.handle(
    IPC.SIDECAR_DEVICE_FILES,
    (
      _e,
      deviceId: string,
      date: string,
      options?: {
        page?: number;
        pageSize?: number;
        sortField?: import('@syncflow/contracts').DeviceFileSortField;
        sortDirection?: import('@syncflow/contracts').SortDirection;
      },
    ) => sidecarClient.getDeviceFiles(deviceId, date, options),
  );
  ipcMain.handle(IPC.SIDECAR_DEVICE_DATES, (_e, deviceId: string) =>
    sidecarClient.getDeviceDates(deviceId),
  );
  ipcMain.handle(IPC.SIDECAR_SETTINGS, () => sidecarClient.getSettings());
  ipcMain.handle(IPC.SIDECAR_UPDATE_SETTINGS, (_e, partial) =>
    sidecarClient.updateSettings(partial),
  );
  ipcMain.handle(IPC.SIDECAR_RESET_STATE, () => sidecarClient.resetState());
  ipcMain.handle(IPC.SIDECAR_CLIENT_CONFIG, () => sidecarClient.getClientConfig());
  ipcMain.handle(IPC.SIDECAR_REDEEM_GIFT_CARD, (_e, payload: { code: string }) =>
    sidecarClient.redeemGiftCard(payload),
  );
  ipcMain.handle(IPC.AUTH_SEND_SMS_CODE, (_e, payload: { phone: string }) =>
    sidecarClient.sendSMSCode(payload),
  );
  ipcMain.handle(IPC.AUTH_LOGIN_WITH_SMS_CODE, async (_e, payload: { phone: string; code: string }) => {
    const res = await sidecarClient.loginWithSMSCode(payload);
    if (res.ok) {
      syncCredentialsToSidecar()
        .then((success) => {
          if (success) {
            sidecarManager.startCredentialsSyncInterval();
          }
        })
        .catch((err) => {
          log.error('Failed to sync credentials after login:', err);
        });
    }
    return res;
  });
  ipcMain.handle(IPC.AUTH_GET_SESSION, () => sidecarClient.getAuthSession());
  ipcMain.handle(IPC.AUTH_LOGOUT, () => sidecarClient.logout());
  ipcMain.handle(IPC.AUTH_LOGIN_WITH_OAUTH, async (_e, payload: { provider: 'google' | 'apple' }) => {
    return new Promise(async (resolve) => {
      let resolved = false;
      const safeResolve = (val: any) => {
        if (!resolved) {
          resolved = true;
          resolve(val);
        }
      };

      try {
        const win = new BrowserWindow({
          width: 500,
          height: 600,
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        });

        // 避免 Google disallowed_useragent 限制
        win.webContents.setUserAgent(
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );

        win.once('ready-to-show', () => win.show());

        win.on('closed', () => {
          safeResolve({ ok: false, message: 'Login window closed by user' });
        });

        if (payload.provider === 'google') {
          const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=318131526906-jdsojdqh6057pn3fo5hhtgudht1bh6c8.apps.googleusercontent.com&redirect_uri=http://localhost/callback&response_type=id_token&scope=openid%20email%20profile&nonce=syncflow_desktop_nonce`;

          const handleRedirect = async (targetUrl: string) => {
            if (targetUrl.startsWith('http://localhost/callback')) {
              win.destroy();
              try {
                const urlObj = new URL(targetUrl.replace('#', '?'));
                const idToken = urlObj.searchParams.get('id_token');
                if (!idToken) throw new Error('No id_token in redirect');
                const res = await sidecarClient.loginWithGoogle({ identityToken: idToken });
                if (res.ok) {
                  await syncCredentialsToSidecar()
                    .then((success) => {
                      if (success) {
                        sidecarManager.startCredentialsSyncInterval();
                      }
                    })
                    .catch((err) => {
                      log.error('Failed to sync credentials after Google login:', err);
                    });
                }
                safeResolve(res);
              } catch (err: any) {
                safeResolve({ ok: false, message: err.message });
              }
            }
          };

          win.webContents.on('will-navigate', (e, url) => {
            if (url.startsWith('http://localhost/callback')) {
              e.preventDefault();
              handleRedirect(url);
            }
          });
          win.webContents.on('will-redirect', (e, url) => {
            if (url.startsWith('http://localhost/callback')) {
              e.preventDefault();
              handleRedirect(url);
            }
          });

          await win.loadURL(googleUrl);
        } else if (payload.provider === 'apple') {
          const clientId = process.env.SYNCFLOW_APPLE_CLIENT_ID || '';
          const redirectUri = process.env.SYNCFLOW_APPLE_REDIRECT_URI || '';

          if (!clientId || !redirectUri) {
            win.destroy();
            safeResolve({
              ok: false,
              message: 'Apple OAuth config missing (SYNCFLOW_APPLE_CLIENT_ID / SYNCFLOW_APPLE_REDIRECT_URI)',
            });
            return;
          }

          const appleUrl = `https://appleid.apple.com/auth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code%20id_token&response_mode=form_post&scope=name%20email`;

          // 攔截 POST 到 redirectUri 的請求
          const session = win.webContents.session;
          session.webRequest.onBeforeRequest(
            { urls: [redirectUri + '*'] },
            async (details, callback) => {
              if (details.method === 'POST' && details.uploadData && details.uploadData.length > 0) {
                win.destroy();
                try {
                  const rawBody = Buffer.from(details.uploadData[0].bytes).toString();
                  const params = new URLSearchParams(rawBody);
                  const idToken = params.get('id_token');
                  const code = params.get('code') || undefined;
                  const userStr = params.get('user');
                  let fullName = '';
                  if (userStr) {
                    const parsedUser = JSON.parse(userStr);
                    if (parsedUser.name) {
                      fullName = `${parsedUser.name.firstName || ''} ${parsedUser.name.lastName || ''}`.trim();
                    }
                  }

                  if (!idToken) throw new Error('No id_token returned from Apple');
                  const res = await sidecarClient.loginWithApple({
                    identityToken: idToken,
                    authorizationCode: code,
                    fullName: fullName || undefined,
                  });
                  if (res.ok) {
                    await syncCredentialsToSidecar()
                      .then((success) => {
                        if (success) {
                          sidecarManager.startCredentialsSyncInterval();
                        }
                      })
                      .catch((err) => {
                        log.error('Failed to sync credentials after Apple login:', err);
                      });
                  }
                  safeResolve(res);
                } catch (err: any) {
                  safeResolve({ ok: false, message: err.message });
                }
                callback({ cancel: true });
              } else {
                callback({});
              }
            }
          );

          await win.loadURL(appleUrl);
        }
      } catch (err: any) {
        safeResolve({ ok: false, message: err.message });
      }
    });
  });
  ipcMain.handle(IPC.SIDECAR_REGENERATE_CODE, () => regenerateConnectionCodeSafely(sidecarManager));
  ipcMain.handle(IPC.SIDECAR_RUNTIME_STATE, () => sidecarManager.getState());
  ipcMain.handle(IPC.SIDECAR_RETRY_START, () => sidecarManager.retryStart());
  ipcMain.handle(IPC.SIDECAR_INSTALL_BONJOUR, () => installBonjourForWindows(sidecarManager));
  ipcMain.handle(IPC.SIDECAR_SHARE_STATUS, () => sidecarClient.getShareStatus());
  ipcMain.handle(IPC.SIDECAR_VALIDATE_SHARE, () => sidecarClient.validateShare());
  ipcMain.handle(IPC.SIDECAR_TRANSFER_ACTIVE, () => sidecarClient.getTransferActive());
  ipcMain.handle(IPC.SIDECAR_SHARED_LIST, (_e, path?: string) => sidecarClient.getSharedList(path));
  ipcMain.handle(IPC.SUPPORT_UPLOAD_DIAGNOSTICS, (_e, request: DiagnosticsUploadRequest) =>
    uploadDiagnostics(sidecarManager, request),
  );
  ipcMain.handle(IPC.SUPPORT_EXPORT_DIAGNOSTICS, (_e, locale?: string, description?: string) =>
    exportDiagnostics(sidecarManager, locale, description),
  );
  ipcMain.handle(IPC.SUPPORT_CHECK_FOR_UPDATES, () => checkForUpdates());
  ipcMain.handle(IPC.SUPPORT_APP_INFO, () => getAppInfo());

  // File operations — real Electron APIs
  ipcMain.handle(IPC.FILES_OPEN_FOLDER, (_e, path: string) => openFolder(path));
  ipcMain.handle(IPC.FILES_OPEN_FILE, (_e, path: string) => openFile(path));
  ipcMain.handle(IPC.FILES_OPEN_EXTERNAL, (_e, target: string) => openExternal(target));
  ipcMain.handle(IPC.FILES_SELECT_FOLDER, () => selectFolder());
  ipcMain.handle(IPC.FILES_COPY_CLIPBOARD, (_e, text: string) => copyToClipboard(text));
}
