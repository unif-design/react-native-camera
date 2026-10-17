import { act, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { Container } from '../../camera/Container';
import { CameraDialogProvider } from '../../camera/ui/CameraDialogHost';
import { ActionRow } from '../../camera/footer/ActionRow';
import { ModeSwitcherPill } from '../../camera/footer/ModeSwitcherPill';
import { SideRail } from '../../camera/setup/SideRail';
import { ZoomChips } from '../../camera/footer/ZoomChips';
import NativePhotoProcessor from '../../NativePhotoProcessor';
import { createFileRegistry } from '../../camera/session/fileRegistry';
import {
  createContainerSessionProps,
  layoutCameraViewport,
} from '../__helpers__/containerSession';
import { renderDark } from '../__helpers__/renderDark';
import { makeDeviceStub } from '../__helpers__/visionCameraMock';
import type { CameraInput } from '../../utils';

let mockBack: ReturnType<typeof makeDeviceStub> | undefined;
let mockFront: ReturnType<typeof makeDeviceStub> | undefined;
let mockPermission = true;
let mockAutoConfigure = true;
let mockNativeProps: Record<string, any>;
const mockCapture = jest.fn();
const mockStop = jest.fn();
const mockCancel = jest.fn();
let mockFinish: (path: string, reason: string) => void;
jest.mock('react-native-vision-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  const vc = require('../__helpers__/visionCameraMock');
  return vc.makeVisionCameraMock({
    ...vc.grantedPermissionOverrides(),
    useCameraDevice: (position: string) =>
      position === 'back' ? mockBack : mockFront,
    useCameraPermission: () => ({
      hasPermission: mockPermission,
      requestPermission: async () => mockPermission,
    }),
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
            dispose: jest.fn(),
          }),
        }),
        []
      ),
    Camera: React.forwardRef((props: Record<string, any>, ref: unknown) => {
      mockNativeProps = props;
      React.useImperativeHandle(ref, () => ({
        focusTo: jest.fn(),
        resetFocus: jest.fn(),
      }));
      const { onConfigured } = props;
      React.useEffect(() => {
        if (mockAutoConfigure) onConfigured?.();
      }, [onConfigured]);
      return <View testID="native-camera-boundary" />;
    }),
  });
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const config: CameraInput = {
  modes: [{ mode: 'continuous' }, { mode: 'video' }],
  retention: 'clear',
};
function mount(input: CameraInput = config) {
  const unlink = jest.fn().mockResolvedValue(undefined);
  const fileRegistry = createFileRegistry(unlink);
  const onSettle = jest.fn();
  const session = { ...createContainerSessionProps(), fileRegistry };
  const element = () => (
    <CameraDialogProvider>
      <Container {...session} config={input} onSettle={onSettle} />
    </CameraDialogProvider>
  );
  const view = renderDark(element());
  if (view.queryByTestId('camera-viewport')) layoutCameraViewport(view);
  return { ...view, unlink, onSettle, refresh: () => view.rerender(element()) };
}
beforeEach(() => {
  jest.clearAllMocks();
  mockFinish = undefined as unknown as typeof mockFinish;
  mockPermission = true;
  mockAutoConfigure = true;
  mockBack = makeDeviceStub();
  mockFront = makeDeviceStub({ position: 'front' });
  mockCapture.mockResolvedValue({ filePath: '/raw.jpg' });
  mockStop.mockResolvedValue(undefined);
  mockCancel.mockResolvedValue(undefined);
  jest
    .mocked(NativePhotoProcessor.inspectPhotoFile)
    .mockResolvedValue(
      JSON.stringify({ width: 1080, height: 1920, orientation: 'up' })
    );
});
afterEach(() => jest.restoreAllMocks());

