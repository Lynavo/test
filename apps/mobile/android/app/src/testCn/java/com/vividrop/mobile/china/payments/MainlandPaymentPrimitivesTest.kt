package com.vividrop.mobile.china.payments

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class MainlandPaymentPrimitivesTest {
  @Test
  fun normalizeAlipayResultTreats9000AsSuccess() {
    val result = MainlandPaymentPrimitives.normalizeAlipayResult(
      mapOf(
        "resultStatus" to "9000",
        "memo" to "OK",
        "result" to "trade_no=202605070001",
      ),
    )

    assertTrue(result.success)
    assertEquals("9000", result.status)
    assertEquals("OK", result.memo)
    assertEquals("trade_no=202605070001", result.rawResult)
  }

  @Test
  fun normalizeAlipayResultTreatsNon9000AsNotCompleted() {
    val result = MainlandPaymentPrimitives.normalizeAlipayResult(
      mapOf("resultStatus" to "6001", "memo" to "user cancelled"),
    )

    assertFalse(result.success)
    assertEquals("6001", result.status)
  }

  @Test
  fun alipayFailureCodeTreatsOnly6001AsCancelled() {
    assertEquals(
      "MAINLAND_PAYMENT_ALIPAY_CANCELLED",
      MainlandPaymentPrimitives.alipayFailureCode("6001"),
    )
    assertEquals(
      "MAINLAND_PAYMENT_ALIPAY_NOT_COMPLETED",
      MainlandPaymentPrimitives.alipayFailureCode("4000"),
    )
    assertEquals(
      "MAINLAND_PAYMENT_ALIPAY_NOT_COMPLETED",
      MainlandPaymentPrimitives.alipayFailureCode("8000"),
    )
  }

  @Test
  fun validatePurchaseRequestKeepsAlipaySandboxFlag() {
    val request = MainlandPaymentPrimitives.validatePurchaseRequest(
      method = "alipay",
      alipayOrderInfo = "signed-order-info",
      alipaySandbox = true,
      wechatPayRequest = null,
    )

    assertEquals("alipay", request.method)
    assertEquals("signed-order-info", request.alipayOrderInfo)
    assertTrue(request.alipaySandbox)
  }

  @Test
  fun readWechatPayRequestRequiresSignedServerFields() {
    val request = MainlandPaymentPrimitives.readWechatPayRequestFields(
      mapOf(
        "appId" to "wx-app-id",
        "partnerId" to "merchant-id",
        "prepayId" to "prepay-id",
        "packageValue" to "Sign=WXPay",
        "nonceStr" to "nonce",
        "timeStamp" to "1777777777",
        "sign" to "signed-value",
      ),
    )

    assertEquals("wx-app-id", request.appId)
    assertEquals("merchant-id", request.partnerId)
    assertEquals("prepay-id", request.prepayId)
    assertEquals("Sign=WXPay", request.packageValue)
    assertEquals("nonce", request.nonceStr)
    assertEquals("1777777777", request.timeStamp)
    assertEquals("signed-value", request.sign)
  }

  @Test
  fun readWechatPayRequestRejectsMissingFields() {
    assertThrows(IllegalArgumentException::class.java) {
      MainlandPaymentPrimitives.readWechatPayRequestFields(
        mapOf(
          "appId" to "wx-app-id",
          "partnerId" to "merchant-id",
          "prepayId" to "prepay-id",
        ),
      )
    }
  }

  @Test
  fun validatePurchaseRequestRejectsMissingMethodWithStableErrorCode() {
    val error = assertThrows(MainlandPaymentRequestValidationException::class.java) {
      MainlandPaymentPrimitives.validatePurchaseRequest(
        method = null,
        alipayOrderInfo = null,
        alipaySandbox = false,
        wechatPayRequest = null,
      )
    }

    assertEquals("MAINLAND_PAYMENT_INVALID_REQUEST", error.code)
    assertEquals("Missing required string: method", error.message)
  }

  @Test
  fun validatePurchaseRequestRejectsBlankWechatFieldWithStableErrorCode() {
    val error = assertThrows(MainlandPaymentRequestValidationException::class.java) {
      MainlandPaymentPrimitives.validatePurchaseRequest(
        method = "wechat",
        alipayOrderInfo = null,
        alipaySandbox = false,
        wechatPayRequest = mapOf(
          "appId" to "wx-app-id",
          "partnerId" to "merchant-id",
          "prepayId" to "prepay-id",
          "packageValue" to "Sign=WXPay",
          "nonceStr" to "nonce",
          "timeStamp" to " ",
          "sign" to "signed-value",
        ),
      )
    }

    assertEquals("MAINLAND_PAYMENT_INVALID_REQUEST", error.code)
    assertEquals("Missing WeChat Pay field: timeStamp", error.message)
  }

  @Test
  fun wechatPendingLifecycleClearsPendingPaymentWhenCallbackIntentIsInvalid() {
    val lifecycle = WechatPendingPaymentLifecycle()
    assertTrue(lifecycle.begin("wx-app-id"))

    val resolution = lifecycle.clearForInvalidCallback()

    assertEquals("MAINLAND_PAYMENT_WECHAT_CALLBACK_INVALID", resolution?.code)
    assertEquals(null, lifecycle.currentAppId())
    assertTrue(lifecycle.begin("wx-app-id"))
  }

  @Test
  fun wechatPendingLifecycleClearsPendingPaymentWhenHostIsDestroyed() {
    val lifecycle = WechatPendingPaymentLifecycle()
    assertTrue(lifecycle.begin("wx-app-id"))

    val resolution = lifecycle.clearForHostDestroy()

    assertEquals("MAINLAND_PAYMENT_WECHAT_HOST_DESTROYED", resolution?.code)
    assertEquals(null, lifecycle.currentAppId())
    assertTrue(lifecycle.begin("wx-app-id"))
  }

  @Test
  fun wechatPendingLifecycleClearsPendingPaymentWhenTimedOut() {
    val lifecycle = WechatPendingPaymentLifecycle()
    assertTrue(lifecycle.begin("wx-app-id"))

    val resolution = lifecycle.clearForTimeout()

    assertEquals("MAINLAND_PAYMENT_WECHAT_TIMEOUT", resolution?.code)
    assertEquals(null, lifecycle.currentAppId())
    assertTrue(lifecycle.begin("wx-app-id"))
  }

  @Test
  fun wechatPendingLifecycleClearsPendingPaymentWhenLaunchFails() {
    val lifecycle = WechatPendingPaymentLifecycle()
    assertTrue(lifecycle.begin("wx-app-id"))

    val resolution = lifecycle.clearForLaunchFailure()

    assertEquals("MAINLAND_PAYMENT_WECHAT_LAUNCH_FAILED", resolution?.code)
    assertEquals(null, lifecycle.currentAppId())
    assertTrue(lifecycle.begin("wx-app-id"))
  }
}
