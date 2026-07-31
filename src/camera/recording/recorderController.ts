import type {
  RecorderSettings,
  RecordingFinishedReason,
} from 'react-native-vision-camera';

export type RecorderLike = {
  readonly recordedDuration: number;
  startRecording: (
    onFinished: (path: string, reason: RecordingFinishedReason) => void,
    onError: (error: Error) => void,
    onPaused?: () => void,
    onResumed?: () => void
  ) => Promise<void>;
  stopRecording: () => Promise<void>;
  cancelRecording: () => Promise<void>;
  dispose: () => void;
};

export type RecorderControllerCallbacks = {
  onFinished: (
    path: string,
    reason: RecordingFinishedReason,
    duration: number
  ) => void;
  onError: (error: Error) => void;
  /** output identity / owner dispose 使本次 Recorder 失效；它不是 native error。 */
  onCancelled?: () => void;
};

export type StartRecorderOptions = {
  hasMicrophonePermission: boolean;
  requestMicrophonePermission: () => Promise<boolean>;
  settings: RecorderSettings;
  callbacks: RecorderControllerCallbacks;
};

export type RecorderController = {
  start: (options: StartRecorderOptions) => Promise<'started' | 'denied'>;
  stop: () => Promise<void>;
  cancel: () => Promise<void>;
  dispose: () => Promise<void>;
  getRecordedDuration: () => number;
};

type RecorderControllerDependencies = {
  createRecorder: (settings: RecorderSettings) => Promise<RecorderLike>;
  now?: () => number;
};

type RecorderOperation = {
  recorder: RecorderLike;
  callbacks: RecorderControllerCallbacks;
  settings: RecorderSettings;
  state: 'pending' | 'finalized' | 'cancelled';
  startedAt: number;
  observedDuration: number;
  stopDuration: number;
  disposed: boolean;
  stopPromise: Promise<void> | null;
};

