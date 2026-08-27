import type { AspectRatio, CustomPhotoFile } from '../../utils';

export type PhotoTargetResolution = {
  width: number;
  height: number;
};

/** VisionCamera CommonResolutions.FHD_* 的稳定像素契约。 */
export const PHOTO_TARGET_RESOLUTIONS: Record<
  AspectRatio,
  PhotoTargetResolution
> = {
  '4:3': { width: 1440, height: 1920 },
  '16:9': { width: 1080, height: 1920 },
};

export function orientedPhotoTarget(
  aspectRatio: AspectRatio,
  width: number,
  height: number
): PhotoTargetResolution {
  const portrait = PHOTO_TARGET_RESOLUTIONS[aspectRatio];
  return width > height
    ? { width: portrait.height, height: portrait.width }
    : portrait;
}

function hasTargetAspect(
  width: number,
  height: number,
  target: PhotoTargetResolution
): boolean {
  if (width <= 0 || height <= 0) return false;
  // 协商尺寸可能有一像素取整误差；用交叉乘积避免浮点比例放大误判。
  return (
    Math.abs(width * target.height - height * target.width) <=
    Math.max(width, height)
  );
}

export function needsPhotoFileProcessing(
  raw: Pick<CustomPhotoFile, 'mime' | 'width' | 'height'>,
  aspectRatio: AspectRatio,
  hasWatermark: boolean
): boolean {
  if (raw.mime !== 'image/jpeg') return false;
  if (hasWatermark) return true;
  const target = orientedPhotoTarget(aspectRatio, raw.width, raw.height);
  return (
    !hasTargetAspect(raw.width, raw.height, target) ||
    raw.width > target.width ||
    raw.height > target.height
  );
}
