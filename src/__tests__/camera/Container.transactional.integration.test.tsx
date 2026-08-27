import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import type { CameraDevice } from 'react-native-vision-camera';
import type { CameraHandle, VideoCallbacks } from '../../camera/Camera';
import { Container } from '../../camera/Container';
import { CameraDialogProvider } from '../../camera/ui/CameraDialogHost';
import type {
  RegisterSessionController,
  SessionControllerBridge,
} from '../../camera/session/controllerBridge';
import {
  createFileRegistry,
  type FileRegistry,
} from '../../camera/session/fileRegistry';
import { processPhoto } from '../../camera/image/processPhoto';
import type {
  CameraMode,
  CameraResult,
  CustomPhotoFile,
  OpenConfig,
} from '../../utils';
import { makePhotoFile } from '../__helpers__/factories';
import { renderDark } from '../__helpers__/renderDark';
import { layoutCameraViewport } from '../__helpers__/containerSession';
import { makeDeviceStub } from '../__helpers__/visionCameraMock';

type MockCameraProps = {
  device: CameraDevice;
  currentMode: CameraMode;
  aspectRatio?: '4:3' | '16:9';
  isActive?: boolean;
  flash?: 'auto' | 'on' | 'off';
  sound?: boolean;
  enableZoom?: boolean;
  enableFocus?: boolean;
  onConfigured?: () => void;
};

type MockCameraSnapshot = {
  instanceId: number;
  props: MockCameraProps;
};

const mockCameraSnapshots: MockCameraSnapshot[] = [];
let mockCameraMounts = 0;
let mockCameraInstanceSequence = 0;
let mockVideoCallbacks: VideoCallbacks | null = null;
let mockActualPosition: 'back' | 'front' | null = null;
let mockBackDevice!: CameraDevice;
let mockFrontDevice!: CameraDevice;
const originalAppStateDescriptor = Object.getOwnPropertyDescriptor(
  AppState,
  'currentState'
);

const mockCapture = jest.fn<Promise<CustomPhotoFile | null>, []>();
const mockStartVideo = jest.fn<
  Promise<'started' | 'denied'>,
  [VideoCallbacks]
>();
const mockStopVideo = jest.fn<Promise<void>, []>();
const mockCancelVideo = jest.fn<Promise<void>, []>();
const mockGetRecordedDuration = jest.fn<number, []>();

jest.mock('react-native-vision-camera', () => {
  const vc = require('../__helpers__/visionCameraMock');
  return vc.makeVisionCameraMock({
    ...vc.grantedPermissionOverrides(),
    useCameraDevice: (requested: 'back' | 'front') =>
      mockActualPosition == null || mockActualPosition === requested
        ? requested === 'back'
          ? mockBackDevice
          : mockFrontDevice
        : undefined,
  });
});

