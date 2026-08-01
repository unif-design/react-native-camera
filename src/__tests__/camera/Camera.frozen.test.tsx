import { createRef, StrictMode } from 'react';
import { act, render } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import * as RNFS from '@dr.pogodin/react-native-fs';
import * as VisionCamera from 'react-native-vision-camera';
import {
  Camera,
  type CameraHandle,
  type VideoCallbacks,
} from '../../camera/Camera';
import type { CameraMode } from '../../utils';
import { renderDark } from '../__helpers__/renderDark';
import { makeDeviceStub } from '../__helpers__/visionCameraMock';

jest.mock('react-native-vision-camera', () => {
  const { makeVisionCameraMock } = require('../__helpers__/visionCameraMock');
  return makeVisionCameraMock({
    useMicrophonePermission: jest.fn(() => ({
      hasPermission: true,
      requestPermission: jest.fn().mockResolvedValue(true),
    })),
  });
});

jest.mock('@dr.pogodin/react-native-fs', () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
}));

const unlinkMock = jest.mocked(RNFS.unlink);
const useVideoOutputMock = jest.mocked(VisionCamera.useVideoOutput);
const useMicrophonePermissionMock = jest.mocked(
  VisionCamera.useMicrophonePermission
);

// 定格帧:烧水印期间 Container 透传 frozenUri,Camera 在取景框内盖刚拍原图防黑屏。
// 直接渲染 <Camera>(绕过 Container),isActive=false 对齐烧水印时停取景。
const singleMode: CameraMode = { mode: 'single' };
const videoMode: CameraMode = { mode: 'video' };

function renderCamera(frozenUri?: string) {
  return renderDark(
    <Camera
      device={makeDeviceStub() as never}
      currentMode={singleMode}
      isActive={false}
      frozenUri={frozenUri}
    />
  );
}

it('frozenUri 非空 → 取景框内渲染定格 Image(cover)', () => {
  const { getByTestId } = renderCamera('file:///tmp/p1.jpg');
  const img = getByTestId('frozen-frame');
  expect(img.props.source).toEqual({ uri: 'file:///tmp/p1.jpg' });
  expect(img.props.resizeMode).toBe('cover');
});

it('frozenUri 为空 → 不渲染定格 Image', () => {
  const { queryByTestId } = renderCamera(undefined);
  expect(queryByTestId('frozen-frame')).toBeNull();
});

type NativeRecorderHarness = {
  recorder: {
    startRecording: jest.Mock;
    stopRecording: jest.Mock;
    cancelRecording: jest.Mock;
    dispose: jest.Mock;
    recordedDuration: number;
  };
  finish: (
    path?: string,
    reason?: 'stopped' | 'max-duration-reached' | 'max-file-size-reached'
  ) => void;
};

function makeNativeRecorder(): NativeRecorderHarness {
  let onFinished:
    | ((
        path: string,
        reason: 'stopped' | 'max-duration-reached' | 'max-file-size-reached'
      ) => void)
    | undefined;
  const recorder = {
    startRecording: jest.fn(
      (
        finished: NonNullable<typeof onFinished>,
        _error: (error: Error) => void
      ) => {
        onFinished = finished;
        return Promise.resolve();
      }
    ),
    stopRecording: jest.fn().mockResolvedValue(undefined),
    cancelRecording: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn(),
    recordedDuration: 0,
  };
  return {
    recorder,
    finish: (path = '/tmp/video.mp4', reason = 'stopped') =>
      onFinished?.(path, reason),
  };
}

function renderVideoCamera(currentMode: CameraMode = videoMode) {
  const ref = createRef<CameraHandle>();
  const element = (mode: CameraMode) => (
    <Camera
      ref={ref}
      device={makeDeviceStub() as never}
      currentMode={mode}
      isActive={false}
    />
  );
  const rendered = renderDark(element(currentMode));
  return { ...rendered, ref, element };
}

function makeVideoCallbacks(): VideoCallbacks & {
  onFinished: jest.Mock;
  onError: jest.Mock;
  onCancelled: jest.Mock;
} {
  return {
    onFinished: jest.fn(),
    onError: jest.fn(),
    onCancelled: jest.fn(),
  };
}

beforeEach(() => {
  unlinkMock.mockClear();
  unlinkMock.mockResolvedValue(undefined);
  useVideoOutputMock.mockClear();
  useMicrophonePermissionMock.mockReturnValue({
    status: 'authorized',
    hasPermission: true,
    canRequestPermission: false,
    requestPermission: jest.fn().mockResolvedValue(true),
  });
});

