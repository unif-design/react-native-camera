import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import type { CameraHandle, VideoCallbacks } from '../Camera';
import type { FileRegistry } from '../session/fileRegistry';
import type {
  CameraOperationToken,
  CameraSessionController,
} from './useCameraSessionController';

export type VideoTransactionEvents = Pick<
  CameraSessionController,
  | 'videoStarted'
  | 'videoProgress'
  | 'stopVideo'
  | 'videoFinished'
  | 'fail'
  | 'isCurrent'
>;

export type UseVideoTransactionParams = {
  cameraRef: RefObject<CameraHandle | null>;
  fileRegistry: FileRegistry;
  onError: (message: string) => void;
};

export type VideoTransaction = {
  start: (
    token: CameraOperationToken,
    events: VideoTransactionEvents
  ) => Promise<void>;
  stop: () => void;
  cancel: () => Promise<void>;
};

type VideoOperationStatus =
  | 'starting'
  | 'recording'
  | 'stopping'
  | 'finished'
  | 'failed'
  | 'cancelled';

type VideoOperation = {
  token: CameraOperationToken;
  events: VideoTransactionEvents;
  camera: CameraHandle | null;
  registry: FileRegistry;
  reportError: (message: string) => void;
  status: VideoOperationStatus;
  lastDuration: number;
  timer: ReturnType<typeof setInterval> | null;
  stopIssued: boolean;
  nativeCancelIssued: boolean;
  cancelPromise: Promise<void> | null;
  cancelCallbackHandled: boolean;
  deliveredPath: string | null;
};

const DURATION_POLL_MS = 250;

function isLive(status: VideoOperationStatus): boolean {
  return (
    status === 'starting' || status === 'recording' || status === 'stopping'
  );
}

function clearDurationTimer(operation: VideoOperation): void {
  if (operation.timer == null) return;
  clearInterval(operation.timer);
  operation.timer = null;
}

function deleteOwned(registry: FileRegistry, path: string): void {
  try {
    registry.delete(path).catch(() => {
      // registry 正常会自行吞掉 unlink/reporter 异常；注入实现 reject 也不能泄漏 rejection。
    });
  } catch {
    // 清理是 best-effort，不能遮蔽 native callback 的终态。
  }
}

