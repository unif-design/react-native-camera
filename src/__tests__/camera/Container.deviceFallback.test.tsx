import { act, fireEvent, waitFor } from '@testing-library/react-native';
import type { ForwardedRef, ReactElement } from 'react';
import type { CameraDevice, DeviceFilter } from 'react-native-vision-camera';
import type { CameraHandle } from '../../camera/Camera';
import { Container } from '../../camera/Container';
import { CameraDialogProvider } from '../../camera/ui/CameraDialogHost';
import type { CameraFrameRect } from '../../camera/session/frameRect';
import type { CameraMode, CameraResult, CustomPhotoFile } from '../../utils';
import {
  createContainerSessionProps,
  layoutCameraViewport,
} from '../__helpers__/containerSession';
import { makePhotoFile } from '../__helpers__/factories';
import { renderDark } from '../__helpers__/renderDark';
import { makeDeviceStub } from '../__helpers__/visionCameraMock';

type MockInventory = {
  back?: CameraDevice;
  front?: CameraDevice;
};

type MockCameraProps = {
  device: CameraDevice;
  currentMode: CameraMode;
  frame: CameraFrameRect;
  enableZoom?: boolean;
  enableFocus?: boolean;
  onConfigured?: () => void;
};

type MockCameraSnapshot = {
  instanceId: number;
  props: MockCameraProps;
};

let mockInventory: MockInventory = {};
const mockDeviceHookCalls: Array<{
  position: 'back' | 'front';
  filter?: DeviceFilter;
}> = [];
const mockCameraSnapshots: MockCameraSnapshot[] = [];
let mockCameraInstanceSequence = 0;
const mockCapture = jest.fn<Promise<CustomPhotoFile | null>, []>();

jest.mock('react-native-vision-camera', () => {
  const vc = require('../__helpers__/visionCameraMock');
  return vc.makeVisionCameraMock({
    ...vc.grantedPermissionOverrides(),
    useCameraDevice: (position: 'back' | 'front', filter?: DeviceFilter) => {
      mockDeviceHookCalls.push({ position, filter });
      return mockInventory[position];
    },
  });
});

jest.mock('../../camera/Camera', () => {
  const React = require('react') as typeof import('react');
  const ReactNative = require('react-native') as typeof import('react-native');
  return {
    Camera: React.forwardRef(
      (props: MockCameraProps, ref: ForwardedRef<CameraHandle>) => {
        const [instanceId] = React.useState(() => ++mockCameraInstanceSequence);
        React.useImperativeHandle(
          ref,
          () => ({
            capture: mockCapture,
            startVideo: jest.fn().mockResolvedValue('denied'),
            stopVideo: jest.fn().mockResolvedValue(undefined),
            cancelVideo: jest.fn().mockResolvedValue(undefined),
            getRecordedDuration: jest.fn().mockReturnValue(0),
          }),
          []
        );
        mockCameraSnapshots.push({ instanceId, props });
        return (
          <ReactNative.View
            testID="mock-native-camera"
            nativeID="vision-camera"
          />
        );
      }
    ),
  };
});

function cameraDevice(
  position: 'back' | 'front',
  id = `device-${position}`
): CameraDevice {
  return makeDeviceStub({ id, position }) as unknown as CameraDevice;
}

function latestCamera(): MockCameraSnapshot {
  const latest = mockCameraSnapshots.at(-1);
  if (latest == null) throw new Error('Camera boundary was not rendered');
  return latest;
}

function configureLatest(): void {
  const callback = latestCamera().props.onConfigured;
  if (callback == null) throw new Error('missing onConfigured callback');
  act(() => callback());
}

function renderContainer(
  requested: 'back' | 'front',
  onSettle: (result: CameraResult) => void = () => {}
) {
  const element: ReactElement = (
    <CameraDialogProvider>
      <Container
        {...createContainerSessionProps()}
        config={{
          cameraMode: [{ mode: 'continuous', type: requested }],
          dataRetainedMode: 'retain',
        }}
        onSettle={onSettle}
      />
    </CameraDialogProvider>
  );
  const rendered = renderDark(element);
  return { ...rendered, element };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInventory = {};
  mockDeviceHookCalls.length = 0;
  mockCameraSnapshots.length = 0;
  mockCameraInstanceSequence = 0;
  mockCapture.mockResolvedValue(
    makePhotoFile({
      id: 'raw-fallback',
      path: '/raw-fallback.jpg',
      uri: 'file:///raw-fallback.jpg',
      cameraType: 'back',
      mode: 'continuous',
    })
  );
});

