import { act, renderHook } from '@testing-library/react-native';
import { useLayoutEffect, type RefObject } from 'react';
import type { CameraHandle, VideoCallbacks } from '../../../camera/Camera';
import {
  useCameraSessionController,
  type CameraOperationToken,
  type CameraSessionController,
} from '../../../camera/hooks/useCameraSessionController';
import {
  useVideoTransaction,
  type VideoTransactionEvents,
} from '../../../camera/hooks/useVideoTransaction';
import type { SessionControllerBridge } from '../../../camera/session/controllerBridge';
import {
  createFileRegistry,
  type FileRegistry,
} from '../../../camera/session/fileRegistry';
import type { CameraResult, CustomPhotoFile } from '../../../utils';
import { makePhotoFile } from '../../__helpers__/factories';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(rounds = 6): Promise<void> {
  for (let index = 0; index < rounds; index += 1) {
    await Promise.resolve();
  }
}

function video(path: string, duration = 0): CustomPhotoFile {
  return makePhotoFile({
    id: path.replaceAll('/', '').replaceAll('.', '-'),
    path,
    uri: `file://${path}`,
    cameraMode: 'video',
    mode: 'video',
    mime: 'video/mp4',
    duration,
  });
}

type CameraOverrides = Partial<CameraHandle>;

type SetupOptions = {
  camera?: CameraOverrides;
  registry?: FileRegistry;
  onError?: jest.Mock<void, [string]>;
  onLayoutUnmount?: () => void;
};

function setup(options: SetupOptions = {}) {
  const callbacks: VideoCallbacks[] = [];
  const camera: CameraHandle = {
    capture: jest.fn().mockResolvedValue(null),
    startVideo:
      options.camera?.startVideo ??
      jest.fn((nextCallbacks: VideoCallbacks) => {
        callbacks.push(nextCallbacks);
        return Promise.resolve('started' as const);
      }),
    stopVideo:
      options.camera?.stopVideo ?? jest.fn().mockResolvedValue(undefined),
    cancelVideo:
      options.camera?.cancelVideo ?? jest.fn().mockResolvedValue(undefined),
    getRecordedDuration:
      options.camera?.getRecordedDuration ?? jest.fn(() => 0),
  };
  const cameraRef = { current: camera } as RefObject<CameraHandle | null>;
  const unlink = jest
    .fn<Promise<void>, [string]>()
    .mockResolvedValue(undefined);
  const registry = options.registry ?? createFileRegistry(unlink);
  const onError = options.onError ?? jest.fn<void, [string]>();
  const eventLog: string[] = [];
  const eventResults: Partial<Record<keyof VideoTransactionEvents, boolean>> =
    {};
  const registerController = jest.fn(
    (_sessionId: number, _bridge: SessionControllerBridge) => jest.fn()
  );
  const confirm = jest.fn().mockResolvedValue(true);
  const cancelRecording = jest.fn();
  const onSettle = jest.fn<void, [CameraResult]>();

  const hook = renderHook(() => {
    const controller = useCameraSessionController({
      sessionId: 41,
      initialState: {
        files: [],
        modeIndex: 0,
        aspectRatio: '16:9',
        activePosition: 'back',
        canFlip: true,
        flash: 'off',
        sound: false,
        nativeConfigurationKey: 'device=back-1|output=video',
      },
      registerController,
      confirm,
      cancelRecording,
      onSettle,
    });
    const transaction = useVideoTransaction({
      cameraRef,
      fileRegistry: registry,
      onError,
    });
    // 声明在 transaction hook 之后：layout cleanup 按 hook 顺序执行，transaction 必须先
    // 同步失效 operation，随后这个 probe 才模拟 commit 窗口里的 native late callback。
    useLayoutEffect(
      () => () => {
        options.onLayoutUnmount?.();
      },
      []
    );
    return { controller, transaction };
  });

  act(() => {
    expect(
      hook.result.current.controller.configured(
        hook.result.current.controller.state.configurationGeneration
      )
    ).toBe(true);
  });

  const eventsFor = (
    controller: CameraSessionController
  ): VideoTransactionEvents => ({
    videoStarted: (token) => {
      eventLog.push('videoStarted');
      return eventResults.videoStarted ?? controller.videoStarted(token);
    },
    videoProgress: (token, duration) => {
      eventLog.push(`videoProgress:${duration}`);
      return (
        eventResults.videoProgress ?? controller.videoProgress(token, duration)
      );
    },
    stopVideo: (token, duration) => {
      eventLog.push(`stopVideo:${duration}`);
      return eventResults.stopVideo ?? controller.stopVideo(token, duration);
    },
    videoFinished: (token, result) => {
      eventLog.push(
        `videoFinished:${result.file?.path ?? 'none'}:${result.duration}:${result.reason}`
      );
      return (
        eventResults.videoFinished ?? controller.videoFinished(token, result)
      );
    },
    fail: (token) => {
      eventLog.push('fail');
      return eventResults.fail ?? controller.fail(token);
    },
    isCurrent: (token) => {
      eventLog.push('isCurrent');
      return eventResults.isCurrent ?? controller.isCurrent(token);
    },
  });

  const begin = (): CameraOperationToken => {
    let token: CameraOperationToken | null = null;
    act(() => {
      token = hook.result.current.controller.beginVideo();
    });
    if (token == null) throw new Error('video operation was not accepted');
    return token;
  };

  const start = (token = begin()): Promise<void> => {
    let promise!: Promise<void>;
    act(() => {
      promise = hook.result.current.transaction.start(
        token,
        eventsFor(hook.result.current.controller)
      );
    });
    return promise;
  };

  return {
    ...hook,
    camera,
    cameraRef,
    callbacks,
    registry,
    unlink,
    onError,
    eventLog,
    eventResults,
    eventsFor,
    begin,
    start,
  };
}

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('finish before start continuation wins and late started cannot restore recording', async () => {
  const startResult = deferred<'started' | 'denied'>();
  let callbacks!: VideoCallbacks;
  const harness = setup({
    camera: {
      startVideo: jest.fn((nextCallbacks) => {
        callbacks = nextCallbacks;
        return startResult.promise;
      }),
    },
  });
  const start = harness.start();
  const file = video('/early.mp4', 2);

  act(() => {
    callbacks.onFinished(file, 'max-duration-reached', 2);
  });
  await act(async () => {
    startResult.resolve('started');
    await start;
  });

  expect(harness.result.current.controller.state).toMatchObject({
    phase: 'ready',
    files: [file],
    video: { duration: 2, reason: 'max-duration-reached' },
  });
  expect(harness.eventLog.filter((entry) => entry === 'videoStarted')).toEqual(
    []
  );
});

