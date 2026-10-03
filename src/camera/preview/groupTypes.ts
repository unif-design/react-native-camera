import type { CapturedFile, CameraCaptureMode } from '../../utils';

/** 拍摄模式的中文文案(单一来源):预览类型 tab(PreviewTopBar)与取景模式行(Container ModeSwitcherPill)共用。 */
export const MODE_LABEL: Record<CameraCaptureMode, string> = {
  continuous: '连拍',
  single: '单拍',
  video: '视频',
};

const ORDER: CameraCaptureMode[] = ['continuous', 'single', 'video'];

export function distinctTypes(files: CapturedFile[]): CameraCaptureMode[] {
  const present = new Set(files.map((f) => f.mode));
  return ORDER.filter((t) => present.has(t));
}

export function filesOfType(
  files: CapturedFile[],
  type: CameraCaptureMode
): CapturedFile[] {
  return files.filter((f) => f.mode === type);
}
