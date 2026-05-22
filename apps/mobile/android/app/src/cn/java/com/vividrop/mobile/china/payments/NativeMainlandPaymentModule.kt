package com.vividrop.mobile.china.payments

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.alipay.sdk.app.EnvUtils
import com.alipay.sdk.app.PayTask
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.tencent.mm.opensdk.modelbase.BaseResp
import com.tencent.mm.opensdk.modelpay.PayReq
import com.tencent.mm.opensdk.openapi.WXAPIFactory
import kotlin.concurrent.thread

class NativeMainlandPaymentModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), LifecycleEventListener {
  init {
    reactContext.addLifecycleEventListener(this)
  }

  override fun getName(): String = MODULE_NAME

  @ReactMethod
  fun purchaseSubscription(request: ReadableMap, promise: Promise) {
    val validatedRequest = try {
      MainlandPaymentPrimitives.validatePurchaseRequest(
        method = request.optionalString("method"),
        alipayOrderInfo = request.optionalString("alipayOrderInfo"),
        alipaySandbox = request.optionalBoolean("alipaySandbox"),
        wechatPayRequest = request.optionalMap("wechatPayRequest")?.toStringMap(),
      )
    } catch (error: MainlandPaymentRequestValidationException) {
      promise.reject(error.code, error.message)
      return
    } catch (error: RuntimeException) {
      promise.reject("MAINLAND_PAYMENT_INVALID_REQUEST", error.message)
      return
    }

    when (validatedRequest.method) {
      "alipay" -> launchAlipay(
        validatedRequest.alipayOrderInfo.orEmpty(),
        validatedRequest.alipaySandbox,
        promise,
      )
      "wechat" -> launchWechatPay(validatedRequest.wechatPayRequest!!, promise)
      else -> promise.reject(
        "MAINLAND_PAYMENT_UNSUPPORTED_METHOD",
        "Unsupported payment method: ${validatedRequest.method}",
      )
    }
  }

  override fun onHostResume() = Unit

  override fun onHostPause() = Unit

  override fun onHostDestroy() {
    rejectPendingWechatPaymentForHostDestroy()
  }

  private fun launchAlipay(orderInfo: String, sandbox: Boolean, promise: Promise) {
    val activity = getCurrentActivity()
    if (activity == null) {
      promise.reject("MAINLAND_PAYMENT_ACTIVITY_UNAVAILABLE", "Current Activity is unavailable")
      return
    }

    thread(name = "NativeMainlandPaymentAlipay", isDaemon = true) {
      try {
        Log.i(MODULE_NAME, "Launching Alipay payment. Sandbox: $sandbox, OrderInfo length: ${orderInfo.length}")
        if (sandbox) {
          Log.i(MODULE_NAME, "Setting Alipay EnvUtils to SANDBOX")
          EnvUtils.setEnv(EnvUtils.EnvEnum.SANDBOX)
        }
        @Suppress("UNCHECKED_CAST")
        val result = PayTask(activity).payV2(orderInfo, true) as Map<String, String>
        Log.i(MODULE_NAME, "Alipay PayTask returned status: ${result["resultStatus"]}")
        val normalized = MainlandPaymentPrimitives.normalizeAlipayResult(result)
        if (normalized.success) {
          val payload = Arguments.createMap().apply {
            putString("status", "completed")
            putString("provider", "alipay")
            putString("resultStatus", normalized.status)
            putString("rawResult", normalized.rawResult)
          }
          promise.resolve(payload)
        } else {
          val userInfo = Arguments.createMap().apply {
            putString("provider", "alipay")
            putString("resultStatus", normalized.status)
            normalized.memo?.let { putString("memo", it) }
          }
          promise.reject(
            MainlandPaymentPrimitives.alipayFailureCode(normalized.status),
            normalized.memo ?: "Alipay payment was not completed",
            userInfo,
          )
        }
      } catch (error: Throwable) {
        Log.w(MODULE_NAME, "Alipay launch failed", error)
        val userInfo = Arguments.createMap().apply {
          putString("provider", "alipay")
          putString("errorClass", error.javaClass.simpleName)
        }
        promise.reject(
          "MAINLAND_PAYMENT_ALIPAY_FAILED",
          error.message ?: "Alipay payment failed",
          userInfo,
        )
      }
    }
  }

