import * as RNFS from '@dr.pogodin/react-native-fs';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { CameraHandle, VideoCallbacks } from '../../camera/Camera';
import { processPhoto } from '../../camera/image/processPhoto';
import { useCamera } from '../../hooks';
import type {
  CameraApi,
  CameraResult,
  CustomPhotoFile,
  OpenConfig,
} from '../../utils';
import { makePhotoFile } from '../__helpers__/factories';
import { layoutCameraViewport } from '../__helpers__/containerSession';

type MockCameraProps = {
  onConfigured?: () => void;
};

const mockCameraProps: MockCameraProps[] = [];
const mockCapture = jest.fn<Promise<CustomPhotoFile | null>, []>();
const mockStartVideo = jest.fn<
  Promise<'started' | 'denied'>,
  [VideoCallbacks]
>();
const mockStopVideo = jest.fn<Promise<void>, []>();
const mockCancelVideo = jest.fn<Promise<void>, []>();
const mockGetRecordedDuration = jest.fn<number, []>();
const mockVideoCallbacks: VideoCallbacks[] = [];

jest.mock('react-native-vision-camera', () => {
  const vc = require('../__helpers__/visionCameraMock');
  return vc.makeVisionCameraMock({
    ...vc.grantedPermissionOverrides(),
    useCameraDevice: (position: 'back' | 'front') =>
      vc.makeDeviceStub({ position }),
  });
});

