package com.vividrop.mobile.china.payments

data class AlipayPaymentResult(
  val success: Boolean,
  val status: String,
  val memo: String?,
  val rawResult: String?,
)

data class WechatPayRequestFields(
  val appId: String,
  val partnerId: String,
  val prepayId: String,
  val packageValue: String,
  val nonceStr: String,
  val timeStamp: String,
  val sign: String,
)

data class MainlandPaymentPurchaseRequest(
  val method: String,
  val alipayOrderInfo: String?,
  val alipaySandbox: Boolean,
  val wechatPayRequest: WechatPayRequestFields?,
)

class MainlandPaymentRequestValidationException(
  override val message: String,
) : IllegalArgumentException(message) {
  val code: String = "MAINLAND_PAYMENT_INVALID_REQUEST"
}

data class WechatPendingPaymentResolution(
  val code: String,
  val message: String,
)

class WechatPendingPaymentLifecycle {
  private var pendingAppId: String? = null

  fun begin(appId: String): Boolean {
    if (pendingAppId != null) {
      return false
    }
    pendingAppId = appId
    return true
  }

  fun currentAppId(): String? = pendingAppId

  fun clearForCompletedCallback(): Boolean {
    if (pendingAppId == null) {
      return false
    }
    pendingAppId = null
    return true
  }

  fun clearForInvalidCallback(): WechatPendingPaymentResolution? =
    clearWithResolution(
      "MAINLAND_PAYMENT_WECHAT_CALLBACK_INVALID",
      "WeChat callback intent was not handled",
    )

  fun clearForHostDestroy(): WechatPendingPaymentResolution? =
    clearWithResolution(
      "MAINLAND_PAYMENT_WECHAT_HOST_DESTROYED",
      "Host was destroyed before WeChat payment completed",
    )

  fun clearForTimeout(): WechatPendingPaymentResolution? =
    clearWithResolution(
      "MAINLAND_PAYMENT_WECHAT_TIMEOUT",
      "WeChat payment timed out",
    )

  fun clearForLaunchFailure(): WechatPendingPaymentResolution? =
    clearWithResolution(
      "MAINLAND_PAYMENT_WECHAT_LAUNCH_FAILED",
      "Failed to launch WeChat Pay",
    )

  private fun clearWithResolution(
    code: String,
    message: String,
  ): WechatPendingPaymentResolution? {
    if (pendingAppId == null) {
      return null
    }
    pendingAppId = null
    return WechatPendingPaymentResolution(code, message)
  }
}

object MainlandPaymentPrimitives {
  fun validatePurchaseRequest(
    method: String?,
    alipayOrderInfo: String?,
    alipaySandbox: Boolean,
    wechatPayRequest: Map<String, String?>?,
  ): MainlandPaymentPurchaseRequest {
    val normalizedMethod = requireRequestString(method, "method")
    return when (normalizedMethod) {
      "alipay" -> MainlandPaymentPurchaseRequest(
        method = normalizedMethod,
        alipayOrderInfo = requireRequestString(alipayOrderInfo, "alipayOrderInfo"),
        alipaySandbox = alipaySandbox,
        wechatPayRequest = null,
      )
      "wechat" -> MainlandPaymentPurchaseRequest(
        method = normalizedMethod,
        alipayOrderInfo = null,
        alipaySandbox = false,
        wechatPayRequest = readWechatPayRequestFields(
          wechatPayRequest
            ?: throw MainlandPaymentRequestValidationException(
              "Missing required map: wechatPayRequest",
            ),
        ),
      )
      else -> MainlandPaymentPurchaseRequest(
        method = normalizedMethod,
        alipayOrderInfo = null,
        alipaySandbox = false,
        wechatPayRequest = null,
      )
    }
  }

  fun normalizeAlipayResult(result: Map<String, String>): AlipayPaymentResult {
    val status = result["resultStatus"].orEmpty()
    return AlipayPaymentResult(
      success = status == ALIPAY_SUCCESS_STATUS,
      status = status,
      memo = result["memo"],
      rawResult = result["result"],
    )
  }

  fun alipayFailureCode(status: String): String =
    if (status == ALIPAY_CANCELLED_STATUS) {
      "MAINLAND_PAYMENT_ALIPAY_CANCELLED"
    } else {
      "MAINLAND_PAYMENT_ALIPAY_NOT_COMPLETED"
    }

  fun readWechatPayRequestFields(fields: Map<String, String?>): WechatPayRequestFields =
    WechatPayRequestFields(
      appId = requireField(fields, "appId"),
      partnerId = requireField(fields, "partnerId"),
      prepayId = requireField(fields, "prepayId"),
      packageValue = requireField(fields, "packageValue"),
      nonceStr = requireField(fields, "nonceStr"),
      timeStamp = requireField(fields, "timeStamp"),
      sign = requireField(fields, "sign"),
    )

  private fun requireField(fields: Map<String, String?>, key: String): String {
    val value = fields[key]?.trim()
    if (value.isNullOrEmpty()) {
      throw MainlandPaymentRequestValidationException("Missing WeChat Pay field: $key")
    }
    return value
  }

  private fun requireRequestString(value: String?, key: String): String {
    val normalized = value?.trim()
    if (normalized.isNullOrEmpty()) {
      throw MainlandPaymentRequestValidationException("Missing required string: $key")
    }
    return normalized
  }

  private const val ALIPAY_SUCCESS_STATUS = "9000"
  private const val ALIPAY_CANCELLED_STATUS = "6001"
}
