import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** 仅供相机内部使用的文件级照片处理 TurboModule。公开入口仍只有 useCamera()。 */
export interface Spec extends TurboModule {
  inspectPhotoFile(inputPath: string): Promise<string>;

  processPhoto(
    inputPath: string,
    outputPath: string,
    aspectRatio: string,
    targetWidth: number,
    targetHeight: number,
    quality: number,
    watermarkJson: string
  ): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('UnifPhotoProcessor');