jest.mock('../../camera/Camera', () => {
  const React = require('react') as typeof import('react');
  const ReactNative = require('react-native') as typeof import('react-native');

  return {
    Camera: React.forwardRef(
      (
        props: MockCameraProps,
        ref: import('react').ForwardedRef<CameraHandle>
      ) => {
        const [instanceId] = React.useState(() => ++mockCameraInstanceSequence);
        React.useLayoutEffect(() => {
          mockCameraMounts += 1;
        }, []);
        React.useImperativeHandle(
          ref,
          () => ({
            capture: mockCapture,
            startVideo: (callbacks) => {
              mockVideoCallbacks = callbacks;
              return mockStartVideo(callbacks);
            },
            stopVideo: mockStopVideo,
            cancelVideo: mockCancelVideo,
            getRecordedDuration: mockGetRecordedDuration,
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

jest.mock('../../camera/image/processPhoto', () => {
  const actual = jest.requireActual('../../camera/image/processPhoto');
  return {
    ...actual,
    processPhoto: jest.fn(),
  };
});

const processPhotoMock = jest.mocked(processPhoto);

type Harness = ReturnType<typeof renderDark> & {
  registry: FileRegistry;
  unlink: jest.Mock<Promise<void>, [string]>;
  onSettle: jest.Mock<void, [CameraResult]>;
  getBridge: () => SessionControllerBridge;
};

function latestCamera(): MockCameraSnapshot {
  const snapshot = mockCameraSnapshots.at(-1);
  if (snapshot == null) throw new Error('Camera boundary was not rendered');
  return snapshot;
}

function configureLatest(): void {
  const callback = latestCamera().props.onConfigured;
  if (callback == null) throw new Error('Camera did not receive onConfigured');
  act(() => callback());
}

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
  await act(async () => {
    for (let index = 0; index < rounds; index += 1) {
      await Promise.resolve();
    }
  });
}

function renderContainer(config: OpenConfig): Harness {
  const unlink = jest
    .fn<Promise<void>, [string]>()
    .mockResolvedValue(undefined);
  const registry = createFileRegistry(unlink);
  const onSettle = jest.fn<void, [CameraResult]>();
  let bridge: SessionControllerBridge | null = null;
  const registerController: RegisterSessionController = (
    _sessionId,
    controller
  ) => {
    bridge = controller;
    return () => {
      if (bridge === controller) bridge = null;
    };
  };
  const rendered = renderDark(
    <CameraDialogProvider>
      <Container
        sessionId={51}
        fileRegistry={registry}
        registerContainer={() => () => {}}
        registerController={registerController}
        config={config}
        onSettle={onSettle}
      />
    </CameraDialogProvider>
  );
  layoutCameraViewport(rendered);
  return {
    ...rendered,
    registry,
    unlink,
    onSettle,
    getBridge: () => {
      if (bridge == null) throw new Error('controller bridge not registered');
      return bridge;
    },
  };
}

function photoModes(
  second: CameraMode = { mode: 'continuous', quality: 0.9 }
): OpenConfig {
  return {
    cameraMode: [
      { mode: 'single', quality: 0.9, type: 'back' },
      second,
      { mode: 'video' },
    ],
    dataRetainedMode: 'retain',
  };
}

async function captureWithoutProcessing(
  harness: Harness,
  file: CustomPhotoFile
): Promise<void> {
  mockCapture.mockResolvedValueOnce({
    ...file,
    width: 1080,
    height: 1920,
  });
  await act(async () => {
    fireEvent.press(harness.getByTestId('shutter-btn'));
    await Promise.resolve();
  });
  await flushMicrotasks();
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    get: () => 'active',
  });
  mockCameraSnapshots.length = 0;
  mockCameraMounts = 0;
  mockCameraInstanceSequence = 0;
  mockVideoCallbacks = null;
  mockActualPosition = null;
  mockBackDevice = makeDeviceStub({
    position: 'back',
  }) as unknown as CameraDevice;
  mockFrontDevice = makeDeviceStub({
    position: 'front',
  }) as unknown as CameraDevice;
  mockCapture.mockResolvedValue(null);
  mockStartVideo.mockResolvedValue('started');
  mockStopVideo.mockResolvedValue(undefined);
  mockCancelVideo.mockResolvedValue(undefined);
  mockGetRecordedDuration.mockReturnValue(0);
  processPhotoMock.mockImplementation(async (raw, operation, registry) => {
    const final = {
      ...raw,
      id: `${raw.id}-processed`,
      path: `${raw.path}.processed.jpg`,
      uri: `${raw.uri}.processed.jpg`,
      cameraType: operation.cameraPosition,
    };
    registry.register(final.path);
    return final;
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

afterAll(() => {
  if (originalAppStateDescriptor != null) {
    Object.defineProperty(AppState, 'currentState', originalAppStateDescriptor);
  }
});

it('keeps native-dependent controls truly disabled until the current configuration callback', () => {
  const harness = renderContainer(photoModes());
  const initial = latestCamera();

  expect(initial.props.enableFocus).toBe(false);
  expect(initial.props.enableZoom).toBe(false);

  act(() => {
    fireEvent.press(harness.getByTestId('shutter-btn'));
    fireEvent.press(harness.getByTestId('flip-btn'));
    fireEvent.press(harness.getByTestId('mode-pill-1'));
    fireEvent.press(harness.getByTestId('aspect-btn'));
    fireEvent.press(harness.getByTestId('flash-btn'));
    fireEvent.press(harness.getByTestId('sound-btn'));
    fireEvent.press(harness.getByTestId('zoom-chip-1'));
  });

  expect(mockCapture).not.toHaveBeenCalled();
  expect(latestCamera().props).toMatchObject({
    currentMode: { mode: 'single' },
    aspectRatio: '16:9',
    flash: 'off',
    sound: false,
    enableFocus: false,
    enableZoom: false,
  });

  configureLatest();

  expect(latestCamera().props.enableFocus).toBe(true);
  expect(latestCamera().props.enableZoom).toBe(true);
});

it('remounts the aspect-specific photo output, keeps same-key photo mode mounted, then remounts video', () => {
  const harness = renderContainer(photoModes());
  const initialConfigured = latestCamera().props.onConfigured;
  if (initialConfigured == null) throw new Error('missing initial callback');
  const initialInstance = latestCamera().instanceId;
  configureLatest();

  fireEvent.press(harness.getByTestId('aspect-btn'));
  const aspectConfigured = latestCamera().props.onConfigured;
  if (aspectConfigured == null) throw new Error('missing aspect callback');
  expect(latestCamera().props.enableFocus).toBe(false);
  expect(latestCamera().props.aspectRatio).toBe('4:3');
  expect(latestCamera().instanceId).not.toBe(initialInstance);

  act(() => initialConfigured());
  expect(latestCamera().props.enableFocus).toBe(false);
  act(() => aspectConfigured());
  expect(latestCamera().props.enableFocus).toBe(true);
  const aspectInstance = latestCamera().instanceId;

  fireEvent.press(harness.getByTestId('mode-pill-1'));
  expect(latestCamera().props.enableFocus).toBe(true);
  expect(latestCamera().props.currentMode.mode).toBe('continuous');
  expect(latestCamera().instanceId).toBe(aspectInstance);

  fireEvent.press(harness.getByTestId('mode-pill-2'));
  const currentConfigured = latestCamera().props.onConfigured;
  if (currentConfigured == null) throw new Error('missing current callback');
  expect(latestCamera().props.enableFocus).toBe(false);

  act(() => aspectConfigured());
  expect(latestCamera().props.enableFocus).toBe(false);

  act(() => currentConfigured());
  expect(latestCamera().props.enableFocus).toBe(true);
  expect(latestCamera().instanceId).not.toBe(aspectInstance);
  expect(mockCameraMounts).toBe(3);
});

it('enters configuring only for real photo quality and device changes', () => {
  const harness = renderContainer(
    photoModes({ mode: 'continuous', quality: 0.8 })
  );
  configureLatest();

  fireEvent.press(harness.getByTestId('mode-pill-1'));
  expect(latestCamera().props.enableFocus).toBe(false);
  configureLatest();

  fireEvent.press(harness.getByTestId('flip-btn'));
  expect(latestCamera().props.device.position).toBe('front');
  expect(latestCamera().props.enableFocus).toBe(false);
  configureLatest();
  expect(latestCamera().props.enableFocus).toBe(true);
});

it('routes the real shutter through the photo transaction with a synchronous token gate and actual device metadata', async () => {
  mockActualPosition = 'front';
  const pending = deferred<CustomPhotoFile | null>();
  const raw = makePhotoFile({
    id: 'raw-photo',
    path: '/raw-photo.jpg',
    uri: 'file:///raw-photo.jpg',
    width: 1080,
    height: 1920,
    cameraType: 'back',
    mode: 'continuous',
  });
  mockCapture.mockReturnValue(pending.promise);
  const harness = renderContainer({
    cameraMode: [{ mode: 'continuous', type: 'back' }],
    dataRetainedMode: 'retain',
  });
  configureLatest();

  act(() => {
    fireEvent.press(harness.getByTestId('shutter-btn'));
    fireEvent.press(harness.getByTestId('shutter-btn'));
  });
  expect(mockCapture).toHaveBeenCalledTimes(1);

  await act(async () => {
    pending.resolve(raw);
    await pending.promise;
  });
  await flushMicrotasks();

  expect(harness.registry.stateOf(raw.path)).toBe('owned');
  fireEvent.press(harness.getByTestId('side-save-btn'));
  expect(harness.onSettle).toHaveBeenCalledWith({
    code: 200,
    data: [
      expect.objectContaining({
        path: raw.path,
        cameraType: 'front',
        cameraMode: 'continuous',
        mode: 'continuous',
      }),
    ],
    message: 'ok',
  });
});

it('registers and removes raw/final files when photo processing fails or becomes stale', async () => {
  const raw = makePhotoFile({
    id: 'raw-processing',
    path: '/raw-processing.jpg',
    uri: 'file:///raw-processing.jpg',
  });
  mockCapture.mockResolvedValue(raw);
  processPhotoMock.mockRejectedValueOnce(new Error('encode failed'));
  const failed = renderContainer({
    cameraMode: [{ mode: 'single' }],
    dataRetainedMode: 'retain',
  });
  configureLatest();

  await act(async () => {
    fireEvent.press(failed.getByTestId('shutter-btn'));
    await Promise.resolve();
  });
  await waitFor(() =>
    expect(failed.registry.stateOf(raw.path)).toBe('deleted')
  );
  expect(failed.getByText('相机异常:照片处理失败,请重试')).toBeTruthy();
  failed.unmount();

  const processing = deferred<CustomPhotoFile>();
  const final = makePhotoFile({
    id: 'late-final',
    path: '/late-final.jpg',
    uri: 'file:///late-final.jpg',
  });
  processPhotoMock.mockReturnValueOnce(processing.promise);
  const stale = renderContainer({
    cameraMode: [{ mode: 'single' }],
    dataRetainedMode: 'retain',
  });
  configureLatest();
  await act(async () => {
    fireEvent.press(stale.getByTestId('shutter-btn'));
    await Promise.resolve();
  });
  expect(stale.registry.stateOf(raw.path)).toBe('owned');

  act(() => stale.getBridge().forceTeardown());
  await act(async () => {
    processing.resolve(final);
    await processing.promise;
  });
  await waitFor(() => {
    expect(stale.registry.stateOf(raw.path)).toBe('deleted');
    expect(stale.registry.stateOf(final.path)).toBe('deleted');
  });
  expect(stale.onSettle).not.toHaveBeenCalled();
});

it('keeps the configured Camera mounted and ready across confirm-preview retake', async () => {
  const harness = renderContainer({
    cameraMode: [{ mode: 'single' }],
    dataRetainedMode: 'clear',
  });
  const instanceId = latestCamera().instanceId;
  configureLatest();
  await captureWithoutProcessing(
    harness,
    makePhotoFile({
      id: 'preview-retake',
      path: '/preview-retake.jpg',
      uri: 'file:///preview-retake.jpg',
    })
  );

  expect(harness.getByTestId('preview-overlay')).toBeTruthy();
  expect(harness.getByTestId('mock-native-camera')).toBeTruthy();
  expect(latestCamera().props.isActive).toBe(false);
  fireEvent.press(harness.getByTestId('retake-btn'));

  expect(harness.queryByTestId('preview-overlay')).toBeNull();
  expect(harness.getByTestId('mock-native-camera')).toBeTruthy();
  expect(latestCamera().instanceId).toBe(instanceId);
  expect(latestCamera().props.isActive).toBe(true);
  expect(
    harness.getByTestId('shutter-btn').props.accessibilityState.disabled
  ).toBe(false);
});

it('keeps the configured Camera mounted and ready across gallery back', async () => {
  const harness = renderContainer({
    cameraMode: [{ mode: 'continuous' }],
    dataRetainedMode: 'retain',
  });
  const instanceId = latestCamera().instanceId;
  configureLatest();
  await captureWithoutProcessing(
    harness,
    makePhotoFile({
      id: 'preview-back',
      path: '/preview-back.jpg',
      uri: 'file:///preview-back.jpg',
      mode: 'continuous',
    })
  );
  fireEvent.press(harness.getByTestId('thumbnail-stack'));

  expect(harness.getByTestId('preview-overlay')).toBeTruthy();
  expect(harness.getByTestId('mock-native-camera')).toBeTruthy();
  expect(latestCamera().props.isActive).toBe(false);
  fireEvent.press(harness.getByTestId('back-btn'));

  expect(harness.queryByTestId('preview-overlay')).toBeNull();
  expect(latestCamera().instanceId).toBe(instanceId);
  expect(latestCamera().props.isActive).toBe(true);
  expect(
    harness.getByTestId('shutter-btn').props.accessibilityState.disabled
  ).toBe(false);
});

it('keeps the configured Camera mounted and ready after deleting the last preview file', async () => {
  const harness = renderContainer({
    cameraMode: [{ mode: 'continuous' }],
    dataRetainedMode: 'retain',
  });
  const instanceId = latestCamera().instanceId;
  configureLatest();
  await captureWithoutProcessing(
    harness,
    makePhotoFile({
      id: 'preview-delete',
      path: '/preview-delete.jpg',
      uri: 'file:///preview-delete.jpg',
      mode: 'continuous',
    })
  );
  fireEvent.press(harness.getByTestId('thumbnail-stack'));
  fireEvent.press(harness.getByTestId('delete-btn'));
  await act(async () => {
    fireEvent.press(harness.getByTestId('camera-confirm-ok'));
    await Promise.resolve();
  });

  await waitFor(() =>
    expect(harness.queryByTestId('preview-overlay')).toBeNull()
  );
  expect(harness.getByTestId('mock-native-camera')).toBeTruthy();
  expect(latestCamera().instanceId).toBe(instanceId);
  expect(latestCamera().props.isActive).toBe(true);
  expect(
    harness.getByTestId('shutter-btn').props.accessibilityState.disabled
  ).toBe(false);
});

it.each(['stopped', 'max-duration-reached', 'max-file-size-reached'] as const)(
  'routes %s video completion through one native callback and settles one file',
  async (reason) => {
    const harness = renderContainer({
      cameraMode: [{ mode: 'video' }],
      dataRetainedMode: 'retain',
    });
    configureLatest();

    await act(async () => {
      fireEvent.press(harness.getByTestId('shutter-btn'));
      await Promise.resolve();
    });
    if (mockVideoCallbacks == null) {
      throw new Error('video callbacks were not installed');
    }
    expect(harness.getByTestId('recording-timer')).toBeTruthy();

    if (reason === 'stopped') {
      mockGetRecordedDuration.mockReturnValue(4.7);
      fireEvent.press(harness.getByTestId('shutter-btn'));
      fireEvent.press(harness.getByTestId('shutter-btn'));
      expect(mockStopVideo).toHaveBeenCalledTimes(1);
      expect(harness.getByTestId('recording-timer')).toBeTruthy();
    }

    const video = makePhotoFile({
      id: `video-${reason}`,
      path: `/video-${reason}.mp4`,
      uri: `file:///video-${reason}.mp4`,
      mode: 'video',
      duration: 7,
    });
    act(() => {
      mockVideoCallbacks?.onFinished(video, reason, 7);
      mockVideoCallbacks?.onFinished(video, reason, 7);
    });

    expect(harness.registry.stateOf(video.path)).toBe('owned');
    expect(harness.queryByTestId('recording-timer')).toBeNull();
    fireEvent.press(harness.getByTestId('side-save-btn'));
    expect(harness.onSettle).toHaveBeenCalledWith({
      code: 200,
      data: [expect.objectContaining({ path: video.path, mode: 'video' })],
      message: 'ok',
    });
  }
);

it('accepts callback-before-start once and cleans a late callback after force teardown', async () => {
  const starting = deferred<'started' | 'denied'>();
  mockStartVideo.mockReturnValueOnce(starting.promise);
  const early = renderContainer({
    cameraMode: [{ mode: 'video' }],
    dataRetainedMode: 'retain',
  });
  configureLatest();
  fireEvent.press(early.getByTestId('shutter-btn'));
  if (mockVideoCallbacks == null) {
    throw new Error('video callbacks were not installed');
  }
  const earlyFile = makePhotoFile({
    id: 'early-video',
    path: '/early-video.mp4',
    uri: 'file:///early-video.mp4',
    mode: 'video',
  });
  act(() =>
    mockVideoCallbacks?.onFinished(earlyFile, 'max-duration-reached', 3)
  );
  await act(async () => {
    starting.resolve('started');
    await starting.promise;
  });
  fireEvent.press(early.getByTestId('side-save-btn'));
  expect(early.onSettle).toHaveBeenCalledWith({
    code: 200,
    data: [expect.objectContaining({ path: earlyFile.path })],
    message: 'ok',
  });
  early.unmount();

  const late = renderContainer({
    cameraMode: [{ mode: 'video' }],
    dataRetainedMode: 'retain',
  });
  configureLatest();
  await act(async () => {
    fireEvent.press(late.getByTestId('shutter-btn'));
    await Promise.resolve();
  });
  const callbacks = mockVideoCallbacks;
  if (callbacks == null) throw new Error('late callbacks missing');
  await act(async () => {
    late.getBridge().forceTeardown();
    await Promise.resolve();
  });
  const lateFile = makePhotoFile({
    id: 'late-video',
    path: '/late-video.mp4',
    uri: 'file:///late-video.mp4',
    mode: 'video',
  });
  act(() => callbacks.onFinished(lateFile, 'max-file-size-reached', 9));
  await waitFor(() =>
    expect(late.registry.stateOf(lateFile.path)).toBe('deleted')
  );
  expect(late.onSettle).not.toHaveBeenCalled();
});

it('routes the registered recording cancel bridge through confirmation and native cancellation', async () => {
  const harness = renderContainer({
    cameraMode: [{ mode: 'video' }],
    dataRetainedMode: 'retain',
  });
  configureLatest();
  await act(async () => {
    fireEvent.press(harness.getByTestId('shutter-btn'));
    await Promise.resolve();
  });

  act(() => harness.getBridge().requestUserCancel());
  expect(harness.getByText('放弃录制')).toBeTruthy();
  await act(async () => {
    fireEvent.press(harness.getByTestId('camera-confirm-ok'));
    await Promise.resolve();
  });

  expect(mockCancelVideo).toHaveBeenCalledTimes(1);
  expect(harness.onSettle).toHaveBeenCalledWith({
    code: 0,
    data: [],
    message: 'cancelled',
  });
});