type RecorderAttempt = {
  cancelled: boolean;
  callbacks: RecorderControllerCallbacks;
};

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function finiteDuration(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function createRecorderController({
  createRecorder,
  now,
}: RecorderControllerDependencies): RecorderController {
  let active: RecorderOperation | null = null;
  let pendingAttempt: RecorderAttempt | null = null;
  let lastDuration = 0;
  let controllerDisposed = false;
  const clockSource =
    now ??
    (() => {
      const performanceNow = globalThis.performance?.now;
      return typeof performanceNow === 'function'
        ? performanceNow.call(globalThis.performance)
        : Date.now();
    });
  let lastClockValue = Number.NEGATIVE_INFINITY;

  const monotonicNow = () => {
    let next = lastClockValue;
    try {
      const value = clockSource();
      if (Number.isFinite(value)) next = Math.max(lastClockValue, value);
    } catch {
      // 单调时钟只用于 duration fallback；读取失败时沿用上次值。
    }
    if (!Number.isFinite(next)) next = 0;
    lastClockValue = next;
    return next;
  };

  const disposeRecorder = (operation: RecorderOperation) => {
    if (operation.disposed) return;
    operation.disposed = true;
    try {
      operation.recorder.dispose();
    } catch (error) {
      console.warn('recorder dispose failed', error);
    }
  };

  const readNativeDuration = (operation: RecorderOperation) => {
    try {
      operation.observedDuration = Math.max(
        operation.observedDuration,
        finiteDuration(operation.recorder.recordedDuration)
      );
    } catch {
      // 已终止的 native Recorder 可能拒绝属性访问；保留此前缓存值。
    }
    return operation.observedDuration;
  };

  const elapsedDuration = (operation: RecorderOperation) =>
    Math.max(0, (monotonicNow() - operation.startedAt) / 1000);

  const computeDuration = (
    operation: RecorderOperation,
    reason?: RecordingFinishedReason
  ) => {
    const configuredMax =
      reason === 'max-duration-reached'
        ? finiteDuration(operation.settings.maxDuration ?? 0)
        : 0;
    return Math.max(
      readNativeDuration(operation),
      operation.stopDuration,
      elapsedDuration(operation),
      configuredMax
    );
  };

  const clearActive = (operation: RecorderOperation) => {
    if (active === operation) active = null;
  };

  const notifyError = (
    callbacks: RecorderControllerCallbacks,
    error: Error
  ) => {
    try {
      callbacks.onError(error);
    } catch (callbackError) {
      console.warn('recorder error callback failed', callbackError);
    }
  };

  const notifyCancelled = (callbacks: RecorderControllerCallbacks) => {
    try {
      callbacks.onCancelled?.();
    } catch (callbackError) {
      console.warn('recorder cancel callback failed', callbackError);
    }
  };

  const finalizeFinished = (
    operation: RecorderOperation,
    path: string,
    reason: RecordingFinishedReason
  ) => {
    if (operation.state !== 'pending') return;

    const duration = computeDuration(operation, reason);
    operation.state = 'finalized';
    lastDuration = duration;
    clearActive(operation);
    try {
      operation.callbacks.onFinished(path, reason, duration);
    } catch (error) {
      console.warn('recorder finished callback failed', error);
    } finally {
      disposeRecorder(operation);
    }
  };

  const finalizeNativeError = (operation: RecorderOperation, error: Error) => {
    if (operation.state !== 'pending') return;

    lastDuration = computeDuration(operation);
    operation.state = 'finalized';
    clearActive(operation);
    notifyError(operation.callbacks, error);
    disposeRecorder(operation);
  };

  const abortWithError = async (operation: RecorderOperation, error: Error) => {
    if (operation.state !== 'pending') return false;

    lastDuration = computeDuration(operation);
    operation.state = 'finalized';
    clearActive(operation);
    notifyError(operation.callbacks, error);
    try {
      await operation.recorder.cancelRecording();
    } catch {
      // 原始 start/stop 错误是诊断真值；cancel 仅 best-effort 防 orphan recording。
    } finally {
      disposeRecorder(operation);
    }
    return true;
  };

  const cleanupUnstartedRecorder = async (recorder: RecorderLike) => {
    try {
      await recorder.cancelRecording();
    } catch {
      // create 已产出但尚未 start；部分平台不允许此时 cancel，dispose 仍必须执行。
    } finally {
      try {
        recorder.dispose();
      } catch (error) {
        console.warn('recorder dispose failed', error);
      }
    }
  };

  const start = async ({
    hasMicrophonePermission,
    requestMicrophonePermission,
    settings: inputSettings,
    callbacks,
  }: StartRecorderOptions): Promise<'started' | 'denied'> => {
    // 权限请求与 native create 都可能 await；先快照设置，避免调用方随后修改本次 Recorder。
    const settings = { ...inputSettings };
    if (controllerDisposed) return 'denied';
    if (pendingAttempt != null || active?.state === 'pending') {
      const error = new Error('A video recording is already active');
      notifyError(callbacks, error);
      throw error;
    }

    // 从 permission/create 阶段就占住 attempt；否则两个 start 会在 active Recorder 安装前并发越过。
    const attempt: RecorderAttempt = { cancelled: false, callbacks };
    pendingAttempt = attempt;
    let granted = hasMicrophonePermission;
    if (!granted) {
      try {
        granted = await requestMicrophonePermission();
      } catch {
        granted = false;
      }
    }
    if (!granted || attempt.cancelled || controllerDisposed) {
      if (pendingAttempt === attempt) pendingAttempt = null;
      return 'denied';
    }

    let recorder: RecorderLike;
    try {
      recorder = await createRecorder(settings);
    } catch (error) {
      if (pendingAttempt === attempt) pendingAttempt = null;
      if (attempt.cancelled || controllerDisposed) return 'denied';
      const normalized = asError(error);
      notifyError(callbacks, normalized);
      throw normalized;
    }

    if (attempt.cancelled || controllerDisposed) {
      if (pendingAttempt === attempt) pendingAttempt = null;
      await cleanupUnstartedRecorder(recorder);
      return 'denied';
    }

    const operation: RecorderOperation = {
      recorder,
      callbacks,
      settings,
      state: 'pending',
      startedAt: monotonicNow(),
      observedDuration: 0,
      stopDuration: 0,
      disposed: false,
      stopPromise: null,
    };
    if (pendingAttempt === attempt) pendingAttempt = null;
    active = operation;
    lastDuration = 0;

    try {
      await recorder.startRecording(
        (path, reason) => finalizeFinished(operation, path, reason),
        (error) => finalizeNativeError(operation, error),
        () => {},
        () => {}
      );
      // cancel/dispose 可能先于 native start continuation；只有 cancel 要映射 denied。
      // finish/error callback 已 finalized 时仍返回 started，让上层以 callback 真值收口。
      return operation.state === 'cancelled' ? 'denied' : 'started';
    } catch (error) {
      const normalized = asError(error);
      // callback 可能已先完成；此时 callback 是唯一终态，晚到 continuation 只能 no-op。
      const ownedFailure = await abortWithError(operation, normalized);
      if (!ownedFailure) {
        return operation.state === 'cancelled' ? 'denied' : 'started';
      }
      throw normalized;
    }
  };

  const stop = async () => {
    const operation = active;
    if (operation == null || operation.state !== 'pending') return;
    if (operation.stopPromise != null) return operation.stopPromise;

    // 官方语义：stop resolve 只代表请求已提交；必须在调用前缓存会在终止后归零的 duration。
    operation.stopDuration = Math.max(
      operation.stopDuration,
      readNativeDuration(operation),
      elapsedDuration(operation)
    );
    const stopPromise = (async () => {
      try {
        await operation.recorder.stopRecording();
      } catch (error) {
        const normalized = asError(error);
        // finish/error callback 可能先占终态；晚到 stop reject 不能覆盖既有结果。
        const ownedFailure = await abortWithError(operation, normalized);
        if (ownedFailure) throw normalized;
      }
    })();
    operation.stopPromise = stopPromise;
    return stopPromise;
  };

  const cancelActive = async (notifyOwner: boolean) => {
    const attempt = pendingAttempt;
    if (attempt != null) {
      // permission/create continuation 会看到该标记；若 Recorder 晚到，由它自行 cancel+dispose。
      attempt.cancelled = true;
      if (pendingAttempt === attempt) pendingAttempt = null;
      if (notifyOwner) notifyCancelled(attempt.callbacks);
    }

    const operation = active;
    if (operation == null || operation.state !== 'pending') return;

    // await 前先原子占有取消终态；同期 finish/error callback 只能 no-op，不能交付文件。
    operation.state = 'cancelled';
    clearActive(operation);
    if (notifyOwner) notifyCancelled(operation.callbacks);
    try {
      await operation.recorder.cancelRecording();
    } finally {
      disposeRecorder(operation);
    }
  };

  const cancel = () => cancelActive(false);

  const getRecordedDuration = () => {
    const operation = active;
    if (operation == null || operation.state !== 'pending') {
      return lastDuration;
    }
    const duration = Math.max(
      readNativeDuration(operation),
      elapsedDuration(operation)
    );
    operation.observedDuration = Math.max(operation.observedDuration, duration);
    lastDuration = operation.observedDuration;
    return operation.observedDuration;
  };

  return {
    start,
    stop,
    cancel,
    dispose: async () => {
      controllerDisposed = true;
      // output identity replacement 不能静默丢掉上层 waiter；以独立 cancel 终态通知，
      // 不伪装 native error。显式 session cancel 已由调用方先失效 operation，故仍走 cancel()。
      await cancelActive(true);
    },
    getRecordedDuration,
  };
}
