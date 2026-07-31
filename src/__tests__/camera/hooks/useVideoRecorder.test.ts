import { renderHook, act } from '@testing-library/react-native';
import type { RefObject } from 'react';
import type { CameraHandle, VideoCallbacks } from '../../../camera/Camera';
import { useVideoRecorder } from '../../../camera/hooks/useVideoRecorder';
import { makePhotoFile } from '../../__helpers__/factories';

function makeRef(
  handle: Partial<CameraHandle>
): RefObject<CameraHandle | null> {
  return { current: handle as CameraHandle };
}

const fakeVideo = makePhotoFile({
  id: 'v1',
  mode: 'video',
  path: '/tmp/v.mp4',
  uri: 'file:///tmp/v.mp4',
  width: 1920,
  height: 1080,
  duration: 3,
});

afterEach(() => {
  jest.useRealTimers();
});

it('初始未录制且 ref=null 时 start 返回 false，不进入假录制态', async () => {
  const ref: RefObject<CameraHandle | null> = { current: null };
  const { result } = renderHook(() => useVideoRecorder(ref));

  expect(result.current.recording).toBe(false);
  expect(result.current.recSeconds).toBe(0);
  await act(async () => {
    await expect(result.current.startRecording()).resolves.toBe(false);
  });
  expect(result.current.recording).toBe(false);
});

it('start 只有返回 started 且 operation 未被 callback 终结时才进入 recording', async () => {
  const startVideo = jest.fn().mockResolvedValue('started');
  const ref = makeRef({ startVideo });
  const { result } = renderHook(() => useVideoRecorder(ref));

  let ok = false;
  await act(async () => {
    ok = await result.current.startRecording();
  });

  expect(startVideo).toHaveBeenCalledTimes(1);
  expect(startVideo.mock.calls[0]?.[0]).toEqual({
    onFinished: expect.any(Function),
    onError: expect.any(Function),
    onCancelled: expect.any(Function),
  });
  expect(ok).toBe(true);
  expect(result.current.recording).toBe(true);
});

it('麦克风拒绝返回 denied 时返回 false，不进入 recording', async () => {
  const ref = makeRef({
    startVideo: jest.fn().mockResolvedValue('denied'),
  });
  const { result } = renderHook(() => useVideoRecorder(ref));

  await act(async () => {
    await expect(result.current.startRecording()).resolves.toBe(false);
  });
  expect(result.current.recording).toBe(false);
});

it('finish callback 可早于 start continuation，晚到 started 不会写回假 recording', async () => {
  let callbacks!: VideoCallbacks;
  let resolveStart!: (value: 'started') => void;
  const startVideo = jest.fn(
    (nextCallbacks: VideoCallbacks) =>
      new Promise<'started'>((resolve) => {
        callbacks = nextCallbacks;
        resolveStart = resolve;
      })
  );
  const ref = makeRef({ startVideo });
  const { result } = renderHook(() => useVideoRecorder(ref));

  let starting!: Promise<boolean>;
  act(() => {
    starting = result.current.startRecording();
  });
  await act(async () => {
    callbacks.onFinished(fakeVideo, 'max-duration-reached', 3);
    resolveStart('started');
    await expect(starting).resolves.toBe(true);
  });

  expect(result.current.recording).toBe(false);
  expect(result.current.recSeconds).toBe(0);
});

it('error callback 可早于 start reject，终态只复位一次且 start 返回 false', async () => {
  let callbacks!: VideoCallbacks;
  let rejectStart!: (reason: Error) => void;
  const startVideo = jest.fn(
    (nextCallbacks: VideoCallbacks) =>
      new Promise<'started'>((_resolve, reject) => {
        callbacks = nextCallbacks;
        rejectStart = reject;
      })
  );
  const ref = makeRef({ startVideo });
  const { result } = renderHook(() => useVideoRecorder(ref));

  let starting!: Promise<boolean>;
  act(() => {
    starting = result.current.startRecording();
  });
  await act(async () => {
    callbacks.onError(new Error('native failed'));
    rejectStart(new Error('late start failure'));
    await expect(starting).resolves.toBe(false);
  });

  expect(result.current.recording).toBe(false);
});

