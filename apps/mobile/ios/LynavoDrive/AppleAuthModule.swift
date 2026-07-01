import Foundation
import React

@objc(AppleAuthModule)
class AppleAuthModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  private func exportedConstants() -> [AnyHashable: Any] {
    var constants: [AnyHashable: Any] = [:]
    let environment = ProcessInfo.processInfo.environment
    [
      "LYNAVO_VISUAL_QA",
      "LYNAVO_VISUAL_QA_EMAIL",
      "LYNAVO_VISUAL_QA_HOME_EMPTY",
      "LYNAVO_VISUAL_QA_ROUTE",
      "LYNAVO_VISUAL_QA_SHARED_FILES_PREVIEW",
      "LYNAVO_DEV_SKIP_AUTH",
      "LYNAVO_DEV_SKIP_AUTH_EMAIL",
    ].forEach { key in
      if let value = environment[key] {
        constants[key] = value
      }
    }
    return constants
  }

  @objc
  func constantsToExport() -> [AnyHashable : Any]! {
    return exportedConstants()
  }

  @objc
  func getConstants() -> [AnyHashable : Any]! {
    return exportedConstants()
  }
  
  @objc
  func login(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    reject(
      "ERR_OFFICIAL_AUTH_UNSUPPORTED",
      "Sign in with Apple is unavailable in the OSS runtime.",
      nil
    )
  }
}
