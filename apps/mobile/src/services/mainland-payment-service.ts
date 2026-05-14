import { NativeModules } from 'react-native';
import type { SubscriptionInfo, SubscriptionPlan } from '../stores/auth-store';
import type { MainlandPaymentMethod } from '../utils/subscriptionPaymentRouting';
import { apiGet, apiPost } from './api';
import { recordDiagnosticsLog } from './diagnostics-log-service';

export interface MainlandPaymentRequest {
  method: MainlandPaymentMethod;
  productId: string;
  plan: Exclude<SubscriptionPlan, ''>;
}

export interface WechatPayRequestPayload {
  appId: string;
  partnerId: string;
  prepayId: string;
  packageValue: string;
  nonceStr: string;
  timeStamp: string;
  sign: string;
}

interface MainlandPaymentOrderResponse {
  order_id?: unknown;
  method?: unknown;
  alipay_order_info?: unknown;
  alipay_sandbox?: unknown;
  alipaySandbox?: unknown;
  wechat_pay_request?: unknown;
}

interface MainlandPaymentNativeRequest {
  orderId: string;
  method: MainlandPaymentMethod;
  alipayOrderInfo: string | null;
  alipaySandbox: boolean;
  wechatPayRequest: WechatPayRequestPayload | null;
}

interface MainlandPaymentNativeResult {
  status: string;
  provider: MainlandPaymentMethod;
  resultStatus?: string;
  rawResult?: string;
}

interface MainlandPaymentConfirmResponse {
  pending?: unknown;
  order_id?: unknown;
  orderId?: unknown;
  poll_after_ms?: unknown;
  pollAfterMs?: unknown;
  subscription?: unknown;
}

interface NativeMainlandPaymentModule {
  purchaseSubscription(request: MainlandPaymentNativeRequest): Promise<unknown>;
}

type DiagnosticsDetails = Record<
  string,
  string | number | boolean | null | undefined
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readNullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : readString(value);
}

function readAutoRenewing(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  return null;
}

function readBoolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readStringOrNumber(value: unknown): string | number | null {
  if (typeof value === 'string') return value;
  return readNumber(value);
}

function readErrorCode(error: unknown): string | undefined {
  if (!isRecord(error)) return undefined;
  const code = readStringOrNumber(error.code);
  return code == null ? undefined : String(code);
}

function readErrorUserInfo(error: unknown): Record<string, unknown> | null {
  if (!isRecord(error)) return null;
  const userInfo = error.userInfo;
  return isRecord(userInfo) ? userInfo : null;
}

function readNativePaymentErrorDetails(error: unknown): DiagnosticsDetails {
  const details: DiagnosticsDetails = {};
  const code = readErrorCode(error);
  if (code) details.code = code;
  if (error instanceof Error && error.message) {
    details.message = error.message;
  }

  const userInfo = readErrorUserInfo(error);
  if (!userInfo) return details;

  const provider = readString(userInfo.provider);
  if (provider) details.provider = provider;

  const resultStatus = readStringOrNumber(
    userInfo.resultStatus ?? userInfo.result_status,
  );
  if (resultStatus != null) details.resultStatus = resultStatus;

  const memo = readString(userInfo.memo);
  if (memo) details.memo = memo;

  const errCode = readStringOrNumber(userInfo.errCode ?? userInfo.err_code);
  if (errCode != null) details.errCode = errCode;

  const errStr = readString(userInfo.errStr ?? userInfo.err_str);
  if (errStr) details.errStr = errStr;

  const errorClass = readString(userInfo.errorClass ?? userInfo.error_class);
  if (errorClass) details.errorClass = errorClass;

  return details;
}

function readPaymentProvider(
  value: unknown,
): SubscriptionInfo['paymentProvider'] {
  if (value === 'apple' || value === 'mainland') return value;
  return null;
}

function readRenewalState(value: unknown): SubscriptionInfo['renewalState'] {
  if (
    value === 'auto_renewing' ||
    value === 'cancelled' ||
    value === 'prepaid'
  ) {
    return value;
  }
  return null;
}

function readRequiredString(value: unknown, fieldName: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  throw new Error(`MAINLAND_PAYMENT_INVALID_${fieldName.toUpperCase()}`);
}

function readWechatPayRequest(value: unknown): WechatPayRequestPayload {
  if (!isRecord(value)) {
    throw new Error('MAINLAND_PAYMENT_INVALID_WECHAT_PAY_REQUEST');
  }
  return {
    appId: readRequiredString(value.appId ?? value.app_id, 'wechat_app_id'),
    partnerId: readRequiredString(
      value.partnerId ?? value.partner_id,
      'wechat_partner_id',
    ),
    prepayId: readRequiredString(
      value.prepayId ?? value.prepay_id,
      'wechat_prepay_id',
    ),
    packageValue: readRequiredString(
      value.packageValue ?? value.package,
      'wechat_package',
    ),
    nonceStr: readRequiredString(
      value.nonceStr ?? value.nonce_str,
      'wechat_nonce_str',
    ),
    timeStamp: readRequiredString(
      value.timeStamp ?? value.timestamp ?? value.time_stamp,
      'wechat_timestamp',
    ),
    sign: readRequiredString(value.sign, 'wechat_sign'),
  };
}

