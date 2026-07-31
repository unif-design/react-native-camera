import * as RNFS from '@dr.pogodin/react-native-fs';
import {
  ImageFormat,
  Skia,
  type SkData,
  type SkImage,
  type SkPaint,
  type SkSurface,
} from '@shopify/react-native-skia';
import type {
  AspectRatio,
  CameraMode,
  CameraType,
  CustomPhotoFile,
  WatermarkType,
} from '../../utils';
import { toFileUri } from '../../utils';
import type { FileRegistry } from '../session/fileRegistry';
import {
  createWatermarkParagraph,
  hasVisibleWatermark,
  type WatermarkParagraph,
} from '../watermark/paragraph';
import { computeCropRect } from './cropGeometry';

export type PhotoProcessingStage =
  | 'read'
  | 'decode'
  | 'crop'
  | 'surface'
  | 'draw'
  | 'watermark'
  | 'snapshot'
  | 'encode'
  | 'write';

export class PhotoProcessingError extends Error {
  readonly code = 'photo_processing_failed' as const;
  readonly stage: PhotoProcessingStage;

  constructor(stage: PhotoProcessingStage, cause?: unknown) {
    super(`Photo processing failed during ${stage}`, { cause });
    this.name = 'PhotoProcessingError';
    this.stage = stage;
  }
}

export type PhotoProcessingSnapshot = {
  sessionId: number;
  captureId: string;
  aspectRatio: AspectRatio;
  mode: Pick<CameraMode, 'quality'>;
  watermark?: WatermarkType;
  cameraPosition: CameraType;
};

function snapshotOperation(
  operation: PhotoProcessingSnapshot
): PhotoProcessingSnapshot {
  return {
    sessionId: operation.sessionId,
    captureId: operation.captureId,
    aspectRatio: operation.aspectRatio,
    mode: { quality: operation.mode.quality },
    ...(operation.watermark == null
      ? {}
      : {
          watermark: {
            content: [...operation.watermark.content],
            ...(operation.watermark.position == null
              ? {}
              : { position: operation.watermark.position }),
          },
        }),
    cameraPosition: operation.cameraPosition,
  };
}

function jpegQuality(quality: number | undefined): number {
  const normalized =
    quality == null || !Number.isFinite(quality) ? 0.9 : quality;
  return Math.round(Math.min(1, Math.max(0, normalized)) * 100);
}

function safePathSegment(value: string | number): string {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function disposeSafely(resource: { dispose: () => void } | null): void {
  try {
    resource?.dispose();
  } catch {
    // 释放失败不能遮蔽原始 processor error，也不能阻断其余 native 对象逆序释放。
  }
}

export async function processPhoto(
  raw: CustomPhotoFile,
  operation: PhotoProcessingSnapshot,
  registry: FileRegistry
): Promise<CustomPhotoFile> {
  if (raw.mime !== 'image/jpeg') return raw;

  const captured = snapshotOperation(operation);
  registry.register(raw.path);
  const watermark = hasVisibleWatermark(captured.watermark)
    ? captured.watermark
    : undefined;
  if (captured.aspectRatio !== '16:9' && watermark == null) return raw;

  const outputPath =
    `${RNFS.TemporaryDirectoryPath}/camera_` +
    `${safePathSegment(captured.sessionId)}_${safePathSegment(captured.captureId)}.jpg`;
  let data: SkData | null = null;
  let image: SkImage | null = null;
  let surface: SkSurface | null = null;
  let paint: SkPaint | null = null;
  let prepared: WatermarkParagraph | null = null;
  let snapshot: SkImage | null = null;
  let outputMayExist = false;
  let stage: PhotoProcessingStage = 'read';
  let failure: PhotoProcessingError | null = null;
  let result: CustomPhotoFile | null = null;

  try {
    data = await Skia.Data.fromURI(raw.uri);

    stage = 'decode';
    image = Skia.Image.MakeImageFromEncoded(data);
    if (image == null) throw new PhotoProcessingError(stage);

    stage = 'crop';
    // MakeImageFromEncoded 已按 encoded origin 给出最终像素方向；这里禁止再套 EXIF rotate/mirror。
    const crop = computeCropRect(
      image.width(),
      image.height(),
      captured.aspectRatio
    );

    stage = 'surface';
    surface = Skia.Surface.MakeOffscreen(crop.width, crop.height);
    if (surface == null) throw new PhotoProcessingError(stage);
    const finalWidth = surface.width();
    const finalHeight = surface.height();
    if (finalWidth <= 0 || finalHeight <= 0) {
      throw new PhotoProcessingError(stage);
    }

    stage = 'draw';
    paint = Skia.Paint();
    const canvas = surface.getCanvas();
    canvas.drawImageRect(
      image,
      Skia.XYWHRect(crop.x, crop.y, crop.width, crop.height),
      Skia.XYWHRect(0, 0, finalWidth, finalHeight),
      paint
    );

    if (watermark != null) {
      stage = 'watermark';
      prepared = createWatermarkParagraph(finalWidth, finalHeight, watermark);
      prepared.paragraph.paint(
        canvas,
        prepared.placement.x,
        prepared.placement.y
      );
    }

    stage = 'snapshot';
    snapshot = surface.makeImageSnapshot();

    stage = 'encode';
    const encoded = snapshot.encodeToBase64(
      ImageFormat.JPEG,
      jpegQuality(captured.mode.quality)
    );
    if (encoded.length === 0) throw new PhotoProcessingError(stage);

    stage = 'write';
    outputMayExist = true;
    await RNFS.writeFile(outputPath, encoded, 'base64');
    registry.register(outputPath);
    await registry.replace(raw.path, outputPath);

    result = {
      ...raw,
      cameraType: captured.cameraPosition,
      path: outputPath,
      uri: toFileUri(outputPath),
      width: finalWidth,
      height: finalHeight,
    };
  } catch (error) {
    failure =
      error instanceof PhotoProcessingError
        ? error
        : new PhotoProcessingError(stage, error);
  } finally {
    // 创建顺序 data → image → surface → paint → builder → paragraph → snapshot；
    // 逆序释放保证依赖对象仍存活，并在任一步失败时继续收完其余 native 资源。
    disposeSafely(snapshot);
    try {
      prepared?.dispose();
    } catch {
      // bundle 自己会用 finally 继续 dispose builder；这里只防止遮蔽 processor error。
    }
    disposeSafely(paint);
    disposeSafely(surface);
    disposeSafely(image);
    disposeSafely(data);
  }

  if (failure != null) {
    if (outputMayExist) {
      // write 可能已留下部分文件；先登记所有权，registry 才被允许执行 best-effort unlink。
      registry.register(outputPath);
      await registry.delete(outputPath);
    }
    await registry.delete(raw.path);
    throw failure;
  }

  if (result == null) {
    await registry.delete(raw.path);
    throw new PhotoProcessingError(stage);
  }
  return result;
}
