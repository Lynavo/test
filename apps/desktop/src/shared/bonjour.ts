export const BONJOUR_WINDOWS_SUPPORT_URL = 'https://support.apple.com/en-us/106380';
export const BONJOUR_WINDOWS_INSTALLER_URL =
  'https://download.info.apple.com/Mac_OS_X/061-8098.20100603.gthyu/BonjourPSSetup.exe';
export const BONJOUR_WINDOWS_INSTALLER_NAME = 'BonjourPSSetup.exe';

export type BonjourInstallStatus = 'installed' | 'already_installed';
export type BonjourInstallMessageCode = 'installed' | 'alreadyInstalled';

export const BONJOUR_INSTALL_ERROR_CODES = {
  unsupportedPlatform: 'BONJOUR_INSTALL_UNSUPPORTED_PLATFORM',
  postInstallNotDetected: 'BONJOUR_INSTALL_POST_INSTALL_NOT_DETECTED',
  tooManyRedirects: 'BONJOUR_INSTALL_TOO_MANY_REDIRECTS',
  downloadHttp: 'BONJOUR_INSTALL_DOWNLOAD_HTTP',
  canceled: 'BONJOUR_INSTALL_CANCELED',
  failedExit: 'BONJOUR_INSTALL_FAILED_EXIT',
} as const;

export interface BonjourInstallResult {
  status: BonjourInstallStatus;
  message: string | null;
  messageCode: BonjourInstallMessageCode;
  supportUrl: string;
  installerPath: string | null;
  bonjourPath: string | null;
}