it('controller identity 在 start pending 时 onCancelled 可立即结束 start，不等待晚到 continuation', async () => {
  let callbacks!: VideoCallbacks & { onCancelled?: () => void };
  let resolveStart!: (value: 'started') => void;
  const startVideo = jest.fn(
    (nextCallbacks: VideoCallbacks) =>
      new Promise<'started'>((resolve) => {
        callbacks = nextCallbacks;
        resolveStart = resolve;
      })
  );
  const ref = makeRef({ startVideo });
  const { result } = renderHook(() => useVideoRecorder(ref));

  let observed: boolean | 'pending' = 'pending';
  const starting = result.current.startRecording();
  starting.then((value) => {
    observed = value;
  });
  act(() => {
    callbacks.onCancelled?.();
  });
  await act(async () => {
    await Promise.resolve();
  });
  const afterCancellation = observed;

  resolveStart('started');
  await starting;

  expect(afterCancellation).toBe(false);
  expect(result.current.recording).toBe(false);
});

it('recSeconds 轮询 CameraHandle.getRecordedDuration，而不是自行累加', async () => {
  jest.useFakeTimers();
  let duration = 0;
  const getRecordedDuration = jest.fn(() => duration);
  const ref = makeRef({
    // Task 4 期间 useCaptureFlow 的旧测试 double 仍返回 undefined；兼容桥应等价视为 started。
    startVideo: jest.fn().mockResolvedValue(undefined),
    getRecordedDuration,
  });
  const { result } = renderHook(() => useVideoRecorder(ref));

  await act(async () => {
    await result.current.startRecording();
  });
  duration = 4.9;
  act(() => jest.advanceTimersByTime(1000));
  expect(result.current.recSeconds).toBe(4);
  expect(getRecordedDuration).toHaveBeenCalled();
});

it('stopVideo 只提交请求；兼容 stopRecording 从 finish callback 等待并返回 file', async () => {
  let callbacks!: VideoCallbacks;
  const startVideo = jest.fn((nextCallbacks: VideoCallbacks) => {
    callbacks = nextCallbacks;
    return Promise.resolve<'started'>('started');
  });
  let resolveStop!: () => void;
  const stopVideo = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveStop = resolve;
      })
  );
  const ref = makeRef({ startVideo, stopVideo });
  const { result } = renderHook(() => useVideoRecorder(ref));
  await act(async () => {
    await result.current.startRecording();
  });

  let stopping!: Promise<typeof fakeVideo | null>;
  act(() => {
    stopping = result.current.stopRecording();
  });
  expect(stopVideo).toHaveBeenCalledTimes(1);
  expect(result.current.recording).toBe(true);

  await act(async () => {
    callbacks.onFinished(fakeVideo, 'stopped', 3);
    resolveStop();
    await expect(stopping).resolves.toBe(fakeVideo);
  });
  expect(result.current.recording).toBe(false);
  expect(result.current.recSeconds).toBe(0);
});

it('finish 可早于 stopVideo resolve，晚到 stop continuation 不会重复迁移', async () => {
  let callbacks!: VideoCallbacks;
  const startVideo = jest.fn((nextCallbacks: VideoCallbacks) => {
    callbacks = nextCallbacks;
    return Promise.resolve<'started'>('started');
  });
  let resolveStop!: () => void;
  const stopVideo = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveStop = resolve;
      })
  );
  const ref = makeRef({ startVideo, stopVideo });
  const { result } = renderHook(() => useVideoRecorder(ref));
  await act(async () => {
    await result.current.startRecording();
  });

  let stopping!: Promise<typeof fakeVideo | null>;
  let observed: typeof fakeVideo | null | 'pending' = 'pending';
  act(() => {
    stopping = result.current.stopRecording();
    stopping.then((file) => {
      observed = file;
    });
    callbacks.onFinished(fakeVideo, 'stopped', 3);
  });
  expect(result.current.recording).toBe(false);
  await act(async () => {
    await Promise.resolve();
  });
  const beforeStopResolved = observed;

  await act(async () => {
    resolveStop();
    await expect(stopping).resolves.toBe(fakeVideo);
  });
  expect(beforeStopResolved).toBe(fakeVideo);
  expect(result.current.recording).toBe(false);
});

