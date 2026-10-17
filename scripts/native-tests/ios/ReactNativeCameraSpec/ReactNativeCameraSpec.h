#pragma once
#import <Foundation/Foundation.h>
#include <memory>
#define RCT_EXPORT_MODULE(name)
typedef void (^RCTPromiseResolveBlock)(id);
typedef void (^RCTPromiseRejectBlock)(NSString *, NSString *, NSError *);
namespace facebook::react {
struct TurboModule { virtual ~TurboModule() = default; };
struct ObjCTurboModule { struct InitParams {}; };
struct NativePhotoProcessorSpecJSI : TurboModule {
  explicit NativePhotoProcessorSpecJSI(const ObjCTurboModule::InitParams &) {}
};
}
@protocol NativePhotoProcessorSpec <NSObject>
- (void)inspectPhotoFile:(NSString *)inputPath resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
- (void)inspectVideoFile:(NSString *)inputPath resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
- (void)processPhoto:(NSString *)inputPath outputPath:(NSString *)outputPath aspectRatio:(NSString *)aspectRatio targetWidth:(double)targetWidth targetHeight:(double)targetHeight quality:(double)quality watermarkJson:(NSString *)watermarkJson resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params;
@end
