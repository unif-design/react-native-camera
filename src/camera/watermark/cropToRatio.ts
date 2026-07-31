import * as RNFS from '@dr.pogodin/react-native-fs';
import { Skia, ImageFormat } from '@shopify/react-native-skia';
import type {
  SkData,
  SkImage,
  SkSurface,
  SkPaint,
} from '@shopify/react-native-skia';
import type { CustomPhotoFile } from '../../utils';
import { toFileUri } from '../../utils';
import { computeCropRect } from '../image/cropGeometry';

function disposeSafely(resource: { dispose: () => void } | null): void {
  try {
    resource?.dispose();
  } catch {
    // 单个 JSI 对象释放失败不能阻断其余对象按依赖逆序释放，也不能破坏兼容入口的原图兜底。
  }
}

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
  let paint: SkPaint | null = null;
  try {
    const base64 = await RNFS.readFile(file.path, 'base64');
    data = Skia.Data.fromBase64(base64);
    image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) return file;
    const w = image.width();
    const h = image.height();

    const crop = computeCropRect(w, h, ratio);

    surface = Skia.Surface.MakeOffscreen(crop.width, crop.height);
    if (!surface) return file;
    const canvas = surface.getCanvas();
    // 局部 const(类型非空)供绘制,同时存进 let 供 finally 逆序 dispose —— 免非空断言。
    const p = Skia.Paint();
    paint = p;
    canvas.drawImageRect(
      image,
      Skia.XYWHRect(crop.x, crop.y, crop.width, crop.height),
      Skia.XYWHRect(0, 0, crop.width, crop.height),
      p
    );

    snapshot = surface.makeImageSnapshot();
    const outB64 = snapshot.encodeToBase64(ImageFormat.JPEG, 92);
    const outPath = `${RNFS.TemporaryDirectoryPath}/crop_${file.id}.jpg`;
    await RNFS.writeFile(outPath, outB64, 'base64');
    return {
      ...file,
      path: outPath,
      uri: toFileUri(outPath),
      width: crop.width,
      height: crop.height,
    };
  } catch {
    // 解码/分配/读写任何异常都返原图,绝不阻断保存(红线同水印烧录)。
    return file;
  } finally {
    // 释放 Skia native 对象(按依赖逆序,后创建的先释放),避免全分辨率大图反复裁后内存增长/OOM
    disposeSafely(snapshot);
    disposeSafely(paint);
    disposeSafely(surface);
    disposeSafely(image);
    disposeSafely(data);
  }
}
