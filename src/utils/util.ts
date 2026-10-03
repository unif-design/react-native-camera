import type {
  CapturedFile,
  CameraCaptureMode,
  CameraFacing,
  CameraCancelled,
  RawCapturedFile,
} from './types';
export function cancelledResult(): CameraCancelled {
  return { status: 'cancelled' };
}
export function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}
let photoIdCounter = 0;
export function buildPhotoFile(
  raw: RawCapturedFile,
  mode: CameraCaptureMode,
  facing: CameraFacing,
  isVideo = false
): CapturedFile {
  return {
    id: `${Date.now()}-${photoIdCounter++}`,
    path: raw.path,
    uri: toFileUri(raw.path),
    mode,
    facing,
    mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
    width: raw.width,
    height: raw.height,
    ...(raw.durationMs === undefined ? {} : { durationMs: raw.durationMs }),
  };
}
