import { needsPhotoFileProcessing } from '../../../camera/image/photoResolution';

function jpeg(width: number, height: number) {
  return { mime: 'image/jpeg' as const, width, height };
}

it('允许目标尺寸的一像素协商取整误差直接返回文件', () => {
  expect(needsPhotoFileProcessing(jpeg(1440, 1919), '4:3', false)).toBe(false);
});

it('画幅超过一像素协商误差时进入文件处理', () => {
  expect(needsPhotoFileProcessing(jpeg(1440, 1918), '4:3', false)).toBe(true);
});

it.each([
  [3000, 4000],
  [4000, 3000],
] as const)('超目标尺寸 %sx%s 即使画幅准确也必须下采样', (width, height) => {
  expect(needsPhotoFileProcessing(jpeg(width, height), '4:3', false)).toBe(
    true
  );
});
