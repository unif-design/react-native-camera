import type { CustomPhotoFile, CameraModeName } from './interface';

export function toFileUri(path: string): string {
  if (path.startsWith('file://')) return path;
  return `file://${path}`;
}

export function buildPhotoFile(
  raw: { path: string; width: number; height: number; duration?: number },
  mode: CameraModeName,
  isVideo: boolean = false
): CustomPhotoFile {
  return {
    path: raw.path,
    uri: toFileUri(raw.path),
    width: raw.width,
    height: raw.height,
    mime: isVideo ? 'video/mp4' : 'image/jpeg',
    mode,
    ...(raw.duration != null ? { duration: raw.duration } : {}),
  };
}