it.each(['error', 'cancel'] as const)(
  '%s callback before start continuation wins and late started is ignored',
  async (terminal) => {
    const startResult = deferred<'started' | 'denied'>();
    let callbacks!: VideoCallbacks;
    const harness = setup({
      camera: {
        startVideo: jest.fn((nextCallbacks) => {
          callbacks = nextCallbacks;
          return startResult.promise;
        }),
      },
    });
    const start = harness.start();

    act(() => {
      if (terminal === 'error') callbacks.onError(new Error('native'));
      else callbacks.onCancelled?.();
    });
    await act(async () => {
      startResult.resolve('started');
      await start;
    });

    expect(harness.result.current.controller.state.phase).toBe('ready');
    expect(harness.eventLog.filter((entry) => entry === 'fail')).toHaveLength(
      1
    );
    expect(harness.eventLog).not.toContain('videoStarted');
    expect(harness.onError).toHaveBeenCalledTimes(terminal === 'error' ? 1 : 0);
  }
);

it('finish before stop Promise resolves remains the only success terminal', async () => {
  const stopResult = deferred<void>();
  const harness = setup({
    camera: { stopVideo: jest.fn(() => stopResult.promise) },
  });
  await act(async () => {
    await harness.start();
  });
  const file = video('/stop-race.mp4', 4);

  act(() => {
    harness.result.current.transaction.stop();
    harness.callbacks[0]!.onFinished(file, 'stopped', 4);
  });
  await act(async () => {
    stopResult.resolve();
    await stopResult.promise;
  });

  expect(harness.result.current.controller.state).toMatchObject({
    phase: 'ready',
    files: [file],
  });
  expect(harness.eventLog.filter((entry) => entry === 'fail')).toHaveLength(0);
  expect(harness.camera.stopVideo).toHaveBeenCalledTimes(1);
});

