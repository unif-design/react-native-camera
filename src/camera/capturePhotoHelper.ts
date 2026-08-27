import type {
  CameraPhotoOutput,
  CapturePhotoSettings,
  CameraOrientation,
} from 'react-native-vision-camera';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { inspectPhotoFile } from './image/nativePhotoProcessor';

export type CapturedPhotoRaw = {
  path: string;
  width: number;
  height: number;
  orientation: CameraOrientation;
};

/**
 * VisionCamera 5.x 文件路径：capturePhotoToFile() 直接产出临时 JPEG；随后只读
 * ImageIO/BitmapFactory 文件头得到方向与尺寸，不创建 JS 持有的原生 Photo。
 *
 * 命名为 captureToTempFile（而非 capturePhotoToFile）以避开与 native
 * CameraPhotoOutput.capturePhotoToFile 的同名混淆。
 */
export async function captureToTempFile(
  photoOutput: CameraPhotoOutput,
  settings: CapturePhotoSettings
): Promise<CapturedPhotoRaw> {
  const { filePath } = await photoOutput.capturePhotoToFile(settings, {});
  try {
    const metadata = await inspectPhotoFile(filePath);
    return { path: filePath, ...metadata };
  } catch (error) {
    try {
      await RNFS.unlink(filePath);
    } catch {
      // 文件尚未交给 session registry；清理失败只做无敏感信息诊断，不能遮蔽元数据错误。
      console.warn('captured photo cleanup failed');
    }
    throw error;
  }
}
