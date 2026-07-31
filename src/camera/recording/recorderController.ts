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
  /** 终态后才产出的 path 必须交给原 session 清理，不能静默遗留或进入 UI。 */
  onDiscardedFile?: (path: string) => void;
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
  /**
   * 重新启用一个仅因 effect cleanup 而失效的 controller。React 19 StrictMode 会
   * setup → cleanup → setup 复用同一个 memo 实例，若不提供该入口，`dispose()` 的
   * `controllerDisposed` 会让此后所有 `start()` 永远返回 'denied'。
   * 只清 controller 级别的失效位，绝不复活任何已取消的 attempt / operation。
   */
  activate: () => void;
  dispose: () => Promise<void>;
  getRecordedDuration: () => number;
};

type RecorderControllerDependencies = {
  createRecorder: (settings: RecorderSettings) => Promise<RecorderLike>;
  now?: () => number;
  /** 有界 teardown 的定时器；缺省 setTimeout。测试注入后可手动触发，无需 fake timers。 */
  scheduleTimeout?: (callback: () => void, ms: number) => () => void;
};

/** native cancel 最多尝试次数：一次抢占 + 两次 start settle 后的补救。 */
export const CANCEL_MAX_ATTEMPTS = 3;
/** 两次 cancel 之间的退避上限；start settle 信号先到时会提前结束等待。 */
export const CANCEL_RETRY_DELAY_MS = 120;
/** 单次 native cancel 的等待上限；native 挂死时不能让 teardown 永远悬着。 */
export const CANCEL_ATTEMPT_TIMEOUT_MS = 2000;

