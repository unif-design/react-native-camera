import type { CustomPhotoFile, CameraModeName } from '../../utils';

// CustomPhotoFile 工厂:各测试此前各自内联一份(命名 photo()/f()/内联对象),默认值/字段略有差异。
// 收敛成一个参数化工厂,保留「后置单拍 jpeg」默认,所有差异(mode、width/height、duration…)走 overrides。

// id 缺省自增,避免同测试内多次调用撞 id(等价原各工厂里手动传不同 id)。
let seq = 0;

/**
 * 造一个 CustomPhotoFile。
 * - 默认:后置(back)单拍(single)jpeg。
 * - `id` 缺省自增(`f-0`/`f-1`…),防同测试多次调用撞 id;需固定 id 时显式传。
 * - `mode` 与 `cameraMode` 同步:传任一即两者同值(传两者以显式值为准,正常无需都传)。
 * - `mime` 缺省随 mode 推导(video → `video/mp4`,否则 `image/jpeg`);显式传 `mime` 覆盖。
 */
export function makePhotoFile(
  overrides: Partial<CustomPhotoFile> = {}
): CustomPhotoFile {
  // mode/cameraMode 同步:任一传入即作为两者的值(都传则各自的显式值生效)。
  const resolvedMode: CameraModeName =
    overrides.mode ?? overrides.cameraMode ?? 'single';
  const id = overrides.id ?? `f-${seq++}`;
  return {
    id,
    cameraType: 'back',
    cameraMode: resolvedMode,
    path: `/${id}.jpg`,
    uri: `file:///${id}.jpg`,
    width: 1,
    height: 1,
    mime: resolvedMode === 'video' ? 'video/mp4' : 'image/jpeg',
    mode: resolvedMode,
    ...overrides,
  };
}
