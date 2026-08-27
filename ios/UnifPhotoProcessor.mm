#import "UnifPhotoProcessor.h"

#import <CoreGraphics/CoreGraphics.h>
#import <CoreImage/CoreImage.h>
#import <CoreText/CoreText.h>
#import <ImageIO/ImageIO.h>
#import <os/log.h>
#import <os/signpost.h>

static NSString *const EPhotoRead = @"E_PHOTO_READ";
static NSString *const EPhotoDecode = @"E_PHOTO_DECODE";
static NSString *const EPhotoAllocate = @"E_PHOTO_ALLOCATE";
static NSString *const EPhotoCrop = @"E_PHOTO_CROP";
static NSString *const EPhotoWatermark = @"E_PHOTO_WATERMARK";
static NSString *const EPhotoEncode = @"E_PHOTO_ENCODE";
static NSString *const EPhotoWrite = @"E_PHOTO_WRITE";

typedef struct {
  size_t rawWidth;
  size_t rawHeight;
  size_t displayWidth;
  size_t displayHeight;
  CGImagePropertyOrientation orientation;
} UnifPhotoMetadata;

static dispatch_queue_t UnifPhotoQueue(void) {
  static dispatch_queue_t queue;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    queue = dispatch_queue_create("com.unif.react-native-camera.photo", DISPATCH_QUEUE_SERIAL);
  });
  return queue;
}

static os_log_t UnifPhotoLog(void) {
  static os_log_t log;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    log = os_log_create("com.unif.react-native-camera", "PhotoProcessing");
  });
  return log;
}

static CIContext *UnifPhotoContext(void) {
  static CIContext *context;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    context = [CIContext contextWithOptions:@{
      kCIContextCacheIntermediates : @NO,
      // 旧修复已证明这条拍照链不能依赖 GPU offscreen readback；Core Image 仍固定 CPU
      // renderer，并把工作格式限制为最终 JPEG 所需的 8-bit RGBA，避免半浮点中间缓冲。
      kCIContextUseSoftwareRenderer : @YES,
      kCIContextWorkingFormat : @(kCIFormatRGBA8),
    }];
  });
  return context;
}