it.each(['stopped', 'max-duration-reached', 'max-file-size-reached'] as const)(
  '%s uses the shared finish callback and appends once',
  async (reason) => {
    const harness = setup();
    await act(async () => {
      await harness.start();
    });
    const file = video(`/${reason}.mp4`, 7);

    act(() => {
      harness.callbacks[0]!.onFinished(file, reason, 7);
    });

    expect(harness.result.current.controller.state.files).toEqual([file]);
    expect(
      harness.eventLog.filter((entry) => entry.startsWith('videoFinished:'))
    ).toHaveLength(1);
  }
);

it('registers a finished path before consulting the videoFinished gate', async () => {
  const order: string[] = [];
  const base = createFileRegistry(jest.fn().mockResolvedValue(undefined));
  const registry: FileRegistry = {
    ...base,
    register: (path) => {
      order.push(`register:${path}`);
      base.register(path);
    },
  };
  const harness = setup({ registry });
  const token = harness.begin();
  const baseEvents = harness.eventsFor(harness.result.current.controller);
  const events: VideoTransactionEvents = {
    ...baseEvents,
    videoFinished: () => {
      order.push('videoFinished');
      return false;
    },
  };
  await act(async () => {
    await harness.result.current.transaction.start(token, events);
  });
  order.length = 0;
  const file = video('/ordered.mp4');

  act(() => {
    harness.callbacks[0]!.onFinished(file, 'stopped', 1);
  });

  expect(order).toEqual(['register:/ordered.mp4', 'videoFinished']);
  expect(registry.stateOf(file.path)).toBe('deleted');
});

it('stale finish registers then deletes without committing UI state', async () => {
  const harness = setup();
  await act(async () => {
    await harness.start();
  });
  act(() => {
    harness.result.current.controller.forceTeardown();
  });
  const file = video('/stale.mp4');

  act(() => {
    harness.callbacks[0]!.onFinished(file, 'stopped', 3);
  });
  await act(flushMicrotasks);

  expect(harness.registry.stateOf(file.path)).toBe('deleted');
  expect(harness.unlink).toHaveBeenCalledWith(file.path);
  expect(
    harness.eventLog.filter((entry) => entry.startsWith('videoFinished:'))
  ).toHaveLength(0);
  expect(harness.onError).not.toHaveBeenCalled();
});

it('same-path successful duplicate is retained while a different late path is deleted', async () => {
  const harness = setup();
  await act(async () => {
    await harness.start();
  });
  const delivered = video('/delivered.mp4', 2);
  const late = video('/late-different.mp4', 3);

  act(() => {
    harness.callbacks[0]!.onFinished(delivered, 'stopped', 2);
    harness.callbacks[0]!.onFinished(delivered, 'stopped', 2);
    harness.callbacks[0]!.onFinished(late, 'stopped', 3);
  });
  await act(flushMicrotasks);

  expect(harness.registry.stateOf(delivered.path)).toBe('owned');
  expect(harness.registry.stateOf(late.path)).toBe('deleted');
  expect(harness.unlink).not.toHaveBeenCalledWith(delivered.path);
  expect(harness.unlink).toHaveBeenCalledWith(late.path);
  expect(harness.result.current.controller.state.files).toEqual([delivered]);
});

it('discarded callback always registers then deletes independently of token state', async () => {
  const harness = setup();
  await act(async () => {
    await harness.start();
  });
  act(() => {
    harness.result.current.controller.forceTeardown();
    harness.callbacks[0]!.onDiscardedFile?.('/discarded.mp4');
  });
  await act(flushMicrotasks);

  expect(harness.registry.stateOf('/discarded.mp4')).toBe('deleted');
  expect(harness.unlink).toHaveBeenCalledWith('/discarded.mp4');
});

it('cancel claims terminal state before a synchronous finish and reclaims the path', async () => {
  let callbacks!: VideoCallbacks;
  const file = video('/cancel-race.mp4', 2);
  const harness = setup({
    camera: {
      startVideo: jest.fn((nextCallbacks) => {
        callbacks = nextCallbacks;
        return Promise.resolve('started');
      }),
      cancelVideo: jest.fn(() => {
        callbacks.onFinished(file, 'stopped', 2);
        return Promise.resolve();
      }),
    },
  });
  await act(async () => {
    await harness.start();
  });

  await act(async () => {
    harness.result.current.controller.forceTeardown();
    await harness.result.current.transaction.cancel();
  });

  expect(harness.registry.stateOf(file.path)).toBe('deleted');
  expect(harness.result.current.controller.state.files).toEqual([]);
  expect(harness.camera.cancelVideo).toHaveBeenCalledTimes(1);
});

