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
  captureId: string | number;
  aspectRatio: AspectRatio;
  mode: Pick<CameraMode, 'quality'>;
  watermark?: WatermarkType;
  cameraPosition: CameraType;
};

export type PhotoProcessingContext = {
  isCurrent?: () => boolean;
  onCleanupRequired?: (paths: readonly string[]) => void;
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

function assertCurrent(
  context: PhotoProcessingContext | undefined,
  stage: PhotoProcessingStage
): void {
  if (context?.isCurrent == null) return;
  try {
    if (context.isCurrent()) return;
  } catch (error) {
    throw new PhotoProcessingError(stage, error);
  }
  throw new PhotoProcessingError(stage);
}

function cleanupOwned(registry: FileRegistry, paths: readonly string[]): void {
  for (const path of new Set(paths)) {
    // registry 会在首个 await 前同步把 owned 标成 deleted；processor 不等待磁盘 unlink，
    // 否则慢 I/O 会延长 UHD Skia/native 事务并阻塞 stale operation 退出。
    registry.delete(path).catch(() => {
      // 正常 registry 已吞掉 unlink/reporter 错误；自定义实现 reject 也不能形成未处理 rejection。
    });
  }
}

function requestCleanup(
  registry: FileRegistry,
  context: PhotoProcessingContext | undefined,
  paths: readonly string[]
): void {
  const ownedPaths = [...new Set(paths)];
  if (context?.onCleanupRequired != null) {
    try {
      context.onCleanupRequired(ownedPaths);
      return;
    } catch {
      // delegate 失效时退回 processor 默认清理，不能因协调层异常泄漏 raw/partial output。
    }
  }
  cleanupOwned(registry, ownedPaths);
}

export async function processPhoto(
  raw: CustomPhotoFile,
  operation: PhotoProcessingSnapshot,
  registry: FileRegistry,
  context?: PhotoProcessingContext
): Promise<CustomPhotoFile> {
  const captured = snapshotOperation(operation);
  const watermark = hasVisibleWatermark(captured.watermark)
    ? captured.watermark
    : undefined;
  const needsProcessing =
    raw.mime === 'image/jpeg' &&
    (captured.aspectRatio === '16:9' || watermark != null);
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
    assertCurrent(context, stage);
    if (!needsProcessing) return raw;
    if (outputPath === raw.path) {
      throw new PhotoProcessingError('write');
    }

    data = await Skia.Data.fromURI(raw.uri);
    assertCurrent(context, stage);

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
    // write 完成后的第一步先登记 final；随后的 token gate 若判 stale，registry 才有权
    // 同步摘除 raw/final 所有权并异步清理，且不会遗失已成功落盘的输出。
    registry.register(outputPath);
    assertCurrent(context, stage);

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
    // write reject 仍可能留下部分文件；先登记所有权，再同步标 deleted 并 fire-and-forget
    // unlink。registry 的状态门禁保证 raw/final 即使同 path 或重复进入也只删一次。
    if (outputMayExist) registry.register(outputPath);
    requestCleanup(
      registry,
      context,
      outputMayExist ? [raw.path, outputPath] : [raw.path]
    );
    throw failure;
  }

  if (result == null) {
    requestCleanup(registry, context, [raw.path]);
    throw new PhotoProcessingError(stage);
  }
  return result;
}