function normalizeNativeResult(
  value: unknown,
  method: MainlandPaymentMethod,
): MainlandPaymentNativeResult {
  if (!isRecord(value)) {
    throw new Error('MAINLAND_PAYMENT_INVALID_NATIVE_RESPONSE');
  }
  const status = readString(value.status) ?? 'completed';
  const provider = readString(value.provider) ?? method;
  if (provider !== 'wechat' && provider !== 'alipay') {
    throw new Error('MAINLAND_PAYMENT_INVALID_PROVIDER');
  }
  return {
    status,
    provider,
    resultStatus:
      readNullableString(value.resultStatus ?? value.result_status) ??
      undefined,
    rawResult:
      readNullableString(value.rawResult ?? value.raw_result) ?? undefined,
  };
}

function normalizePaymentOrder(
  value: unknown,
  requestedMethod: MainlandPaymentMethod,
): MainlandPaymentNativeRequest {
  if (!isRecord(value)) {
    throw new Error('MAINLAND_PAYMENT_INVALID_ORDER');
  }
  const method = readString(value.method) ?? requestedMethod;
  if (method !== requestedMethod) {
    throw new Error('MAINLAND_PAYMENT_METHOD_MISMATCH');
  }
  const orderId = readRequiredString(
    value.order_id ?? value.orderId,
    'order_id',
  );

  if (requestedMethod === 'alipay') {
    return {
      orderId,
      method: requestedMethod,
      alipayOrderInfo: readRequiredString(
        value.alipay_order_info ?? value.alipayOrderInfo,
        'alipay_order_info',
      ),
      alipaySandbox: readBoolean(
        value.alipay_sandbox ?? value.alipaySandbox,
      ),
      wechatPayRequest: null,
    };
  }

  return {
    orderId,
    method: requestedMethod,
    alipayOrderInfo: null,
    alipaySandbox: false,
    wechatPayRequest: readWechatPayRequest(
      value.wechat_pay_request ?? value.wechatPayRequest,
    ),
  };
}

function normalizeSubscription(value: unknown): SubscriptionInfo {
  if (!isRecord(value)) {
    throw new Error('MAINLAND_PAYMENT_INVALID_RESPONSE');
  }

  const status = readString(value.status);
  const plan = readString(value.plan);
  if (
    status !== 'trialing' &&
    status !== 'subscribed' &&
    status !== 'trial_expired' &&
    status !== 'sub_expired'
  ) {
    throw new Error('MAINLAND_PAYMENT_INVALID_STATUS');
  }
  if (plan !== '' && plan !== 'monthly' && plan !== 'yearly') {
    throw new Error('MAINLAND_PAYMENT_INVALID_PLAN');
  }

  return {
    status,
    plan,
    expireAt: readNullableString(value.expireAt ?? value.expire_at),
    trialEnd: readNullableString(value.trialEnd ?? value.trial_end),
    autoRenewing: readAutoRenewing(value.autoRenewing ?? value.auto_renewing),
    paymentProvider: readPaymentProvider(
      value.paymentProvider ?? value.payment_provider,
    ),
    renewalState: readRenewalState(value.renewalState ?? value.renewal_state),
  };
}

function isPendingConfirmResponse(
  value: MainlandPaymentConfirmResponse,
): boolean {
  return value.pending === true;
}

function subscriptionFromConfirmResponse(
  value: MainlandPaymentConfirmResponse,
): SubscriptionInfo | null {
  if (isRecord(value) && 'subscription' in value) {
    return normalizeSubscription(value.subscription);
  }
  if (!isPendingConfirmResponse(value)) {
    return normalizeSubscription(value);
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const MAINLAND_PAYMENT_STATUS_MAX_ATTEMPTS = 20;
const MAINLAND_PAYMENT_STATUS_DEFAULT_POLL_MS = 1500;
const MAINLAND_PAYMENT_STATUS_MIN_POLL_MS = 1000;

function isCompletedSubscriptionForPlan(
  subscription: SubscriptionInfo,
  plan: MainlandPaymentRequest['plan'],
): boolean {
  return subscription.status === 'subscribed' && subscription.plan === plan;
}

function readPollAfterMs(value: MainlandPaymentConfirmResponse): number | null {
  return readNumber(value.poll_after_ms ?? value.pollAfterMs);
}

async function waitForMainlandSubscription(
  plan: MainlandPaymentRequest['plan'],
  pollAfterMs: number | null,
): Promise<SubscriptionInfo> {
  const requestedDelayMs =
    pollAfterMs != null && pollAfterMs >= 0
      ? pollAfterMs
      : MAINLAND_PAYMENT_STATUS_DEFAULT_POLL_MS;
  const delayMs = Math.max(
    requestedDelayMs,
    MAINLAND_PAYMENT_STATUS_MIN_POLL_MS,
  );

  for (
    let attempt = 0;
    attempt < MAINLAND_PAYMENT_STATUS_MAX_ATTEMPTS;
    attempt += 1
  ) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }
    const status = normalizeSubscription(
      await apiGet<unknown>('/subscription/status'),
    );
    if (isCompletedSubscriptionForPlan(status, plan)) {
      return status;
    }
  }
  throw new Error('MAINLAND_PAYMENT_PENDING_TIMEOUT');
}

