import * as RNFS from '@dr.pogodin/react-native-fs';
import { Skia, ImageFormat } from '@shopify/react-native-skia';
import type { SkData, SkImage, SkSurface } from '@shopify/react-native-skia';
import type { CustomPhotoFile, WatermarkType } from '../../utils';
import { toFileUri } from '../../utils';
import {
  createWatermarkParagraph,
  hasVisibleWatermark,
  type WatermarkParagraph,
} from './paragraph';

/**
 * 把水印烧进照片:读字节 → Skia 解码 → 离屏全分辨率 surface 画原图 + Paragraph 画水印
 * → 编码 JPEG → fs 写临时文件 → 返回换了 path/uri 的新 file。
 * 任何异常(解码/离屏分配失败、读写出错)都返回**原 file**,绝不阻断保存。
 * Skia 对象是 C++ 包装,finally 里 dispose 释放原生内存,避免全分辨率大图反复烧后增长/OOM。
 *
 * 文字用 Skia **Paragraph**(而非 `Skia.Font()`+`canvas.drawText`):Paragraph 默认走系统
 * 字体管理器、自带字形 fallback,中文/emoji 都能渲染;而 `Skia.Font()`+`drawText` **不做
 * 字形 fallback**,默认 typeface 没有 CJK 字形 → 汉字全映射到 .notdef、烧出来空白(真机踩过:
 * 预览 WatermarkStamp 用 RN <Text> 有 fallback 能显示、Skia 烧录却空白;jest mock 了 Skia 测不到)。
 */
export async function burnWatermark(
  file: CustomPhotoFile,
  wm: WatermarkType
): Promise<CustomPhotoFile> {
  let data: SkData | null = null;
  let image: SkImage | null = null;
  let surface: SkSurface | null = null;
  let snapshot: SkImage | null = null;
  let prepared: WatermarkParagraph | null = null;
  try {
    if (!hasVisibleWatermark(wm)) return file;
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

    // 兼容入口暂留给旧 useCaptureFlow；Paragraph 的样式、换行宽度与放置已统一走共享 helper。
    prepared = createWatermarkParagraph(w, h, wm);
    prepared.paragraph.paint(
      canvas,
      prepared.placement.x,
      prepared.placement.y
    );

    snapshot = surface.makeImageSnapshot();
    const outB64 = snapshot.encodeToBase64(ImageFormat.JPEG, 92);
    const outPath = `${RNFS.TemporaryDirectoryPath}/wm_${file.id}.jpg`;
    await RNFS.writeFile(outPath, outB64, 'base64');
    return { ...file, path: outPath, uri: toFileUri(outPath) };
  } catch {
    // 解码/分配/读写任何异常都返原图,绝不阻断保存。
    return file;
  } finally {
    // 释放 Skia native 对象(按依赖逆序,后创建的先释放),避免全分辨率大图反复烧后内存增长/OOM。
    snapshot?.dispose();
    prepared?.dispose();
    surface?.dispose();
    image?.dispose();
    data?.dispose();
  }
}
