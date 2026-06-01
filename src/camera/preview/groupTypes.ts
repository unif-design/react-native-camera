import type { CustomPhotoFile, CameraModeName } from '../../utils';

const ORDER: CameraModeName[] = ['continuous', 'single', 'video'];

export function distinctTypes(files: CustomPhotoFile[]): CameraModeName[] {
  const present = new Set(files.map((f) => f.cameraMode));
  return ORDER.filter((t) => present.has(t));
}

export function filesOfType(
  files: CustomPhotoFile[],
  type: CameraModeName
): CustomPhotoFile[] {
  return files.filter((f) => f.cameraMode === type);
}
