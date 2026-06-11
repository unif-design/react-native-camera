import { cropToRatio } from '../../../camera/watermark/cropToRatio';
import { makePhotoFile } from '../../__helpers__/factories';

// jest.setup 已桩 fs(读写内存)+ Skia(MakeImageFromEncoded → 1080×1440 图)。按桩尺寸断言。
const photo = () =>
  makePhotoFile({
    id: '1',
    path: '/a.jpg',
    uri: 'file:///a.jpg',
    width: 1080,
    height: 1440,
  });

it('16:9 居中裁切:等高裁宽,尺寸/路径正确,其余字段保留', async () => {
  const out = await cropToRatio(photo(), '16:9');
  // 桩图 1080×1440(竖屏 4:3)→ 竖屏 9:16:等高裁宽 cropW = round(1440*9/16) = 810、高不变 1440。
  expect(out.width).toBe(810);
  expect(out.height).toBe(1440);
  expect(out.width / out.height).toBeCloseTo(9 / 16, 5);
  // 换了 path/uri(写到临时文件),id 等其余字段保留。
  expect(out.path).not.toBe('/a.jpg');
  expect(out.uri.startsWith('file://')).toBe(true);
  expect(out.id).toBe('1');
  expect(out.mime).toBe('image/jpeg');
});

it('drawImageRect 用居中 srcRect 裁(offsetX = (1080-810)/2 = 135、offsetY = 0)', async () => {
  const skia = require('@shopify/react-native-skia');
  // XYWHRect 桩需记录入参 → 临时替换为 jest.fn 透传(本测试内,afterEach 还原)。
  const orig = skia.Skia.XYWHRect;
  const rects: number[][] = [];
  skia.Skia.XYWHRect = jest.fn((x: number, y: number, w: number, h: number) => {
    rects.push([x, y, w, h]);
    return { x, y, width: w, height: h };
  });
  try {
    await cropToRatio(photo(), '16:9');
    // 第一个 rect = src(居中裁)、第二个 = dst(从 0,0 满铺)。
    expect(rects[0]).toEqual([135, 0, 810, 1440]);
    expect(rects[1]).toEqual([0, 0, 810, 1440]);
  } finally {
    skia.Skia.XYWHRect = orig;
  }
});

it('解码失败 → 兜底返回原图(绝不阻断保存)', async () => {
  const skia = require('@shopify/react-native-skia');
  skia.Skia.Image.MakeImageFromEncoded.mockReturnValueOnce(null);
  const p = photo();
  const out = await cropToRatio(p, '16:9');
  expect(out).toBe(p);
});

it('离屏 surface 分配失败 → 兜底返回原图', async () => {
  const skia = require('@shopify/react-native-skia');
  skia.Skia.Surface.MakeOffscreen.mockReturnValueOnce(null);
  const p = photo();
  const out = await cropToRatio(p, '16:9');
  expect(out).toBe(p);
});

it('成功后 Skia 原生对象被 dispose(逆序释放,防 OOM)', async () => {
  const skia = require('@shopify/react-native-skia');
  // 用带 jest.fn dispose 的一次性桩覆盖 image/data/surface/snapshot,断言都被 dispose。
  const imgDispose = jest.fn();
  const dataDispose = jest.fn();
  const surfDispose = jest.fn();
  const snapDispose = jest.fn();
  const snapshot = {
    encodeToBase64: jest.fn(() => 'OUT'),
    dispose: snapDispose,
  };
  const surface = {
    getCanvas: () => ({ drawImageRect: jest.fn() }),
    makeImageSnapshot: () => snapshot,
    dispose: surfDispose,
  };
  skia.Skia.Image.MakeImageFromEncoded.mockReturnValueOnce({
    width: () => 1080,
    height: () => 1440,
    dispose: imgDispose,
  });
  skia.Skia.Data.fromBase64.mockReturnValueOnce({ dispose: dataDispose });
  skia.Skia.Surface.MakeOffscreen.mockReturnValueOnce(surface);

  await cropToRatio(photo(), '16:9');
  expect(snapDispose).toHaveBeenCalled();
  expect(surfDispose).toHaveBeenCalled();
  expect(imgDispose).toHaveBeenCalled();
  expect(dataDispose).toHaveBeenCalled();
});
