import type {
  CameraPhotoOutput,
  CapturePhotoSettings,
  CameraOrientation,
} from 'react-native-vision-camera';

export type CapturedPhotoRaw = {
  path: string;
  width: number;
  height: number;
  orientation: CameraOrientation;
};

/**
 * 5.x 拍照标准序列：
 *   1. await photoOutput.capturePhoto(settings, {})
 *   2. await photo.saveToTemporaryFileAsync()
 *   3. 读 photo.width / photo.height / photo.orientation
 *   4. photo.dispose() (try/finally 保护)
 */
export async function capturePhotoToFile(
  photoOutput: CameraPhotoOutput,
  settings: CapturePhotoSettings
): Promise<CapturedPhotoRaw> {
  const photo = await photoOutput.capturePhoto(settings, {});
  try {
    const path = await photo.saveToTemporaryFileAsync();
    return {
      path,
      width: photo.width,
      height: photo.height,
      orientation: photo.orientation,
    };
  } finally {
    photo.dispose();
  }
}
