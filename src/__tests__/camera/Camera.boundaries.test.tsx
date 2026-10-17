import { createRef } from 'react';
import { act } from '@testing-library/react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {
  Camera,
  type CameraHandle,
  type VideoCallbacks,
} from '../../camera/Camera';
import NativePhotoProcessor from '../../NativePhotoProcessor';
import { makeDeviceStub } from '../__helpers__/visionCameraMock';
import { makeAnimatedFrameStub } from '../__helpers__/cameraFrame';
import { renderDark } from '../__helpers__/renderDark';

const mockFocus = jest.fn();
const mockResetFocus = jest.fn();
const mockCapture = jest.fn();
const mockStop = jest.fn();
const mockCancel = jest.fn();
const mockDispose = jest.fn();
let mockFinish: (path: string, reason: 'stopped') => void;
let mockNativeProps: Record<string, any>;
let mockTap: Record<string, any>;
let mockPinch: Record<string, any>;

jest.mock('react-native-vision-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  const vc = require('../__helpers__/visionCameraMock');
  return vc.makeVisionCameraMock({
    ...vc.grantedPermissionOverrides(),
    usePhotoOutput: () =>
      React.useMemo(() => ({ capturePhotoToFile: mockCapture }), []),
    useVideoOutput: () =>
      React.useMemo(
        () => ({
          createRecorder: async () => ({
            filePath: '/video.mp4',
            recordedDuration: 2,
            startRecording: async (finish: typeof mockFinish) => {
              mockFinish = finish;
            },
            stopRecording: mockStop,
            cancelRecording: mockCancel,
            dispose: mockDispose,
          }),
        }),
        []
      ),
    Camera: React.forwardRef((props: Record<string, any>, ref: unknown) => {
      mockNativeProps = props;
      React.useImperativeHandle(ref, () => ({
        focusTo: mockFocus,
        resetFocus: mockResetFocus,
      }));
      const { onConfigured } = props;
      React.useEffect(() => {
        onConfigured?.();
      }, [onConfigured]);
      return <View testID="native-camera-boundary" />;
    }),
  });
});

jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler');
  return {
    ...actual,
    Pressable: require('react-native').Pressable,
    GestureDetector: ({ children }: { children: unknown }) => children,
    useTapGesture: (config: Record<string, unknown>) => {
      mockTap = config;
      return actual.useTapGesture(config);
    },
    usePinchGesture: (config: Record<string, unknown>) => {
      mockPinch = config;
      return actual.usePinchGesture(config);
    },
  };
});

const frame = { x: 0, y: 0, width: 300, height: 400 };
function mount(overrides: Record<string, unknown> = {}) {
  const ref = createRef<CameraHandle>();
  const view = renderDark(
    <Camera
      ref={ref}
      device={makeDeviceStub() as never}
      currentMode={{ mode: 'single' }}
      frame={frame}
      animatedFrame={makeAnimatedFrameStub(frame)}
      {...overrides}
    />
  );
  return { ...view, ref };
}
function callbacks(): VideoCallbacks & {
  onFinished: jest.Mock;
  onError: jest.Mock;
} {
  return { onFinished: jest.fn(), onError: jest.fn() };
}
beforeEach(() => {
  jest.clearAllMocks();
  mockFocus.mockResolvedValue(undefined);
  mockCapture.mockResolvedValue({ filePath: '/photo.jpg' });
  mockStop.mockResolvedValue(undefined);
  mockCancel.mockResolvedValue(undefined);
  jest
    .mocked(NativePhotoProcessor.inspectPhotoFile)
    .mockResolvedValue(
      JSON.stringify({ width: 300, height: 400, orientation: 'up' })
    );
  jest
    .mocked(NativePhotoProcessor.inspectVideoFile)
    .mockResolvedValue(JSON.stringify({ width: 1920, height: 1080 }));
});
afterEach(() => jest.restoreAllMocks());

it('pinch clamps zoom and forwards the settled value only when a callback exists', async () => {
  const zoom = { value: 2 };
  const onZoomEnd = jest.fn();
  const view = mount({ zoomShared: zoom, softMaxZoom: 4, onZoomEnd });
  await act(async () => {
    mockPinch.onBegin();
    mockPinch.onUpdate({ scale: 3 });
    mockPinch.onDeactivate();
  });
  expect(zoom.value).toBe(4);
  expect(onZoomEnd).toHaveBeenCalledWith(4);
  view.unmount();
  mount();
  await act(async () => {
    mockPinch.onBegin();
    mockPinch.onUpdate({ scale: 0.1 });
    mockPinch.onDeactivate();
  });
  expect(onZoomEnd).toHaveBeenCalledTimes(1);
});

it.each([
  { enableFocus: false },
  { device: makeDeviceStub({ supportsFocusMetering: false }) },
])('disabled focus ignores a queued tap', async (props) => {
  mount(props);
  await act(async () => {
    mockTap.onDeactivate({ x: 10, y: 20 });
  });
  expect(mockFocus).not.toHaveBeenCalled();
});

