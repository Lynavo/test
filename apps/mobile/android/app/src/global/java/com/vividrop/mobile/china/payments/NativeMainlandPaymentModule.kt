package com.vividrop.mobile.china.payments

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class NativeMainlandPaymentModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "NativeMainlandPayment"

  @ReactMethod
  fun purchaseSubscription(request: ReadableMap, promise: Promise) {
    promise.reject(
      "MAINLAND_PAYMENT_UNSUPPORTED_METHOD",
      "Mainland payments are not supported in the global build flavor.",
    )
  }
}