type RecorderOperation = {
  recorder: RecorderLike;
  callbacks: RecorderControllerCallbacks;
  settings: RecorderSettings;
  state: 'pending' | 'finalized' | 'cancelled';
  startedAt: number;
  /** 只累计正的 native 读数（含 stop 前 snapshot）；与 monotonic fallback 严格分离。 */
  observedNativeDuration: number;
  disposed: boolean;
  stopPromise: Promise<void> | null;
  deliveredPath: string | null;
  reportedProducedPaths: Set<string>;
  /** native `startRecording()` continuation resolve 或 reject 后 settle，用于取消重试。 */
  startSettled: Promise<void>;
  markStartSettled: () => void;
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
  scheduleTimeout,
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
  const timerSource =
    scheduleTimeout ??
    ((callback: () => void, ms: number) => {
      const handle = setTimeout(callback, ms);
      return () => clearTimeout(handle);
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

  /**
   * 把「信号 Promise」与「定时器」竞速成一个必定 settle 的结果。定时器句柄在任一分支胜出后
   * 立即 clear：否则每次 teardown 都会留一个悬挂的 setTimeout，测试和真机都会泄漏。
   */
  const raceWithTimer = <T>(
    signal: Promise<T>,
    ms: number,
    timeoutValue: T
  ): Promise<T> =>
    new Promise<T>((resolve) => {
      let settled = false;
      let clearTimer: (() => void) | null = null;
      const runClear = () => {
        const clear = clearTimer;
        clearTimer = null;
        if (clear == null) return;
        try {
          clear();
        } catch (error) {
          console.warn('recorder teardown timer clear failed', error);
        }
      };
      const settle = (value: T) => {
        if (settled) return;
        settled = true;
        runClear();
        resolve(value);
      };
      clearTimer = timerSource(() => settle(timeoutValue), ms);
      // 注入的 scheduleTimeout 若同步触发，上一行赋值发生在 settle 之后；这里补一次 clear。
      if (settled) runClear();
      signal.then(
        (value) => settle(value),
        () => settle(timeoutValue)
      );
    });

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
      operation.observedNativeDuration = Math.max(
        operation.observedNativeDuration,
        finiteDuration(operation.recorder.recordedDuration)
      );
    } catch {
      // 已终止的 native Recorder 可能拒绝属性访问；保留此前缓存值。
    }
    return operation.observedNativeDuration;
  };

  /**
   * 只在拿不到 native 读数时兜底。`startedAt` 会在 native start continuation resolve 后
   * 重锚（见 start()），所以这里量的是「录像真正开始之后」的墙上时间，不含创建/启动开销。
   */
  const elapsedFallback = (operation: RecorderOperation) =>
    Math.max(0, (monotonicNow() - operation.startedAt) / 1000);

  /**
   * duration 单一规则：native 有正读数就是真值，绝不被 monotonic 覆盖 —— 早期无条件
   * `Math.max(native, elapsed, …)` 会把 start 延迟（真机常见数百毫秒到数秒）算进时长，
   * 系统性高估。只有 `max-duration-reached` 才补到配置上限：native 到点自停时读数可能
   * 略小于配置值，而对消费者语义上就是「录满了」。
   */
  const computeDuration = (
    operation: RecorderOperation,
    reason?: RecordingFinishedReason
  ) => {
    const native = readNativeDuration(operation);
    const base = native > 0 ? native : elapsedFallback(operation);
    if (reason === 'max-duration-reached') {
      return Math.max(
        base,
        finiteDuration(operation.settings.maxDuration ?? 0)
      );
    }
    return base;
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

  /**
   * 终态之后才产出的 path 必须原路交回，不能静默遗留、也不能混进 UI 结果。
   * **Task 4→5 交接点**：Task 5 会注入产生它的原 session `FileRegistry`
   * （先登记、再检查 operation token、最后删除），Task 4 只在 `Camera.tsx` 保留
   * RNFS best-effort 兜底。这里按 path 去重（见 `reportedProducedPaths`），
   * 保证同一 path 只上报一次，下游不会重复 unlink。
   */
  const notifyDiscardedFile = (
    callbacks: RecorderControllerCallbacks,
    path: string
  ) => {
    try {
      callbacks.onDiscardedFile?.(path);
    } catch (callbackError) {
      console.warn('recorder discarded-file callback failed', callbackError);
    }
  };

  const finalizeFinished = (
    operation: RecorderOperation,
    path: string,
    reason: RecordingFinishedReason
  ) => {
    if (operation.reportedProducedPaths.has(path)) return;
    operation.reportedProducedPaths.add(path);
    if (operation.state !== 'pending') {
      if (operation.deliveredPath !== path) {
        notifyDiscardedFile(operation.callbacks, path);
      }
      return;
    }

    const duration = computeDuration(operation, reason);
    operation.state = 'finalized';
    operation.deliveredPath = path;
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

  /**
   * 取消一个已取得取消终态的 operation，并保证 recorder 恰好被 dispose 一次。
   *
   * 为什么要重试：`HybridVideoRecorder.swift` 的 `cancelRecording()` 开头是
   * `guard self.videoOutput.isRecording else { throw ... "Not currently recording!" }`。
   * 若 `startRecording()` 的 Promise 还 pending（native 尚未走到 `onRecordingStarted`），
   * 此刻 cancel 必然 reject，而录像随后仍会真正开始 —— 只 cancel 一次就 dispose 会留下
   * 一段脱离控制的 native 录像。所以 reject 后要等 start settle（或退避超时）再补一刀。
   *
   * 为什么每次 attempt 还要超时：native cancel 挂死时不能让 teardown 永远悬着（会拖住
   * effect cleanup / session 收尾）；超时即停手，正确性由「晚到 path 走 discard + dispose」兜底。
   */
  const teardownCancelledOperation = async (operation: RecorderOperation) => {
    // native binding 既可能 reject 也可能同步 throw；两者一律归一成 'rejected' 继续重试。
    const requestNativeCancel = (): Promise<'cancelled' | 'rejected'> => {
      const rejected = (error: unknown) => {
        console.warn('recorder cancel attempt failed', error);
        return 'rejected' as const;
      };
      try {
        return Promise.resolve(operation.recorder.cancelRecording()).then(
          () => 'cancelled' as const,
          rejected
        );
      } catch (error) {
        return Promise.resolve(rejected(error));
      }
    };

    try {
      for (let attempt = 1; attempt <= CANCEL_MAX_ATTEMPTS; attempt += 1) {
        const outcome = await raceWithTimer<
          'cancelled' | 'rejected' | 'timeout'
        >(requestNativeCancel(), CANCEL_ATTEMPT_TIMEOUT_MS, 'timeout');
        if (outcome !== 'rejected') return;
        if (attempt === CANCEL_MAX_ATTEMPTS) return;
        // start settle 才是「native 现在真的在录」的可靠信号；退避定时器只是它不来时的上限。
        await raceWithTimer<'start-settled' | 'timeout'>(
          operation.startSettled.then(() => 'start-settled' as const),
          CANCEL_RETRY_DELAY_MS,
          'timeout'
        );
      }
    } catch (error) {
      console.warn('recorder teardown failed', error);
    } finally {
      disposeRecorder(operation);
    }
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

    let markStartSettled!: () => void;
    const startSettled = new Promise<void>((resolve) => {
      markStartSettled = resolve;
    });
    const operation: RecorderOperation = {
      recorder,
      callbacks,
      settings,
      state: 'pending',
      startedAt: monotonicNow(),
      observedNativeDuration: 0,
      disposed: false,
      stopPromise: null,
      deliveredPath: null,
      reportedProducedPaths: new Set(),
      startSettled,
      markStartSettled,
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
      // 官方语义：startRecording 的 Promise 在 onRecordingStarted 才 resolve = 录像真正开始。
      // 把 monotonic 锚点重置到此刻，否则权限请求 / createRecorder / native 启动的开销都会被
      // 算进 fallback duration（真机上常见数百毫秒到数秒的系统性高估）。
      // 只在仍 pending 时重锚：已 finalized/cancelled 的 operation 不能被晚到 continuation 改写。
      if (operation.state === 'pending') operation.startedAt = monotonicNow();
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
    } finally {
      // resolve 或 reject 都算 settle：teardown 靠它判断「native 是否已经真的开录」。
      operation.markStartSettled();
    }
  };

  const stop = async () => {
    const operation = active;
    if (operation == null || operation.state !== 'pending') return;
    if (operation.stopPromise != null) return operation.stopPromise;

    // 官方语义：stop resolve 只代表请求已提交；必须在调用前快照会在终止后归零/抛错的 native 读数。
    // 只快照 native，不再把 monotonic elapsed 混进来（那会让 stop 前的等待时间污染真实时长）。
    readNativeDuration(operation);
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
    // cancel()/dispose() 一律不向外 reject：调用方是 effect cleanup / session 收尾，
    // 拿到 rejection 也无从处置；native 失败只 warn，正确性靠晚到 path discard + dispose。
    await teardownCancelledOperation(operation);
  };

  const cancel = () => cancelActive(false);

  // 与 computeDuration 同一规则：native 正读数优先，取不到才用（已重锚的）monotonic fallback。
  const getRecordedDuration = () => {
    const operation = active;
    if (operation == null || operation.state !== 'pending') {
      return lastDuration;
    }
    const native = readNativeDuration(operation);
    lastDuration = native > 0 ? native : elapsedFallback(operation);
    return lastDuration;
  };

  return {
    start,
    stop,
    cancel,
    // 只清 controller 级失效位。已被取消的 attempt / operation 各自带自己的 token，
    // 这里不碰它们 —— 「effect 重新挂载可以重新开始录像」与「上一次录像永远回不来」不冲突。
    activate: () => {
      controllerDisposed = false;
    },
    dispose: async () => {
      controllerDisposed = true;
      // output identity replacement 不能静默丢掉上层 waiter；以独立 cancel 终态通知，
      // 不伪装 native error。显式 session cancel 已由调用方先失效 operation，故仍走 cancel()。
      await cancelActive(true);
    },
    getRecordedDuration,
  };
}
