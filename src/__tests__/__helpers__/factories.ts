import type { CapturedFile, CameraCaptureMode } from '../../utils';

// CapturedFile 工厂:各测试此前各自内联一份(命名 photo()/f()/内联对象),默认值/字段略有差异。
// 收敛成一个参数化工厂,保留「后置单拍 jpeg」默认,所有差异(mode、width/height、duration…)走 overrides。

// id 缺省自增,避免同测试内多次调用撞 id(等价原各工厂里手动传不同 id)。
let seq = 0;

/**
 * 造一个 CapturedFile。
 * - 默认:后置(back)单拍(single)jpeg。
 * - `id` 缺省自增(`f-0`/`f-1`…),防同测试多次调用撞 id;需固定 id 时显式传。
 * - `mimeType` 缺省随 mode 推导(video → `video/mp4`,否则 `image/jpeg`);显式传 `mimeType` 覆盖。
 */
export function makePhotoFile(
  overrides: Partial<CapturedFile> = {}
): CapturedFile {
  const resolvedMode: CameraCaptureMode = overrides.mode ?? 'single';
  const id = overrides.id ?? `f-${seq++}`;
  return {
    id,
    facing: 'back',
    path: `/${id}.jpg`,
    uri: `file:///${id}.jpg`,
    width: 1,
    height: 1,
    mimeType: resolvedMode === 'video' ? 'video/mp4' : 'image/jpeg',
    mode: resolvedMode,

    ...overrides,
  };
}
