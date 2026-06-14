import type {
  CustomPhotoFile,
  CameraModeName,
  CameraType,
  CameraResult,
} from './interface';

/** 取消/关闭的标准结果(code 0、空 data)。统一各处散落的 `{code:0,data:[],message:'cancelled'}` 字面量。 */
export function cancelledResult(): CameraResult {
  return { code: 0, data: [], message: 'cancelled' };
}

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
    isRemake: false,
    ...(raw.duration != null ? { duration: raw.duration } : {}),
  };
}