static NSString *UnifJSON(NSDictionary *value) {
  NSData *data = [NSJSONSerialization dataWithJSONObject:value options:0 error:nil];
  return data == nil ? nil : [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}

static BOOL UnifOrientationSwapsDimensions(CGImagePropertyOrientation orientation) {
  return orientation == kCGImagePropertyOrientationLeftMirrored ||
         orientation == kCGImagePropertyOrientationRight ||
         orientation == kCGImagePropertyOrientationRightMirrored ||
         orientation == kCGImagePropertyOrientationLeft;
}

static NSString *UnifOrientationName(CGImagePropertyOrientation orientation) {
  switch (orientation) {
  case kCGImagePropertyOrientationDown:
  case kCGImagePropertyOrientationDownMirrored:
    return @"down";
  case kCGImagePropertyOrientationLeftMirrored:
  case kCGImagePropertyOrientationRight:
    return @"right";
  case kCGImagePropertyOrientationRightMirrored:
  case kCGImagePropertyOrientationLeft:
    return @"left";
  default:
    return @"up";
  }
}

static BOOL UnifReadMetadata(NSString *path,
                             UnifPhotoMetadata *metadata,
                             NSString **failureCode) {
  NSURL *url = [NSURL fileURLWithPath:path];
  NSDictionary *sourceOptions = @{(__bridge NSString *)kCGImageSourceShouldCache : @NO};
  CGImageSourceRef source = CGImageSourceCreateWithURL((__bridge CFURLRef)url,
                                                        (__bridge CFDictionaryRef)sourceOptions);
  if (source == nil) {
    *failureCode = EPhotoRead;
    return NO;
  }
  CFDictionaryRef propertiesRef = CGImageSourceCopyPropertiesAtIndex(source, 0, NULL);
  CFRelease(source);
  if (propertiesRef == nil) {
    *failureCode = EPhotoRead;
    return NO;
  }
  NSDictionary *properties = CFBridgingRelease(propertiesRef);
  NSNumber *width = properties[(__bridge NSString *)kCGImagePropertyPixelWidth];
  NSNumber *height = properties[(__bridge NSString *)kCGImagePropertyPixelHeight];
  NSNumber *orientationValue = properties[(__bridge NSString *)kCGImagePropertyOrientation];
  if (width.unsignedLongLongValue == 0 || height.unsignedLongLongValue == 0) {
    *failureCode = EPhotoRead;
    return NO;
  }
  CGImagePropertyOrientation orientation =
      orientationValue == nil ? kCGImagePropertyOrientationUp
                              : (CGImagePropertyOrientation)orientationValue.unsignedIntValue;
  metadata->rawWidth = (size_t)width.unsignedLongLongValue;
  metadata->rawHeight = (size_t)height.unsignedLongLongValue;
  metadata->orientation = orientation;
  if (UnifOrientationSwapsDimensions(orientation)) {
    metadata->displayWidth = metadata->rawHeight;
    metadata->displayHeight = metadata->rawWidth;
  } else {
    metadata->displayWidth = metadata->rawWidth;
    metadata->displayHeight = metadata->rawHeight;
  }
  return YES;
}

static void UnifLogStage(NSString *stage, size_t width, size_t height) {
  os_log_info(UnifPhotoLog(), "stage=%{public}s size=%{public}zux%{public}zu",
              stage.UTF8String, width, height);
}

static CIImage *UnifCreateInputImage(NSString *path,
                                     UnifPhotoMetadata metadata,
                                     size_t targetWidth,
                                     size_t targetHeight,
                                     BOOL *sampled,
                                     NSString **failureCode) {
  NSURL *url = [NSURL fileURLWithPath:path];
  size_t targetMax = MAX(targetWidth, targetHeight);
  size_t sourceMax = MAX(metadata.displayWidth, metadata.displayHeight);
  if (sourceMax > targetMax) {
    *sampled = YES;
    NSDictionary *sourceOptions = @{(__bridge NSString *)kCGImageSourceShouldCache : @NO};
    CGImageSourceRef source = CGImageSourceCreateWithURL((__bridge CFURLRef)url,
                                                          (__bridge CFDictionaryRef)sourceOptions);
    if (source == nil) {
      *failureCode = EPhotoRead;
      return nil;
    }
    NSDictionary *thumbnailOptions = @{
      (__bridge NSString *)kCGImageSourceShouldCache : @NO,
      (__bridge NSString *)kCGImageSourceCreateThumbnailFromImageAlways : @YES,
      (__bridge NSString *)kCGImageSourceCreateThumbnailWithTransform : @YES,
      (__bridge NSString *)kCGImageSourceThumbnailMaxPixelSize : @(targetMax),
    };
    CGImageRef thumbnail = CGImageSourceCreateThumbnailAtIndex(
        source, 0, (__bridge CFDictionaryRef)thumbnailOptions);
    CFRelease(source);
    if (thumbnail == nil) {
      *failureCode = EPhotoDecode;
      return nil;
    }
    CIImage *image = [CIImage imageWithCGImage:thumbnail];
    CGImageRelease(thumbnail);
    return image;
  }

  *sampled = NO;
  CIImage *image = [CIImage imageWithContentsOfURL:url
                                          options:@{kCIImageApplyOrientationProperty : @YES}];
  if (image == nil) {
    *failureCode = EPhotoDecode;
  }
  return image;
}

static CGRect UnifCropRect(CGRect extent, NSString *aspectRatio) {
  CGFloat targetRatio = [aspectRatio isEqualToString:@"16:9"] ? 9.0 / 16.0 : 3.0 / 4.0;
  CGFloat sourceRatio = CGRectGetWidth(extent) / CGRectGetHeight(extent);
  if (sourceRatio > targetRatio) {
    CGFloat width = CGRectGetHeight(extent) * targetRatio;
    return CGRectMake(CGRectGetMidX(extent) - width / 2.0, CGRectGetMinY(extent),
                      width, CGRectGetHeight(extent));
  }
  CGFloat height = CGRectGetWidth(extent) / targetRatio;
  return CGRectMake(CGRectGetMinX(extent), CGRectGetMidY(extent) - height / 2.0,
                    CGRectGetWidth(extent), height);
}

static CTTextAlignment UnifTextAlignment(NSString *position) {
  if ([position hasSuffix:@"-left"]) return kCTTextAlignmentLeft;
  if ([position hasSuffix:@"-center"]) return kCTTextAlignmentCenter;
  return kCTTextAlignmentRight;
}

static CIImage *UnifWatermarkImage(NSDictionary *watermark,
                                   size_t outputWidth,
                                   size_t outputHeight,
                                   NSString **failureCode) {
  NSArray *rawLines = [watermark[@"content"] isKindOfClass:NSArray.class]
                          ? watermark[@"content"]
                          : nil;
  if (rawLines == nil) {
    *failureCode = EPhotoWatermark;
    return nil;
  }
  NSMutableArray<NSString *> *lines = [NSMutableArray arrayWithCapacity:rawLines.count];
  BOOL visible = NO;
  for (id value in rawLines) {
    NSString *line = [value isKindOfClass:NSString.class] ? value : [value description];
    [lines addObject:line ?: @""];
    if ([line stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet].length > 0) {
      visible = YES;
    }
  }
  if (!visible) return nil;

  NSString *position = [watermark[@"position"] isKindOfClass:NSString.class]
                           ? watermark[@"position"]
                           : @"top-right";
  NSString *text = [lines componentsJoinedByString:@"\n"];
  CGFloat shortSide = MIN(outputWidth, outputHeight);
  CGFloat fontSize = MAX(1, round(shortSide * 0.033));
  CGFloat lineHeight = MAX(fontSize, round(fontSize * 1.45));
  CGFloat padding = MAX(0, round(shortSide * 0.04));
  CGFloat paragraphWidth = MAX(1, MIN(round(outputWidth * 0.7), outputWidth - 2 * padding));

  CTFontRef normalFont = CTFontCreateUIFontForLanguage(kCTFontUIFontSystem, fontSize, NULL);
  CTFontRef emphasizedFont =
      CTFontCreateUIFontForLanguage(kCTFontUIFontEmphasizedSystem, fontSize, NULL);
  if (normalFont == nil) {
    *failureCode = EPhotoWatermark;
    return nil;
  }
  if (emphasizedFont == nil) {
    emphasizedFont = CTFontCreateCopyWithSymbolicTraits(
        normalFont, fontSize, NULL, kCTFontBoldTrait, kCTFontBoldTrait);
  }
  if (emphasizedFont == nil) emphasizedFont = (CTFontRef)CFRetain(normalFont);
  CGColorSpaceRef textColorSpace = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
  CGFloat whiteComponents[] = {1, 1, 1, 1};
  CGColorRef white = CGColorCreate(textColorSpace, whiteComponents);
  CGColorSpaceRelease(textColorSpace);
  CTTextAlignment alignment = UnifTextAlignment(position);
  CGFloat minLineHeight = lineHeight;
  CGFloat maxLineHeight = lineHeight;
  CTParagraphStyleSetting settings[] = {
      {kCTParagraphStyleSpecifierAlignment, sizeof(alignment), &alignment},
      {kCTParagraphStyleSpecifierMinimumLineHeight, sizeof(minLineHeight), &minLineHeight},
      {kCTParagraphStyleSpecifierMaximumLineHeight, sizeof(maxLineHeight), &maxLineHeight},
  };
  CTParagraphStyleRef paragraphStyle =
      CTParagraphStyleCreate(settings, sizeof(settings) / sizeof(settings[0]));
  NSMutableAttributedString *attributed =
      [[NSMutableAttributedString alloc] initWithString:text];
  NSRange fullRange = NSMakeRange(0, attributed.length);
  [attributed addAttribute:(__bridge NSString *)kCTFontAttributeName
                     value:(__bridge id)normalFont
                     range:fullRange];
  [attributed addAttribute:(__bridge NSString *)kCTForegroundColorAttributeName
                     value:(__bridge id)white
                     range:fullRange];
  [attributed addAttribute:(__bridge NSString *)kCTParagraphStyleAttributeName
                     value:(__bridge id)paragraphStyle
                     range:fullRange];
  NSRange newline = [text rangeOfString:@"\n"];
  NSUInteger firstLineLength = newline.location == NSNotFound ? text.length : newline.location;
  if (firstLineLength > 0) {
    [attributed addAttribute:(__bridge NSString *)kCTFontAttributeName
                       value:(__bridge id)emphasizedFont
                       range:NSMakeRange(0, firstLineLength)];
  }

  CTFramesetterRef framesetter =
      CTFramesetterCreateWithAttributedString((__bridge CFAttributedStringRef)attributed);
  CGSize constraints = CGSizeMake(paragraphWidth, MAX(1, outputHeight - 2 * padding));
  CGSize measured = CTFramesetterSuggestFrameSizeWithConstraints(
      framesetter, CFRangeMake(0, 0), NULL, constraints, NULL);
  size_t bitmapWidth = (size_t)ceil(paragraphWidth);
  size_t bitmapHeight = (size_t)MAX(1, ceil(MIN(measured.height, constraints.height)));
  CGColorSpaceRef colorSpace = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
  CGContextRef bitmap = CGBitmapContextCreate(
      NULL, bitmapWidth, bitmapHeight, 8, bitmapWidth * 4, colorSpace,
      (CGBitmapInfo)(kCGBitmapByteOrder32Big | kCGImageAlphaPremultipliedLast));
  CGColorSpaceRelease(colorSpace);
  if (bitmap == nil) {
    CFRelease(framesetter);
    CFRelease(paragraphStyle);
    CGColorRelease(white);
    CFRelease(emphasizedFont);
    CFRelease(normalFont);
    *failureCode = EPhotoAllocate;
    return nil;
  }
  CGFloat shadowBlur = MAX(2, round(fontSize * 0.1));
  CGColorSpaceRef shadowColorSpace = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
  CGFloat shadowComponents[] = {0, 0, 0, 0.7};
  CGColorRef shadow = CGColorCreate(shadowColorSpace, shadowComponents);
  CGColorSpaceRelease(shadowColorSpace);
  CGContextSetShadowWithColor(bitmap, CGSizeZero, shadowBlur, shadow);
  CGColorRelease(shadow);
  CGMutablePathRef path = CGPathCreateMutable();
  CGPathAddRect(path, NULL, CGRectMake(0, 0, bitmapWidth, bitmapHeight));
  CTFrameRef frame = CTFramesetterCreateFrame(framesetter, CFRangeMake(0, 0), path, NULL);
  CTFrameDraw(frame, bitmap);
  CGImageRef overlayRef = CGBitmapContextCreateImage(bitmap);
  CFRelease(frame);
  CGPathRelease(path);
  CGContextRelease(bitmap);
  CFRelease(framesetter);
  CFRelease(paragraphStyle);
  CGColorRelease(white);
  CFRelease(emphasizedFont);
  CFRelease(normalFont);
  if (overlayRef == nil) {
    *failureCode = EPhotoWatermark;
    return nil;
  }

  CIImage *overlay = [CIImage imageWithCGImage:overlayRef];
  CGImageRelease(overlayRef);
  CGFloat x;
  if ([position hasSuffix:@"-left"]) {
    x = padding;
  } else if ([position hasSuffix:@"-center"]) {
    x = (outputWidth - bitmapWidth) / 2.0;
  } else {
    x = outputWidth - padding - bitmapWidth;
  }
  CGFloat y = [position hasPrefix:@"bottom-"]
                  ? padding
                  : outputHeight - padding - bitmapHeight;
  return [overlay imageByApplyingTransform:CGAffineTransformMakeTranslation(x, y)];
}

static NSDictionary *UnifProcessPhoto(NSString *inputPath,
                                      NSString *outputPath,
                                      NSString *aspectRatio,
                                      size_t requestedTargetWidth,
                                      size_t requestedTargetHeight,
                                      NSInteger quality,
                                      NSString *watermarkJSON,
                                      NSString **failureCode,
                                      NSString **failureStage) {
  CFTimeInterval startedAt = CFAbsoluteTimeGetCurrent();
  UnifPhotoMetadata metadata = {};
  *failureStage = @"read";
  UnifLogStage(*failureStage, 0, 0);
  if (!UnifReadMetadata(inputPath, &metadata, failureCode)) return nil;

  size_t shortTarget = MIN(requestedTargetWidth, requestedTargetHeight);
  size_t longTarget = MAX(requestedTargetWidth, requestedTargetHeight);
  size_t targetWidth = metadata.displayWidth > metadata.displayHeight ? longTarget : shortTarget;
  size_t targetHeight = metadata.displayWidth > metadata.displayHeight ? shortTarget : longTarget;

  *failureStage = @"decode";
  UnifLogStage(*failureStage, metadata.displayWidth, metadata.displayHeight);
  BOOL sampled = NO;
  CIImage *input = UnifCreateInputImage(inputPath, metadata, targetWidth, targetHeight,
                                        &sampled, failureCode);
  if (input == nil) return nil;

  *failureStage = @"crop";
  CGRect crop = UnifCropRect(input.extent, aspectRatio);
  if (CGRectIsEmpty(crop) || !isfinite(crop.size.width) || !isfinite(crop.size.height)) {
    *failureCode = EPhotoCrop;
    return nil;
  }
  CGFloat scale = MIN(1.0, MIN(targetWidth / crop.size.width, targetHeight / crop.size.height));
  size_t outputWidth = (size_t)MAX(1, llround(crop.size.width * scale));
  size_t outputHeight = (size_t)MAX(1, llround(crop.size.height * scale));
  UnifLogStage(*failureStage, outputWidth, outputHeight);
  CIImage *result = [input imageByCroppingToRect:crop];
  result = [result imageByApplyingTransform:CGAffineTransformMakeTranslation(-crop.origin.x,
                                                                               -crop.origin.y)];
  if (scale != 1.0) {
    result = [result imageByApplyingTransform:CGAffineTransformMakeScale(scale, scale)];
  }
  result = [result imageByCroppingToRect:CGRectMake(0, 0, outputWidth, outputHeight)];

  NSDictionary *watermark = nil;
  if (watermarkJSON.length > 0 && ![watermarkJSON isEqualToString:@"null"]) {
    NSData *jsonData = [watermarkJSON dataUsingEncoding:NSUTF8StringEncoding];
    id value = jsonData == nil ? nil : [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:nil];
    if (![value isKindOfClass:NSDictionary.class]) {
      *failureCode = EPhotoWatermark;
      *failureStage = @"watermark";
      return nil;
    }
    watermark = value;
  }
  if (watermark != nil) {
    *failureStage = @"watermark";
    UnifLogStage(*failureStage, outputWidth, outputHeight);
    CIImage *overlay = UnifWatermarkImage(watermark, outputWidth, outputHeight, failureCode);
    if (overlay == nil && *failureCode != nil) return nil;
    if (overlay != nil) result = [overlay imageByCompositingOverImage:result];
  }

  *failureStage = @"write";
  UnifLogStage(@"encode", outputWidth, outputHeight);
  NSURL *outputURL = [NSURL fileURLWithPath:outputPath];
  NSError *removeError = nil;
  if ([[NSFileManager defaultManager] fileExistsAtPath:outputPath] &&
      ![[NSFileManager defaultManager] removeItemAtURL:outputURL error:&removeError]) {
    *failureCode = EPhotoWrite;
    return nil;
  }
  CGColorSpaceRef colorSpace = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
  NSError *writeError = nil;
  BOOL written = [UnifPhotoContext()
      writeJPEGRepresentationOfImage:result
                               toURL:outputURL
                          colorSpace:colorSpace
                             options:@{
                               (__bridge NSString *)kCGImageDestinationLossyCompressionQuality :
                                   @(MAX(0, MIN(100, quality)) / 100.0)
                             }
                               error:&writeError];
  CGColorSpaceRelease(colorSpace);
  if (!written) {
    *failureCode = writeError == nil ? EPhotoEncode : EPhotoWrite;
    return nil;
  }

  double durationMs = (CFAbsoluteTimeGetCurrent() - startedAt) * 1000.0;
  os_log_info(UnifPhotoLog(),
              "stage=complete input=%{public}zux%{public}zu output=%{public}zux%{public}zu "
              "sampled=%{public}s durationMs=%{public}.1f",
              metadata.displayWidth, metadata.displayHeight, outputWidth, outputHeight,
              sampled ? "true" : "false", durationMs);
  return @{
    @"width" : @(outputWidth),
    @"height" : @(outputHeight),
    @"diagnostics" : @{
      @"inputWidth" : @(metadata.displayWidth),
      @"inputHeight" : @(metadata.displayHeight),
      @"outputWidth" : @(outputWidth),
      @"outputHeight" : @(outputHeight),
      @"sampled" : @(sampled),
      @"durationMs" : @(durationMs),
    },
  };
}

@implementation UnifPhotoProcessor

RCT_EXPORT_MODULE(UnifPhotoProcessor)

- (void)inspectPhotoFile:(NSString *)inputPath
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(UnifPhotoQueue(), ^{
    @autoreleasepool {
      NSString *failureCode = nil;
      UnifPhotoMetadata metadata = {};
      if (!UnifReadMetadata(inputPath, &metadata, &failureCode)) {
        reject(failureCode ?: EPhotoRead, @"Photo metadata inspection failed", nil);
        return;
      }
      NSString *json = UnifJSON(@{
        @"width" : @(metadata.displayWidth),
        @"height" : @(metadata.displayHeight),
        @"orientation" : UnifOrientationName(metadata.orientation),
      });
      if (json == nil) {
        reject(EPhotoRead, @"Photo metadata inspection failed", nil);
        return;
      }
      resolve(json);
    }
  });
}