describe('录像 native adapter', () => {
  it('麦克风请求返回 false 时返回 denied，且不创建 Recorder', async () => {
    const createRecorder = jest.fn();
    useVideoOutputMock.mockReturnValue({ createRecorder } as never);
    const requestPermission = jest.fn().mockResolvedValue(false);
    useMicrophonePermissionMock.mockReturnValue({
      status: 'not-determined',
      hasPermission: false,
      canRequestPermission: true,
      requestPermission,
    });
    const { ref } = renderVideoCamera();
    const callbacks = makeVideoCallbacks();

    await act(async () => {
      await expect(ref.current?.startVideo(callbacks)).resolves.toBe('denied');
    });
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(createRecorder).not.toHaveBeenCalled();
    // Task 5 门禁：mic denied 是「不能开始」，不是录像错误 —— 不得进入 error 终态。
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(callbacks.onFinished).not.toHaveBeenCalled();
  });

  it('每次 start 按当前 recTime 创建新 Recorder，不预热或复用旧 settings', async () => {
    const first = makeNativeRecorder();
    const second = makeNativeRecorder();
    const createRecorder = jest
      .fn()
      .mockResolvedValueOnce(first.recorder)
      .mockResolvedValueOnce(second.recorder);
    const videoOutput = { createRecorder };
    useVideoOutputMock.mockReturnValue(videoOutput as never);
    const { ref, rerender, element } = renderVideoCamera({
      mode: 'video',
      recTime: 3,
    });

    await act(async () => {
      await ref.current?.startVideo(makeVideoCallbacks());
      first.finish('/tmp/first.mp4');
    });
    rerender(element({ mode: 'video', recTime: 8 }));
    await act(async () => {
      await ref.current?.startVideo(makeVideoCallbacks());
    });

    expect(createRecorder).toHaveBeenCalledTimes(2);
    expect(createRecorder).toHaveBeenNthCalledWith(1, { maxDuration: 3 });
    expect(createRecorder).toHaveBeenNthCalledWith(2, { maxDuration: 8 });
  });

  it('stopVideo 返回 void，文件只经 finish callback 交付并保留 stop 前 duration', async () => {
    const native = makeNativeRecorder();
    native.recorder.recordedDuration = 4.5;
    native.recorder.stopRecording.mockImplementationOnce(() => {
      native.recorder.recordedDuration = 0;
      native.finish('/tmp/manual.mp4', 'stopped');
      return Promise.resolve();
    });
    useVideoOutputMock.mockReturnValue({
      createRecorder: jest.fn().mockResolvedValue(native.recorder),
    } as never);
    const callbacks = makeVideoCallbacks();
    const { ref } = renderVideoCamera();

    await act(async () => {
      await ref.current?.startVideo(callbacks);
    });
    let returned: unknown = 'not-void';
    await act(async () => {
      returned = await ref.current?.stopVideo();
    });

    expect(returned).toBeUndefined();
    expect(callbacks.onFinished).toHaveBeenCalledTimes(1);
    expect(callbacks.onFinished).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/tmp/manual.mp4',
        mode: 'video',
        duration: 4.5,
      }),
      'stopped',
      4.5
    );
    expect(native.recorder.dispose).toHaveBeenCalledTimes(1);
  });

  it('自动结束只经 start callbacks 交付一次', async () => {
    const native = makeNativeRecorder();
    useVideoOutputMock.mockReturnValue({
      createRecorder: jest.fn().mockResolvedValue(native.recorder),
    } as never);
    const callbacks = makeVideoCallbacks();
    const { ref } = renderVideoCamera(videoMode);
    await act(async () => {
      await ref.current?.startVideo(callbacks);
      native.finish('/tmp/auto.mp4', 'max-duration-reached');
    });

    expect(callbacks.onFinished).toHaveBeenCalledTimes(1);
    expect(callbacks.onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/tmp/auto.mp4', mode: 'video' }),
      'max-duration-reached',
      expect.any(Number)
    );
    const [file, , duration] = callbacks.onFinished.mock.calls[0]!;
    expect(duration).toBeGreaterThanOrEqual(0);
    expect(file.duration).toBe(duration);
  });

  it('unmount 强制 cancel active Recorder，并且 dispose 恰好一次', async () => {
    const native = makeNativeRecorder();
    useVideoOutputMock.mockReturnValue({
      createRecorder: jest.fn().mockResolvedValue(native.recorder),
    } as never);
    const { ref, unmount } = renderVideoCamera();
    await act(async () => {
      await ref.current?.startVideo(makeVideoCallbacks());
    });

    unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(native.recorder.cancelRecording).toHaveBeenCalledTimes(1);
    expect(native.recorder.dispose).toHaveBeenCalledTimes(1);
  });

  it('video output identity 替换时给 hook 明确 cancel 终态，不静默遗留 waiter', async () => {
    const first = makeNativeRecorder();
    const second = makeNativeRecorder();
    useVideoOutputMock
      .mockReturnValueOnce({
        createRecorder: jest.fn().mockResolvedValue(first.recorder),
      } as never)
      .mockReturnValue({
        createRecorder: jest.fn().mockResolvedValue(second.recorder),
      } as never);
    const callbacks = makeVideoCallbacks();
    const { ref, rerender, element } = renderVideoCamera();
    await act(async () => {
      await ref.current?.startVideo(callbacks);
    });

    rerender(element({ mode: 'video', recTime: 9 }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(callbacks.onCancelled).toHaveBeenCalledTimes(1);
    expect(callbacks.onFinished).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(first.recorder.cancelRecording).toHaveBeenCalledTimes(1);
    expect(first.recorder.dispose).toHaveBeenCalledTimes(1);
  });

  it('React 19 StrictMode 的 setup→cleanup→setup 后 controller 仍可用，startVideo 正常 started', async () => {
    const native = makeNativeRecorder();
    const createRecorder = jest.fn().mockResolvedValue(native.recorder);
    useVideoOutputMock.mockReturnValue({ createRecorder } as never);
    const ref = createRef<CameraHandle>();
    // StrictMode 必须是最外层：套在 ThemeProvider 之内时 React 不会对该子树重放
    // setup→cleanup→setup（已实测），测试就成了空跑，测不到 controller 被永久 dispose。
    render(
      <StrictMode>
        <ThemeProvider forceScheme="dark">
          <Camera
            ref={ref}
            device={makeDeviceStub() as never}
            currentMode={videoMode}
            isActive={false}
          />
        </ThemeProvider>
      </StrictMode>
    );

    const callbacks = makeVideoCallbacks();
    await act(async () => {
      await expect(ref.current?.startVideo(callbacks)).resolves.toBe('started');
    });

    expect(createRecorder).toHaveBeenCalledTimes(1);
    expect(native.recorder.startRecording).toHaveBeenCalledTimes(1);
    expect(callbacks.onCancelled).not.toHaveBeenCalled();
  });

  it('video output identity 真的被替换时旧 controller 永久失效，不会被重新激活', async () => {
    const first = makeNativeRecorder();
    const second = makeNativeRecorder();
    const firstCreate = jest.fn().mockResolvedValue(first.recorder);
    const secondCreate = jest.fn().mockResolvedValue(second.recorder);
    useVideoOutputMock
      .mockReturnValueOnce({ createRecorder: firstCreate } as never)
      .mockReturnValue({ createRecorder: secondCreate } as never);
    const callbacks = makeVideoCallbacks();
    const { ref, rerender, element } = renderVideoCamera();
    await act(async () => {
      await ref.current?.startVideo(callbacks);
    });

    rerender(element({ mode: 'video', recTime: 9 }));
    await act(async () => {
      await Promise.resolve();
    });

    // 替换后重新开录必须落到新 output 的 Recorder；旧 controller 不得被 activate() 复活。
    const nextCallbacks = makeVideoCallbacks();
    await act(async () => {
      await expect(ref.current?.startVideo(nextCallbacks)).resolves.toBe(
        'started'
      );
    });

    expect(callbacks.onCancelled).toHaveBeenCalledTimes(1);
    expect(first.recorder.cancelRecording).toHaveBeenCalledTimes(1);
    expect(first.recorder.dispose).toHaveBeenCalledTimes(1);
    expect(firstCreate).toHaveBeenCalledTimes(1);
    expect(secondCreate).toHaveBeenCalledTimes(1);
    expect(second.recorder.startRecording).toHaveBeenCalledTimes(1);
  });

  it('cancel 后 native 晚到 produced path 时 best-effort 删除，不交付 photos', async () => {
    const native = makeNativeRecorder();
    useVideoOutputMock.mockReturnValue({
      createRecorder: jest.fn().mockResolvedValue(native.recorder),
    } as never);
    const callbacks = makeVideoCallbacks();
    const { ref } = renderVideoCamera();
    await act(async () => {
      await ref.current?.startVideo(callbacks);
      await ref.current?.cancelVideo();
      native.finish('/tmp/late-after-cancel.mp4');
      await Promise.resolve();
    });

    expect(callbacks.onFinished).not.toHaveBeenCalled();
    expect(unlinkMock).toHaveBeenCalledTimes(1);
    expect(unlinkMock).toHaveBeenCalledWith('/tmp/late-after-cancel.mp4');
  });
});
