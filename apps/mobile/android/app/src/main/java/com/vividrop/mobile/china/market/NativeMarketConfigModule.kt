package com.vividrop.mobile.china.market

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.vividrop.mobile.china.BuildConfig
import com.vividrop.mobile.china.MainActivity

class NativeMarketConfigModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = MODULE_NAME

  override fun getConstants(): MutableMap<String, Any> {
    val market = normalizeMarket(BuildConfig.FLAVOR)
    return hashMapOf<String, Any>("SYNCFLOW_MARKET" to market).apply {
      if (market == "global") {
        putAll(MainActivity.getVisualQaLaunchExtras())
      }
    }
  }

  private fun normalizeMarket(flavor: String): String =
    when (flavor) {
      "global" -> "global"
      else -> "cn"
    }

  companion object {
    const val MODULE_NAME = "NativeMarketConfig"
  }
}
