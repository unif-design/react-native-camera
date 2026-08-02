import { act, fireEvent } from '@testing-library/react-native';
import type { ForwardedRef, ReactElement } from 'react';
import type { CameraDevice } from 'react-native-vision-camera';
import type { CameraHandle } from '../../camera/Camera';
import { Container } from '../../camera/Container';
import type { CameraFrameRect } from '../../camera/session/frameRect';
import { CameraDialogProvider } from '../../camera/ui/CameraDialogHost';
import type { CameraMode, OpenConfig, WatermarkType } from '../../utils';
import {
  createContainerSessionProps,
  layoutCameraViewport,
} from '../__helpers__/containerSession';
import { renderDark } from '../__helpers__/renderDark';

type MockCameraProps = {
  device: CameraDevice;
  currentMode: CameraMode;
  frame: CameraFrameRect;
  animatedFrame?: object;
  enableFocus?: boolean;
  onConfigured?: () => void;
};

type CameraSnapshot = {
  instanceId: number;
  props: MockCameraProps;
};

const mockCameraSnapshots: CameraSnapshot[] = [];
const mockWatermarkSnapshots: Array<{
  frame: CameraFrameRect;
  animatedFrame?: object;
}> = [];
let mockCameraMounts = 0;
let mockCameraInstanceSequence = 0;

jest.mock('react-native-vision-camera', () => {
  const vc = require('../__helpers__/visionCameraMock');
  return vc.makeVisionCameraMock({
    ...vc.grantedPermissionOverrides(),
    useCameraDevice: (position: 'back' | 'front') =>
      vc.makeDeviceStub({ position }),
  });
});

jest.mock('../../camera/Camera', () => {
  const React = require('react') as typeof import('react');
  const ReactNative = require('react-native') as typeof import('react-native');
  return {
    Camera: React.forwardRef(
      (props: MockCameraProps, ref: ForwardedRef<CameraHandle>) => {
        const [instanceId] = React.useState(() => ++mockCameraInstanceSequence);
        React.useEffect(() => {
          mockCameraMounts += 1;
        }, []);
        React.useImperativeHandle(
          ref,
          () => ({
            capture: jest.fn().mockResolvedValue(null),
            startVideo: jest.fn().mockResolvedValue('denied'),
            stopVideo: jest.fn().mockResolvedValue(undefined),
            cancelVideo: jest.fn().mockResolvedValue(undefined),
            getRecordedDuration: jest.fn().mockReturnValue(0),
          }),
          []
        );
        mockCameraSnapshots.push({ instanceId, props });
        return <ReactNative.View testID="mock-native-camera" />;
      }
    ),
  };
});

jest.mock('../../camera/watermark', () => {
  const ReactNative = require('react-native') as typeof import('react-native');
  return {
    WatermarkStamp: ({
      frame,
      animatedFrame,
    }: {
      watermark: WatermarkType;
      frame: CameraFrameRect;
      animatedFrame?: object;
    }) => {
      mockWatermarkSnapshots.push({ frame, animatedFrame });
      return <ReactNative.View testID="mock-watermark-stamp" />;
    },
  };
});

const watermark: WatermarkType = {
  content: ['viewport'],
  position: 'bottom-right',
};

function latestCamera(): CameraSnapshot {
  const snapshot = mockCameraSnapshots.at(-1);
  if (snapshot == null) throw new Error('Camera boundary was not rendered');
  return snapshot;
}

function latestWatermark(): {
  frame: CameraFrameRect;
  animatedFrame?: object;
} {
  const snapshot = mockWatermarkSnapshots.at(-1);
  if (snapshot == null) throw new Error('Watermark boundary was not rendered');
  return snapshot;
}

function expectSharedFrameAnimation(): void {
  const cameraAnimatedFrame = latestCamera().props.animatedFrame;
  expect(cameraAnimatedFrame).toBeDefined();
  expect(latestWatermark().animatedFrame).toBe(cameraAnimatedFrame);
}

function expectFrame(actual: CameraFrameRect, expected: CameraFrameRect): void {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
  expect(actual.width).toBeCloseTo(expected.width, 10);
  expect(actual.height).toBeCloseTo(expected.height, 10);
}

function configureLatest(): void {
  const callback = latestCamera().props.onConfigured;
  if (callback == null) throw new Error('missing onConfigured callback');
  act(() => callback());
}

