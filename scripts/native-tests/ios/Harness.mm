#import "AppleBoundary.h"
#import "UnifPhotoProcessor.h"
#import <CoreGraphics/CoreGraphics.h>
#import <ImageIO/ImageIO.h>
#include <cstdio>

static void check(BOOL ok, NSString *message) {
  if (!ok)
    [NSException raise:@"Assertion" format:@"%@", message];
}
static NSDictionary *call(void (^invoke)(RCTPromiseResolveBlock,
                                         RCTPromiseRejectBlock)) {
  dispatch_semaphore_t done = dispatch_semaphore_create(0);
  __block NSDictionary *receipt = nil;
  invoke(
      ^(id value) {
        NSData *data = [value dataUsingEncoding:NSUTF8StringEncoding];
        receipt = [NSJSONSerialization JSONObjectWithData:data
                                                  options:0
                                                    error:nil];
        dispatch_semaphore_signal(done);
      },
      ^(NSString *code, NSString *message, NSError *error) {
        receipt = @{@"error" : code, @"message" : message};
        dispatch_semaphore_signal(done);
      });
  check(dispatch_semaphore_wait(
            done, dispatch_time(DISPATCH_TIME_NOW, 10 * NSEC_PER_SEC)) == 0,
        @"native operation did not settle");
  return receipt;
}
static void fixture(NSString *path, size_t width, size_t height,
                    unsigned int orientation) {
  CGColorSpaceRef colors = CGColorSpaceCreateDeviceRGB();
  CGContextRef context = CGBitmapContextCreate(
      NULL, width, height, 8, 0, colors, kCGImageAlphaPremultipliedLast);
  CGContextSetRGBFillColor(context, 0.1, 0.5, 0.8, 1);
  CGContextFillRect(context, CGRectMake(0, 0, width, height));
  CGImageRef image = CGBitmapContextCreateImage(context);
  CGImageDestinationRef destination = CGImageDestinationCreateWithURL(
      (__bridge CFURLRef)[NSURL fileURLWithPath:path], CFSTR("public.jpeg"), 1,
      NULL);
  CGImageDestinationAddImage(
      destination, image,
      (__bridge CFDictionaryRef)
          @{(__bridge NSString *)kCGImagePropertyOrientation : @(orientation)});
  check(CGImageDestinationFinalize(destination),
        @"could not write image fixture");
  CFRelease(destination);
  CGImageRelease(image);
  CGContextRelease(context);
  CGColorSpaceRelease(colors);
}
int main() {
  @autoreleasepool {
    NSString *root = [NSTemporaryDirectory()
        stringByAppendingPathComponent:NSUUID.UUID.UUIDString];
    [[NSFileManager defaultManager] createDirectoryAtPath:root
                              withIntermediateDirectories:YES
                                               attributes:nil
                                                    error:nil];
    UnifPhotoProcessor *processor = [UnifPhotoProcessor new];
    CameraInstallBoundaries();
    __block int failures = 0;
    void (^test)(NSString *, void (^)(void)) =
        ^(NSString *name, void (^body)(void)) {
          @try {
            CameraResetBoundaries();
            body();
            printf("PASS: %s\n", name.UTF8String);
          } @catch (NSException *error) {
            failures++;
            printf("FAIL: %s: %s\n", name.UTF8String, error.reason.UTF8String);
          }
        };
    @try {
      test(@"photo inspection preserves dimensions and all EXIF directions", ^{
        NSArray *directions = @[
          @"up", @"up", @"down", @"down", @"right", @"right", @"left", @"left"
        ];
        NSString *path =
            [root stringByAppendingPathComponent:@"orientation.jpg"];
        for (unsigned int orientation = 1; orientation <= 8; orientation++) {
          fixture(path, 320, 240, orientation);
          NSDictionary *value = call(
              ^(RCTPromiseResolveBlock resolve, RCTPromiseRejectBlock reject) {
                [processor inspectPhotoFile:path resolve:resolve reject:reject];
              });
          check([value[@"width"] isEqual:orientation >= 5 ? @240 : @320],
                @"incorrect upright width");
          check([value[@"height"] isEqual:orientation >= 5 ? @320 : @240],
                @"incorrect upright height");
          check([value[@"orientation"] isEqual:directions[orientation - 1]],
                @"incorrect direction");
        }
      });
      test(@"missing photo and video files reject through the native contract",
           ^{
             NSString *path = [root stringByAppendingPathComponent:@"missing"];
             NSDictionary *photo = call(^(RCTPromiseResolveBlock resolve,
                                          RCTPromiseRejectBlock reject) {
               [processor inspectPhotoFile:path resolve:resolve reject:reject];
             });
             check([photo[@"error"] isEqual:@"E_PHOTO_READ"],
                   @"missing photo accepted");
             NSDictionary *video = call(^(RCTPromiseResolveBlock resolve,
                                          RCTPromiseRejectBlock reject) {
               [processor inspectVideoFile:path resolve:resolve reject:reject];
             });
             check([video[@"error"] isEqual:@"E_VIDEO_READ"],
                   @"missing video accepted");
           });
      test(@"photo processing crops, samples, writes JPEG and preserves "
           @"borrowed source",
           ^{
             NSString *input =
                 [root stringByAppendingPathComponent:@"source.jpg"];
             NSString *output =
                 [root stringByAppendingPathComponent:@"output.jpg"];
             fixture(input, 320, 240, 1);
             for (NSString *aspect in
                  @[ @"1:1", @"3:4", @"9:16", @"original" ]) {
               NSDictionary *value = call(^(RCTPromiseResolveBlock resolve,
                                            RCTPromiseRejectBlock reject) {
                 [processor processPhoto:input
                              outputPath:output
                             aspectRatio:aspect
                             targetWidth:120
                            targetHeight:160
                                 quality:85
                           watermarkJson:@"null"
                                 resolve:resolve
                                  reject:reject];
               });
               check(value[@"error"] == nil, [value description]);
               check([value[@"width"] intValue] > 0 &&
                         [value[@"height"] intValue] > 0,
                     @"output dimensions missing");
               NSDictionary *verified = call(^(RCTPromiseResolveBlock resolve,
                                               RCTPromiseRejectBlock reject) {
                 [processor inspectPhotoFile:output
                                     resolve:resolve
                                      reject:reject];
               });
               check([verified[@"width"] isEqual:value[@"width"]] &&
                         [verified[@"height"] isEqual:value[@"height"]],
                     @"reported output differs from real JPEG");
               check([[NSFileManager defaultManager] fileExistsAtPath:input],
                     @"borrowed source was deleted");
             }
           });
      test(@"watermark positions produce real JPEG outputs with independent "
           @"content",
           ^{
             NSString *input =
                 [root stringByAppendingPathComponent:@"watermark-source.jpg"];
             fixture(input, 160, 240, 1);
             for (NSString *position in @[
                    @"top-left", @"top-right", @"top-center", @"bottom-left",
                    @"bottom-right", @"bottom-center", @"center"
                  ]) {
               NSString *output =
                   [root stringByAppendingPathComponent:
                             [position stringByAppendingString:@".jpg"]];
               NSString *watermark = [[NSString alloc]
                   initWithData:[NSJSONSerialization dataWithJSONObject:@{
                     @"content" : @[ @"采集现场", @"2026-10-16" ],
                     @"position" : position
                   }
                                                                options:0
                                                                  error:nil]
                       encoding:NSUTF8StringEncoding];
               NSDictionary *value = call(^(RCTPromiseResolveBlock resolve,
                                            RCTPromiseRejectBlock reject) {
                 [processor processPhoto:input
                              outputPath:output
                             aspectRatio:@"3:4"
                             targetWidth:320
                            targetHeight:480
                                 quality:90
                           watermarkJson:watermark
                                 resolve:resolve
                                  reject:reject];
               });
               check(value[@"error"] == nil, [value description]);
               check([[NSFileManager defaultManager] fileExistsAtPath:output],
                     @"watermark JPEG missing");
             }
           });
      test(@"metadata system failures preserve the read error contract", ^{
        NSString *input =
            [root stringByAppendingPathComponent:@"metadata-faults.jpg"];
        fixture(input, 320, 240, 1);
        for (NSNumber *mode in @[
               @(CameraFaultProperties), @(CameraFaultWidthZero),
               @(CameraFaultHeightZero), @(CameraFaultJSON)
             ]) {
          CameraResetBoundaries();
          cameraFault = (CameraFault)mode.integerValue;
          NSDictionary *value = call(^(RCTPromiseResolveBlock resolve,
                                       RCTPromiseRejectBlock reject) {
            [processor inspectPhotoFile:input resolve:resolve reject:reject];
          });
          check([value[@"error"] isEqual:@"E_PHOTO_READ"], [value description]);
        }
        cameraFault = CameraFaultOrientationMissing;
        NSDictionary *value = call(
            ^(RCTPromiseResolveBlock resolve, RCTPromiseRejectBlock reject) {
              [processor inspectPhotoFile:input resolve:resolve reject:reject];
            });
        check([value[@"orientation"] isEqual:@"up"],
              @"missing orientation must default to up");
      });
      test(@"video callbacks validate transforms, dimensions, errors and "
           @"optional duration",
           ^{
             cameraUseVideoBoundary = YES;
             NSString *input =
                 [root stringByAppendingPathComponent:@"boundary.mp4"];
             auto inspect = ^NSDictionary * {
               return call(^(RCTPromiseResolveBlock resolve,
                             RCTPromiseRejectBlock reject) {
                 [processor inspectVideoFile:input
                                     resolve:resolve
                                      reject:reject];
               });
             };
             check([inspect()[@"error"] isEqual:@"E_VIDEO_READ"],
                   @"empty video tracks accepted");
             cameraVideoTracks = @[ CameraVideoTrack() ];
             cameraVideoError =
                 [NSError errorWithDomain:AVFoundationErrorDomain
                                     code:AVErrorFileFormatNotRecognized
                                 userInfo:nil];
             check([inspect()[@"error"] isEqual:@"E_VIDEO_READ"],
                   @"video SDK error accepted");
             cameraVideoError = nil;
             for (NSNumber *degrees in @[ @0, @90, @180, @270 ]) {
               cameraVideoTransform = CGAffineTransformMakeRotation(
                   degrees.doubleValue * M_PI / 180);
               NSDictionary *value = inspect();
               BOOL swapped = degrees.intValue == 90 || degrees.intValue == 270;
               check([value[@"width"] isEqual:swapped ? @240 : @320] &&
                         [value[@"height"] isEqual:swapped ? @320 : @240],
                     @"video rotation mismatch");
               check([value[@"durationMs"] isEqual:@1500],
                     @"video duration mismatch");
             }
             cameraVideoTransform = CGAffineTransformIdentity;
             for (NSValue *size in @[
                    [NSValue valueWithSize:CGSizeMake(NAN, 240)],
                    [NSValue valueWithSize:CGSizeMake(320, NAN)],
                    [NSValue valueWithSize:CGSizeMake(0, 240)],
                    [NSValue valueWithSize:CGSizeMake(320, 0)]
                  ]) {
               cameraVideoSize = size.sizeValue;
               check([inspect()[@"error"] isEqual:@"E_VIDEO_READ"],
                     @"invalid video size accepted");
             }
             cameraVideoSize = CGSizeMake(320, 240);
             cameraVideoTransform =
                 CGAffineTransformMake(1, 0, 0, INFINITY, 0, 0);
             check([inspect()[@"error"] isEqual:@"E_VIDEO_READ"],
                   @"invalid height transform accepted");
             cameraVideoTransform =
                 CGAffineTransformMake(1, 0, 0, 1, INFINITY, 0);
             check([inspect()[@"error"] isEqual:@"E_VIDEO_READ"],
                   @"invalid width transform accepted");
             cameraVideoTransform = CGAffineTransformIdentity;
             for (NSValue *time in @[
                    [NSValue valueWithCMTime:kCMTimeIndefinite],
                    [NSValue valueWithCMTime:kCMTimePositiveInfinity],
                    [NSValue valueWithCMTime:CMTimeMake(-1, 1)]
                  ]) {
               cameraVideoDuration = time.CMTimeValue;
               NSDictionary *value = inspect();
               check(value[@"error"] == nil && value[@"durationMs"] == nil,
                     @"invalid duration should be omitted without losing "
                     @"dimensions");
             }
             cameraFault = CameraFaultJSON;
             check([inspect()[@"error"] isEqual:@"E_VIDEO_READ"],
                   @"unserializable video receipt accepted");
           });
      test(@"processing faults settle and remove incomplete outputs without "
           @"deleting source",
           ^{
             NSString *input =
                 [root stringByAppendingPathComponent:@"fault-source.jpg"];
             NSString *output =
                 [root stringByAppendingPathComponent:@"fault-output.jpg"];
             fixture(input, 320, 240, 1);
             NSArray *cases = @[
               @[ @(CameraFaultSourceSecondRead), @"E_PHOTO_READ" ],
               @[ @(CameraFaultThumbnail), @"E_PHOTO_DECODE" ],
               @[ @(CameraFaultDecodedImage), @"E_PHOTO_DECODE" ],
               @[ @(CameraFaultFullImage), @"E_PHOTO_DECODE" ],
               @[ @(CameraFaultEmptyExtent), @"E_PHOTO_CROP" ],
               @[ @(CameraFaultInfiniteExtent), @"E_PHOTO_CROP" ],
               @[ @(CameraFaultHeightOverflow), @"E_PHOTO_CROP" ],
               @[ @(CameraFaultNormalFont), @"E_PHOTO_WATERMARK" ],
               @[ @(CameraFaultBitmap), @"E_PHOTO_ALLOCATE" ],
               @[ @(CameraFaultOverlay), @"E_PHOTO_WATERMARK" ],
               @[ @(CameraFaultRemove), @"E_PHOTO_WRITE" ],
               @[ @(CameraFaultWrite), @"E_PHOTO_WRITE" ],
               @[ @(CameraFaultEncode), @"E_PHOTO_ENCODE" ],
               @[ @(CameraFaultJSON), @"E_PHOTO_ENCODE" ],
               @[ @(CameraFaultException), @"E_PHOTO_DECODE" ],
             ];
             for (NSArray *item in cases) {
               CameraResetBoundaries();
               [@"partial" writeToFile:output
                            atomically:YES
                              encoding:NSUTF8StringEncoding
                                 error:nil];
               cameraFault = (CameraFault)[item[0] integerValue];
               double target = cameraFault == CameraFaultFullImage ? 1000 : 100;
               NSDictionary *value = call(^(RCTPromiseResolveBlock resolve,
                                            RCTPromiseRejectBlock reject) {
                 [processor processPhoto:input
                              outputPath:output
                             aspectRatio:@"16:9"
                             targetWidth:target
                            targetHeight:target
                                 quality:85
                           watermarkJson:@"{\"content\":[\"visible\"]}"
                                 resolve:resolve
                                  reject:reject];
               });
               check(
                   [value[@"error"] isEqual:item[1]],
                   [NSString stringWithFormat:@"fault %@: %@", item[0], value]);
               check(![[NSFileManager defaultManager] fileExistsAtPath:output],
                     @"failed output retained");
               check([[NSFileManager defaultManager] fileExistsAtPath:input],
                     @"borrowed input removed");
             }
           });
      test(
          @"watermark input variants and font fallbacks keep valid JPEG "
          @"behavior",
          ^{
            NSString *input =
                [root stringByAppendingPathComponent:@"variants.jpg"];
            NSString *output =
                [root stringByAppendingPathComponent:@"variants-output.jpg"];
            fixture(input, 48, 64, 1);
            auto process = ^NSDictionary *(NSString *watermark, double width,
                                           double height, double quality) {
              return call(^(RCTPromiseResolveBlock resolve,
                            RCTPromiseRejectBlock reject) {
                [processor processPhoto:input
                             outputPath:output
                            aspectRatio:@"16:9"
                            targetWidth:width
                           targetHeight:height
                                quality:quality
                          watermarkJson:watermark
                                resolve:resolve
                                 reject:reject];
              });
            };
            for (
                NSString *json in @[
                  @"", @"{\"content\":[]}", @"{\"content\":[\" \",\"\\n\"]}",
                  @"{\"content\":[42,true,null,{\"key\":1},[\"nested\"]],\"position\":42}",
                  @"{\"content\":[\"\",\"second\"]}"
                ]) {
              NSDictionary *value = process(json, 1000, 1000, 100);
              check(value[@"error"] == nil, [value description]);
              check([value[@"diagnostics"][@"sampled"] isEqual:@NO],
                    @"small input was upscaled or sampled");
            }
            for (NSString *json in @[ @"[]", @"{", @"{\"content\":42}" ]) {
              check([process(json, 48, 64, 80)[@"error"]
                        isEqual:@"E_PHOTO_WATERMARK"],
                    @"invalid watermark accepted");
            }
            unichar invalid[] = {0xd800};
            NSString *nonUTF8 = [NSString stringWithCharacters:invalid
                                                        length:1];
            check([process(nonUTF8, 48, 64, 80)[@"error"]
                      isEqual:@"E_PHOTO_WATERMARK"],
                  @"invalid UTF8 watermark accepted");
            for (NSNumber *mode in @[
                   @(CameraFaultEmphasizedFont), @(CameraFaultAllBoldFonts),
                   @(CameraFaultTextNoFit), @(CameraFaultSubpixelExtent)
                 ]) {
              cameraFault = (CameraFault)mode.integerValue;
              NSDictionary *value =
                  process(@"{\"content\":[\"title\"]}", 48, 64, 90);
              if (cameraFault == CameraFaultSubpixelExtent) {
                check(cameraWriteSize.width >= 1 && cameraWriteSize.height >= 1,
                      [NSString stringWithFormat:
                                    @"positive subpixel encoder input %@: %@",
                                    NSStringFromSize(cameraWriteSize), value]);
                check(value[@"error"] == nil, [value description]);
                check(
                    [value[@"width"] intValue] == 1 &&
                        [value[@"height"] intValue] == 1,
                    @"fractional decoder size did not retain one output pixel");
              } else {
                check(value[@"error"] == nil, [value description]);
              }
            }
            cameraFault = CameraFaultNone;
            check(process(@"null", -1, 0, -10)[@"error"] == nil,
                  @"non-positive output values were not clamped");
            check(process(@"null", 64, 48, 150)[@"error"] == nil,
                  @"quality maximum was not clamped");
          });
      test(@"small and large layouts scale down while bounding text and JPEG "
           @"dimensions",
           ^{
             NSString *input =
                 [root stringByAppendingPathComponent:@"sizing.jpg"];
             NSString *output =
                 [root stringByAppendingPathComponent:@"sizing-output.jpg"];
             for (NSNumber *edge in @[ @1, @2, @3, @4, @8, @16, @1200 ]) {
               size_t width = edge.unsignedLongValue;
               fixture(input, width, width * 2, 1);
               for (NSNumber *targetHeight in @[ @(width * 2), @1 ]) {
                 NSDictionary *value = call(^(RCTPromiseResolveBlock resolve,
                                              RCTPromiseRejectBlock reject) {
                   [processor processPhoto:input
                                outputPath:output
                               aspectRatio:@"16:9"
                               targetWidth:width * 4
                              targetHeight:targetHeight.doubleValue
                                   quality:75
                             watermarkJson:@"{\"content\":[\"ABCDEFGHIJKLMN\","
                                           @"\"second\",\"third\"]}"
                                   resolve:resolve
                                    reject:reject];
                 });
                 check(value[@"error"] == nil, [value description]);
                 check([value[@"width"] intValue] >= 1 &&
                           [value[@"height"] intValue] >= 1,
                       @"scaled output must keep positive dimensions");
               }
             }
           });
      test(@"failed processing removes only its incomplete output", ^{
        NSString *input = [root stringByAppendingPathComponent:@"missing.jpg"];
        NSString *output = [root stringByAppendingPathComponent:@"partial.jpg"];
        [@"partial" writeToFile:output
                     atomically:YES
                       encoding:NSUTF8StringEncoding
                          error:nil];
        NSDictionary *value = call(
            ^(RCTPromiseResolveBlock resolve, RCTPromiseRejectBlock reject) {
              [processor processPhoto:input
                           outputPath:output
                          aspectRatio:@"3:4"
                          targetWidth:120
                         targetHeight:160
                              quality:85
                        watermarkJson:@"null"
                              resolve:resolve
                               reject:reject];
            });
        check([value[@"error"] isEqual:@"E_PHOTO_READ"],
              @"missing input was processed");
        check(![[NSFileManager defaultManager] fileExistsAtPath:output],
              @"failed output was retained");
        check([processor getTurboModule:facebook::react::ObjCTurboModule::
                                            InitParams{}] != nullptr,
              @"TurboModule registration missing");
      });
    } @finally {
      [[NSFileManager defaultManager] removeItemAtPath:root error:nil];
    }
    return failures ? 1 : 0;
  }
}
