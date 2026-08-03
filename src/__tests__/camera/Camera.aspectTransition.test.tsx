import { createRef } from 'react';
import * as Reanimated from 'react-native-reanimated';
import * as VisionCamera from 'react-native-vision-camera';
import { StyleSheet } from 'react-native';
import { act } from '@testing-library/react-native';
import {
  Camera,
  type CameraHandle,
  type VideoCallbacks,
} from '../../camera/Camera';
import { AnimatedCameraFrame } from '../../camera/AnimatedCameraFrame';
import type { CameraFrameRect } from '../../camera/session/frameRect';
import type { CameraMode } from '../../utils';
import { renderDark } from '../__helpers__/renderDark';
import { makeDeviceStub } from '../__helpers__/visionCameraMock';

jest.mock('react-native-vision-camera', () => {
  const vc = require('../__helpers__/visionCameraMock');
  return vc.makeVisionCameraMock({
    useMicrophonePermission: jest.fn(() => ({
      status: 'authorized',
      hasPermission: true,
      canRequestPermission: false,
      requestPermission: jest.fn().mockResolvedValue(true),
    })),
  });
});

// jest 的 reanimated 桩会同步返回 withTiming 终值，故可直接读取动画 View 的最终 rect；
// 断言 x/y/width/height 全由显式 frame 驱动，避免退回 window width + 单 height 动画。
const singleMode: CameraMode = { mode: 'single' };
const initialFrame: CameraFrameRect = {
  x: 12,
  y: 24,
  width: 366,
  height: 650.6666666666666,
};

function element(frame: CameraFrameRect) {
  return (
    <AnimatedCameraFrame frame={frame}>
      {(animatedFrame) => (
        <Camera
          device={makeDeviceStub() as never}
          currentMode={singleMode}
          isActive={false}
          frame={frame}
          animatedFrame={animatedFrame}
        />
      )}
    </AnimatedCameraFrame>
  );
}

/** 取景框 = 包住 VisionCamera 的最近父 View(Animated.View 在 jest 下渲染成普通 View)。 */
function getFrame(root: ReturnType<typeof renderDark>['UNSAFE_root']) {
  const vc = root.findByProps({ nativeID: 'vision-camera' });
  const frame = vc.parent;
  if (frame == null) throw new Error('missing animated frame');
  return frame;
}

it('显式 frame 精确驱动 absolute left/top/width/height', () => {
  const { UNSAFE_root } = renderDark(element(initialFrame));
  const style = StyleSheet.flatten(getFrame(UNSAFE_root).props.style);

  expect(style).toEqual(
    expect.objectContaining({
      position: 'absolute',
      left: 12,
      top: 24,
      width: 366,
      height: 650.6666666666666,
      overflow: 'hidden',
    })
  );
  expect(style.aspectRatio).toBeUndefined();
});

it('frame resize 更新完整 rect，且保持同一 Camera/native instance', () => {
  const rendered = renderDark(element(initialFrame));
  const nativeBefore = rendered.UNSAFE_root.findByProps({
    nativeID: 'vision-camera',
  });
  const nextFrame: CameraFrameRect = {
    x: 75.33333333333337,
    y: 0,
    width: 693.3333333333333,
    height: 390,
  };
  const withTiming = jest.spyOn(Reanimated, 'withTiming');
  withTiming.mockClear();

  rendered.rerender(element(nextFrame));

  const nativeAfter = rendered.UNSAFE_root.findByProps({
    nativeID: 'vision-camera',
  });
  expect(nativeAfter).toBe(nativeBefore);
  expect(withTiming.mock.calls.map(([value]) => value)).toEqual([
    nextFrame.x,
    nextFrame.y,
    nextFrame.width,
    nextFrame.height,
  ]);
  expect(
    withTiming.mock.calls.every(([, options]) => options?.duration === 250)
  ).toBe(true);
  withTiming.mockRestore();
});

it("VisionCamera resizeMode='cover'", () => {
  const { UNSAFE_root } = renderDark(element(initialFrame));
  const vc = UNSAFE_root.findByProps({ nativeID: 'vision-camera' });
  expect(vc.props.resizeMode).toBe('cover');
});

it('frame 内无纯黑 pointerEvents=none 转场遮罩', () => {
  const { UNSAFE_root } = renderDark(element(initialFrame));
  const shade = UNSAFE_root.findAll((node) => {
    const style = StyleSheet.flatten(node.props.style);
    return (
      style != null &&
      style.backgroundColor === '#000' &&
      node.props.pointerEvents === 'none'
    );
  });
  expect(shade).toHaveLength(0);
});

it('仅 frame resize 不替换 active native recorder owner', async () => {
  const recorder = {
    startRecording: jest.fn().mockResolvedValue(undefined),
    stopRecording: jest.fn().mockResolvedValue(undefined),
    pauseRecording: jest.fn().mockResolvedValue(undefined),
    resumeRecording: jest.fn().mockResolvedValue(undefined),
    cancelRecording: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn(),
    isRecording: true,
    isPaused: false,
    recordedDuration: 1,
    recordedFileSize: 0,
    filePath: '/tmp/frame-resize.mp4',
  };
  const videoOutput = {
    createRecorder: jest.fn().mockResolvedValue(recorder),
  };
  jest
    .mocked(VisionCamera.useVideoOutput)
    .mockReturnValue(videoOutput as never);
  jest.mocked(VisionCamera.useMicrophonePermission).mockReturnValue({
    status: 'authorized',
    hasPermission: true,
    canRequestPermission: false,
    requestPermission: jest.fn().mockResolvedValue(true),
  });
  const ref = createRef<CameraHandle>();
  const videoElement = (frame: CameraFrameRect) => (
    <AnimatedCameraFrame frame={frame}>
      {(animatedFrame) => (
        <Camera
          ref={ref}
          device={makeDeviceStub() as never}
          currentMode={{ mode: 'video' }}
          isActive={false}
          frame={frame}
          animatedFrame={animatedFrame}
        />
      )}
    </AnimatedCameraFrame>
  );
  const rendered = renderDark(videoElement(initialFrame));
  const callbacks: VideoCallbacks = {
    onFinished: jest.fn(),
    onError: jest.fn(),
  };
  await act(async () => {
    await ref.current?.startVideo(callbacks);
  });

  rendered.rerender(
    videoElement({ x: 0, y: 0, width: 693.3333333333333, height: 390 })
  );
  await act(async () => {
    await Promise.resolve();
  });

  expect(videoOutput.createRecorder).toHaveBeenCalledTimes(1);
  expect(recorder.cancelRecording).not.toHaveBeenCalled();
  expect(recorder.dispose).not.toHaveBeenCalled();
});
