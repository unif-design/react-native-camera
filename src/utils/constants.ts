import type {
  CameraCaptureMode,
  CameraFacing,
  CameraFlash,
  CameraPhotoMode,
  CameraWatermark,
} from './types';
export const CAMERA_MODES: readonly CameraCaptureMode[] = [
  'single',
  'continuous',
  'video',
];
export const CAMERA_FACINGS: readonly CameraFacing[] = ['front', 'back'];
export const CAMERA_FLASHES: readonly CameraFlash[] = ['auto', 'on', 'off'];
export const CAMERA_QUALITY_PRIORITIES: readonly NonNullable<
  CameraPhotoMode['qualityPriority']
>[] = ['speed', 'balanced', 'quality'];
export const CAMERA_WATERMARK_POSITIONS: readonly NonNullable<
  CameraWatermark['position']
>[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

// Android MediaRecorder/编码器使用有符号 32 位整数码率。
export const MAX_VIDEO_BIT_RATE = 2_147_483_647;