it('side controls change capture flash/sound, flip both ways and accept footer/viewport layout updates', async () => {
  const h = mount();
  const side = () => h.UNSAFE_getByType(SideRail).props;
  act(() => {
    side().onChangeFlash('on');
    side().onToggleSound();
  });
  act(() => h.UNSAFE_getByType(ActionRow).props.onFlip());
  expect(mockNativeProps.device.position).toBe('front');
  act(() => h.UNSAFE_getByType(ActionRow).props.onFlip());
  expect(mockNativeProps.device.position).toBe('back');
  layoutCameraViewport(h);
  layoutCameraViewport(h, { width: 420, height: 844 });
  let footer = h.UNSAFE_getByType(ActionRow).parent;
  while (footer && !footer.props.onLayout) footer = footer.parent;
  act(() =>
    footer!.props.onLayout({ nativeEvent: { layout: { height: 170 } } })
  );
  await act(async () => h.UNSAFE_getByType(ActionRow).props.onShutter());
  expect(mockCapture).toHaveBeenCalledWith(
    { flashMode: 'on', enableShutterSound: true },
    {}
  );
});
it('busy and invalid queued controls cannot mutate the active photo configuration', async () => {
  const capture = deferred<{ filePath: string }>();
  mockCapture.mockReturnValue(capture.promise);
  const h = mount();
  await act(async () => {
    await h.UNSAFE_getByType(ModeSwitcherPill).props.onSelect(0);
    await h.UNSAFE_getByType(ModeSwitcherPill).props.onSelect(99);
    h.UNSAFE_getByType(ActionRow).props.onShutter();
  });
  const before = mockNativeProps.device;
  await act(async () => {
    await h.UNSAFE_getByType(ModeSwitcherPill).props.onSelect(1);
    h.UNSAFE_getByType(SideRail).props.onChangeAspectRatio('4:3');
    h.UNSAFE_getByType(ActionRow).props.onFlip();
    h.UNSAFE_getByType(ZoomChips).props.onSelect(2);
  });
  mockBack = undefined;
  mockFront = undefined;
  h.refresh();
  expect(mockNativeProps.device).toBe(before);
  await act(async () => capture.resolve({ filePath: '/raw.jpg' }));
  expect(h.getByTestId('no-camera')).toBeTruthy();
});
it.each(['cancel', 'accept', 'busy'] as const)(
  'mode switch confirmation preserves media until %s decision',
  async (decision) => {
    const h = mount();
    await act(async () => h.UNSAFE_getByType(ActionRow).props.onShutter());
    let selection!: Promise<void>;
    act(() => {
      selection = h.UNSAFE_getByType(ModeSwitcherPill).props.onSelect(1);
    });
    expect(h.getByText('切换拍摄模式')).toBeTruthy();
    const next = deferred<{ filePath: string }>();
    if (decision === 'busy') {
      mockCapture.mockReturnValueOnce(next.promise);
      act(() => h.UNSAFE_getByType(ActionRow).props.onShutter());
    }
    await act(async () => {
      fireEvent.press(
        h.getByTestId(decision === 'cancel' ? 'confirm-cancel' : 'confirm-ok')
      );
      await selection;
    });
    expect(h.UNSAFE_getByType(ModeSwitcherPill).props.currentIndex).toBe(
      decision === 'accept' ? 1 : 0
    );
    expect(h.unlink).toHaveBeenCalledTimes(decision === 'accept' ? 1 : 0);
    if (decision === 'busy')
      await act(async () => next.resolve({ filePath: '/second.jpg' }));
  }
);
it('disabled video shutter and repeated stop cannot create a second native recorder', async () => {
  mockAutoConfigure = false;
  const h = mount({ modes: [{ mode: 'video' }], retention: 'retain' });
  await act(async () => h.UNSAFE_getByType(ActionRow).props.onShutter());
  expect(mockFinish).toBeUndefined();
  act(() => mockNativeProps.onConfigured());
  await act(async () => h.UNSAFE_getByType(ActionRow).props.onShutter());
  act(() => h.UNSAFE_getByType(ActionRow).props.onShutter());
  act(() => h.UNSAFE_getByType(ActionRow).props.onShutter());
  expect(mockStop).toHaveBeenCalledTimes(1);
});
it('empty session error uses the local fallback without settling', () => {
  const h = mount();
  act(() => mockNativeProps.onError(new Error('')));
  expect(h.getByText('相机异常:相机会话异常,请重试')).toBeTruthy();
  expect(h.onSettle).not.toHaveBeenCalled();
});
it('invalid internal mode collection reports invalid_input on close', () => {
  const h = mount({ modes: [], retention: 'retain' });
  fireEvent.press(h.getByTestId('close-btn'));
  expect(h.onSettle).toHaveBeenCalledWith({
    status: 'failed',
    error: { reason: 'invalid_input', message: 'Invalid camera input' },
  });
});
it('denied permission opens the actual platform settings boundary', async () => {
  mockPermission = false;
  const settings = jest
    .spyOn(Linking, 'openSettings')
    .mockResolvedValue(undefined);
  const h = mount();
  await act(async () => {});
  fireEvent.press(h.getByText('去设置'));
  expect(settings).toHaveBeenCalledTimes(1);
});

it('a removed mode while its confirmation is pending cannot be applied', async () => {
  const input = { ...config, modes: [...config.modes] };
  const h = mount(input);
  await act(async () => h.UNSAFE_getByType(ActionRow).props.onShutter());
  let selection!: Promise<void>;
  act(() => {
    selection = h.UNSAFE_getByType(ModeSwitcherPill).props.onSelect(1);
  });
  input.modes.pop();
  await act(async () => {
    fireEvent.press(h.getByTestId('confirm-ok'));
    await selection;
  });
  expect(h.UNSAFE_getByType(ModeSwitcherPill).props.currentIndex).toBe(0);
});

it('a platform error-animation failure does not leak a rejected shutter promise', async () => {
  const h = mount();
  const animation = jest
    .spyOn(require('react-native-reanimated'), 'withTiming')
    .mockImplementationOnce(() => {
      throw new Error('animation unavailable');
    });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockCapture.mockRejectedValueOnce(new Error('native capture unavailable'));
  await act(async () => h.UNSAFE_getByType(ActionRow).props.onShutter());
  expect(animation).toHaveBeenCalled();
  expect(h.onSettle).not.toHaveBeenCalled();
  expect(h.UNSAFE_getByType(ActionRow).props.shutterDisabled).toBe(false);
});
it('a platform interval allocation failure is consumed at the video shutter boundary', async () => {
  const h = mount({ modes: [{ mode: 'video' }], retention: 'retain' });
  const interval = jest
    .spyOn(global, 'setInterval')
    .mockImplementationOnce(() => {
      throw new Error('timer allocation unavailable');
    });
  await act(async () => h.UNSAFE_getByType(ActionRow).props.onShutter());
  expect(interval).toHaveBeenCalledWith(expect.any(Function), 250);
  expect(h.UNSAFE_getByType(ActionRow).props.recording).toBe(true);
  expect(h.onSettle).not.toHaveBeenCalled();
});