function renderContainer(config: OpenConfig) {
  const element: ReactElement = (
    <CameraDialogProvider>
      <Container
        {...createContainerSessionProps()}
        config={config}
        onSettle={() => {}}
      />
    </CameraDialogProvider>
  );
  return renderDark(element);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCameraSnapshots.length = 0;
  mockWatermarkSnapshots.length = 0;
  mockCameraMounts = 0;
  mockCameraInstanceSequence = 0;
});

it('zero viewport 不挂 native Camera，但保留可触发 layout 的稳定 root', () => {
  const harness = renderContainer({
    cameraMode: [{ mode: 'single' }],
    dataRetainedMode: 'retain',
    watermark,
  });

  expect(harness.getByTestId('camera-viewport')).toBeTruthy();
  expect(harness.getByTestId('layout-pending')).toBeTruthy();
  expect(harness.queryByTestId('mock-native-camera')).toBeNull();
  expect(harness.queryByTestId('mock-watermark-stamp')).toBeNull();
});

it.each([
  [
    { width: 390, height: 844 },
    {
      '16:9': {
        x: 0,
        y: 75.33333333333337,
        width: 390,
        height: 693.3333333333333,
      },
      '4:3': { x: 0, y: 162, width: 390, height: 520 },
    },
  ],
  [
    { width: 844, height: 390 },
    {
      '16:9': {
        x: 75.33333333333337,
        y: 0,
        width: 693.3333333333333,
        height: 390,
      },
      '4:3': { x: 162, y: 0, width: 520, height: 390 },
    },
  ],
  [
    { width: 507, height: 768 },
    {
      '16:9': { x: 37.5, y: 0, width: 432, height: 768 },
      '4:3': { x: 0, y: 46, width: 507, height: 676 },
    },
  ],
] as const)(
  'viewport %p 对 16:9/4:3 只派生一个共享 Camera/Watermark frame',
  (viewport, expected) => {
    const harness = renderContainer({
      cameraMode: [{ mode: 'single' }],
      dataRetainedMode: 'retain',
      watermark,
    });
    layoutCameraViewport(harness, viewport);

    expectFrame(latestCamera().props.frame, expected['16:9']);
    expect(latestWatermark().frame).toBe(latestCamera().props.frame);
    expectSharedFrameAnimation();
    configureLatest();
    fireEvent.press(harness.getByTestId('aspect-btn'));

    expectFrame(latestCamera().props.frame, expected['4:3']);
    expect(latestWatermark().frame).toBe(latestCamera().props.frame);
    expectSharedFrameAnimation();
    expect(latestCamera().props.enableFocus).toBe(true);
  }
);

it('resize/orientation 更新完整 rect，且不 remount Camera', () => {
  const harness = renderContainer({
    cameraMode: [{ mode: 'single' }],
    dataRetainedMode: 'retain',
    watermark,
  });
  layoutCameraViewport(harness, { width: 390, height: 844 });
  const instanceId = latestCamera().instanceId;
  const animatedFrame = latestCamera().props.animatedFrame;

  layoutCameraViewport(harness, { width: 844, height: 390 });

  expect(latestCamera().props.frame).toEqual({
    x: 75.33333333333337,
    y: 0,
    width: 693.3333333333333,
    height: 390,
  });
  expect(latestWatermark().frame).toBe(latestCamera().props.frame);
  expectSharedFrameAnimation();
  expect(latestCamera().props.animatedFrame).toBe(animatedFrame);
  expect(latestCamera().instanceId).toBe(instanceId);
  expect(mockCameraMounts).toBe(1);
});

it('video 画幅切换先更新共享 frame，并保持 generation gate 到新 onConfigured', () => {
  const harness = renderContainer({
    cameraMode: [{ mode: 'video' }],
    dataRetainedMode: 'retain',
    watermark,
  });
  layoutCameraViewport(harness, { width: 390, height: 844 });
  configureLatest();

  fireEvent.press(harness.getByTestId('aspect-btn'));

  expect(latestCamera().props.frame).toEqual({
    x: 0,
    y: 162,
    width: 390,
    height: 520,
  });
  expect(latestWatermark().frame).toBe(latestCamera().props.frame);
  expectSharedFrameAnimation();
  expect(latestCamera().props.enableFocus).toBe(false);
  configureLatest();
  expect(latestCamera().props.enableFocus).toBe(true);
});