- (void)processPhoto:(NSString *)inputPath
           outputPath:(NSString *)outputPath
          aspectRatio:(NSString *)aspectRatio
          targetWidth:(double)targetWidth
         targetHeight:(double)targetHeight
              quality:(double)quality
        watermarkJson:(NSString *)watermarkJson
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(UnifPhotoQueue(), ^{
    @autoreleasepool {
      os_signpost_id_t signpost = os_signpost_id_generate(UnifPhotoLog());
      os_signpost_interval_begin(UnifPhotoLog(), signpost, "PhotoProcessing");
      NSString *failureCode = nil;
      NSString *failureStage = @"read";
      NSDictionary *result = nil;
      @try {
        result = UnifProcessPhoto(inputPath, outputPath, aspectRatio,
                                  (size_t)MAX(1, llround(targetWidth)),
                                  (size_t)MAX(1, llround(targetHeight)),
                                  (NSInteger)llround(quality), watermarkJson,
                                  &failureCode, &failureStage);
      } @catch (__unused NSException *exception) {
        failureCode = failureCode ?: EPhotoDecode;
      }
      os_signpost_interval_end(UnifPhotoLog(), signpost, "PhotoProcessing",
                               "stage=%{public}s", failureStage.UTF8String);
      if (result == nil) {
        os_log_error(UnifPhotoLog(), "stage=%{public}s failed", failureStage.UTF8String);
        [[NSFileManager defaultManager] removeItemAtPath:outputPath error:nil];
        reject(failureCode ?: EPhotoDecode,
               [NSString stringWithFormat:@"Photo processing failed during %@", failureStage],
               nil);
        return;
      }
      NSString *json = UnifJSON(result);
      if (json == nil) {
        [[NSFileManager defaultManager] removeItemAtPath:outputPath error:nil];
        reject(EPhotoEncode, @"Photo processing failed during encode", nil);
        return;
      }
      resolve(json);
    }
  });
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativePhotoProcessorSpecJSI>(params);
}

@end
