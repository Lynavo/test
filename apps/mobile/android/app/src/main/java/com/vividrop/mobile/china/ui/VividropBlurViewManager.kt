package com.vividrop.mobile.china.ui

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class VividropBlurViewManager(
  private val reactContext: ReactApplicationContext,
) : SimpleViewManager<VividropBlurView>() {
  override fun getName(): String = REACT_CLASS

  override fun createViewInstance(context: ThemedReactContext): VividropBlurView =
    VividropBlurView(reactContext)

  @ReactProp(name = "blurStyle")
  fun setBlurStyle(view: VividropBlurView, blurStyle: String?) {
    view.setBlurStyle(blurStyle)
  }

  @ReactProp(name = "intensity", defaultFloat = 0.08f)
  fun setIntensity(view: VividropBlurView, intensity: Float) {
    view.setIntensity(intensity)
  }

  companion object {
    const val REACT_CLASS = "VividropBlurView"
  }
}
