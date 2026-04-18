// Mock native modules that api.ts pulls in transitively via auth-store
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
}));
jest.mock('../../stores/auth-store', () => ({
  getAccessToken: jest.fn(() => null),
  getRefreshToken: jest.fn(() => null),
}));

import { ERROR_CODE, ApiError } from '../api';
import { classifyIapError, IapErrorClass } from '../iap-errors';

describe('classifyIapError', () => {
  test('E_USER_CANCELLED → cancelled (silent)', () => {
    const cls = classifyIapError({ code: 'E_USER_CANCELLED' });
    expect(cls.kind).toBe(IapErrorClass.Cancelled);
    expect(cls.i18nKey).toBeNull();
  });

  test('E_DEFERRED_PAYMENT → deferred with i18n key', () => {
    const cls = classifyIapError({ code: 'E_DEFERRED_PAYMENT' });
    expect(cls.kind).toBe(IapErrorClass.Deferred);
    expect(cls.i18nKey).toBe('subscription.errors.deferred');
  });

  test('E_NETWORK_ERROR → retryable', () => {
    const cls = classifyIapError({ code: 'E_NETWORK_ERROR' });
    expect(cls.kind).toBe(IapErrorClass.Retryable);
    expect(cls.i18nKey).toBe('subscription.errors.iapFailed');
  });

  test('E_ALREADY_OWNED → alreadyOwned with dedicated i18n key', () => {
    const cls = classifyIapError({ code: 'E_ALREADY_OWNED' });
    expect(cls.kind).toBe(IapErrorClass.AlreadyOwned);
    expect(cls.i18nKey).toBe('subscription.errors.alreadyOwned');
  });

  test('E_ITEM_UNAVAILABLE → fatalConfig', () => {
    const cls = classifyIapError({ code: 'E_ITEM_UNAVAILABLE' });
    expect(cls.kind).toBe(IapErrorClass.FatalConfig);
    expect(cls.i18nKey).toBe('subscription.errors.productUnavailable');
  });

  test('E_DEVELOPER_ERROR → fatalConfig (ASC misconfig, not retryable)', () => {
    // Observed in sandbox when a product ID exists in code but is not
    // yet approved / missing metadata in App Store Connect. Must fail
    // fast with an alert — waiting won't help.
    const cls = classifyIapError({ code: 'E_DEVELOPER_ERROR' });
    expect(cls.kind).toBe(IapErrorClass.FatalConfig);
    expect(cls.i18nKey).toBe('subscription.errors.productUnavailable');
  });

  test('Unknown Apple code → retryable with generic key', () => {
    const cls = classifyIapError({ code: 'E_UNKNOWN' });
    expect(cls.kind).toBe(IapErrorClass.Retryable);
    expect(cls.i18nKey).toBe('subscription.errors.iapFailed');
  });

  test('Backend 2001 IAP_VERIFY_FAILED → retryable', () => {
    const cls = classifyIapError(
      new ApiError(ERROR_CODE.IAP_VERIFY_FAILED, 'fail'),
    );
    expect(cls.kind).toBe(IapErrorClass.Retryable);
    expect(cls.i18nKey).toBe('subscription.errors.verifyFailed');
  });

  test('Backend 2002 RECEIPT_ALREADY_USED → silent success', () => {
    const cls = classifyIapError(
      new ApiError(ERROR_CODE.RECEIPT_ALREADY_USED, 'used'),
    );
    expect(cls.kind).toBe(IapErrorClass.SilentSuccess);
  });

  test('Backend 2003 PRODUCT_ID_MISMATCH → fatal mismatch', () => {
    const cls = classifyIapError(
      new ApiError(ERROR_CODE.PRODUCT_ID_MISMATCH, 'mismatch'),
    );
    expect(cls.kind).toBe(IapErrorClass.FatalMismatch);
    expect(cls.i18nKey).toBe('subscription.errors.productMismatch');
  });

  test('Backend 2005 RECEIPT_BOUND_TO_OTHER_USER → fatal mismatch with dedicated copy', () => {
    // Guard against regression to SilentSuccess — cross-account receipt
    // reuse MUST surface an actionable alert, not silently "succeed".
    const cls = classifyIapError(
      new ApiError(ERROR_CODE.RECEIPT_BOUND_TO_OTHER_USER, 'bound to other'),
    );
    expect(cls.kind).toBe(IapErrorClass.FatalMismatch);
    expect(cls.i18nKey).toBe('subscription.errors.receiptBoundToOther');
  });

  test('Backend NETWORK_ERROR → retryable', () => {
    const cls = classifyIapError(
      new ApiError(ERROR_CODE.NETWORK_ERROR, 'network'),
    );
    expect(cls.kind).toBe(IapErrorClass.Retryable);
    expect(cls.i18nKey).toBe('subscription.errors.verifyRetrying');
  });
});
