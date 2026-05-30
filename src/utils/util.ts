import type { CustomPhotoFile, CameraModeName, CameraType } from './interface';

export function toFileUri(path: string): string {
  if (path.startsWith('file://')) return path;
  return `file://${path}`;
}

// 单调递增计数器,保证同毫秒多张照片 id 不撞(原版用纯时间戳有撞 id 风险)。
let photoIdCounter = 0;

export function buildPhotoFile(
  raw: { path: string; width: number; height: number; duration?: number },
  mode: CameraModeName,
  cameraType: CameraType,
  isVideo: boolean = false
): CustomPhotoFile {
  return {
    id: `${Date.now()}-${photoIdCounter++}`,
    cameraType,
    cameraMode: mode,
    path: raw.path,
    uri: toFileUri(raw.path),
    width: raw.width,
    height: raw.height,
    mime: isVideo ? 'video/mp4' : 'image/jpeg',
    mode,
    ...(raw.duration != null ? { duration: raw.duration } : {}),
  };
}