it('controller identity 被替换时 onCancelled 立即兑现 stop waiter 为 null', async () => {
  let callbacks!: VideoCallbacks & { onCancelled?: () => void };
  const startVideo = jest.fn((nextCallbacks: VideoCallbacks) => {
    callbacks = nextCallbacks;
    return Promise.resolve<'started'>('started');
  });
  let resolveStop!: () => void;
  const stopVideo = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveStop = resolve;
      })
  );
  const ref = makeRef({ startVideo, stopVideo });
  const { result } = renderHook(() => useVideoRecorder(ref));
  await act(async () => {
    await result.current.startRecording();
  });

  let observed: typeof fakeVideo | null | 'pending' = 'pending';
  const stopping = result.current.stopRecording();
  stopping.then((file) => {
    observed = file;
  });
  act(() => {
    callbacks.onCancelled?.();
  });
  await act(async () => {
    await Promise.resolve();
  });
  const afterCancellation = observed;

  // RED 阶段也释放测试 double，避免悬空 Promise 干扰后续用例。
  resolveStop();
  callbacks.onError(new Error('cleanup'));
  await stopping;

  expect(afterCancellation).toBeNull();
  expect(result.current.recording).toBe(false);
});

it('stop reject 且底层未触发 error callback 时兼容返回 null 并复位', async () => {
  const ref = makeRef({
    startVideo: jest.fn().mockResolvedValue('started'),
    stopVideo: jest.fn().mockRejectedValue(new Error('stop failed')),
  });
  const { result } = renderHook(() => useVideoRecorder(ref));
  await act(async () => {
    await result.current.startRecording();
  });

  await act(async () => {
    await expect(result.current.stopRecording()).resolves.toBeNull();
  });
  expect(result.current.recording).toBe(false);
});

it('兼容 markStopped 在旧 auto-finish prop 路径中复位 recording', async () => {
  const ref = makeRef({
    startVideo: jest.fn().mockResolvedValue('started'),
  });
  const { result } = renderHook(() => useVideoRecorder(ref));
  await act(async () => {
    await result.current.startRecording();
  });
  expect(result.current.recording).toBe(true);

  act(() => result.current.markStopped());
  expect(result.current.recording).toBe(false);
});

it('cancel 使当前 operation 立即失效，晚到 finish 不交付给在等的 stop', async () => {
  let callbacks!: VideoCallbacks;
  const startVideo = jest.fn((nextCallbacks: VideoCallbacks) => {
    callbacks = nextCallbacks;
    return Promise.resolve<'started'>('started');
  });
  const cancelVideo = jest.fn().mockResolvedValue(undefined);
  const ref = makeRef({
    startVideo,
    stopVideo: jest.fn().mockResolvedValue(undefined),
    cancelVideo,
  });
  const { result } = renderHook(() => useVideoRecorder(ref));
  await act(async () => {
    await result.current.startRecording();
  });

  const stopping = result.current.stopRecording();
  await act(async () => {
    await result.current.cancelRecording();
    callbacks.onFinished(fakeVideo, 'stopped', 3);
  });

  await expect(stopping).resolves.toBeNull();
  expect(cancelVideo).toHaveBeenCalledTimes(1);
  expect(result.current.recording).toBe(false);
});

it('旧 operation 的重复 callback 不能终结下一次录像', async () => {
  const callbacks: VideoCallbacks[] = [];
  const startVideo = jest.fn((nextCallbacks: VideoCallbacks) => {
    callbacks.push(nextCallbacks);
    return Promise.resolve<'started'>('started');
  });
  const ref = makeRef({ startVideo });
  const { result } = renderHook(() => useVideoRecorder(ref));

  await act(async () => {
    await result.current.startRecording();
    callbacks[0]?.onFinished(fakeVideo, 'max-duration-reached', 3);
  });
  await act(async () => {
    await result.current.startRecording();
  });
  expect(result.current.recording).toBe(true);

  act(() => {
    callbacks[0]?.onError(new Error('late old callback'));
    callbacks[0]?.onFinished(fakeVideo, 'stopped', 3);
  });
  expect(result.current.recording).toBe(true);
});

it('unmount 强制 cancel active operation，晚到 callback 不再更新 hook', async () => {
  let callbacks!: VideoCallbacks;
  const startVideo = jest.fn((nextCallbacks: VideoCallbacks) => {
    callbacks = nextCallbacks;
    return Promise.resolve<'started'>('started');
  });
  const cancelVideo = jest.fn().mockResolvedValue(undefined);
  const ref = makeRef({ startVideo, cancelVideo });
  const { result, unmount } = renderHook(() => useVideoRecorder(ref));
  await act(async () => {
    await result.current.startRecording();
  });

  unmount();
  expect(cancelVideo).toHaveBeenCalledTimes(1);
  expect(() =>
    callbacks.onFinished(fakeVideo, 'max-duration-reached', 3)
  ).not.toThrow();
});
