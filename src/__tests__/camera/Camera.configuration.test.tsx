import { act } from '@testing-library/react-native';
import type { CameraDevice } from 'react-native-vision-camera';
import { Camera } from '../../camera/Camera';
import { cameraSessionReducer } from '../../camera/session/reducer';
import type { CameraSessionState } from '../../camera/session/types';
import type { CameraMode } from '../../utils';
import { makeAnimatedFrameStub } from '../__helpers__/cameraFrame';
import { renderDark } from '../__helpers__/renderDark';
import { makeDeviceStub } from '../__helpers__/visionCameraMock';

type NativeConfigurationRequest = {
  device: CameraDevice;
  output: object;
  complete: () => void;
};

const mockNativeConfigurationRequests: NativeConfigurationRequest[] = [];
let mockPhotoOutputSequence = 0;

jest.mock('react-native-vision-camera', () => {
  const React = require('react') as typeof import('react');
  const ReactNative = require('react-native') as typeof import('react-native');
  const vc = require('../__helpers__/visionCameraMock');
  return vc.makeVisionCameraMock({
    ...vc.grantedPermissionOverrides(),
    usePhotoOutput: jest.fn(() =>
      React.useMemo(
        () => ({
          id: `photo-output-${++mockPhotoOutputSequence}`,
          capturePhoto: jest.fn(),
          capturePhotoToFile: jest.fn(),
        }),
        []
      )
    ),
    useVideoOutput: jest.fn(() =>
      React.useMemo(
        () => ({
          createRecorder: jest.fn(),
        }),
        []
      )
    ),
    Camera: ({
      device,
      outputs,
      onConfigured,
    }: {
      device: CameraDevice;
      outputs: object[];
      onConfigured?: () => void;
    }) => {
      // 对齐 VisionCamera 5.0.11 useStableCallback：旧 configure continuation
      // 调用稳定 wrapper，而 wrapper 总是转发到该组件实例的最新 callback。
      const callbackRef = React.useRef(onConfigured);
      callbackRef.current = onConfigured;
      const stableOnConfigured = React.useCallback(
        () => callbackRef.current?.(),
        []
      );

      React.useEffect(() => {
        mockNativeConfigurationRequests.push({
          device,
          output: outputs[0] as object,
          complete: stableOnConfigured,
        });
      }, [device, outputs, stableOnConfigured]);

      return (
        <ReactNative.View
          nativeID="vision-camera"
          testID={`native-camera-${device.id}`}
        />
      );
    },
  });
});

const frame = { x: 0, y: 0, width: 390, height: 520 };
const animatedFrame = makeAnimatedFrameStub(frame);
const mode: CameraMode = { mode: 'single' };

function cameraElement(
  device: CameraDevice,
  configurationGeneration: number,
  onConfigured: () => void
) {
  return (
    <Camera
      key={configurationGeneration}
      device={device}
      currentMode={mode}
      frame={frame}
      animatedFrame={animatedFrame}
      isActive={false}
      onConfigured={onConfigured}
    />
  );
}

beforeEach(() => {
  mockNativeConfigurationRequests.length = 0;
  mockPhotoOutputSequence = 0;
});

it('binds deferred completions and native outputs to the generation that created them', () => {
  const firstDevice = makeDeviceStub({
    id: 'same-public-id',
    position: 'back',
  }) as unknown as CameraDevice;
  const replacementDevice = makeDeviceStub({
    id: 'same-public-id',
    position: 'back',
  }) as unknown as CameraDevice;
  let session: CameraSessionState = {
    phase: 'configuring',
    files: [],
    modeIndex: 0,
    aspectRatio: '16:9',
    activePosition: 'back',
    canFlip: true,
    flash: 'off',
    sound: false,
    preview: null,
    operationId: null,
    configurationGeneration: 2,
    nativeConfigurationKey: 'replacement',
    video: { duration: 0, reason: null },
  };
  const firstConfigured = jest.fn(() => {
    session = cameraSessionReducer(session, {
      type: 'CONFIGURED',
      generation: 1,
    });
  });
  const replacementConfigured = jest.fn(() => {
    session = cameraSessionReducer(session, {
      type: 'CONFIGURED',
      generation: 2,
    });
  });
  const rendered = renderDark(cameraElement(firstDevice, 1, firstConfigured));
  expect(mockNativeConfigurationRequests).toHaveLength(1);

  rendered.rerender(cameraElement(replacementDevice, 2, replacementConfigured));
  expect(mockNativeConfigurationRequests).toHaveLength(2);
  expect(mockNativeConfigurationRequests[1]?.output).not.toBe(
    mockNativeConfigurationRequests[0]?.output
  );

  // 旧 native Promise 在新 render 替换 callback 后才完成。若共享同一个
  // useStableCallback ref，它会错误调用 replacementConfigured。
  act(() => mockNativeConfigurationRequests[0]?.complete());
  expect(firstConfigured).toHaveBeenCalledTimes(1);
  expect(replacementConfigured).not.toHaveBeenCalled();
  expect(session.phase).toBe('configuring');

  act(() => mockNativeConfigurationRequests[1]?.complete());
  expect(replacementConfigured).toHaveBeenCalledTimes(1);
  expect(session.phase).toBe('ready');
});
