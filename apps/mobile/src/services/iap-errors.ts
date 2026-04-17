import { ApiError, ERROR_CODE } from './api';

export enum IapErrorClass {
  /** User cancelled the Apple UI — never show an alert. */
  Cancelled = 'cancelled',
  /** Ask to Buy / Screen Time parental hold — transaction will resume later. */
  Deferred = 'deferred',
  /** Transient — show error + let user retry. */
  Retryable = 'retryable',
  /** Same receipt already verified by backend — treat as success. */
  SilentSuccess = 'silentSuccess',
  /** Receipt.productId not in backend validProducts — must finish to stop queue. */
  FatalMismatch = 'fatalMismatch',
  /** Product not on App Store / region-limited — contact support. */
  FatalConfig = 'fatalConfig',
  /** User already has an active sub — trigger Restore flow. */
  AutoRestore = 'autoRestore',
}

export interface IapErrorClassification {
  kind: IapErrorClass;
  i18nKey: string | null;
}

interface WithCode {
  code?: string | number;
}

export function classifyIapError(err: unknown): IapErrorClassification {
  if (err instanceof ApiError) {
    switch (err.code) {
      case ERROR_CODE.RECEIPT_ALREADY_USED:
        return { kind: IapErrorClass.SilentSuccess, i18nKey: null };
      case ERROR_CODE.PRODUCT_ID_MISMATCH:
        return {
          kind: IapErrorClass.FatalMismatch,
          i18nKey: 'subscription.errors.productMismatch',
        };
      case ERROR_CODE.IAP_VERIFY_FAILED:
        return {
          kind: IapErrorClass.Retryable,
          i18nKey: 'subscription.errors.verifyFailed',
        };
      case ERROR_CODE.NETWORK_ERROR:
        return {
          kind: IapErrorClass.Retryable,
          i18nKey: 'subscription.errors.verifyRetrying',
        };
      default:
        return {
          kind: IapErrorClass.Retryable,
          i18nKey: 'subscription.errors.verifyFailed',
        };
    }
  }

  const code = (err as WithCode)?.code;
  switch (code) {
    case 'E_USER_CANCELLED':
      return { kind: IapErrorClass.Cancelled, i18nKey: null };
    case 'E_DEFERRED_PAYMENT':
      return {
        kind: IapErrorClass.Deferred,
        i18nKey: 'subscription.errors.deferred',
      };
    case 'E_ALREADY_OWNED':
      return { kind: IapErrorClass.AutoRestore, i18nKey: null };
    case 'E_ITEM_UNAVAILABLE':
      return {
        kind: IapErrorClass.FatalConfig,
        i18nKey: 'subscription.errors.productUnavailable',
      };
    case 'E_NETWORK_ERROR':
    case 'E_UNKNOWN':
    default:
      return {
        kind: IapErrorClass.Retryable,
        i18nKey: 'subscription.errors.iapFailed',
      };
  }
}
