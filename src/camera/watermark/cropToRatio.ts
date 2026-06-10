import * as RNFS from '@dr.pogodin/react-native-fs';
import { Skia, ImageFormat } from '@shopify/react-native-skia';
import type { SkData, SkImage, SkSurface } from '@shopify/react-native-skia';
import type { CustomPhotoFile } from '../../utils';
import { toFileUri } from '../../utils';

/**
 * 出图 16:9 居中裁切:photo 流恒 4:3 全幅出图(session 零重配,见 Camera.tsx),16:9 视野
 * 由这里**拍后**用 Skia 居中裁掉左右实现 —— vision-camera 拍照本身无 crop 参数(已确认)。
 *
 * 复用 burnWatermark 完整模式:`@dr.pogodin/react-native-fs` 读字节 → Skia 解码 → 算居中
 * 16:9 srcRect → 离屏 surface drawImageRect 裁 → 编码 JPEG(quality 92,与水印一致)→ fs 写
 * 临时文件 → 返回换了 path/uri/width/height 的新 file。
 *
 * **红线照搬 burnWatermark**:任何异常(解码/离屏分配失败、读写出错)都返回**原 file**,绝不
 * 阻断保存;Skia 对象是 C++ 包装,finally 里按依赖逆序 dispose 释放原生内存(防大图反复裁
 * 后增长/OOM);一次只处理一张(调用方已串行,与烧水印同帧不并发)。
 */
export async function cropToRatio(
  file: CustomPhotoFile,
  ratio: '16:9'
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

    // 目标竖屏宽/高比(ratio='16:9' → portraitWH = 9/16)。竖屏 4:3 原图(h>w):**等高裁宽**
    // cropW = h*portraitWH,居中取(offsetX = (w-cropW)/2)。若 cropW > w(图本就偏窄,fallback)
    // 改**等宽裁高**:cropH = w/portraitWH,居中取(offsetY = (h-cropH)/2)。
    // '16:9' 是横向写法;竖屏取景旋转 90° → 竖屏宽/高 = 短边/长边 = 9/16。
    const [rw, rh] = ratio.split(':').map(Number) as [number, number];
    const portraitWH = rh / rw; // 16:9 → 9/16(竖屏:短边/长边)
    let cropW = Math.round(h * portraitWH);
    let cropH = h;
    let offsetX = Math.round((w - cropW) / 2);
    let offsetY = 0;
    if (cropW > w) {
      cropW = w;
      cropH = Math.round(w / portraitWH);
      offsetX = 0;
      offsetY = Math.round((h - cropH) / 2);
    }

    surface = Skia.Surface.MakeOffscreen(cropW, cropH);
    if (!surface) return file;
    const canvas = surface.getCanvas();
    const paint = Skia.Paint();
    canvas.drawImageRect(
      image,
      Skia.XYWHRect(offsetX, offsetY, cropW, cropH),
      Skia.XYWHRect(0, 0, cropW, cropH),
      paint
    );

    snapshot = surface.makeImageSnapshot();
    const outB64 = snapshot.encodeToBase64(ImageFormat.JPEG, 92);
    const outPath = `${RNFS.TemporaryDirectoryPath}/crop_${file.id}.jpg`;
    await RNFS.writeFile(outPath, outB64, 'base64');
    return {
      ...file,
      path: outPath,
      uri: toFileUri(outPath),
      width: cropW,
      height: cropH,
    };
  } catch {
    return file;
  } finally {
    // 释放 Skia native 对象(按依赖逆序),避免全分辨率大图反复裁后内存增长/OOM
    snapshot?.dispose();
    surface?.dispose();
    image?.dispose();
    data?.dispose();
  }
}
