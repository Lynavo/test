package com.vividrop.mobile.china.wxapi

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import com.tencent.mm.opensdk.constants.ConstantsAPI
import com.tencent.mm.opensdk.modelbase.BaseReq
import com.tencent.mm.opensdk.modelbase.BaseResp
import com.tencent.mm.opensdk.openapi.IWXAPIEventHandler
import com.tencent.mm.opensdk.openapi.WXAPIFactory
import com.vividrop.mobile.china.payments.NativeMainlandPaymentModule

class WXPayEntryActivity : Activity(), IWXAPIEventHandler {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    handleWechatIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleWechatIntent(intent)
  }

  override fun onReq(req: BaseReq?) {
    // App Pay only needs payment responses.
  }

  override fun onResp(resp: BaseResp?) {
    if (resp?.type == ConstantsAPI.COMMAND_PAY_BY_WX) {
      NativeMainlandPaymentModule.handleWechatPayResponse(resp.errCode, resp.errStr)
    }
    finish()
  }

  private fun handleWechatIntent(intent: Intent?) {
    val appId = NativeMainlandPaymentModule.currentWechatAppId()
    if (appId.isNullOrBlank() || intent == null) {
      finish()
      return
    }
    val handled = WXAPIFactory.createWXAPI(this, appId, false).handleIntent(intent, this)
    if (!handled) {
      NativeMainlandPaymentModule.handleWechatPayCallbackInvalid()
      finish()
    }
  }
}