export function useVideoTransaction({
  cameraRef,
  fileRegistry,
  onError,
}: UseVideoTransactionParams): VideoTransaction {
  const mountedRef = useRef(true);
  const activeOperationRef = useRef<VideoOperation | null>(null);

  const claimTerminal = useCallback(
    (operation: VideoOperation, status: VideoOperationStatus): boolean => {
      if (!isLive(operation.status)) return false;
      operation.status = status;
      clearDurationTimer(operation);
      if (activeOperationRef.current === operation) {
        activeOperationRef.current = null;
      }
      return true;
    },
    []
  );

  const requestNativeCancel = useCallback(
    (operation: VideoOperation): Promise<void> => {
      if (operation.cancelPromise != null) return operation.cancelPromise;
      if (!isLive(operation.status)) return Promise.resolve();

      // 先同步失效 continuation，再碰 native；cancelVideo 同步回调也只能走 stale 清理。
      claimTerminal(operation, 'cancelled');
      if (operation.nativeCancelIssued || operation.camera == null) {
        operation.cancelPromise = Promise.resolve();
        return operation.cancelPromise;
      }

      operation.nativeCancelIssued = true;
      let request: void | Promise<void>;
      try {
        request = operation.camera.cancelVideo();
      } catch {
        request = undefined;
      }
      operation.cancelPromise = Promise.resolve(request).catch(() => {
        // force teardown 有界且不可逆；native cancel 失败不能恢复 reducer/UI。
      });
      return operation.cancelPromise;
    },
    [claimTerminal]
  );

  const finalizeFailure = useCallback(
    (
      operation: VideoOperation,
      message: string | null,
      status: Extract<VideoOperationStatus, 'failed' | 'cancelled'> = 'failed'
    ): boolean => {
      if (!claimTerminal(operation, status)) return false;
      if (!mountedRef.current) return false;
      const accepted = operation.events.fail(operation.token);
      if (accepted && message != null) operation.reportError(message);
      return accepted;
    },
    [claimTerminal]
  );

  const sampleDuration = useCallback(
    (operation: VideoOperation): void => {
      if (
        !mountedRef.current ||
        activeOperationRef.current !== operation ||
        (operation.status !== 'recording' && operation.status !== 'stopping')
      ) {
        clearDurationTimer(operation);
        return;
      }
      if (!operation.events.isCurrent(operation.token)) {
        requestNativeCancel(operation).catch(() => {});
        return;
      }

      let duration: number;
      try {
        duration = operation.camera?.getRecordedDuration() ?? Number.NaN;
      } catch {
        duration = Number.NaN;
      }
      if (!Number.isFinite(duration) || duration < 0) return;
      operation.lastDuration = duration;
      if (!operation.events.videoProgress(operation.token, duration)) {
        requestNativeCancel(operation).catch(() => {});
      }
    },
    [requestNativeCancel]
  );

  const start = useCallback(
    async (
      token: CameraOperationToken,
      events: VideoTransactionEvents
    ): Promise<void> => {
      const active = activeOperationRef.current;
      if (active != null && isLive(active.status)) return;

      const operation: VideoOperation = {
        token,
        events,
        camera: cameraRef.current,
        registry: fileRegistry,
        reportError: onError,
        status: 'starting',
        lastDuration: 0,
        timer: null,
        stopIssued: false,
        nativeCancelIssued: false,
        cancelPromise: null,
        cancelCallbackHandled: false,
        deliveredPath: null,
      };
      activeOperationRef.current = operation;

      const callbacks: VideoCallbacks = {
        onFinished: (file, reason, duration) => {
          // native 一交出 path，第一件事永远是登记原 session 所有权；之后才允许 gate/删除。
          operation.registry.register(file.path);

          if (operation.deliveredPath != null) {
            if (operation.deliveredPath !== file.path) {
              deleteOwned(operation.registry, file.path);
            }
            return;
          }

          if (
            !mountedRef.current ||
            activeOperationRef.current !== operation ||
            !isLive(operation.status) ||
            !operation.events.isCurrent(operation.token)
          ) {
            claimTerminal(operation, 'finished');
            deleteOwned(operation.registry, file.path);
            return;
          }

          const accepted = operation.events.videoFinished(operation.token, {
            file,
            duration,
            reason,
          });
          if (accepted) {
            operation.deliveredPath = file.path;
            claimTerminal(operation, 'finished');
            return;
          }

          claimTerminal(operation, 'finished');
          deleteOwned(operation.registry, file.path);
        },
        onDiscardedFile: (path) => {
          operation.registry.register(path);
          deleteOwned(operation.registry, path);
        },
        onError: () => {
          finalizeFailure(operation, '录像失败,请重试');
        },
        onCancelled: () => {
          if (operation.cancelCallbackHandled) return;
          operation.cancelCallbackHandled = true;
          if (isLive(operation.status)) {
            finalizeFailure(operation, null, 'cancelled');
            return;
          }
          if (
            operation.status === 'cancelled' &&
            mountedRef.current &&
            operation.events.fail(operation.token)
          ) {
            // Native cancel 只负责让 current reducer 回 ready，不向用户显示错误。
          }
        },
      };

      if (operation.camera == null) {
        finalizeFailure(operation, '录像启动失败,请重试');
        return;
      }

      let startRequest: Promise<'started' | 'denied'>;
      try {
        startRequest = operation.camera.startVideo(callbacks);
      } catch {
        finalizeFailure(operation, '录像启动失败,请重试');
        return;
      }

      let result: 'started' | 'denied';
      try {
        result = await startRequest;
      } catch {
        finalizeFailure(operation, '录像启动失败,请重试');
        return;
      }

      // Callback 可能在 start Promise 前结束 operation；late continuation 永不恢复 recording。
      if (
        activeOperationRef.current !== operation ||
        operation.status !== 'starting'
      ) {
        return;
      }
      if (result === 'denied') {
        finalizeFailure(operation, '麦克风权限未开启');
        return;
      }
      if (!operation.events.videoStarted(operation.token)) {
        await requestNativeCancel(operation);
        return;
      }

      operation.status = 'recording';
      sampleDuration(operation);
      if (
        activeOperationRef.current === operation &&
        operation.status === 'recording'
      ) {
        operation.timer = setInterval(
          () => sampleDuration(operation),
          DURATION_POLL_MS
        );
      }
    },
    [
      cameraRef,
      fileRegistry,
      finalizeFailure,
      onError,
      requestNativeCancel,
      sampleDuration,
      claimTerminal,
    ]
  );

  const stop = useCallback((): void => {
    const operation = activeOperationRef.current;
    if (
      operation == null ||
      !isLive(operation.status) ||
      operation.stopIssued
    ) {
      return;
    }

    let duration = operation.lastDuration;
    try {
      const sampled = operation.camera?.getRecordedDuration();
      if (sampled != null && Number.isFinite(sampled) && sampled >= 0) {
        duration = sampled;
        operation.lastDuration = sampled;
      }
    } catch {
      // stop 的 reducer snapshot 回退到上一个有效 duration。
    }

    if (!operation.events.stopVideo(operation.token, duration)) {
      requestNativeCancel(operation).catch(() => {});
      return;
    }
    operation.stopIssued = true;
    operation.status = 'stopping';

    let stopRequest: void | Promise<void>;
    try {
      stopRequest = operation.camera?.stopVideo();
    } catch {
      finalizeFailure(operation, '录像失败,请重试');
      return;
    }
    Promise.resolve(stopRequest).catch(() => {
      finalizeFailure(operation, '录像失败,请重试');
    });
  }, [finalizeFailure, requestNativeCancel]);

  const cancel = useCallback(async (): Promise<void> => {
    const operation = activeOperationRef.current;
    if (operation == null) return;
    await requestNativeCancel(operation);
  }, [requestNativeCancel]);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const operation = activeOperationRef.current;
      if (operation != null) {
        requestNativeCancel(operation).catch(() => {});
      }
    };
  }, [requestNativeCancel]);

  return {
    start,
    stop,
    cancel,
  };
}
