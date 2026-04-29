import type { TFunction } from 'i18next';
import {
  BONJOUR_INSTALL_ERROR_CODES,
  type BonjourInstallMessageCode,
} from '../../shared/bonjour';

const successKeyByCode: Record<BonjourInstallMessageCode, string> = {
  installed: 'errors.settings.bonjourInstallSuccess',
  alreadyInstalled: 'errors.settings.bonjourAlreadyInstalled',
};

export function getBonjourInstallSuccessMessage(
  code: BonjourInstallMessageCode,
  t: TFunction,
): string {
  return t(successKeyByCode[code]);
}

export function getBonjourInstallErrorMessage(error: unknown, t: TFunction): string {
  const message = error instanceof Error ? error.message : '';

  if (message.includes(BONJOUR_INSTALL_ERROR_CODES.unsupportedPlatform)) {
    return t('errors.settings.bonjourUnsupportedPlatform');
  }
  if (message.includes(BONJOUR_INSTALL_ERROR_CODES.postInstallNotDetected)) {
    return t('errors.settings.bonjourPostInstallNotDetected');
  }
  if (message.includes(BONJOUR_INSTALL_ERROR_CODES.tooManyRedirects)) {
    return t('errors.settings.bonjourTooManyRedirects');
  }
  if (message.includes(BONJOUR_INSTALL_ERROR_CODES.canceled)) {
    return t('errors.settings.bonjourInstallCanceled');
  }

  const httpStatus = extractCodeDetail(message, BONJOUR_INSTALL_ERROR_CODES.downloadHttp);
  if (httpStatus) {
    return t('errors.settings.bonjourDownloadHttpFailed', { status: httpStatus });
  }

  const exitCode = extractCodeDetail(message, BONJOUR_INSTALL_ERROR_CODES.failedExit);
  if (exitCode) {
    return t('errors.settings.bonjourInstallExitFailed', { code: exitCode });
  }

  return t('errors.settings.bonjourInstallFallback');
}

function extractCodeDetail(message: string, code: string): string | null {
  const match = message.match(new RegExp(`${code}:([^\\s]+)`));
  return match?.[1] ?? null;
}