it('focus failure is diagnosed and subject changes reset native focus', async () => {
  const failure = new Error('focus unavailable');
  mockFocus.mockRejectedValueOnce(failure);
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  mount();
  await act(async () => {
    mockTap.onDeactivate({ x: 10, y: 20 });
  });
  expect(mockFocus).toHaveBeenCalledWith(
    { x: 10, y: 20 },
    { responsiveness: 'snappy', adaptiveness: 'continuous', autoResetAfter: 3 }
  );
  expect(warn).toHaveBeenCalledWith('focusTo failed', failure);
  act(() => mockNativeProps.onSubjectAreaChanged());
  expect(mockResetFocus).toHaveBeenCalledTimes(1);
});

it.each([
  { width: 0, height: 400 },
  { width: 300, height: 0 },
])('invalid viewport skips the native camera', (size) => {
  const view = mount({ frame: { ...frame, ...size } });
  expect(view.queryByTestId('native-camera-boundary')).toBeNull();
});

it('capture failure is local and default flash remains auto', async () => {
  const failure = new Error('capture failed');
  mockCapture.mockRejectedValueOnce(failure);
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const view = mount();
  await act(async () => {
    await expect(view.ref.current!.capture()).resolves.toBeNull();
  });
  expect(mockCapture).toHaveBeenCalledWith(
    { flashMode: 'auto', enableShutterSound: true },
    {}
  );
  expect(warn).toHaveBeenCalledWith('capturePhoto failed', failure);
});

it('video completion uses actual metadata and falls back to recorder duration when absent', async () => {
  const view = mount({ currentMode: { mode: 'video' } });
  const events = callbacks();
  await act(async () => {
    await expect(view.ref.current!.startVideo(events)).resolves.toBe('started');
  });
  await act(async () => {
    mockFinish('/video.mp4', 'stopped');
  });
  expect(events.onFinished).toHaveBeenCalledWith(
    expect.objectContaining({
      uri: 'file:///video.mp4',
      width: 1920,
      height: 1080,
      mode: 'video',
    }),
    'stopped',
    2
  );
  expect(events.onError).not.toHaveBeenCalled();
});

it.each([true, false])(
  'metadata rejection reports failure and routes discard callback=%s',
  async (withDiscard) => {
    const view = mount({ currentMode: { mode: 'video' } });
    const events = callbacks();
    const discarded = jest.fn();
    if (withDiscard) events.onDiscardedFile = discarded;
    jest
      .mocked(NativePhotoProcessor.inspectVideoFile)
      .mockRejectedValueOnce(
        withDiscard ? new Error('metadata unavailable') : 'native unavailable'
      );
    if (!withDiscard)
      jest
        .mocked(RNFS.unlink)
        .mockRejectedValueOnce(new Error('cleanup failed'));
    await act(async () => {
      await view.ref.current!.startVideo(events);
      mockFinish('/video.mp4', 'stopped');
    });
    expect(events.onFinished).not.toHaveBeenCalled();
    expect(events.onError).toHaveBeenCalledWith(expect.any(Error));
    if (withDiscard) expect(discarded).toHaveBeenCalledWith('/video.mp4');
    else expect(RNFS.unlink).toHaveBeenCalledWith('/video.mp4');
  }
);

it.each(['resolve', 'reject', 'throw'] as const)(
  'cancelled late video cleanup handles RNFS %s',
  async (outcome) => {
    const view = mount({ currentMode: { mode: 'video' } });
    const events = callbacks();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await act(async () => {
      await view.ref.current!.startVideo(events);
      await view.ref.current!.cancelVideo();
    });
    if (outcome === 'reject')
      jest
        .mocked(RNFS.unlink)
        .mockRejectedValueOnce(new Error('cleanup failed'));
    if (outcome === 'throw')
      jest.mocked(RNFS.unlink).mockImplementationOnce(() => {
        throw new Error('cleanup failed');
      });
    await act(async () => {
      mockFinish('/late.mp4', 'stopped');
    });
    expect(RNFS.unlink).toHaveBeenCalledWith('/late.mp4');
    expect(events.onFinished).not.toHaveBeenCalled();
    expect(events.onError).not.toHaveBeenCalled();
    if (outcome !== 'resolve')
      expect(warn).toHaveBeenCalledWith(
        'discarded video cleanup failed',
        expect.any(Error)
      );
  }
);

it('front camera disables capture flash and discarded native output is handed to its owner', async () => {
  const photoView = mount({ device: makeDeviceStub({ position: 'front' }) });
  await act(async () => {
    await photoView.ref.current!.capture();
  });
  photoView.unmount();
  const view = mount({ currentMode: { mode: 'video' } });
  expect(mockCapture).toHaveBeenCalledWith(
    { flashMode: 'off', enableShutterSound: true },
    {}
  );
  const events = { ...callbacks(), onDiscardedFile: jest.fn() };
  await act(async () => {
    await view.ref.current!.startVideo(events);
    await view.ref.current!.cancelVideo();
    mockFinish('/owned-late.mp4', 'stopped');
  });
  expect(events.onDiscardedFile).toHaveBeenCalledWith('/owned-late.mp4');
  expect(RNFS.unlink).not.toHaveBeenCalledWith('/owned-late.mp4');
});
