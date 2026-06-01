import { distinctTypes, filesOfType } from './groupTypes';
import type { CustomPhotoFile } from '../../utils';

const f = (
  cameraMode: CustomPhotoFile['cameraMode'],
  id: string
): CustomPhotoFile => ({
  id,
  cameraType: 'back',
  cameraMode,
  path: `/${id}.jpg`,
  uri: `file:///${id}.jpg`,
  width: 1,
  height: 1,
  mime: cameraMode === 'video' ? 'video/mp4' : 'image/jpeg',
  mode: cameraMode,
});

it('distinctTypes 按 连拍/单拍/视频 顺序去重', () => {
  const files = [
    f('single', 'a'),
    f('video', 'b'),
    f('single', 'c'),
    f('continuous', 'd'),
  ];
  expect(distinctTypes(files)).toEqual(['continuous', 'single', 'video']);
  expect(distinctTypes([f('single', 'a')])).toEqual(['single']);
  expect(distinctTypes([])).toEqual([]);
});

it('filesOfType 过滤', () => {
  const files = [f('single', 'a'), f('video', 'b'), f('single', 'c')];
  expect(filesOfType(files, 'single').map((x) => x.id)).toEqual(['a', 'c']);
});
