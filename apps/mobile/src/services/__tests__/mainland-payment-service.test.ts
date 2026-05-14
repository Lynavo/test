jest.mock('react-native', () => ({
  NativeModules: {},
}));

const mockApiPost = jest.fn();
const mockApiGet = jest.fn();
const mockRecordDiagnosticsLog = jest.fn();
jest.mock('../api', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));
jest.mock('../diagnostics-log-service', () => ({
  recordDiagnosticsLog: (...args: unknown[]) =>
    mockRecordDiagnosticsLog(...args),
}));

import { NativeModules } from 'react-native';
import { mainlandPaymentService } from '../mainland-payment-service';

describe('mainlandPaymentService', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockRecordDiagnosticsLog.mockReset();
    delete (NativeModules as Record<string, unknown>).NativeMainlandPayment;
    jest.useRealTimers();
  });

  test('throws a stable unavailable error when native payment module is missing', async () => {
    await expect(
      mainlandPaymentService.purchase({
        method: 'wechat',
        productId: 'vividrop.monthly',
        plan: 'monthly',
      }),
    ).rejects.toThrow('MAINLAND_PAYMENT_UNAVAILABLE');
  });

  test('creates an order, launches the native SDK, then confirms subscription', async () => {
    mockApiPost
      .mockResolvedValueOnce({
        order_id: 'order-1',
        method: 'alipay',
        alipay_order_info: 'signed-order-info',
        alipay_sandbox: true,
      })
      .mockResolvedValueOnce({
        subscription: {
          status: 'subscribed',
          plan: 'yearly',
          expire_at: '2027-05-07T00:00:00Z',
          trial_end: null,
          auto_renewing: null,
          payment_provider: 'mainland',
          renewal_state: 'prepaid',
        },
      });
    (NativeModules as Record<string, unknown>).NativeMainlandPayment = {
      purchaseSubscription: jest.fn().mockResolvedValue({
        status: 'completed',
        provider: 'alipay',
      }),
    };

    await expect(
      mainlandPaymentService.purchase({
        method: 'alipay',
        productId: 'vividrop.yearly',
        plan: 'yearly',
      }),
    ).resolves.toEqual({
      status: 'subscribed',
      plan: 'yearly',
      expireAt: '2027-05-07T00:00:00Z',
      trialEnd: null,
      autoRenewing: null,
      paymentProvider: 'mainland',
      renewalState: 'prepaid',
    });
    expect(mockApiPost).toHaveBeenNthCalledWith(
      1,
      '/subscription/mainland-payments/order',
      {
        method: 'alipay',
        product_id: 'vividrop.yearly',
        plan: 'yearly',
      },
    );
    expect(
      (
        (NativeModules as Record<string, unknown>).NativeMainlandPayment as {
          purchaseSubscription: jest.Mock;
        }
      ).purchaseSubscription,
    ).toHaveBeenCalledWith({
      orderId: 'order-1',
      method: 'alipay',
      alipayOrderInfo: 'signed-order-info',
      alipaySandbox: true,
      wechatPayRequest: null,
    });
    expect(mockApiPost).toHaveBeenNthCalledWith(
      2,
      '/subscription/mainland-payments/confirm',
      {
        order_id: 'order-1',
        method: 'alipay',
        native_status: 'completed',
        provider: 'alipay',
      },
    );
  });

  test('logs native Alipay failure details without leaking signed order info', async () => {
    mockApiPost.mockResolvedValueOnce({
      order_id: 'order-alipay-failed',
      method: 'alipay',
      alipay_order_info: 'signed-order-info-with-secret-signature',
    });
    const nativeError = Object.assign(new Error('Alipay payment failed'), {
      code: 'MAINLAND_PAYMENT_ALIPAY_NOT_COMPLETED',
      userInfo: {
        provider: 'alipay',
        resultStatus: '4000',
        memo: 'system error',
      },
    });
    (NativeModules as Record<string, unknown>).NativeMainlandPayment = {
      purchaseSubscription: jest.fn().mockRejectedValue(nativeError),
    };

    await expect(
      mainlandPaymentService.purchase({
        method: 'alipay',
        productId: 'vividrop.yearly',
        plan: 'yearly',
      }),
    ).rejects.toThrow('Alipay payment failed');

    expect(mockRecordDiagnosticsLog).toHaveBeenCalledWith(
      'MainlandPayment',
      'native purchase failed',
      expect.objectContaining({
        method: 'alipay',
        orderId: 'order-alipay-failed',
        code: 'MAINLAND_PAYMENT_ALIPAY_NOT_COMPLETED',
        resultStatus: '4000',
        memo: 'system error',
      }),
    );
    expect(JSON.stringify(mockRecordDiagnosticsLog.mock.calls)).not.toContain(
      'signed-order-info-with-secret-signature',
    );
  });

  test('passes WeChat signed order fields to the native SDK', async () => {
    const wechatPayRequest = {
      appId: 'wx-app-id',
      partnerId: 'merchant-id',
      prepayId: 'prepay-id',
      packageValue: 'Sign=WXPay',
      nonceStr: 'nonce',
      timeStamp: '1777777777',
      sign: 'signed-value',
    };
    mockApiPost
      .mockResolvedValueOnce({
        order_id: 'order-2',
        method: 'wechat',
        wechat_pay_request: wechatPayRequest,
      })
      .mockResolvedValueOnce({
        subscription: {
          status: 'subscribed',
          plan: 'monthly',
          expireAt: '2026-06-07T00:00:00Z',
          trialEnd: null,
          autoRenewing: null,
          paymentProvider: 'mainland',
          renewalState: 'prepaid',
        },
      });
    (NativeModules as Record<string, unknown>).NativeMainlandPayment = {
      purchaseSubscription: jest.fn().mockResolvedValue({
        status: 'completed',
        provider: 'wechat',
      }),
    };

    await expect(
      mainlandPaymentService.purchase({
        method: 'wechat',
        productId: 'vividrop.monthly',
        plan: 'monthly',
      }),
    ).resolves.toEqual({
      status: 'subscribed',
      plan: 'monthly',
      expireAt: '2026-06-07T00:00:00Z',
      trialEnd: null,
      autoRenewing: null,
      paymentProvider: 'mainland',
      renewalState: 'prepaid',
    });
    expect(
      (
        (NativeModules as Record<string, unknown>).NativeMainlandPayment as {
          purchaseSubscription: jest.Mock;
        }
      ).purchaseSubscription,
    ).toHaveBeenCalledWith({
      orderId: 'order-2',
      method: 'wechat',
      alipayOrderInfo: null,
      alipaySandbox: false,
      wechatPayRequest,
    });
  });

  test('logs native WeChat failure details without leaking signed order info', async () => {
    const wechatPayRequest = {
      appId: 'wx-app-id',
      partnerId: 'merchant-id',
      prepayId: 'prepay-id',
      packageValue: 'Sign=WXPay',
      nonceStr: 'nonce',
      timeStamp: '1777777777',
      sign: 'signed-wechat-order-value',
    };
    mockApiPost.mockResolvedValueOnce({
      order_id: 'order-wechat-failed',
      method: 'wechat',
      wechat_pay_request: wechatPayRequest,
    });
    const nativeError = Object.assign(new Error('WeChat payment failed'), {
      code: 'MAINLAND_PAYMENT_WECHAT_FAILED',
      userInfo: {
        provider: 'wechat',
        errCode: -1,
        errStr: 'signature invalid',
      },
    });
    (NativeModules as Record<string, unknown>).NativeMainlandPayment = {
      purchaseSubscription: jest.fn().mockRejectedValue(nativeError),
    };

    await expect(
      mainlandPaymentService.purchase({
        method: 'wechat',
        productId: 'vividrop.monthly',
        plan: 'monthly',
      }),
    ).rejects.toThrow('WeChat payment failed');

    expect(mockRecordDiagnosticsLog).toHaveBeenCalledWith(
      'MainlandPayment',
      'native purchase failed',
      expect.objectContaining({
        method: 'wechat',
        orderId: 'order-wechat-failed',
        code: 'MAINLAND_PAYMENT_WECHAT_FAILED',
        errCode: -1,
        errStr: 'signature invalid',
      }),
    );
    expect(JSON.stringify(mockRecordDiagnosticsLog.mock.calls)).not.toContain(
      'signed-wechat-order-value',
    );
  });

  test('waits for subscription status when live confirm returns pending', async () => {
    jest.useFakeTimers();
    mockApiPost
      .mockResolvedValueOnce({
        order_id: 'order-live',
        method: 'alipay',
        alipay_order_info: 'signed-order-info',
      })
      .mockResolvedValueOnce({
        pending: true,
        order_id: 'order-live',
        poll_after_ms: 1,
      });
    mockApiGet.mockResolvedValueOnce({
      status: 'subscribed',
      plan: 'yearly',
      expire_at: '2027-05-07T00:00:00Z',
      trial_end: null,
      auto_renewing: null,
      payment_provider: 'mainland',
      renewal_state: 'prepaid',
    });
    (NativeModules as Record<string, unknown>).NativeMainlandPayment = {
      purchaseSubscription: jest.fn().mockResolvedValue({
        status: 'completed',
        provider: 'alipay',
      }),
    };

    const purchase = mainlandPaymentService.purchase({
      method: 'alipay',
      productId: 'vividrop.yearly',
      plan: 'yearly',
    });
    await jest.advanceTimersByTimeAsync(999);
    expect(mockApiGet).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);

    await expect(purchase).resolves.toEqual({
      status: 'subscribed',
      plan: 'yearly',
      expireAt: '2027-05-07T00:00:00Z',
      trialEnd: null,
      autoRenewing: null,
      paymentProvider: 'mainland',
      renewalState: 'prepaid',
    });
    expect(mockApiGet).toHaveBeenCalledWith('/subscription/status');
  });

  test('polls status when immediate confirm subscription does not match requested plan', async () => {
    jest.useFakeTimers();
    mockApiPost
      .mockResolvedValueOnce({
        order_id: 'order-plan-mismatch',
        method: 'wechat',
        wechat_pay_request: {
          appId: 'wx-app-id',
          partnerId: 'merchant-id',
          prepayId: 'prepay-id',
          packageValue: 'Sign=WXPay',
          nonceStr: 'nonce',
          timeStamp: '1777777777',
          sign: 'signed-value',
        },
      })
      .mockResolvedValueOnce({
        poll_after_ms: 0,
        subscription: {
          status: 'subscribed',
          plan: 'monthly',
          expire_at: '2026-06-07T00:00:00Z',
          payment_provider: 'mainland',
          renewal_state: 'prepaid',
        },
      });
    mockApiGet.mockResolvedValueOnce({
      status: 'subscribed',
      plan: 'yearly',
      expire_at: '2027-05-07T00:00:00Z',
      payment_provider: 'mainland',
      renewal_state: 'prepaid',
    });
    (NativeModules as Record<string, unknown>).NativeMainlandPayment = {
      purchaseSubscription: jest.fn().mockResolvedValue({
        status: 'completed',
        provider: 'wechat',
      }),
    };

    const purchase = mainlandPaymentService.purchase({
      method: 'wechat',
      productId: 'vividrop.yearly',
      plan: 'yearly',
    });
    await jest.advanceTimersByTimeAsync(1000);

    await expect(purchase).resolves.toEqual({
      status: 'subscribed',
      plan: 'yearly',
      expireAt: '2027-05-07T00:00:00Z',
      trialEnd: null,
      autoRenewing: null,
      paymentProvider: 'mainland',
      renewalState: 'prepaid',
    });
    expect(mockApiGet).toHaveBeenCalledWith('/subscription/status');
  });
});
