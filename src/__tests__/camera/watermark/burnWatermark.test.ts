import { burnWatermark } from '../../../camera/watermark/burnWatermark';
import type { CustomPhotoFile, WatermarkType } from '../../../utils';

const photo = (): CustomPhotoFile => ({
  id: '1',
  cameraType: 'back',
  cameraMode: 'single',
  path: '/a.jpg',
  uri: 'file:///a.jpg',
  width: 1080,
  height: 1440,
  mime: 'image/jpeg',
  mode: 'single',
});
const wm: WatermarkType = { content: ['L1', 'L2'], position: 'top-right' };

it('composites and returns a new path', async () => {
  const out = await burnWatermark(photo(), wm);
  expect(out.path).not.toBe('/a.jpg');
  expect(out.uri.startsWith('file://')).toBe(true);
  expect(out.id).toBe('1'); // 其余字段保留
});

it('falls back to original file on error', async () => {
  const skia = require('@shopify/react-native-skia');
  skia.Skia.Image.MakeImageFromEncoded.mockReturnValueOnce(null); // 解码失败
  const p = photo();
  const out = await burnWatermark(p, wm);
  expect(out).toBe(p); // 兜底原图
});
