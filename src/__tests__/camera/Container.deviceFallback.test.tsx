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
  isActive?: boolean;
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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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
      width: 1080,
      height: 1920,
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

it('两侧都有设备时 flip 为新 generation 重建 output owner，避免跨 session 复用 native output', () => {
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
  expect(latestCamera().instanceId).not.toBe(instanceId);
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

it('capture 期间只保留 committed device，回到 ready 后才原子提交 pending inventory', async () => {
  const back = cameraDevice('back', 'capture-device');
  const front = cameraDevice('front', 'capture-fallback');
  mockInventory = { back };
  const capture = deferred<CustomPhotoFile | null>();
  mockCapture.mockReturnValueOnce(capture.promise);
  const harness = renderContainer('back');
  layoutCameraViewport(harness);
  configureLatest();
  const committedInstance = latestCamera().instanceId;

  fireEvent.press(harness.getByTestId('shutter-btn'));
  mockInventory = { front };
  layoutCameraViewport(harness, { width: 391, height: 844 });

  expect(latestCamera().props.device).toBe(back);
  expect(latestCamera().instanceId).toBe(committedInstance);

  const raw = makePhotoFile({
    id: 'capture-pending-selection',
    path: '/capture-pending-selection.jpg',
    uri: 'file:///capture-pending-selection.jpg',
    width: 1080,
    height: 1920,
    cameraType: 'back',
    mode: 'continuous',
  });
  await act(async () => {
    capture.resolve(raw);
    await capture.promise;
  });
  await waitFor(() => expect(latestCamera().props.device).toBe(front));
  expect(latestCamera().props.enableFocus).toBe(false);
  configureLatest();
  expect(latestCamera().props.enableFocus).toBe(true);
});

it('inventory 消失时忙态保留 committed device，回到 ready 后进入 no-device', async () => {
  const back = cameraDevice('back', 'removed-during-capture');
  mockInventory = { back };
  const capture = deferred<CustomPhotoFile | null>();
  mockCapture.mockReturnValueOnce(capture.promise);
  const harness = renderContainer('back');
  layoutCameraViewport(harness);
  configureLatest();
  fireEvent.press(harness.getByTestId('shutter-btn'));

  mockInventory = {};
  layoutCameraViewport(harness, { width: 391, height: 844 });
  expect(latestCamera().props.device).toBe(back);
  expect(harness.queryByTestId('no-camera')).toBeNull();

  const raw = makePhotoFile({
    id: 'removed-inventory-photo',
    path: '/removed-inventory-photo.jpg',
    uri: 'file:///removed-inventory-photo.jpg',
    width: 1080,
    height: 1920,
    cameraType: 'back',
    mode: 'continuous',
  });
  await act(async () => {
    capture.resolve(raw);
    await capture.promise;
  });

  await waitFor(() => expect(harness.getByTestId('no-camera')).toBeTruthy());
  expect(harness.queryByTestId('mock-native-camera')).toBeNull();
});

it('same-id device object replacement still starts a gated native generation', () => {
  const original = cameraDevice('back', 'stable-public-id');
  mockInventory = { back: original };
  const harness = renderContainer('back');
  layoutCameraViewport(harness);
  configureLatest();
  const originalInstance = latestCamera().instanceId;
  const replacement = cameraDevice('back', 'stable-public-id');

  mockInventory = { back: replacement };
  layoutCameraViewport(harness, { width: 391, height: 844 });

  expect(latestCamera().props.device).toBe(replacement);
  expect(latestCamera().props.enableFocus).toBe(false);
  expect(latestCamera().instanceId).not.toBe(originalInstance);
});

it('preview 期间冻结 committed selection，退出后再配置最新 inventory', async () => {
  const back = cameraDevice('back', 'preview-device');
  const front = cameraDevice('front', 'preview-fallback');
  mockInventory = { back };
  const harness = renderContainer('back');
  layoutCameraViewport(harness);
  configureLatest();
  await act(async () => {
    fireEvent.press(harness.getByTestId('shutter-btn'));
    await Promise.resolve();
  });
  fireEvent.press(harness.getByTestId('thumbnail-stack'));
  expect(harness.getByTestId('preview-overlay')).toBeTruthy();

  mockInventory = { front };
  layoutCameraViewport(harness, { width: 391, height: 844 });

  expect(latestCamera().props.device).toBe(back);
  expect(latestCamera().props.isActive).toBe(false);
  fireEvent.press(harness.getByTestId('back-btn'));
  await waitFor(() => expect(latestCamera().props.device).toBe(front));
  expect(latestCamera().props.enableFocus).toBe(false);
  configureLatest();
  expect(latestCamera().props.enableFocus).toBe(true);
});
