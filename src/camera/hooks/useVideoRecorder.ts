import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { CustomPhotoFile } from '../../utils';
import type { CameraHandle, VideoCallbacks } from '../Camera';

type HookRecordingOperation = {
  id: number;
  outcome: 'pending' | 'finished' | 'error' | 'cancelled';
  stopPromise: Promise<CustomPhotoFile | null> | null;
  resolveStop: ((file: CustomPhotoFile | null) => void) | null;
  terminalPromise: Promise<
    Exclude<HookRecordingOperation['outcome'], 'pending'>
  >;
  resolveTerminal:
    | ((outcome: Exclude<HookRecordingOperation['outcome'], 'pending'>) => void)
    | null;
};

export type VideoRecorder = {
  recording: boolean;
  recSeconds: number;
  /** 成功返回 true；permission denied、ref 缺失或 native start error 返回 false。 */
  startRecording: () => Promise<boolean>;
  /**
   * Task 4→5 的临时兼容桥：CameraHandle.stopVideo() 只提交 void 请求，本方法等待本次
   * start 安装的 finish callback 后返回 file，供尚未 reducer 化的 useCaptureFlow 消费。
   */
  stopRecording: () => Promise<CustomPhotoFile | null>;
  /** session force teardown：立即使 operation token 失效，再请求 native cancel。 */
  cancelRecording: () => Promise<void>;
  /** 兼容现有自动结束 prop；新 callback 已复位时为幂等 no-op。 */
  markStopped: () => void;
};

/**
 * Task 4 的录像 adapter：native callback 是唯一终态，start/stop Promise continuation
 * 只处理请求结果。Task 5 会把这些 operation-local event 接入统一 reducer / registry。
 */
export function useVideoRecorder(
  cameraRef: RefObject<CameraHandle | null>
): VideoRecorder {
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const mountedRef = useRef(true);
  const recordingRef = useRef(false);
  const latestCameraRef = useRef(cameraRef);
  latestCameraRef.current = cameraRef;
  const nextOperationIdRef = useRef(1);
  const operationRef = useRef<HookRecordingOperation | null>(null);

  const transitionStopped = useCallback(() => {
    const wasRecording = recordingRef.current;
    recordingRef.current = false;
    if (!mountedRef.current || !wasRecording) return;
    setRecording(false);
    setRecSeconds(0);
  }, []);

  const finalizeOperation = useCallback(
    (
      operation: HookRecordingOperation,
      outcome: Exclude<HookRecordingOperation['outcome'], 'pending'>,
      file: CustomPhotoFile | null
    ) => {
      if (operation.outcome !== 'pending') return;
      operation.outcome = outcome;
      if (operationRef.current === operation) operationRef.current = null;
      transitionStopped();
      operation.resolveStop?.(file);
      operation.resolveStop = null;
      operation.resolveTerminal?.(outcome);
      operation.resolveTerminal = null;
    },
    [transitionStopped]
  );

  useEffect(() => {
    if (!recording) {
      setRecSeconds(0);
      return;
    }
    const updateDuration = () => {
      const duration = cameraRef.current?.getRecordedDuration?.() ?? 0;
      setRecSeconds(Math.max(0, Math.floor(duration)));
    };
    updateDuration();
    const id = setInterval(updateDuration, 250);
    return () => clearInterval(id);
  }, [cameraRef, recording]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    const camera = cameraRef.current;
    if (
      camera == null ||
      operationRef.current?.outcome === 'pending' ||
      recordingRef.current
    ) {
      return false;
    }

    let resolveTerminal!: NonNullable<
      HookRecordingOperation['resolveTerminal']
    >;
    const terminalPromise = new Promise<
      Exclude<HookRecordingOperation['outcome'], 'pending'>
    >((resolve) => {
      resolveTerminal = resolve;
    });
    const operation: HookRecordingOperation = {
      id: nextOperationIdRef.current++,
      outcome: 'pending',
      stopPromise: null,
      resolveStop: null,
      terminalPromise,
      resolveTerminal,
    };
    operationRef.current = operation;

    const callbacks: VideoCallbacks = {
      onFinished: (file) => {
        finalizeOperation(operation, 'finished', file);
      },
      onError: () => {
        finalizeOperation(operation, 'error', null);
      },
      onCancelled: () => {
        finalizeOperation(operation, 'cancelled', null);
      },
    };

    let startRequest: Promise<'started' | 'denied'>;
    try {
      startRequest = camera.startVideo(callbacks);
    } catch {
      finalizeOperation(operation, 'error', null);
      return false;
    }
    const nativeOutcome = startRequest.then(
      (result) => ({ type: 'native' as const, result }),
      () => ({ type: 'error' as const })
    );
    const terminalOutcome = operation.terminalPromise.then((outcome) => ({
      type: 'terminal' as const,
      outcome,
    }));
    const first = await Promise.race([nativeOutcome, terminalOutcome]);

    if (first.type === 'terminal') {
      return first.outcome === 'finished';
    }
    if (first.type === 'error') {
      finalizeOperation(operation, 'error', null);
      return false;
    }
    if (first.result === 'denied') {
      finalizeOperation(operation, 'cancelled', null);
      return false;
    }
    if (operation.outcome === 'error' || operation.outcome === 'cancelled') {
      return false;
    }
    if (operation.outcome === 'finished') {
      // 自动结束可早于 start continuation；文件已由 callback/兼容 prop 收口，不能回写 recording。
      return true;
    }
    recordingRef.current = true;
    if (mountedRef.current) setRecording(true);
    return true;
  }, [cameraRef, finalizeOperation]);

  const stopRecording = useCallback((): Promise<CustomPhotoFile | null> => {
    const camera = cameraRef.current;
    const operation = operationRef.current;
    if (
      camera == null ||
      operation == null ||
      operation.outcome !== 'pending'
    ) {
      return Promise.resolve(null);
    }
    if (operation.stopPromise != null) return operation.stopPromise;

    const finished = new Promise<CustomPhotoFile | null>((resolve) => {
      operation.resolveStop = resolve;
    });
    operation.stopPromise = finished;
    const requestStop = async () => {
      try {
        // 返回值必须忽略：官方 stop resolve 只代表停止请求已提交，文件只从 callback 来。
        await camera.stopVideo();
      } catch {
        finalizeOperation(operation, 'error', null);
      }
    };
    requestStop();
    return finished;
  }, [cameraRef, finalizeOperation]);

  const cancelRecording = useCallback(async () => {
    const operation = operationRef.current;
    if (operation != null) {
      finalizeOperation(operation, 'cancelled', null);
    } else {
      transitionStopped();
    }
    try {
      await cameraRef.current?.cancelVideo?.();
    } catch {
      // force teardown 不能因 native cancel 失败恢复 UI operation；controller 仍会 dispose。
    }
  }, [cameraRef, finalizeOperation, transitionStopped]);

  const markStopped = useCallback(() => {
    // Camera 的统一 callback 先复位，再调用兼容 auto-finish prop；这里通常是幂等 no-op。
    transitionStopped();
  }, [transitionStopped]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const operation = operationRef.current;
      if (operation != null) {
        finalizeOperation(operation, 'cancelled', null);
      }
      recordingRef.current = false;
      latestCameraRef.current.current?.cancelVideo?.()?.catch(() => {});
    };
  }, [finalizeOperation]);

  return {
    recording,
    recSeconds,
    startRecording,
    stopRecording,
    cancelRecording,
    markStopped,
  };
}
