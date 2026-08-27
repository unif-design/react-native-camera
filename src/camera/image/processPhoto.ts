import * as RNFS from '@dr.pogodin/react-native-fs';
import type {
  AspectRatio,
  CameraMode,
  CameraType,
  CustomPhotoFile,
  WatermarkType,
} from '../../utils';
import { toFileUri } from '../../utils';
import type { FileRegistry } from '../session/fileRegistry';
import { hasVisibleWatermark } from '../watermark/paragraph';
import {
  nativePhotoProcessingStage,
  processPhotoFile,
} from './nativePhotoProcessor';
import {
  needsPhotoFileProcessing,
  orientedPhotoTarget,
} from './photoResolution';

export type PhotoProcessingStage =
  | 'read'
  | 'decode'
  | 'crop'
  | 'surface'
  | 'draw'
  | 'watermark'
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
    // 否则慢 I/O 会延长文件级 native 事务并阻塞 stale operation 退出。
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
  const needsProcessing = needsPhotoFileProcessing(
    raw,
    captured.aspectRatio,
    watermark != null
  );
  const outputPath =
    `${RNFS.TemporaryDirectoryPath}/camera_` +
    `${safePathSegment(raw.id)}_` +
    `${safePathSegment(captured.sessionId)}_${safePathSegment(captured.captureId)}.jpg`;
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

    const target = orientedPhotoTarget(
      captured.aspectRatio,
      raw.width,
      raw.height
    );
    stage = watermark == null ? 'crop' : 'watermark';
    // native 可能在 reject 前留下部分文件；调用前即视为 output 可能存在，失败路径统一清理。
    outputMayExist = true;
    const processed = await processPhotoFile({
      inputPath: raw.path,
      outputPath,
      aspectRatio: captured.aspectRatio,
      targetWidth: target.width,
      targetHeight: target.height,
      quality: jpegQuality(captured.mode.quality),
      ...(watermark == null ? {} : { watermark }),
    });

    // native 返回后的第一步登记 final；随后的 token gate 才有权摘除其所有权。
    registry.register(outputPath);
    stage = 'write';
    assertCurrent(context, stage);

    result = {
      ...raw,
      cameraType: captured.cameraPosition,
      path: outputPath,
      uri: toFileUri(outputPath),
      width: processed.width,
      height: processed.height,
    };
  } catch (error) {
    const nativeStage = nativePhotoProcessingStage(error);
    failure =
      error instanceof PhotoProcessingError
        ? error
        : new PhotoProcessingError(nativeStage ?? stage, error);
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