  private fun launchWechatPay(fields: WechatPayRequestFields, promise: Promise) {
    val api = try {
      WXAPIFactory.createWXAPI(reactApplicationContext, fields.appId, true)
    } catch (error: Throwable) {
      Log.w(MODULE_NAME, "WeChat API creation failed", error)
      promise.reject(
        "MAINLAND_PAYMENT_WECHAT_LAUNCH_FAILED",
        error.message ?: "Failed to launch WeChat Pay",
        buildWechatLaunchFailureInfo(error),
      )
      return
    }
    val wechatInstalled = try {
      api.isWXAppInstalled
    } catch (error: Throwable) {
      Log.w(MODULE_NAME, "WeChat install check failed", error)
      promise.reject(
        "MAINLAND_PAYMENT_WECHAT_LAUNCH_FAILED",
        error.message ?: "Failed to launch WeChat Pay",
        buildWechatLaunchFailureInfo(error),
      )
      return
    }
    if (!wechatInstalled) {
      promise.reject("MAINLAND_PAYMENT_WECHAT_NOT_INSTALLED", "WeChat is not installed")
      return
    }
    try {
      api.registerApp(fields.appId)
    } catch (error: Throwable) {
      Log.w(MODULE_NAME, "WeChat app registration failed", error)
      promise.reject(
        "MAINLAND_PAYMENT_WECHAT_LAUNCH_FAILED",
        error.message ?: "Failed to launch WeChat Pay",
        buildWechatLaunchFailureInfo(error),
      )
      return
    }

    synchronized(wechatLock) {
      if (pendingWechatPromise != null) {
        promise.reject(
          "MAINLAND_PAYMENT_WECHAT_IN_PROGRESS",
          "A WeChat payment is already in progress",
        )
        return
      }
      pendingWechatPromise = promise
      wechatLifecycle.begin(fields.appId)
    }

    val payReq = PayReq().apply {
      appId = fields.appId
      partnerId = fields.partnerId
      prepayId = fields.prepayId
      packageValue = fields.packageValue
      nonceStr = fields.nonceStr
      timeStamp = fields.timeStamp
      sign = fields.sign
    }
    val launched = try {
      api.sendReq(payReq)
    } catch (error: Throwable) {
      Log.w(MODULE_NAME, "WeChat Pay launch failed", error)
      rejectPendingWechatPayment(
        clearLifecycle = { wechatLifecycle.clearForLaunchFailure() },
        userInfo = buildWechatLaunchFailureInfo(error),
      )
      return
    }
    if (!launched) {
      rejectPendingWechatPayment(
        clearLifecycle = { wechatLifecycle.clearForLaunchFailure() },
        userInfo = buildWechatLaunchFailureInfo(),
      )
      return
    }
    scheduleWechatPaymentTimeout()
  }

