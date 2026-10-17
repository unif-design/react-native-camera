#import "AppleBoundary.h"
#include <cfloat>
#import <objc/runtime.h>

CameraFault cameraFault = CameraFaultNone;
BOOL cameraUseVideoBoundary = NO;
NSArray *cameraVideoTracks = @[];
NSError *cameraVideoError = nil;
CGSize cameraVideoSize = {320, 240};
CGAffineTransform cameraVideoTransform = CGAffineTransformIdentity;
CMTime cameraVideoDuration;
CGSize cameraWriteSize;
static NSInteger sourceReads;
static CIImage *cameraDecodedImage;

void CameraResetBoundaries(void) {
  cameraFault = CameraFaultNone;
  cameraUseVideoBoundary = NO;
  cameraVideoTracks = @[];
  cameraVideoError = nil;
  cameraVideoSize = CGSizeMake(320, 240);
  cameraVideoTransform = CGAffineTransformIdentity;
  cameraVideoDuration = CMTimeMake(3, 2);
  sourceReads = 0;
  cameraDecodedImage = nil;
  cameraWriteSize = CGSizeZero;
}
CGImageSourceRef CameraImageSourceCreate(CFURLRef url,
                                         CFDictionaryRef options) {
  sourceReads++;
  if (cameraFault == CameraFaultException)
    [NSException raise:@"DecodeFailure" format:@"system decoder raised"];
  if (cameraFault == CameraFaultSourceSecondRead && sourceReads == 2)
    return nil;
  return CGImageSourceCreateWithURL(url, options);
}
CFDictionaryRef CameraImageProperties(CGImageSourceRef source, size_t index,
                                      CFDictionaryRef options) {
  if (cameraFault == CameraFaultProperties)
    return nil;
  CFDictionaryRef value =
      CGImageSourceCopyPropertiesAtIndex(source, index, options);
  if (!value)
    return nil;
  NSMutableDictionary *properties =
      [(__bridge NSDictionary *)value mutableCopy];
  CFRelease(value);
  if (cameraFault == CameraFaultWidthZero)
    properties[(__bridge NSString *)kCGImagePropertyPixelWidth] = @0;
  if (cameraFault == CameraFaultHeightZero)
    properties[(__bridge NSString *)kCGImagePropertyPixelHeight] = @0;
  if (cameraFault == CameraFaultOrientationMissing)
    [properties
        removeObjectForKey:(__bridge NSString *)kCGImagePropertyOrientation];
  return (__bridge_retained CFDictionaryRef)properties;
}
CGImageRef CameraThumbnail(CGImageSourceRef source, size_t index,
                           CFDictionaryRef options) {
  if (cameraFault == CameraFaultThumbnail)
    return nil;
  return CGImageSourceCreateThumbnailAtIndex(source, index, options);
}
CTFontRef CameraFont(CTFontUIFontType type, CGFloat size,
                     CFStringRef language) {
  if (cameraFault == CameraFaultNormalFont && type == kCTFontUIFontSystem)
    return nil;
  if ((cameraFault == CameraFaultEmphasizedFont ||
       cameraFault == CameraFaultAllBoldFonts) &&
      type == kCTFontUIFontEmphasizedSystem)
    return nil;
  return CTFontCreateUIFontForLanguage(type, size, language);
}
CTFontRef CameraBoldFont(CTFontRef font, CGFloat size,
                         const CGAffineTransform *matrix,
                         CTFontSymbolicTraits value,
                         CTFontSymbolicTraits mask) {
  if (cameraFault == CameraFaultAllBoldFonts)
    return nil;
  return CTFontCreateCopyWithSymbolicTraits(font, size, matrix, value, mask);
}
CGContextRef CameraBitmap(void *data, size_t width, size_t height, size_t bits,
                          size_t row, CGColorSpaceRef colors, uint32_t info) {
  if (cameraFault == CameraFaultBitmap)
    return nil;
  return CGBitmapContextCreate(data, width, height, bits, row, colors, info);
}
CGImageRef CameraOverlay(CGContextRef bitmap) {
  if (cameraFault == CameraFaultOverlay)
    return nil;
  return CGBitmapContextCreateImage(bitmap);
}

CGSize CameraTextSize(CTFramesetterRef setter, CFRange range,
                      CFDictionaryRef attributes, CGSize constraints,
                      CFRange *fit) {
  if (cameraFault == CameraFaultTextNoFit) {
    if (fit)
      *fit = CFRangeMake(range.location, 0);
    return CGSizeZero;
  }
  return CTFramesetterSuggestFrameSizeWithConstraints(setter, range, attributes,
                                                      constraints, fit);
}

@interface CameraTrackBoundary : NSObject
@property(nonatomic, readonly) CGSize naturalSize;
@property(nonatomic, readonly) CGAffineTransform preferredTransform;
@end
@implementation CameraTrackBoundary
- (CGSize)naturalSize {
  return cameraVideoSize;
}
- (CGAffineTransform)preferredTransform {
  return cameraVideoTransform;
}
@end
id CameraVideoTrack(void) { return [CameraTrackBoundary new]; }
@interface CameraAssetBoundary : NSObject
@property(nonatomic, readonly) CMTime duration;
@end
@implementation CameraAssetBoundary
- (CMTime)duration {
  return cameraVideoDuration;
}
- (void)loadTracksWithMediaType:(AVMediaType)type
              completionHandler:(void (^)(NSArray *, NSError *))completion {
  NSCAssert([type isEqual:AVMediaTypeVideo], @"video media contract");
  completion(cameraVideoTracks, cameraVideoError);
}
@end

