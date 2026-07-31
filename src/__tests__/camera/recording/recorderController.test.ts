import type {
  RecorderSettings,
  RecordingFinishedReason,
} from 'react-native-vision-camera';
import {
  CANCEL_ATTEMPT_TIMEOUT_MS,
  CANCEL_MAX_ATTEMPTS,
  CANCEL_RETRY_DELAY_MS,
  createRecorderController,
  type RecorderControllerCallbacks,
  type RecorderLike,
} from '../../../camera/recording/recorderController';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>['resolve'];
  let reject!: Deferred<T>['reject'];
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type RecorderHarness = {
  recorder: RecorderLike;
  finish: (path?: string, reason?: RecordingFinishedReason) => void;
  fail: (error?: Error) => void;
  startDeferred: Deferred<void> | null;
  stopDeferred: Deferred<void> | null;
  cancelDeferred: Deferred<void> | null;
  setRecordedDuration: (duration: number) => void;
  /** 模拟已终止 / 已 detach 的 native Recorder 拒绝属性访问。 */
  setDurationThrows: (throws: boolean) => void;
};

function makeRecorder({
  deferredStart = false,
  deferredStop = false,
  deferredCancel = false,
}: {
  deferredStart?: boolean;
  deferredStop?: boolean;
  deferredCancel?: boolean;
} = {}): RecorderHarness {
  const startDeferred = deferredStart ? deferred<void>() : null;
  const stopDeferred = deferredStop ? deferred<void>() : null;
  const cancelDeferred = deferredCancel ? deferred<void>() : null;
  let onFinished:
    | ((path: string, reason: RecordingFinishedReason) => void)
    | undefined;
  let onError: ((error: Error) => void) | undefined;
  let recordedDuration = 0;
  let durationThrows = false;

  const recorder: RecorderLike = {
    startRecording: jest.fn((finished, error) => {
      onFinished = finished;
      onError = error;
      return startDeferred?.promise ?? Promise.resolve();
    }),
    stopRecording: jest.fn(() => stopDeferred?.promise ?? Promise.resolve()),
    cancelRecording: jest.fn(
      () => cancelDeferred?.promise ?? Promise.resolve()
    ),
    dispose: jest.fn(),
    get recordedDuration() {
      if (durationThrows) throw new Error('native recorder detached');
      return recordedDuration;
    },
  };

  return {
    recorder,
    finish: (
      path = '/tmp/video.mp4',
      reason: RecordingFinishedReason = 'stopped'
    ) => onFinished?.(path, reason),
    fail: (error = new Error('native recording error')) => onError?.(error),
    startDeferred,
    stopDeferred,
    cancelDeferred,
    setRecordedDuration: (duration) => {
      recordedDuration = duration;
    },
    setDurationThrows: (throws) => {
      durationThrows = throws;
    },
  };
}

function makeCallbacks(): RecorderControllerCallbacks & {
  onFinished: jest.Mock;
  onError: jest.Mock;
  onCancelled: jest.Mock;
  onDiscardedFile: jest.Mock;
} {
  return {
    onFinished: jest.fn(),
    onError: jest.fn(),
    onCancelled: jest.fn(),
    onDiscardedFile: jest.fn(),
  };
}

/** 有界 teardown 的定时器注入：手动触发即可确定性覆盖超时/退避，无需 fake timers。 */
function makeTimerHarness() {
  const timers: { callback: () => void; ms: number; cleared: boolean }[] = [];
  const scheduleTimeout = jest.fn((callback: () => void, ms: number) => {
    const entry = { callback, ms, cleared: false };
    timers.push(entry);
    return () => {
      entry.cleared = true;
    };
  });
  return {
    scheduleTimeout,
    timers,
    pending: () => timers.filter((timer) => !timer.cleared),
    trigger: (index = 0) => {
      const entry = timers.filter((timer) => !timer.cleared)[index];
      entry?.callback();
    },
  };
}

/** 让所有已排队的 microtask 跑完；teardown 循环每次 attempt 会经过多次 await。 */
async function flushMicrotasks(times = 12) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

