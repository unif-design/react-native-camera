import { burnWatermark } from '../../../camera/watermark/burnWatermark';
import type { WatermarkType } from '../../../utils';
import { makePhotoFile } from '../../__helpers__/factories';

const photo = () =>
  makePhotoFile({
    id: '1',
    path: '/a.jpg',
    uri: 'file:///a.jpg',
    width: 1080,
    height: 1440,
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

it('首个 snapshot dispose 抛错时仍按逆序尝试其余清理且保留成功结果', async () => {
  const skia = require('@shopify/react-native-skia');
  const order: string[] = [];
  const data = { dispose: jest.fn(() => order.push('data')) };
  const image = {
    width: () => 1080,
    height: () => 1440,
    dispose: jest.fn(() => order.push('image')),
  };
  const paragraph = {
    layout: jest.fn(),
    paint: jest.fn(),
    getHeight: jest.fn(() => 120),
    dispose: jest.fn(() => order.push('paragraph')),
  };
  const builder: Record<string, jest.Mock> = {};
  builder.pushStyle = jest.fn(() => builder);
  builder.addText = jest.fn(() => builder);
  builder.pop = jest.fn(() => builder);
  builder.reset = jest.fn(() => builder);
  builder.build = jest.fn(() => paragraph);
  builder.dispose = jest.fn(() => order.push('builder'));
  const snapshot = {
    encodeToBase64: jest.fn(() => 'OUT'),
    dispose: jest.fn(() => {
      order.push('snapshot');
      throw new Error('snapshot dispose failed');
    }),
  };
  const surface = {
    getCanvas: () => ({ drawImage: jest.fn() }),
    makeImageSnapshot: () => snapshot,
    dispose: jest.fn(() => order.push('surface')),
  };
  skia.Skia.Data.fromBase64.mockReturnValueOnce(data);
  skia.Skia.Image.MakeImageFromEncoded.mockReturnValueOnce(image);
  skia.Skia.ParagraphBuilder.Make.mockReturnValueOnce(builder);
  skia.Skia.Surface.MakeOffscreen.mockReturnValueOnce(surface);

  await expect(burnWatermark(photo(), wm)).resolves.toMatchObject({
    path: '/tmp/wm_1.jpg',
  });
  expect(order).toEqual([
    'snapshot',
    'paragraph',
    'builder',
    'surface',
    'image',
    'data',
  ]);
});
