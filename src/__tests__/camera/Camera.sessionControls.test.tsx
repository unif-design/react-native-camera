import React from 'react';
import { Platform } from 'react-native';
import { act } from '@testing-library/react-native';
import type { CameraMode } from '../../utils';
import { makeAnimatedFrameStub } from '../__helpers__/cameraFrame';
import { renderDark } from '../__helpers__/renderDark';
import { makeDeviceStub } from '../__helpers__/visionCameraMock';

const mockVisionCameraProps: {
  current: Record<string, unknown> | null;
} = { current: null };

jest.mock('react-native-vision-camera', () => {
  const ReactModule = require('react') as typeof import('react');
  const ReactNative = require('react-native') as typeof import('react-native');
  const vc = require('../__helpers__/visionCameraMock');

  return vc.makeVisionCameraMock({
    ...vc.grantedPermissionOverrides(),
    usePhotoOutput: jest.fn(() =>
      ReactModule.useMemo(
        () => ({
          capturePhoto: jest.fn(),
          capturePhotoToFile: jest.fn(),
        }),
        []
      )
    ),
    useVideoOutput: jest.fn(() =>
      ReactModule.useMemo(
        () => ({
          createRecorder: jest.fn(),
        }),
        []
      )
    ),
    Camera: ReactModule.forwardRef(
      (props: Record<string, unknown>, ref: React.ForwardedRef<unknown>) => {
        mockVisionCameraProps.current = props;
        ReactModule.useImperativeHandle(ref, () => ({
          focusTo: jest.fn().mockResolvedValue(undefined),
          resetFocus: jest.fn(),
        }));
        return <ReactNative.View testID="vision-camera" />;
      }
    ),
  });
});

import { Camera } from '../../camera/Camera';

const FRAME = { x: 0, y: 0, width: 390, height: 520 };
const ANIMATED_FRAME = makeAnimatedFrameStub(FRAME);
const PHOTO_MODE: CameraMode = { mode: 'single', quality: 0.9 };
const VIDEO_MODE: CameraMode = { mode: 'video', quality: 0.9 };
const ZOOM_SHARED = { value: 1 };
const ORIGINAL_PLATFORM_OS = Object.getOwnPropertyDescriptor(Platform, 'OS');

function currentVisionCameraProps(): Record<string, unknown> {
  if (mockVisionCameraProps.current == null) {
    throw new Error('VisionCamera 尚未渲染');
  }
  return mockVisionCameraProps.current;
}

function setPlatformOS(os: 'android' | 'ios'): void {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: os,
  });
}

function emitPreviewStarted(): void {
  (currentVisionCameraProps().onPreviewStarted as () => void)();
}

function emitPreviewStopped(): void {
  (currentVisionCameraProps().onPreviewStopped as () => void)();
}

function cameraElement({
  currentMode = PHOTO_MODE,
  flash = 'off',
  isActive = true,
}: {
  currentMode?: CameraMode;
  flash?: 'auto' | 'on' | 'off';
  isActive?: boolean;
} = {}) {
  return (
    <Camera
      device={makeDeviceStub() as never}
      currentMode={currentMode}
      frame={FRAME}
      animatedFrame={ANIMATED_FRAME}
      isActive={isActive}
      flash={flash}
      zoomShared={ZOOM_SHARED as never}
    />
  );
}

beforeEach(() => {
  mockVisionCameraProps.current = null;
  setPlatformOS('android');
});

afterEach(() => {
  if (ORIGINAL_PLATFORM_OS != null) {
    Object.defineProperty(Platform, 'OS', ORIGINAL_PLATFORM_OS);
  }
});

it('Android 仅在当前预览进入 STREAMING 后下发 zoom/torch，停用与重配后重新等待', () => {
  const screen = renderDark(cameraElement());

  expect(currentVisionCameraProps().zoom).toBeUndefined();
  expect(currentVisionCameraProps().torchMode).toBeUndefined();

  act(() => {
    emitPreviewStarted();
  });
  expect(currentVisionCameraProps().zoom).toBe(ZOOM_SHARED);
  expect(currentVisionCameraProps().torchMode).toBe('off');

  screen.rerender(cameraElement({ currentMode: VIDEO_MODE, flash: 'on' }));
  expect(currentVisionCameraProps().zoom).toBeUndefined();
  expect(currentVisionCameraProps().torchMode).toBeUndefined();

  act(() => {
    emitPreviewStarted();
  });
  expect(currentVisionCameraProps().zoom).toBe(ZOOM_SHARED);
  expect(currentVisionCameraProps().torchMode).toBe('on');

  act(() => {
    emitPreviewStopped();
  });
  expect(currentVisionCameraProps().zoom).toBeUndefined();
  expect(currentVisionCameraProps().torchMode).toBeUndefined();

  act(() => {
    emitPreviewStarted();
  });
  expect(currentVisionCameraProps().zoom).toBe(ZOOM_SHARED);
  expect(currentVisionCameraProps().torchMode).toBe('on');

  screen.rerender(
    cameraElement({ currentMode: VIDEO_MODE, flash: 'on', isActive: false })
  );
  expect(currentVisionCameraProps().zoom).toBeUndefined();
  expect(currentVisionCameraProps().torchMode).toBeUndefined();

  screen.rerender(
    cameraElement({ currentMode: VIDEO_MODE, flash: 'on', isActive: true })
  );
  expect(currentVisionCameraProps().zoom).toBeUndefined();
  expect(currentVisionCameraProps().torchMode).toBeUndefined();

  act(() => {
    emitPreviewStarted();
  });
  expect(currentVisionCameraProps().zoom).toBe(ZOOM_SHARED);
  expect(currentVisionCameraProps().torchMode).toBe('on');

  act(() => {
    emitPreviewStopped();
  });
  expect(currentVisionCameraProps().zoom).toBeUndefined();
  expect(currentVisionCameraProps().torchMode).toBeUndefined();
});

it('iOS 保持原生 session 重配期间立即下发 zoom/torch', () => {
  setPlatformOS('ios');
  const screen = renderDark(cameraElement());

  expect(currentVisionCameraProps().zoom).toBe(ZOOM_SHARED);
  expect(currentVisionCameraProps().torchMode).toBe('off');

  screen.rerender(cameraElement({ currentMode: VIDEO_MODE, flash: 'on' }));
  expect(currentVisionCameraProps().zoom).toBe(ZOOM_SHARED);
  expect(currentVisionCameraProps().torchMode).toBe('on');

  screen.rerender(
    cameraElement({ currentMode: VIDEO_MODE, flash: 'on', isActive: false })
  );
  expect(currentVisionCameraProps().zoom).toBe(ZOOM_SHARED);
  expect(currentVisionCameraProps().torchMode).toBe('on');
});