jest.mock('../../camera/Camera', () => {
  const ReactModule = require('react') as typeof import('react');
  const ReactNative = require('react-native') as typeof import('react-native');

  return {
    Camera: ReactModule.forwardRef(
      (
        props: MockCameraProps,
        ref: import('react').ForwardedRef<CameraHandle>
      ) => {
        ReactModule.useImperativeHandle(
          ref,
          () => ({
            capture: mockCapture,
            startVideo: (callbacks) => {
              mockVideoCallbacks.push(callbacks);
              return mockStartVideo(callbacks);
            },
            stopVideo: mockStopVideo,
            cancelVideo: mockCancelVideo,
            getRecordedDuration: mockGetRecordedDuration,
          }),
          []
        );
        mockCameraProps.push(props);
        return <ReactNative.View testID="mock-native-camera" />;
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
const unlinkMock = jest.mocked(RNFS.unlink);
let currentApi: CameraApi | null = null;

function Harness() {
  const [api, holder] = useCamera();
  currentApi = api;
  return holder;
}

function getApi(): CameraApi {
  if (currentApi == null) throw new Error('camera API is not mounted');
  return currentApi;
}

function open(openConfig: OpenConfig): Promise<CameraResult> {
  let promise: Promise<CameraResult> | undefined;
  act(() => {
    promise = getApi().open(openConfig);
  });
  if (promise == null) throw new Error('open did not return a promise');
  return promise;
}

function latestCameraProps(): MockCameraProps {
  const props = mockCameraProps.at(-1);
  if (props == null) throw new Error('Camera boundary was not rendered');
  return props;
}

async function configureLatest(
  harness: ReturnType<typeof render>
): Promise<void> {
  layoutCameraViewport(harness);
  await waitFor(() =>
    expect(latestCameraProps().onConfigured).toEqual(expect.any(Function))
  );
  act(() => latestCameraProps().onConfigured?.());
}

async function flushMicrotasks(rounds = 8): Promise<void> {
  await act(async () => {
    for (let index = 0; index < rounds; index += 1) {
      await Promise.resolve();
    }
  });
}

function makeConfig(mode: 'single' | 'video'): OpenConfig {
  return {
    cameraMode: [{ mode }],
    dataRetainedMode: mode === 'single' ? 'clear' : 'retain',
  };
}

beforeEach(() => {
  currentApi = null;
  mockCameraProps.length = 0;
  mockVideoCallbacks.length = 0;
  jest.clearAllMocks();
  mockCapture.mockResolvedValue(null);
  mockStartVideo.mockResolvedValue('started');
  mockStopVideo.mockResolvedValue(undefined);
  mockCancelVideo.mockResolvedValue(undefined);
  mockGetRecordedDuration.mockReturnValue(0);
  unlinkMock.mockResolvedValue(undefined);
});

it('saves through the real Container and transfers only the returned final file before draining session-owned leftovers', async () => {
  const raw = makePhotoFile({
    id: 'composition-raw',
    path: '/composition-raw.jpg',
    uri: 'file:///composition-raw.jpg',
  });
  const intermediate = '/composition-intermediate.jpg';
  const final = makePhotoFile({
    id: 'composition-final',
    path: '/composition-final.jpg',
    uri: 'file:///composition-final.jpg',
  });
  mockCapture.mockResolvedValue(raw);
  processPhotoMock.mockImplementationOnce(
    async (_raw, _operation, registry) => {
      registry.register(intermediate);
      registry.register(final.path);
      return final;
    }
  );
  const harness = render(<Harness />);
  const resultPromise = open(makeConfig('single'));
  await configureLatest(harness);

  await act(async () => {
    fireEvent.press(harness.getByTestId('shutter-btn'));
    await Promise.resolve();
  });
  await waitFor(() =>
    expect(harness.getByTestId('preview-overlay')).toBeTruthy()
  );
  fireEvent.press(harness.getByTestId('save-btn'));
  await expect(resultPromise).resolves.toEqual({
    code: 200,
    data: [expect.objectContaining({ path: final.path })],
    message: 'ok',
  });

  expect(unlinkMock).toHaveBeenCalledWith(raw.path);
  expect(unlinkMock).toHaveBeenCalledWith(intermediate);
  expect(unlinkMock).not.toHaveBeenCalledWith(final.path);
});

it('routes the real Modal hardware back through the registered recording controller', async () => {
  const harness = render(<Harness />);
  const resultPromise = open(makeConfig('video'));
  await configureLatest(harness);
  await act(async () => {
    fireEvent.press(harness.getByTestId('shutter-btn'));
    await Promise.resolve();
  });

  act(() => harness.getByTestId('camera-modal').props.onRequestClose());
  expect(harness.getByText('放弃录制')).toBeTruthy();
  await act(async () => {
    fireEvent.press(harness.getByTestId('camera-confirm-ok'));
    await Promise.resolve();
  });

  expect(mockCancelVideo).toHaveBeenCalledTimes(1);
  await expect(resultPromise).resolves.toEqual({
    code: 0,
    data: [],
    message: 'cancelled',
  });
});

it('supersedes through the real bridge and rejects stale UI/native continuations without touching the replacement session', async () => {
  const harness = render(<Harness />);
  const firstPromise = open(makeConfig('video'));
  await configureLatest(harness);
  await act(async () => {
    fireEvent.press(harness.getByTestId('shutter-btn'));
    await Promise.resolve();
  });
  const firstCallbacks = mockVideoCallbacks[0];
  if (firstCallbacks == null) throw new Error('first callbacks missing');
  const staleModalClose =
    harness.getByTestId('camera-modal').props.onRequestClose;

  const secondPromise = open(makeConfig('single'));
  await expect(firstPromise).resolves.toEqual({
    code: 0,
    data: [],
    message: 'cancelled',
  });
  expect(mockCancelVideo).toHaveBeenCalledTimes(1);
  await configureLatest(harness);

  let secondSettled = false;
  secondPromise.then(() => {
    secondSettled = true;
  });
  act(() => {
    staleModalClose();
    firstCallbacks.onFinished(
      makePhotoFile({
        id: 'stale-video',
        path: '/stale-video.mp4',
        uri: 'file:///stale-video.mp4',
        mode: 'video',
      }),
      'max-file-size-reached',
      3
    );
  });
  await flushMicrotasks();
  expect(unlinkMock).toHaveBeenCalledWith('/stale-video.mp4');
  expect(secondSettled).toBe(false);
  expect(harness.getByTestId('mock-native-camera')).toBeTruthy();

  act(() => getApi().close());
  await expect(secondPromise).resolves.toEqual({
    code: 0,
    data: [],
    message: 'cancelled',
  });
});

it('real hook unmount force-tears down the mounted Container recording exactly once', async () => {
  const harness = render(<Harness />);
  const resultPromise = open(makeConfig('video'));
  await configureLatest(harness);
  await act(async () => {
    fireEvent.press(harness.getByTestId('shutter-btn'));
    await Promise.resolve();
  });

  harness.unmount();
  await flushMicrotasks();

  expect(mockCancelVideo).toHaveBeenCalledTimes(1);
  await expect(resultPromise).resolves.toEqual({
    code: 0,
    data: [],
    message: 'cancelled',
  });
});