static void swapClass(Class type, SEL selector, id block) {
  Method method = class_getClassMethod(type, selector);
  method_setImplementation(method, imp_implementationWithBlock(block));
}
void CameraInstallBoundaries(void) {
  Method method =
      class_getClassMethod(CIImage.class, @selector(imageWithCGImage:));
  auto image =
      (CIImage * (*)(id, SEL, CGImageRef)) method_getImplementation(method);
  swapClass(CIImage.class, @selector(imageWithCGImage:),
            ^CIImage *(id self, CGImageRef source) {
              if (cameraFault == CameraFaultDecodedImage)
                return nil;
              CIImage *decoded =
                  image(self, @selector(imageWithCGImage:), source);
              if (cameraFault != CameraFaultSubpixelExtent)
                cameraDecodedImage = decoded;
              return decoded;
            });
  method = class_getClassMethod(CIImage.class,
                                @selector(imageWithContentsOfURL:options:));
  auto fullImage = (CIImage * (*)(id, SEL, NSURL *, NSDictionary *))
      method_getImplementation(method);
  swapClass(CIImage.class, @selector(imageWithContentsOfURL:options:),
            ^CIImage *(id self, NSURL *url, NSDictionary *options) {
              if (cameraFault == CameraFaultFullImage)
                return nil;
              CIImage *decoded =
                  fullImage(self, @selector(imageWithContentsOfURL:options:),
                            url, options);
              cameraDecodedImage = decoded;
              return decoded;
            });
  method = class_getInstanceMethod(CIImage.class, @selector(extent));
  auto extent = (CGRect(*)(id, SEL))method_getImplementation(method);
  method_setImplementation(method,
                           imp_implementationWithBlock(^CGRect(id self) {
                             if (cameraFault == CameraFaultSubpixelExtent &&
                                 self == cameraDecodedImage)
                               return CGRectMake(0, 0, .1, .2);
                             if (cameraFault == CameraFaultEmptyExtent)
                               return CGRectZero;
                             if (cameraFault == CameraFaultInfiniteExtent)
                               return CGRectMake(0, 0, INFINITY, INFINITY);
                             if (cameraFault == CameraFaultHeightOverflow)
                               return CGRectMake(0, 0, DBL_MAX, INFINITY);
                             return extent(self, @selector(extent));
                           }));
  method = class_getClassMethod(NSJSONSerialization.class,
                                @selector(dataWithJSONObject:options:error:));
  auto json = (NSData * (*)(id, SEL, id, NSJSONWritingOptions, NSError **))
      method_getImplementation(method);
  swapClass(NSJSONSerialization.class,
            @selector(dataWithJSONObject:options:error:),
            ^NSData *(id self, id object, NSJSONWritingOptions options,
                      NSError **error) {
              if (cameraFault == CameraFaultJSON) {
                if (error)
                  *error = [NSError errorWithDomain:@"Encoder"
                                               code:1
                                           userInfo:nil];
                return nil;
              }
              return json(self, @selector(dataWithJSONObject:options:error:),
                          object, options, error);
            });
  method = class_getInstanceMethod(NSFileManager.class,
                                   @selector(removeItemAtURL:error:));
  auto remove =
      (BOOL(*)(id, SEL, NSURL *, NSError **))method_getImplementation(method);
  method_setImplementation(
      method,
      imp_implementationWithBlock(^BOOL(id self, NSURL *url, NSError **error) {
        if (cameraFault == CameraFaultRemove) {
          if (error)
            *error = [NSError errorWithDomain:NSCocoaErrorDomain
                                         code:NSFileWriteNoPermissionError
                                     userInfo:nil];
          return NO;
        }
        return remove(self, @selector(removeItemAtURL:error:), url, error);
      }));
  method = class_getInstanceMethod(
      CIContext.class, @selector
      (writeJPEGRepresentationOfImage:toURL:colorSpace:options:error:));
  auto write =
      (BOOL(*)(id, SEL, CIImage *, NSURL *, CGColorSpaceRef, NSDictionary *,
               NSError **))method_getImplementation(method);
  method_setImplementation(
      method,
      imp_implementationWithBlock(^BOOL(
          id self, CIImage *image, NSURL *url, CGColorSpaceRef colorSpace,
          NSDictionary *options, NSError **error) {
        cameraWriteSize = image.extent.size;
        if (cameraFault == CameraFaultWrite ||
            cameraFault == CameraFaultEncode) {
          if (error)
            *error = cameraFault == CameraFaultWrite
                         ? [NSError errorWithDomain:NSCocoaErrorDomain
                                               code:NSFileWriteNoPermissionError
                                           userInfo:nil]
                         : nil;
          return NO;
        }
        return write(self,
                     @selector
                     (writeJPEGRepresentationOfImage:
                                               toURL:colorSpace:options:error:),
                     image, url, colorSpace, options, error);
      }));
  method = class_getClassMethod(AVURLAsset.class, @selector(URLAssetWithURL:
                                                                    options:));
  auto asset = (AVURLAsset * (*)(id, SEL, NSURL *, NSDictionary *))
      method_getImplementation(method);
  swapClass(AVURLAsset.class, @selector(URLAssetWithURL:options:),
            ^AVURLAsset *(id self, NSURL *url, NSDictionary *options) {
              if (cameraUseVideoBoundary)
                return (AVURLAsset *)[CameraAssetBoundary new];
              return asset(self, @selector(URLAssetWithURL:options:), url,
                           options);
            });
  CameraResetBoundaries();
}
