import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type {
  CameraMode,
  CameraType,
  CustomPhotoFile,
  OpenConfig,
  WatermarkType,
} from '../../utils';
import type { CameraHandle } from '../Camera';
import { processPhoto, PhotoProcessingError } from '../image/processPhoto';
import type { FileRegistry } from '../session/fileRegistry';
import { hasVisibleWatermark } from '../watermark/paragraph';
import type { AspectRatio } from '../setup';
import type { CameraOperationToken } from './useCameraSessionController';
import type { CameraSessionController } from './useCameraSessionController';

export const MIN_FREEZE_MS = 1000;

export type UsePhotoCaptureTransactionParams = {
  sessionId: number;
  cameraRef: RefObject<CameraHandle | null>;
  controller: CameraSessionController;
  fileRegistry: FileRegistry;
  config: OpenConfig;
  onError: (message: string) => void;
};

export type PhotoCaptureTransaction = {
  capturePhoto: () => Promise<void>;
  photoBusy: boolean;
  flashNonce: number;
  burning: boolean;
  freezeUri: string | null;
  openGallery: () => boolean;
  closePreview: () => boolean;
  deletePhoto: (file: CustomPhotoFile) => boolean;
  retake: () => boolean;
  clearForModeSwitch: () => boolean;
  save: () => boolean;
};

type CaptureSnapshot = {
  mode: CameraMode;
  aspectRatio: AspectRatio;
  watermark?: WatermarkType;
  cameraPosition: CameraType;
  dataRetainedMode: OpenConfig['dataRetainedMode'];
  previewIndex: number;
};

type PendingFileCleanup =
  | {
      type: 'replace';
      rawPath: string;
      finalPath: string;
    }
  | {
      type: 'delete';
      paths: string[];
    };

function snapshotCapture(
  config: OpenConfig,
  controller: CameraSessionController
): CaptureSnapshot | null {
  const sourceMode = config.cameraMode[controller.state.modeIndex];
  if (sourceMode == null || sourceMode.mode === 'video') return null;

  return {
    mode: { ...sourceMode },
    aspectRatio: controller.state.aspectRatio,
    ...(config.watermark == null
      ? {}
      : {
          watermark: {
            content: [...config.watermark.content],
            ...(config.watermark.position == null
              ? {}
              : { position: config.watermark.position }),
          },
        }),
    cameraPosition: controller.state.activePosition,
    dataRetainedMode: config.dataRetainedMode,
    previewIndex: controller.state.files.length,
  };
}

