import RNFS from 'react-native-fs';
import { Skia, ImageFormat } from '@shopify/react-native-skia';
import type { SkData, SkImage, SkSurface } from '@shopify/react-native-skia';
import type { CustomPhotoFile, WatermarkType } from '../../utils';
import { toFileUri } from '../../utils';
import { computeWatermarkLayout } from './layout';

/**
 * 把水印烧进照片:读字节 → Skia 解码 → 离屏全分辨率 surface 画原图 + 逐行画水印
 * → 编码 JPEG → fs 写临时文件 → 返回换了 path/uri 的新 file。
 * 任何异常(解码/离屏分配失败、读写出错)都返回**原 file**,绝不阻断保存。
 * Skia 对象是 C++ 包装,finally 里 dispose 释放原生内存,避免全分辨率大图反复烧后增长/OOM。
 */
export async function burnWatermark(
  file: CustomPhotoFile,
  wm: WatermarkType
): Promise<CustomPhotoFile> {
  let data: SkData | null = null;
  let image: SkImage | null = null;
  let surface: SkSurface | null = null;
  let snapshot: SkImage | null = null;
  try {
    const base64 = await RNFS.readFile(file.path, 'base64');
    data = Skia.Data.fromBase64(base64);
    image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) return file;
    const w = image.width();
    const h = image.height();
    surface = Skia.Surface.MakeOffscreen(w, h);
    if (!surface) return file;
    const canvas = surface.getCanvas();
    canvas.drawImage(image, 0, 0);

    const L = computeWatermarkLayout(w, wm);
    const font = Skia.Font(undefined, L.fontSize);
    const paint = Skia.Paint();
    paint.setColor(Skia.Color('white'));

    const lineH = L.fontSize + L.lineGap;
    const startY =
      L.anchorY === 'top'
        ? L.pad + L.fontSize
        : h - L.pad - (L.content.length - 1) * lineH;
    L.content.forEach((line, i) => {
      const tw = font.measureText(line).width;
      const x =
        L.align === 'left'
          ? L.pad
          : L.align === 'right'
            ? w - L.pad - tw
            : (w - tw) / 2;
      canvas.drawText(line, x, startY + i * lineH, paint, font);
    });

    snapshot = surface.makeImageSnapshot();
    const outB64 = snapshot.encodeToBase64(ImageFormat.JPEG, 92);
    const outPath = `${RNFS.TemporaryDirectoryPath}/wm_${file.id}.jpg`;
    await RNFS.writeFile(outPath, outB64, 'base64');
    return { ...file, path: outPath, uri: toFileUri(outPath) };
  } catch {
    return file;
  } finally {
    // 释放 Skia native 对象(按依赖逆序),避免全分辨率大图反复烧图后内存增长/OOM
    snapshot?.dispose();
    surface?.dispose();
    image?.dispose();
    data?.dispose();
  }
}