it('每次 render 都固定按 back/front 顺序查询同一个稳定 filter', () => {
  mockInventory = {
    back: cameraDevice('back'),
    front: cameraDevice('front'),
  };
  const harness = renderContainer('front');
  layoutCameraViewport(harness);

  expect(mockDeviceHookCalls.length).toBeGreaterThanOrEqual(4);
  for (let index = 0; index < mockDeviceHookCalls.length; index += 2) {
    expect(mockDeviceHookCalls[index]?.position).toBe('back');
    expect(mockDeviceHookCalls[index + 1]?.position).toBe('front');
  }
  const filters = mockDeviceHookCalls.map((call) => call.filter);
  expect(filters.every((filter) => filter === filters[0])).toBe(true);
  expect(filters[0]).toEqual({
    physicalDevices: ['ultra-wide-angle', 'wide-angle'],
  });
});

it('requested back 缺失时 fallback 到实际 front，并用实际方向禁用 zoom/flip 与返回 metadata', async () => {
  mockInventory = { front: cameraDevice('front') };
  const onSettle = jest.fn<void, [CameraResult]>();
  const harness = renderContainer('back', onSettle);
  layoutCameraViewport(harness);

  expect(harness.queryByTestId('no-camera')).toBeNull();
  expect(latestCamera().props.device.position).toBe('front');
  configureLatest();
  expect(latestCamera().props.enableZoom).toBe(false);
  expect(harness.queryByTestId('zoom-chip-0.5')).toBeNull();
  expect(harness.queryByTestId('zoom-chip-1')).toBeNull();
  expect(
    harness.getByTestId('flip-btn').props.accessibilityState.disabled
  ).toBe(true);

  fireEvent.press(harness.getByTestId('aspect-btn'));
  await act(async () => {
    fireEvent.press(harness.getByTestId('shutter-btn'));
    await Promise.resolve();
  });
  await waitFor(() =>
    expect(harness.getByTestId('side-save-btn')).toBeTruthy()
  );
  fireEvent.press(harness.getByTestId('side-save-btn'));

  expect(onSettle).toHaveBeenCalledWith({
    code: 200,
    data: [
      expect.objectContaining({
        path: '/raw-fallback.jpg',
        cameraType: 'front',
      }),
    ],
    message: 'ok',
  });
});

it('requested front 缺失时 fallback 到实际 back，并保留后摄 zoom 行为', () => {
  mockInventory = { back: cameraDevice('back') };
  const harness = renderContainer('front');
  layoutCameraViewport(harness);

  expect(latestCamera().props.device.position).toBe('back');
  configureLatest();
  expect(latestCamera().props.enableZoom).toBe(true);
  expect(harness.getByTestId('zoom-chip-0.5')).toBeTruthy();
  expect(harness.getByTestId('zoom-chip-1')).toBeTruthy();
  expect(
    harness.getByTestId('flip-btn').props.accessibilityState.disabled
  ).toBe(true);
});

it('两侧都有设备时 flip 启用，切换到另一实际设备并等待新 generation', () => {
  mockInventory = {
    back: cameraDevice('back'),
    front: cameraDevice('front'),
  };
  const harness = renderContainer('back');
  layoutCameraViewport(harness);
  const instanceId = latestCamera().instanceId;
  configureLatest();

  expect(
    harness.getByTestId('flip-btn').props.accessibilityState.disabled
  ).toBe(false);
  fireEvent.press(harness.getByTestId('flip-btn'));

  expect(latestCamera().props.device.position).toBe('front');
  expect(latestCamera().props.enableFocus).toBe(false);
  configureLatest();
  expect(latestCamera().props.enableFocus).toBe(true);
  expect(latestCamera().instanceId).toBe(instanceId);
});

it('只有 back/front 都缺失时进入唯一 404 分支', () => {
  mockInventory = {};
  const harness = renderContainer('back');

  expect(harness.getByTestId('no-camera')).toBeTruthy();
  expect(harness.queryByTestId('camera-viewport')).toBeNull();
  expect(mockDeviceHookCalls.map((call) => call.position)).toEqual([
    'back',
    'front',
  ]);
});

it('fallback 后 configuration key 使用 actual position，即使 device id 相同也识别真实设备变化', () => {
  const sharedId = 'shared-device-id';
  mockInventory = { front: cameraDevice('front', sharedId) };
  const harness = renderContainer('back');
  layoutCameraViewport(harness);
  configureLatest();
  expect(latestCamera().props.enableFocus).toBe(true);

  mockInventory = {
    back: cameraDevice('back', sharedId),
    front: cameraDevice('front', sharedId),
  };
  layoutCameraViewport(harness, { width: 391, height: 844 });

  expect(latestCamera().props.device.position).toBe('back');
  expect(latestCamera().props.enableFocus).toBe(false);
  configureLatest();
  expect(latestCamera().props.enableFocus).toBe(true);
});