it('uses the captured handle for stop and cancel after cameraRef is cleared', async () => {
  const stopHarness = setup();
  await act(async () => {
    await stopHarness.start();
  });
  stopHarness.cameraRef.current = null;
  act(() => {
    stopHarness.result.current.transaction.stop();
  });
  expect(stopHarness.camera.stopVideo).toHaveBeenCalledTimes(1);

  const cancelHarness = setup();
  await act(async () => {
    await cancelHarness.start();
  });
  cancelHarness.cameraRef.current = null;
  await act(async () => {
    await cancelHarness.result.current.transaction.cancel();
  });
  expect(cancelHarness.camera.cancelVideo).toHaveBeenCalledTimes(1);
});

it('mic denied fails once and shows its specific message', async () => {
  const harness = setup({
    camera: {
      startVideo: jest.fn().mockResolvedValue('denied'),
    },
  });

  await act(async () => {
    await harness.start();
  });

  expect(harness.result.current.controller.state.phase).toBe('ready');
  expect(harness.eventLog.filter((entry) => entry === 'fail')).toHaveLength(1);
  expect(harness.onError).toHaveBeenCalledTimes(1);
  expect(harness.onError).toHaveBeenCalledWith('麦克风权限未开启');
});

it.each(['sync', 'reject'] as const)(
  '%s start failure fails and reports at most once',
  async (kind) => {
    const failure = new Error('start failed');
    const harness = setup({
      camera: {
        startVideo:
          kind === 'sync'
            ? jest.fn(() => {
                throw failure;
              })
            : jest.fn().mockRejectedValue(failure),
      },
    });

    await act(async () => {
      await harness.start();
    });

    expect(harness.eventLog.filter((entry) => entry === 'fail')).toHaveLength(
      1
    );
    expect(harness.onError).toHaveBeenCalledTimes(1);
    expect(harness.onError).toHaveBeenCalledWith('录像启动失败,请重试');
  }
);

it('native error fails once and stale duplicate errors are silent', async () => {
  const harness = setup();
  await act(async () => {
    await harness.start();
  });

  act(() => {
    harness.callbacks[0]!.onError(new Error('native'));
    harness.callbacks[0]!.onError(new Error('duplicate'));
  });

  expect(harness.eventLog.filter((entry) => entry === 'fail')).toHaveLength(1);
  expect(harness.onError).toHaveBeenCalledTimes(1);
  expect(harness.onError).toHaveBeenCalledWith('录像失败,请重试');
});

it('rejected stop fails once and reports the recording error once', async () => {
  const stopResult = deferred<void>();
  const harness = setup({
    camera: { stopVideo: jest.fn(() => stopResult.promise) },
  });
  await act(async () => {
    await harness.start();
  });

  act(() => {
    harness.result.current.transaction.stop();
    harness.result.current.transaction.stop();
  });
  await act(async () => {
    stopResult.reject(new Error('stop failed'));
    await flushMicrotasks();
  });

  expect(harness.eventLog.filter((entry) => entry === 'fail')).toHaveLength(1);
  expect(harness.onError).toHaveBeenCalledTimes(1);
  expect(harness.onError).toHaveBeenCalledWith('录像失败,请重试');
});

it('callback duration and reason override progress and stop snapshots', async () => {
  const harness = setup({
    camera: { getRecordedDuration: jest.fn(() => 4) },
  });
  await act(async () => {
    await harness.start();
  });
  const file = video('/final-truth.mp4', 11);

  act(() => {
    harness.result.current.transaction.stop();
    harness.callbacks[0]!.onFinished(file, 'max-file-size-reached', 11);
  });

  expect(harness.result.current.controller.state.video).toEqual({
    duration: 11,
    reason: 'max-file-size-reached',
  });
  expect(harness.result.current.controller.state.files).toEqual([file]);
});

