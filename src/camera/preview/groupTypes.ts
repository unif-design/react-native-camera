import type { CustomPhotoFile, CameraModeName } from '../../utils';

/** 拍摄模式的中文文案(单一来源):预览类型 tab(PreviewTopBar)与取景模式行(Container ModeSwitcherPill)共用。 */
export const MODE_LABEL: Record<CameraModeName, string> = {
  continuous: '连拍',
  single: '单拍',
  video: '视频',
};

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
