import { renderHook, act } from '@testing-library/react-native';
import type { RefObject } from 'react';
import type { CustomPhotoFile } from '../../../utils';
import type { CameraHandle } from '../../../camera/Camera';
import { useVideoRecorder } from '../../../camera/hooks/useVideoRecorder';

function makeRef(
  handle: Partial<CameraHandle>
): RefObject<CameraHandle | null> {
  return { current: handle as CameraHandle };
}

const fakeVideo: CustomPhotoFile = {
  id: 'v1',
  cameraType: 'back',
  cameraMode: 'video',
  path: '/tmp/v.mp4',
  uri: 'file:///tmp/v.mp4',
  width: 1920,
  height: 1080,
  mime: 'video/mp4',
  mode: 'video',
  duration: 3,
};

afterEach(() => {
  jest.useRealTimers();
});

it('初始:未录制、recSeconds=0', () => {
  const ref = makeRef({});
  const { result } = renderHook(() => useVideoRecorder(ref));
  expect(result.current.recording).toBe(false);
  expect(result.current.recSeconds).toBe(0);
});

it('startRecording:调 cameraRef.startVideo,成功置 recording=true 并返回 true', async () => {
  const startVideo = jest.fn().mockResolvedValue(undefined);
  const ref = makeRef({ startVideo });
  const { result } = renderHook(() => useVideoRecorder(ref));
  let ok: boolean | undefined;
  await act(async () => {
    ok = await result.current.startRecording();
  });
  expect(startVideo).toHaveBeenCalledTimes(1);
  expect(ok).toBe(true);
  expect(result.current.recording).toBe(true);
});

it('startRecording:startVideo 抛错 → 返回 false、不进假录制态(recording 保持 false)', async () => {
  // 启动失败若仍置 recording=true → 用户按停止走 stopVideo 拿 null → 关相机丢已拍(P1#1b)。
  const startVideo = jest.fn().mockRejectedValue(new Error('boom'));
  const ref = makeRef({ startVideo });
  const { result } = renderHook(() => useVideoRecorder(ref));
  let ok: boolean | undefined;
  await act(async () => {
    ok = await result.current.startRecording();
  });
  expect(ok).toBe(false);
  expect(result.current.recording).toBe(false);
});

it('recSeconds:录制中每秒 +1,停止后归零', async () => {
  jest.useFakeTimers();
  const ref = makeRef({
    startVideo: jest.fn().mockResolvedValue(undefined),
    stopVideo: jest.fn().mockResolvedValue(fakeVideo),
  });
  const { result } = renderHook(() => useVideoRecorder(ref));

  await act(async () => {
    await result.current.startRecording();
  });
  // 录制中:timer effect 起跑。
  act(() => jest.advanceTimersByTime(3000));
  expect(result.current.recSeconds).toBe(3);

  // 停止 → recording=false → effect 清 timer 并把 recSeconds 归零。
  await act(async () => {
    await result.current.stopRecording();
  });
  expect(result.current.recSeconds).toBe(0);
});

it('stopRecording:调 stopVideo、清 recording,并返回拿到的 file', async () => {
  const stopVideo = jest.fn().mockResolvedValue(fakeVideo);
  const ref = makeRef({
    startVideo: jest.fn().mockResolvedValue(undefined),
    stopVideo,
  });
  const { result } = renderHook(() => useVideoRecorder(ref));
  await act(async () => {
    await result.current.startRecording();
  });

  let returned: CustomPhotoFile | null = null;
  await act(async () => {
    returned = await result.current.stopRecording();
  });
  expect(stopVideo).toHaveBeenCalledTimes(1);
  expect(returned).toBe(fakeVideo);
  expect(result.current.recording).toBe(false);
});

it('stopRecording:stopVideo 返回 null → 透传 null(由调用方弹错误条,不再 settle 503)', async () => {
  const ref = makeRef({
    startVideo: jest.fn().mockResolvedValue(undefined),
    stopVideo: jest.fn().mockResolvedValue(null),
  });
  const { result } = renderHook(() => useVideoRecorder(ref));
  await act(async () => {
    await result.current.startRecording();
  });
  let returned: CustomPhotoFile | null = fakeVideo;
  await act(async () => {
    returned = await result.current.stopRecording();
  });
  expect(returned).toBeNull();
});

it('cameraRef.current 为 null:start/stop 不抛,stop 返回 null', async () => {
  const ref: RefObject<CameraHandle | null> = { current: null };
  const { result } = renderHook(() => useVideoRecorder(ref));
  await act(async () => {
    await result.current.startRecording();
  });
  // 即使 ref 空,startRecording 仍置 recording=true(等价原 Container:setRecording 不依赖 startVideo 结果)。
  expect(result.current.recording).toBe(true);
  let returned: CustomPhotoFile | null = fakeVideo;
  await act(async () => {
    returned = await result.current.stopRecording();
  });
  expect(returned).toBeNull();
  expect(result.current.recording).toBe(false);
});

it('markStopped:原生侧自发结束(到点/磁盘满)复位 recording=false', async () => {
  const ref = makeRef({ startVideo: jest.fn().mockResolvedValue(undefined) });
  const { result } = renderHook(() => useVideoRecorder(ref));
  await act(async () => {
    await result.current.startRecording();
  });
  expect(result.current.recording).toBe(true);
  act(() => result.current.markStopped());
  expect(result.current.recording).toBe(false);
});