it('samples progress immediately and every 250 ms, then stops after terminal and cancel', async () => {
  jest.useFakeTimers();
  let duration = 1;
  const harness = setup({
    camera: { getRecordedDuration: jest.fn(() => duration) },
  });
  await act(async () => {
    await harness.start();
  });
  expect(harness.result.current.controller.state.video.duration).toBe(1);

  act(() => {
    duration = 2;
    jest.advanceTimersByTime(250);
  });
  expect(harness.result.current.controller.state.video.duration).toBe(2);

  const progressCount = harness.eventLog.filter((entry) =>
    entry.startsWith('videoProgress:')
  ).length;
  act(() => {
    harness.callbacks[0]!.onFinished(video('/progress.mp4', 3), 'stopped', 3);
    duration = 9;
    jest.advanceTimersByTime(1000);
  });
  expect(
    harness.eventLog.filter((entry) => entry.startsWith('videoProgress:'))
  ).toHaveLength(progressCount);

  const cancelHarness = setup({
    camera: { getRecordedDuration: jest.fn(() => 1) },
  });
  await act(async () => {
    await cancelHarness.start();
    await cancelHarness.result.current.transaction.cancel();
  });
  const cancelProgressCount = cancelHarness.eventLog.filter((entry) =>
    entry.startsWith('videoProgress:')
  ).length;
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(
    cancelHarness.eventLog.filter((entry) => entry.startsWith('videoProgress:'))
  ).toHaveLength(cancelProgressCount);
});

it('unmount sends no UI events, while a late path is still registered and deleted', async () => {
  let callbacks!: VideoCallbacks;
  const harness = setup({
    camera: {
      startVideo: jest.fn((nextCallbacks) => {
        callbacks = nextCallbacks;
        return Promise.resolve('started');
      }),
    },
  });
  await act(async () => {
    await harness.start();
  });
  harness.eventLog.length = 0;
  harness.onError.mockClear();

  act(() => {
    harness.unmount();
  });
  act(() => {
    callbacks.onError(new Error('late'));
    callbacks.onCancelled?.();
    callbacks.onFinished(video('/after-unmount.mp4'), 'stopped', 5);
  });
  await act(flushMicrotasks);

  expect(harness.eventLog).toEqual([]);
  expect(harness.onError).not.toHaveBeenCalled();
  expect(harness.registry.stateOf('/after-unmount.mp4')).toBe('deleted');
  expect(harness.unlink).toHaveBeenCalledWith('/after-unmount.mp4');
});

it('layout unmount commit synchronously invalidates callbacks before passive cleanup', async () => {
  let callbacks!: VideoCallbacks;
  const file = video('/layout-unmount.mp4', 5);
  const harness = setup({
    camera: {
      startVideo: jest.fn((nextCallbacks) => {
        callbacks = nextCallbacks;
        return Promise.resolve('started');
      }),
    },
    onLayoutUnmount: () => {
      callbacks.onFinished(file, 'stopped', 5);
    },
  });
  await act(async () => {
    await harness.start();
  });
  harness.eventLog.length = 0;

  act(() => {
    harness.unmount();
  });
  await act(flushMicrotasks);

  expect(harness.eventLog).toEqual([]);
  expect(harness.registry.stateOf(file.path)).toBe('deleted');
  expect(harness.unlink).toHaveBeenCalledWith(file.path);
});

it('same-call-stack duplicate start and repeated stop/cancel are idempotent', async () => {
  const startResult = deferred<'started' | 'denied'>();
  const startVideo = jest.fn((_callbacks: VideoCallbacks) => {
    return startResult.promise;
  });
  const harness = setup({ camera: { startVideo } });
  const token = harness.begin();
  const events = harness.eventsFor(harness.result.current.controller);
  let starts: Promise<void>[] = [];

  act(() => {
    starts = [
      harness.result.current.transaction.start(token, events),
      harness.result.current.transaction.start(token, events),
      harness.result.current.transaction.start(token, events),
    ];
  });
  expect(startVideo).toHaveBeenCalledTimes(1);
  await act(async () => {
    startResult.resolve('started');
    await Promise.all(starts);
  });

  act(() => {
    harness.result.current.transaction.stop();
    harness.result.current.transaction.stop();
    harness.result.current.transaction.stop();
  });
  expect(harness.camera.stopVideo).toHaveBeenCalledTimes(1);

  await act(async () => {
    await Promise.all([
      harness.result.current.transaction.cancel(),
      harness.result.current.transaction.cancel(),
      harness.result.current.transaction.cancel(),
    ]);
  });
  expect(harness.camera.cancelVideo).toHaveBeenCalledTimes(1);
});