function cleanupOwned(registry: FileRegistry, paths: readonly string[]): void {
  for (const path of new Set(paths)) {
    registry.delete(path).catch(() => {
      // 正常 registry 会吞掉 unlink/reporter 错误；自定义实现 reject 也不能形成未处理 rejection。
    });
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function usePhotoCaptureTransaction({
  sessionId,
  cameraRef,
  controller,
  fileRegistry,
  config,
  onError,
}: UsePhotoCaptureTransactionParams): PhotoCaptureTransaction {
  const [flashNonce, setFlashNonce] = useState(0);
  const [burning, setBurning] = useState(false);
  const [freezeUri, setFreezeUri] = useState<string | null>(null);
  const [cleanupQueue, setCleanupQueue] = useState<PendingFileCleanup[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // raw 仍被 frozen Image 引用时不能 unlink。queue 只在 freezeUri=null 的 commit
  // 之后由 effect 消费，避免 setState 与磁盘删除同一 call stack 造成偶发空白帧。
  useEffect(() => {
    if (freezeUri != null || cleanupQueue.length === 0) return;
    setCleanupQueue([]);
    cleanupQueue.forEach((cleanup) => {
      if (cleanup.type === 'delete') {
        cleanupOwned(fileRegistry, cleanup.paths);
        return;
      }
      fileRegistry.replace(cleanup.rawPath, cleanup.finalPath).catch(() => {
        // registry 已负责 best-effort 诊断；替换清理永远不能回滚已提交的照片。
      });
    });
  }, [cleanupQueue, fileRegistry, freezeUri]);

  const cleanupAfterFreeze = useCallback(
    (paths: readonly string[]): void => {
      const ownedPaths = [...new Set(paths)];
      if (ownedPaths.length === 0) return;
      if (!mountedRef.current) {
        cleanupOwned(fileRegistry, ownedPaths);
        return;
      }

      setBurning(false);
      setFreezeUri(null);
      setCleanupQueue((pending) => [
        ...pending,
        { type: 'delete', paths: ownedPaths },
      ]);
    },
    [fileRegistry]
  );

  const tokenIsCurrent = useCallback(
    (token: CameraOperationToken): boolean =>
      mountedRef.current && controller.isCurrent(token),
    [controller]
  );

  const reportCaptureFailure = useCallback(
    (token: CameraOperationToken): void => {
      if (!tokenIsCurrent(token) || !controller.fail(token)) return;
      onError('拍摄失败,请重试');
    },
    [controller, onError, tokenIsCurrent]
  );

  const capturePhoto = useCallback(async (): Promise<void> => {
    const captured = snapshotCapture(config, controller);
    if (captured == null) return;

    // beginPhoto 同步推进 controller shadow；同一 JS call stack 的后续快门立即被拒绝，
    // 不能依赖 React render 后才更新的视觉 state 来挡 UHD 并发。
    const token = controller.beginPhoto();
    if (token == null) return;
    const delegatedCleanupPaths = new Set<string>();

    let raw: CustomPhotoFile | null | undefined;
    try {
      raw = await cameraRef.current?.capture();
    } catch {
      reportCaptureFailure(token);
      return;
    }

    if (raw == null) {
      reportCaptureFailure(token);
      return;
    }

    // native capture 一交出 path，第一件事就是登记 session 所有权；之后任何 stale
    // 分支才有权安全删除，避免 supersede/unmount 窗口泄漏临时文件。
    fileRegistry.register(raw.path);
    if (!tokenIsCurrent(token)) {
      cleanupOwned(fileRegistry, [raw.path]);
      return;
    }

    const normalized: CustomPhotoFile = {
      ...raw,
      cameraType: captured.cameraPosition,
      cameraMode: captured.mode.mode,
      mode: captured.mode.mode,
    };
    if (!controller.photoCaptured(token)) {
      cleanupOwned(fileRegistry, [raw.path]);
      return;
    }

    if (mountedRef.current) setFlashNonce((value) => value + 1);

    const visibleWatermark = hasVisibleWatermark(captured.watermark);
    const needsProcessing =
      normalized.mime === 'image/jpeg' &&
      (captured.aspectRatio === '16:9' || visibleWatermark);
    const preview =
      captured.mode.mode === 'single' && captured.dataRetainedMode === 'clear'
        ? { variant: 'confirm' as const, index: captured.previewIndex }
        : undefined;

    if (!needsProcessing) {
      if (!tokenIsCurrent(token)) {
        cleanupOwned(fileRegistry, [raw.path]);
        return;
      }
      if (!controller.photoSucceeded(token, normalized, preview)) {
        cleanupOwned(fileRegistry, [raw.path]);
      }
      return;
    }

    const processingStartedAt = Date.now();
    if (mountedRef.current) {
      setFreezeUri(normalized.uri);
      setBurning(true);
    }

    let final: CustomPhotoFile | null = null;
    try {
      final = await processPhoto(
        normalized,
        {
          sessionId,
          captureId: token.operationId,
          aspectRatio: captured.aspectRatio,
          mode: { quality: captured.mode.quality },
          ...(captured.watermark == null
            ? {}
            : { watermark: captured.watermark }),
          cameraPosition: captured.cameraPosition,
        },
        fileRegistry,
        {
          isCurrent: () => tokenIsCurrent(token),
          onCleanupRequired: (paths) => {
            paths.forEach((path) => delegatedCleanupPaths.add(path));
          },
        }
      );

      // processor 契约会登记 final；事务仍把 await 后的第一步做成幂等 register，
      // 让可注入 processor 与未来实现都无法在 token gate 前漏掉输出所有权。
      fileRegistry.register(final.path);
      if (!tokenIsCurrent(token)) {
        cleanupAfterFreeze([raw.path, final.path, ...delegatedCleanupPaths]);
        return;
      }
      if (final.path === raw.path) {
        throw new PhotoProcessingError('write');
      }

      if (mountedRef.current) setBurning(false);
      if (visibleWatermark) {
        const remaining = MIN_FREEZE_MS - (Date.now() - processingStartedAt);
        if (remaining > 0) {
          await wait(remaining);
          if (!tokenIsCurrent(token)) {
            cleanupAfterFreeze([
              raw.path,
              final.path,
              ...delegatedCleanupPaths,
            ]);
            return;
          }
        }
      }

      if (!tokenIsCurrent(token)) {
        cleanupAfterFreeze([raw.path, final.path, ...delegatedCleanupPaths]);
        return;
      }
      if (mountedRef.current) setFreezeUri(null);
      if (!controller.photoSucceeded(token, final, preview)) {
        cleanupAfterFreeze([raw.path, final.path, ...delegatedCleanupPaths]);
        return;
      }

      if (mountedRef.current) {
        const finalPath = final.path;
        setCleanupQueue((pending) => [
          ...pending,
          {
            type: 'replace',
            rawPath: raw.path,
            finalPath,
          },
        ]);
      }
    } catch {
      const cleanupPaths = [
        raw.path,
        ...(final == null ? [] : [final.path]),
        ...delegatedCleanupPaths,
      ];
      const current = tokenIsCurrent(token);
      cleanupAfterFreeze(cleanupPaths);
      if (!current || !controller.fail(token)) return;
      onError('照片处理失败,请重试');
    }
  }, [
    cameraRef,
    cleanupAfterFreeze,
    config,
    controller,
    fileRegistry,
    onError,
    reportCaptureFailure,
    sessionId,
    tokenIsCurrent,
  ]);

  const openGallery = useCallback(
    () => controller.openPreview({ variant: 'gallery', index: 0 }),
    [controller]
  );

  const closePreview = useCallback(
    () => controller.closePreview(),
    [controller]
  );

  const deletePhoto = useCallback(
    (file: CustomPhotoFile): boolean => {
      const removed = controller.deleteFile(file.path);
      if (removed == null) return false;
      cleanupOwned(fileRegistry, [removed.path]);
      return true;
    },
    [controller, fileRegistry]
  );

  const clearFiles = useCallback((): boolean => {
    const removed = controller.clearFiles();
    if (removed == null) return false;
    cleanupOwned(
      fileRegistry,
      removed.map((file) => file.path)
    );
    return true;
  }, [controller, fileRegistry]);

  return {
    capturePhoto,
    photoBusy:
      controller.state.phase === 'capturingPhoto' ||
      controller.state.phase === 'processingPhoto',
    flashNonce,
    burning,
    freezeUri,
    openGallery,
    closePreview,
    deletePhoto,
    retake: clearFiles,
    clearForModeSwitch: clearFiles,
    save: controller.save,
  };
}
