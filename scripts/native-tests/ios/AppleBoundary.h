#import <AVFoundation/AVFoundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <CoreImage/CoreImage.h>
#import <CoreText/CoreText.h>
#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>

typedef NS_ENUM(NSInteger, CameraFault) {
  CameraFaultNone,
  CameraFaultSourceSecondRead,
  CameraFaultProperties,
  CameraFaultWidthZero,
  CameraFaultHeightZero,
  CameraFaultOrientationMissing,
  CameraFaultThumbnail,
  CameraFaultDecodedImage,
  CameraFaultFullImage,
  CameraFaultEmptyExtent,
  CameraFaultInfiniteExtent,
  CameraFaultHeightOverflow,
  CameraFaultNormalFont,
  CameraFaultEmphasizedFont,
  CameraFaultAllBoldFonts,
  CameraFaultBitmap,
  CameraFaultOverlay,
  CameraFaultRemove,
  CameraFaultWrite,
  CameraFaultEncode,
  CameraFaultJSON,
  CameraFaultException,
  CameraFaultSubpixelExtent,
  CameraFaultTextNoFit
};
extern CameraFault cameraFault;
extern BOOL cameraUseVideoBoundary;
extern NSArray *cameraVideoTracks;
extern NSError *cameraVideoError;
extern CGSize cameraVideoSize;
extern CGAffineTransform cameraVideoTransform;
extern CMTime cameraVideoDuration;
extern CGSize cameraWriteSize;
void CameraInstallBoundaries(void);
void CameraResetBoundaries(void);
CGImageSourceRef CameraImageSourceCreate(CFURLRef, CFDictionaryRef);
CFDictionaryRef CameraImageProperties(CGImageSourceRef, size_t,
                                      CFDictionaryRef);
CGImageRef CameraThumbnail(CGImageSourceRef, size_t, CFDictionaryRef);
CTFontRef CameraFont(CTFontUIFontType, CGFloat, CFStringRef);
CTFontRef CameraBoldFont(CTFontRef, CGFloat, const CGAffineTransform *,
                         CTFontSymbolicTraits, CTFontSymbolicTraits);
CGContextRef CameraBitmap(void *, size_t, size_t, size_t, size_t,
                          CGColorSpaceRef, uint32_t);
CGImageRef CameraOverlay(CGContextRef);
CGSize CameraTextSize(CTFramesetterRef, CFRange, CFDictionaryRef, CGSize,
                      CFRange *);
id CameraVideoTrack(void);

#ifdef UNIF_CAMERA_TEST_BOUNDARIES
// Only system C API call sites in the unchanged production translation unit are
// redirected. The boundary implementation calls the real frameworks by default.
#define CGImageSourceCreateWithURL CameraImageSourceCreate
#define CGImageSourceCopyPropertiesAtIndex CameraImageProperties
#define CGImageSourceCreateThumbnailAtIndex CameraThumbnail
#define CTFontCreateUIFontForLanguage CameraFont
#define CTFontCreateCopyWithSymbolicTraits CameraBoldFont
#define CGBitmapContextCreate CameraBitmap
#define CGBitmapContextCreateImage CameraOverlay
#define CTFramesetterSuggestFrameSizeWithConstraints CameraTextSize
#endif