  companion object {
    private const val MODULE_NAME = "NativeMainlandPayment"
    private const val WECHAT_PAYMENT_TIMEOUT_MS = 5 * 60 * 1000L
    private val wechatLock = Any()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val wechatLifecycle = WechatPendingPaymentLifecycle()
    private var pendingWechatPromise: Promise? = null
    private var pendingWechatTimeoutRunnable: Runnable? = null

    fun currentWechatAppId(): String? =
      synchronized(wechatLock) { wechatLifecycle.currentAppId() }

    fun handleWechatPayCallbackInvalid() {
      rejectPendingWechatPayment { wechatLifecycle.clearForInvalidCallback() }
    }

    fun handleWechatPayResponse(errCode: Int, errStr: String?) {
      val promise = clearPendingWechatPromise {
        wechatLifecycle.clearForCompletedCallback()
      } ?: return
      when (errCode) {
        BaseResp.ErrCode.ERR_OK -> {
          val payload = Arguments.createMap().apply {
            putString("status", "completed")
            putString("provider", "wechat")
          }
          promise.resolve(payload)
        }
        BaseResp.ErrCode.ERR_USER_CANCEL ->
          promise.reject(
            "MAINLAND_PAYMENT_WECHAT_CANCELLED",
            errStr ?: "WeChat payment was cancelled",
            buildWechatErrorInfo(errCode, errStr),
          )
        else ->
          promise.reject(
            "MAINLAND_PAYMENT_WECHAT_FAILED",
            errStr ?: "WeChat payment failed",
            buildWechatErrorInfo(errCode, errStr),
          )
      }
    }

    private fun buildWechatErrorInfo(errCode: Int, errStr: String?) =
      Arguments.createMap().apply {
        putString("provider", "wechat")
        putInt("errCode", errCode)
        errStr?.let { putString("errStr", it) }
      }

    private fun buildWechatLaunchFailureInfo(error: Throwable? = null) =
      Arguments.createMap().apply {
        putString("provider", "wechat")
        error?.let {
          putString("errorClass", it.javaClass.simpleName)
          it.message?.let { message -> putString("errStr", message) }
        }
      }

    private fun rejectPendingWechatPaymentForHostDestroy() {
      rejectPendingWechatPayment { wechatLifecycle.clearForHostDestroy() }
    }

    private fun scheduleWechatPaymentTimeout() {
      val timeoutRunnable = Runnable {
        rejectPendingWechatPayment { wechatLifecycle.clearForTimeout() }
      }
      synchronized(wechatLock) {
        pendingWechatTimeoutRunnable = timeoutRunnable
      }
      mainHandler.postDelayed(timeoutRunnable, WECHAT_PAYMENT_TIMEOUT_MS)
    }

    private fun rejectPendingWechatPayment(
      userInfo: WritableMap? = null,
      clearLifecycle: () -> WechatPendingPaymentResolution?,
    ) {
      val (promise, resolution) = synchronized(wechatLock) {
        val resolution = clearLifecycle()
        if (resolution == null) {
          null to null
        } else {
          val promise = pendingWechatPromise
          pendingWechatPromise = null
          pendingWechatTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
          pendingWechatTimeoutRunnable = null
          promise to resolution
        }
      }
      if (promise != null && resolution != null) {
        if (userInfo == null) {
          promise.reject(resolution.code, resolution.message)
        } else {
          promise.reject(resolution.code, resolution.message, userInfo)
        }
      }
    }

    private fun clearPendingWechatPromise(clearLifecycle: () -> Unit): Promise? =
      synchronized(wechatLock) {
        val promise = pendingWechatPromise
        pendingWechatPromise = null
        clearLifecycle()
        pendingWechatTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        pendingWechatTimeoutRunnable = null
        promise
      }
  }
}

private fun ReadableMap.optionalString(key: String): String? {
  if (!hasKey(key) || isNull(key)) {
    return null
  }
  return getString(key)
}

private fun ReadableMap.optionalMap(key: String): ReadableMap? {
  if (!hasKey(key) || isNull(key)) {
    return null
  }
  return getMap(key)
}

private fun ReadableMap.optionalBoolean(key: String): Boolean {
  if (!hasKey(key) || isNull(key)) {
    return false
  }
  return getBoolean(key)
}

private fun ReadableMap.toStringMap(): Map<String, String?> =
  keySetIterator().let { iterator ->
    buildMap {
      while (iterator.hasNextKey()) {
        val key = iterator.nextKey()
        put(key, if (isNull(key)) null else getString(key))
      }
    }
  }
