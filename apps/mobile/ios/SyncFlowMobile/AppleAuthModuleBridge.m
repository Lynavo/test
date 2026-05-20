#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AppleAuthModule, NSObject)

RCT_EXTERN_METHOD(login:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