function startOptions(
  callbacks: RecorderControllerCallbacks,
  overrides: Partial<{
    hasMicrophonePermission: boolean;
    requestMicrophonePermission: () => Promise<boolean>;
    settings: RecorderSettings;
  }> = {}
) {
  return {
    hasMicrophonePermission: true,
    requestMicrophonePermission: jest.fn().mockResolvedValue(true),
    settings: {},
    callbacks,
    ...overrides,
  };
}

describe('recorderController', () => {
  it('麦克风已授权时直接创建并启动；未授权时只在请求结果为 true 后启动', async () => {
    const first = makeRecorder();
    const second = makeRecorder();
    const createRecorder = jest
      .fn()
      .mockResolvedValueOnce(first.recorder)
      .mockResolvedValueOnce(second.recorder);
    const controller = createRecorderController({ createRecorder });
    const firstCallbacks = makeCallbacks();
    const firstRequest = jest.fn().mockResolvedValue(true);

    await expect(
      controller.start(
        startOptions(firstCallbacks, {
          requestMicrophonePermission: firstRequest,
        })
      )
    ).resolves.toBe('started');
    expect(firstRequest).not.toHaveBeenCalled();
    first.finish();

    const secondCallbacks = makeCallbacks();
    const secondRequest = jest.fn().mockResolvedValue(true);
    await expect(
      controller.start(
        startOptions(secondCallbacks, {
          hasMicrophonePermission: false,
          requestMicrophonePermission: secondRequest,
        })
      )
    ).resolves.toBe('started');
    expect(secondRequest).toHaveBeenCalledTimes(1);
    expect(createRecorder).toHaveBeenCalledTimes(2);
  });

  it('麦克风请求返回 false 时不创建 Recorder，也不进入错误终态', async () => {
    const createRecorder = jest.fn();
    const callbacks = makeCallbacks();
    const controller = createRecorderController({ createRecorder });

    await expect(
      controller.start(
        startOptions(callbacks, {
          hasMicrophonePermission: false,
          requestMicrophonePermission: jest.fn().mockResolvedValue(false),
        })
      )
    ).resolves.toBe('denied');

    expect(createRecorder).not.toHaveBeenCalled();
    expect(callbacks.onFinished).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('两个 start 在首个 create await 期间竞争时只允许一个 attempt 创建 Recorder', async () => {
    const creating = deferred<RecorderLike>();
    const secondHarness = makeRecorder();
    const createRecorder = jest
      .fn()
      .mockReturnValueOnce(creating.promise)
      .mockResolvedValueOnce(secondHarness.recorder);
    const controller = createRecorderController({ createRecorder });
    const firstCallbacks = makeCallbacks();
    const secondCallbacks = makeCallbacks();

    const firstStart = controller.start(startOptions(firstCallbacks));
    await Promise.resolve();
    const secondStart = controller.start(startOptions(secondCallbacks));

    await expect(secondStart).rejects.toThrow('already active');
    expect(createRecorder).toHaveBeenCalledTimes(1);
    expect(secondCallbacks.onError).toHaveBeenCalledTimes(1);

    const harness = makeRecorder();
    creating.resolve(harness.recorder);
    await expect(firstStart).resolves.toBe('started');
  });

  it('cancel 在麦克风权限请求 pending 时使 attempt 失效，晚到 granted 不再 create', async () => {
    const permission = deferred<boolean>();
    const createRecorder = jest.fn();
    const callbacks = makeCallbacks();
    const controller = createRecorderController({ createRecorder });

    const starting = controller.start(
      startOptions(callbacks, {
        hasMicrophonePermission: false,
        requestMicrophonePermission: () => permission.promise,
      })
    );
    await Promise.resolve();
    await controller.cancel();
    permission.resolve(true);

    await expect(starting).resolves.toBe('denied');
    expect(createRecorder).not.toHaveBeenCalled();
    expect(callbacks.onFinished).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('cancel 在 create pending 时清理晚到 Recorder，且绝不调用 start/callback', async () => {
    const creating = deferred<RecorderLike>();
    const createRecorder = jest.fn().mockReturnValue(creating.promise);
    const callbacks = makeCallbacks();
    const controller = createRecorderController({ createRecorder });
    const harness = makeRecorder();

    const starting = controller.start(startOptions(callbacks));
    await Promise.resolve();
    await controller.cancel();
    creating.resolve(harness.recorder);

    await expect(starting).resolves.toBe('denied');
    expect(harness.recorder.startRecording).not.toHaveBeenCalled();
    expect(harness.recorder.cancelRecording).toHaveBeenCalledTimes(1);
    expect(harness.recorder.dispose).toHaveBeenCalledTimes(1);
    expect(callbacks.onFinished).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('每次 start 都按当次 settings 创建新 Recorder，不缓存或预热', async () => {
    const first = makeRecorder();
    const second = makeRecorder();
    const createRecorder = jest
      .fn()
      .mockResolvedValueOnce(first.recorder)
      .mockResolvedValueOnce(second.recorder);
    const controller = createRecorderController({ createRecorder });

    await controller.start(
      startOptions(makeCallbacks(), { settings: { maxDuration: 3 } })
    );
    first.finish('/tmp/first.mp4');
    await controller.start(
      startOptions(makeCallbacks(), { settings: { maxDuration: 8 } })
    );

    expect(createRecorder).toHaveBeenNthCalledWith(1, { maxDuration: 3 });
    expect(createRecorder).toHaveBeenNthCalledWith(2, { maxDuration: 8 });
    expect(first.recorder).not.toBe(second.recorder);
  });

  it('create 失败只报告一次错误，且没有可处置的 Recorder', async () => {
    const error = new Error('create failed');
    const callbacks = makeCallbacks();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockRejectedValue(error),
    });

    await expect(controller.start(startOptions(callbacks))).rejects.toBe(error);
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).toHaveBeenCalledWith(error);
  });

  it('start 失败先 cancel 再 dispose，并只报告一次错误', async () => {
    const error = new Error('start failed');
    const harness = makeRecorder();
    jest.mocked(harness.recorder.startRecording).mockRejectedValueOnce(error);
    const callbacks = makeCallbacks();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
    });

    await expect(controller.start(startOptions(callbacks))).rejects.toBe(error);
    expect(harness.recorder.cancelRecording).toHaveBeenCalledTimes(1);
    expect(harness.recorder.dispose).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).toHaveBeenCalledWith(error);
  });

  it('finish 可早于 start Promise continuation，晚到 resolve 不会产生第二终态', async () => {
    const harness = makeRecorder({ deferredStart: true });
    const callbacks = makeCallbacks();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
      now: () => 1000,
    });

    const starting = controller.start(startOptions(callbacks));
    await Promise.resolve();
    await Promise.resolve();
    harness.finish('/tmp/early.mp4', 'max-file-size-reached');
    harness.startDeferred?.resolve();

    await expect(starting).resolves.toBe('started');
    expect(callbacks.onFinished).toHaveBeenCalledTimes(1);
    expect(callbacks.onFinished).toHaveBeenCalledWith(
      '/tmp/early.mp4',
      'max-file-size-reached',
      0
    );
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(harness.recorder.dispose).toHaveBeenCalledTimes(1);
  });

  it('error 可早于 start reject，晚到 reject 不会二次报错或重复 dispose', async () => {
    const harness = makeRecorder({ deferredStart: true });
    const callbacks = makeCallbacks();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
    });
    const nativeError = new Error('callback error');

    const starting = controller.start(startOptions(callbacks));
    await Promise.resolve();
    await Promise.resolve();
    harness.fail(nativeError);
    harness.startDeferred?.reject(new Error('late start rejection'));

    await expect(starting).resolves.toBe('started');
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).toHaveBeenCalledWith(nativeError);
    expect(harness.recorder.dispose).toHaveBeenCalledTimes(1);
    expect(harness.recorder.cancelRecording).not.toHaveBeenCalled();
  });

  it('dispose 在 start Promise pending 时立即发出 cancel 终态，晚到 resolve 只能返回 denied', async () => {
    const harness = makeRecorder({ deferredStart: true });
    const callbacks = makeCallbacks();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
    });

    const starting = controller.start(startOptions(callbacks));
    await Promise.resolve();
    await Promise.resolve();
    const disposing = controller.dispose();

    expect(callbacks.onCancelled).toHaveBeenCalledTimes(1);
    expect(callbacks.onFinished).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();

    harness.startDeferred?.resolve();
    await expect(starting).resolves.toBe('denied');
    await disposing;
    expect(harness.recorder.cancelRecording).toHaveBeenCalledTimes(1);
    expect(harness.recorder.dispose).toHaveBeenCalledTimes(1);
  });

  it('stop 先快照 native duration，文件只由早到的 finish callback 交付', async () => {
    const harness = makeRecorder({ deferredStop: true });
    const callbacks = makeCallbacks();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
      now: () => 1000,
    });
    await controller.start(startOptions(callbacks));
    harness.setRecordedDuration(4.25);

    const stopping = controller.stop();
    harness.setRecordedDuration(0);
    harness.finish('/tmp/stopped.mp4', 'stopped');
    expect(callbacks.onFinished).toHaveBeenCalledWith(
      '/tmp/stopped.mp4',
      'stopped',
      4.25
    );
    expect(callbacks.onFinished).toHaveBeenCalledTimes(1);

    harness.stopDeferred?.resolve();
    await expect(stopping).resolves.toBeUndefined();
    expect(callbacks.onFinished).toHaveBeenCalledTimes(1);
    expect(harness.recorder.dispose).toHaveBeenCalledTimes(1);
  });

  it('finish 后 stop Promise 再 reject 时以 callback 终态为准，不二次报错', async () => {
    const harness = makeRecorder({ deferredStop: true });
    const callbacks = makeCallbacks();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
    });
    await controller.start(startOptions(callbacks));

    const stopping = controller.stop();
    harness.finish('/tmp/stopped.mp4');
    harness.stopDeferred?.reject(new Error('late stop rejection'));

    await expect(stopping).resolves.toBeUndefined();
    expect(callbacks.onFinished).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(harness.recorder.dispose).toHaveBeenCalledTimes(1);
  });

  it('stop throw 时尝试 cancel、清理并只报告一次错误', async () => {
    const error = new Error('stop failed');
    const harness = makeRecorder();
    jest.mocked(harness.recorder.stopRecording).mockRejectedValueOnce(error);
    const callbacks = makeCallbacks();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
    });
    await controller.start(startOptions(callbacks));

    await expect(controller.stop()).rejects.toBe(error);
    expect(harness.recorder.cancelRecording).toHaveBeenCalledTimes(1);
    expect(harness.recorder.dispose).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).toHaveBeenCalledWith(error);
    harness.finish('/tmp/late.mp4');
    expect(callbacks.onFinished).not.toHaveBeenCalled();
  });

  it.each<{
    reason: RecordingFinishedReason;
    expectedDuration: number;
  }>([
    { reason: 'stopped', expectedDuration: 2 },
    { reason: 'max-duration-reached', expectedDuration: 7 },
    { reason: 'max-file-size-reached', expectedDuration: 2 },
  ])(
    '$reason 与手动停止共用同一 finalizer，并保留可信 duration',
    async ({ reason, expectedDuration }) => {
      let now = 1000;
      const harness = makeRecorder();
      const callbacks = makeCallbacks();
      const controller = createRecorderController({
        createRecorder: jest.fn().mockResolvedValue(harness.recorder),
        now: () => now,
      });
      await controller.start(
        startOptions(callbacks, { settings: { maxDuration: 7 } })
      );
      now = 3000;
      harness.finish('/tmp/reason.mp4', reason);

      expect(callbacks.onFinished).toHaveBeenCalledTimes(1);
      expect(callbacks.onFinished).toHaveBeenCalledWith(
        '/tmp/reason.mp4',
        reason,
        expectedDuration
      );
      expect(controller.getRecordedDuration()).toBe(expectedDuration);
    }
  );

  it('注入时钟回退时 duration 保持单调且绝不为负数', async () => {
    let now = 2000;
    const harness = makeRecorder();
    const callbacks = makeCallbacks();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
      now: () => now,
    });
    await controller.start(startOptions(callbacks));
    harness.setRecordedDuration(1.5);
    expect(controller.getRecordedDuration()).toBe(1.5);

    now = 500;
    harness.setRecordedDuration(0);
    harness.finish('/tmp/clock.mp4', 'stopped');

    expect(callbacks.onFinished).toHaveBeenCalledWith(
      '/tmp/clock.mp4',
      'stopped',
      1.5
    );
    expect(controller.getRecordedDuration()).toBe(1.5);
  });

  it('start 延迟不计入时长：native 正读数是真值，绝不被 monotonic 覆盖', async () => {
    let now = 1000;
    const harness = makeRecorder({ deferredStart: true });
    const callbacks = makeCallbacks();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
      now: () => now,
    });

    const starting = controller.start(startOptions(callbacks));
    await flushMicrotasks();
    // native 花了 2000ms 才真正开录（onRecordingStarted 才 resolve start Promise）。
    now = 3000;
    harness.startDeferred?.resolve();
    await expect(starting).resolves.toBe('started');

    harness.setRecordedDuration(0.5);
    now = 3500;
    harness.finish('/tmp/anchored.mp4', 'stopped');

    expect(callbacks.onFinished).toHaveBeenCalledWith(
      '/tmp/anchored.mp4',
      'stopped',
      0.5
    );
  });

  it('native 读数恒为 0 时用 monotonic fallback，且只计 start settle 之后的时长', async () => {
    let now = 1000;
    const harness = makeRecorder({ deferredStart: true });
    const callbacks = makeCallbacks();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
      now: () => now,
    });

    const starting = controller.start(startOptions(callbacks));
    await flushMicrotasks();
    now = 3000;
    harness.startDeferred?.resolve();
    await expect(starting).resolves.toBe('started');

    now = 4500;
    expect(controller.getRecordedDuration()).toBe(1.5);
    harness.finish('/tmp/fallback.mp4', 'stopped');

    expect(callbacks.onFinished).toHaveBeenCalledWith(
      '/tmp/fallback.mp4',
      'stopped',
      1.5
    );
  });

  it('native duration 读取抛错时回退到 monotonic，不中断终态交付', async () => {
    let now = 1000;
    const harness = makeRecorder();
    const callbacks = makeCallbacks();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
      now: () => now,
    });
    await controller.start(startOptions(callbacks));

    harness.setDurationThrows(true);
    now = 2500;

    expect(() => controller.getRecordedDuration()).not.toThrow();
    expect(controller.getRecordedDuration()).toBe(1.5);
    harness.finish('/tmp/throwing.mp4', 'stopped');

    expect(callbacks.onFinished).toHaveBeenCalledWith(
      '/tmp/throwing.mp4',
      'stopped',
      1.5
    );
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('max-duration-reached 时 native 读数小于配置上限也至少返回 maxDuration', async () => {
    let now = 1000;
    const harness = makeRecorder();
    const callbacks = makeCallbacks();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
      now: () => now,
    });
    await controller.start(
      startOptions(callbacks, { settings: { maxDuration: 7 } })
    );

    harness.setRecordedDuration(6.87);
    now = 1200;
    harness.finish('/tmp/max.mp4', 'max-duration-reached');

    expect(callbacks.onFinished).toHaveBeenCalledWith(
      '/tmp/max.mp4',
      'max-duration-reached',
      7
    );
  });

  it('cancel 与 finish 竞争时 cancel 先占终态，不交付文件且只清理一次', async () => {
    const harness = makeRecorder({ deferredCancel: true });
    const callbacks = makeCallbacks();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
    });
    await controller.start(startOptions(callbacks));

    const cancelling = controller.cancel();
    harness.finish('/tmp/late.mp4');
    harness.fail(new Error('late error'));
    harness.cancelDeferred?.resolve();
    await cancelling;

    expect(callbacks.onFinished).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(harness.recorder.cancelRecording).toHaveBeenCalledTimes(1);
    expect(harness.recorder.dispose).toHaveBeenCalledTimes(1);
  });

  it('cancel 失败后晚到的 produced path 只上报 discard 一次，不进入完成结果', async () => {
    const cancelError = new Error('not recording yet');
    const harness = makeRecorder();
    jest
      .mocked(harness.recorder.cancelRecording)
      .mockRejectedValueOnce(cancelError);
    const callbacks = makeCallbacks();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
    });
    await controller.start(startOptions(callbacks));

    await controller.cancel().catch(() => {});
    harness.finish('/tmp/discard-me.mp4');
    harness.finish('/tmp/discard-me.mp4');

    expect(callbacks.onFinished).not.toHaveBeenCalled();
    expect(callbacks.onDiscardedFile).toHaveBeenCalledTimes(1);
    expect(callbacks.onDiscardedFile).toHaveBeenCalledWith(
      '/tmp/discard-me.mp4'
    );
  });

  it('native error 终态后晚到的 produced path 也交给 discard，且同一 path 只上报一次', async () => {
    const harness = makeRecorder();
    const callbacks = makeCallbacks();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
    });
    await controller.start(startOptions(callbacks));

    harness.fail(new Error('native recording error'));
    harness.finish('/tmp/after-error.mp4');
    harness.finish('/tmp/after-error.mp4');

    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onFinished).not.toHaveBeenCalled();
    expect(callbacks.onDiscardedFile).toHaveBeenCalledTimes(1);
    expect(callbacks.onDiscardedFile).toHaveBeenCalledWith(
      '/tmp/after-error.mp4'
    );
  });

  it('stop 失败终态后晚到的 produced path 也交给 discard，不进入完成结果', async () => {
    const error = new Error('stop failed');
    const harness = makeRecorder();
    jest.mocked(harness.recorder.stopRecording).mockRejectedValueOnce(error);
    const callbacks = makeCallbacks();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
    });
    await controller.start(startOptions(callbacks));

    await expect(controller.stop()).rejects.toBe(error);
    harness.finish('/tmp/after-stop-failure.mp4');
    harness.finish('/tmp/after-stop-failure.mp4');

    expect(callbacks.onFinished).not.toHaveBeenCalled();
    expect(callbacks.onDiscardedFile).toHaveBeenCalledTimes(1);
    expect(callbacks.onDiscardedFile).toHaveBeenCalledWith(
      '/tmp/after-stop-failure.mp4'
    );
  });

  it('重复 finish 不会把已交付消费者的 path 当废弃文件删除，额外 path 才 discard', async () => {
    const harness = makeRecorder();
    const callbacks = makeCallbacks();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
    });
    await controller.start(startOptions(callbacks));

    harness.finish('/tmp/consumer.mp4');
    harness.finish('/tmp/consumer.mp4');
    harness.finish('/tmp/unexpected-second.mp4');
    harness.finish('/tmp/unexpected-second.mp4');

    expect(callbacks.onFinished).toHaveBeenCalledTimes(1);
    expect(callbacks.onFinished).toHaveBeenCalledWith(
      '/tmp/consumer.mp4',
      'stopped',
      expect.any(Number)
    );
    expect(callbacks.onDiscardedFile).toHaveBeenCalledTimes(1);
    expect(callbacks.onDiscardedFile).toHaveBeenCalledWith(
      '/tmp/unexpected-second.mp4'
    );
  });

  it('重复 stop/cancel 与晚到 callback 都不重复 native teardown 或终态 callback', async () => {
    const harness = makeRecorder({ deferredCancel: true });
    const callbacks = makeCallbacks();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
    });
    await controller.start(startOptions(callbacks));

    const firstCancel = controller.cancel();
    const secondCancel = controller.cancel();
    harness.cancelDeferred?.resolve();
    await Promise.all([firstCancel, secondCancel]);
    await controller.stop();
    await controller.cancel();
    harness.finish();

    expect(harness.recorder.cancelRecording).toHaveBeenCalledTimes(1);
    expect(harness.recorder.dispose).toHaveBeenCalledTimes(1);
    expect(callbacks.onFinished).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('start 仍 pending 时首次 native cancel 被拒绝，等 start settle 后重试成功', async () => {
    const harness = makeRecorder({ deferredStart: true });
    jest
      .mocked(harness.recorder.cancelRecording)
      .mockRejectedValueOnce(new Error('Not currently recording!'));
    const callbacks = makeCallbacks();
    const timers = makeTimerHarness();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
      scheduleTimeout: timers.scheduleTimeout,
    });

    const starting = controller.start(startOptions(callbacks));
    await flushMicrotasks();
    const cancelling = controller.cancel();
    await flushMicrotasks();

    // 注入的定时器永不自动触发；此时唯一能解除等待的信号是 start continuation settle。
    expect(harness.recorder.cancelRecording).toHaveBeenCalledTimes(1);
    expect(harness.recorder.dispose).not.toHaveBeenCalled();
    expect(timers.timers.some((t) => t.ms === CANCEL_RETRY_DELAY_MS)).toBe(
      true
    );

    harness.startDeferred?.resolve();
    await expect(starting).resolves.toBe('denied');
    await expect(cancelling).resolves.toBeUndefined();

    expect(
      jest.mocked(harness.recorder.cancelRecording).mock.calls.length
    ).toBeGreaterThan(1);
    expect(harness.recorder.dispose).toHaveBeenCalledTimes(1);
    expect(callbacks.onFinished).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(timers.pending()).toHaveLength(0);
  });

  it('native cancel 永不 settle 时按超时停止等待，仍恰好 dispose 一次且不 reject', async () => {
    const harness = makeRecorder({ deferredCancel: true });
    const callbacks = makeCallbacks();
    const timers = makeTimerHarness();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
      scheduleTimeout: timers.scheduleTimeout,
    });
    await controller.start(startOptions(callbacks));

    const cancelling = controller.cancel();
    await flushMicrotasks();
    expect(timers.pending()).toHaveLength(1);
    expect(timers.pending()[0]?.ms).toBe(CANCEL_ATTEMPT_TIMEOUT_MS);
    expect(harness.recorder.dispose).not.toHaveBeenCalled();

    timers.trigger(0);
    await expect(cancelling).resolves.toBeUndefined();

    expect(harness.recorder.cancelRecording).toHaveBeenCalledTimes(1);
    expect(harness.recorder.dispose).toHaveBeenCalledTimes(1);
    expect(timers.pending()).toHaveLength(0);
  });

  it('native cancel 持续拒绝时用尽重试次数即停手，cancel 仍 resolve 且晚到 path 只 discard 一次', async () => {
    const harness = makeRecorder();
    jest
      .mocked(harness.recorder.cancelRecording)
      .mockRejectedValue(new Error('Not currently recording!'));
    const callbacks = makeCallbacks();
    const timers = makeTimerHarness();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
      scheduleTimeout: timers.scheduleTimeout,
    });
    await controller.start(startOptions(callbacks));

    await expect(controller.cancel()).resolves.toBeUndefined();

    expect(harness.recorder.cancelRecording).toHaveBeenCalledTimes(
      CANCEL_MAX_ATTEMPTS
    );
    expect(harness.recorder.dispose).toHaveBeenCalledTimes(1);
    expect(timers.pending()).toHaveLength(0);

    harness.finish('/tmp/escaped-recording.mp4');
    harness.finish('/tmp/escaped-recording.mp4');

    expect(callbacks.onFinished).not.toHaveBeenCalled();
    expect(callbacks.onDiscardedFile).toHaveBeenCalledTimes(1);
    expect(callbacks.onDiscardedFile).toHaveBeenCalledWith(
      '/tmp/escaped-recording.mp4'
    );
  });

  it('dispose 期间 native cancel 抛错也不向外 reject，只 warn', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const harness = makeRecorder();
    jest
      .mocked(harness.recorder.cancelRecording)
      .mockRejectedValue(new Error('Not currently recording!'));
    const callbacks = makeCallbacks();
    const timers = makeTimerHarness();
    const controller = createRecorderController({
      createRecorder: jest.fn().mockResolvedValue(harness.recorder),
      scheduleTimeout: timers.scheduleTimeout,
    });
    await controller.start(startOptions(callbacks));

    await expect(controller.dispose()).resolves.toBeUndefined();

    expect(callbacks.onCancelled).toHaveBeenCalledTimes(1);
    expect(harness.recorder.dispose).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