class MainlandPaymentService {
  async purchase(request: MainlandPaymentRequest): Promise<SubscriptionInfo> {
    const nativeModule = NativeModules.NativeMainlandPayment as
      | NativeMainlandPaymentModule
      | undefined;

    if (!nativeModule?.purchaseSubscription) {
      recordDiagnosticsLog('MainlandPayment', 'native module unavailable', {
        method: request.method,
        productId: request.productId,
        plan: request.plan,
      });
      throw new Error('MAINLAND_PAYMENT_UNAVAILABLE');
    }

    recordDiagnosticsLog('MainlandPayment', 'order create start', {
      method: request.method,
      productId: request.productId,
      plan: request.plan,
    });
    let orderResponse: MainlandPaymentOrderResponse;
    try {
      orderResponse = await apiPost<MainlandPaymentOrderResponse>(
        '/subscription/mainland-payments/order',
        {
          method: request.method,
          product_id: request.productId,
          plan: request.plan,
        },
      );
    } catch (err) {
      recordDiagnosticsLog('MainlandPayment', 'order create failed', {
        method: request.method,
        productId: request.productId,
        plan: request.plan,
        ...readNativePaymentErrorDetails(err),
      });
      throw err;
    }
    const order = normalizePaymentOrder(
      orderResponse,
      request.method,
    );
    recordDiagnosticsLog('MainlandPayment', 'order create success', {
      method: request.method,
      orderId: order.orderId,
      hasAlipayOrderInfo: order.alipayOrderInfo != null,
      alipaySandbox: order.alipaySandbox,
      hasWechatPayRequest: order.wechatPayRequest != null,
    });
    recordDiagnosticsLog('MainlandPayment', 'native purchase start', {
      method: request.method,
      orderId: order.orderId,
    });
    let nativeResult: MainlandPaymentNativeResult;
    try {
      nativeResult = normalizeNativeResult(
        await nativeModule.purchaseSubscription(order),
        request.method,
      );
    } catch (err) {
      recordDiagnosticsLog('MainlandPayment', 'native purchase failed', {
        method: request.method,
        orderId: order.orderId,
        ...readNativePaymentErrorDetails(err),
      });
      throw err;
    }
    recordDiagnosticsLog('MainlandPayment', 'native purchase resolved', {
      method: request.method,
      orderId: order.orderId,
      provider: nativeResult.provider,
      nativeStatus: nativeResult.status,
      resultStatus: nativeResult.resultStatus,
    });
    const confirmBody: Record<string, string> = {
      order_id: order.orderId,
      method: request.method,
      native_status: nativeResult.status,
      provider: nativeResult.provider,
    };
    if (nativeResult.resultStatus) {
      confirmBody.result_status = nativeResult.resultStatus;
    }
    if (nativeResult.rawResult) {
      confirmBody.raw_result = nativeResult.rawResult;
    }
    recordDiagnosticsLog('MainlandPayment', 'confirm start', {
      method: request.method,
      orderId: order.orderId,
      provider: nativeResult.provider,
      nativeStatus: nativeResult.status,
      resultStatus: nativeResult.resultStatus,
    });
    let response: MainlandPaymentConfirmResponse;
    try {
      response = await apiPost<MainlandPaymentConfirmResponse>(
        '/subscription/mainland-payments/confirm',
        confirmBody,
      );
    } catch (err) {
      recordDiagnosticsLog('MainlandPayment', 'confirm failed', {
        method: request.method,
        orderId: order.orderId,
        provider: nativeResult.provider,
        nativeStatus: nativeResult.status,
        resultStatus: nativeResult.resultStatus,
        ...readNativePaymentErrorDetails(err),
      });
      throw err;
    }
    recordDiagnosticsLog('MainlandPayment', 'confirm response', {
      method: request.method,
      orderId: order.orderId,
      pending: isPendingConfirmResponse(response),
      pollAfterMs: readPollAfterMs(response) ?? undefined,
      hasSubscription: isRecord(response) && 'subscription' in response,
    });
    let subscription = subscriptionFromConfirmResponse(response);
    if (
      subscription == null ||
      !isCompletedSubscriptionForPlan(subscription, request.plan)
    ) {
      const pollAfterMs = readPollAfterMs(response);
      recordDiagnosticsLog('MainlandPayment', 'payment pending', {
        method: request.method,
        orderId: order.orderId,
        pollAfterMs: pollAfterMs ?? undefined,
      });
      subscription = await waitForMainlandSubscription(
        request.plan,
        pollAfterMs,
      );
    }
    recordDiagnosticsLog('MainlandPayment', 'purchase success', {
      method: request.method,
      productId: request.productId,
      orderId: order.orderId,
      status: subscription.status,
      plan: subscription.plan,
    });
    return subscription;
  }
}

export const mainlandPaymentService = new MainlandPaymentService();
