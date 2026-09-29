import { createRef } from 'react';
import { render, act } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import * as VisionCamera from 'react-native-vision-camera';
import NativePhotoProcessor from '../../NativePhotoProcessor';
import { Camera, type CameraHandle } from '../../camera/Camera';
import { makeDeviceStub } from '../__helpers__/visionCameraMock';
import { makeAnimatedFrameStub } from '../__helpers__/cameraFrame';

const frame = { x: 0, y: 0, width: 390, height: 520 };
const capturePhotoToFile = jest.fn();
beforeEach(() => {
  capturePhotoToFile
    .mockReset()
    .mockResolvedValue({ filePath: '/tmp/hdr.jpg' });
  jest
    .mocked(VisionCamera.usePhotoOutput)
    .mockReturnValue({ capturePhotoToFile } as never);
  jest
    .mocked(NativePhotoProcessor.inspectPhotoFile)
    .mockResolvedValue('{"width":1080,"height":1920,"orientation":"up"}');
});

test.each([
  [true, false],
  [false, true],
])('requested HDR %s refuses actual HDR %s', async (requested, selected) => {
  const ref = createRef<CameraHandle>();
  const onError = jest.fn();
  const view = render(
    <ThemeProvider forceScheme="dark">
      <Camera
        ref={ref}
        device={makeDeviceStub({ supportsPhotoHDR: true }) as never}
        currentMode={{ mode: 'single', hdr: requested }}
        frame={frame}
        animatedFrame={makeAnimatedFrameStub(frame)}
        onCameraError={onError}
      />
    </ThemeProvider>
  );
  const camera = view.UNSAFE_root.findByProps({ nativeID: 'vision-camera' });
  act(() =>
    camera.props.onSessionConfigSelected?.({ isPhotoHDREnabled: selected })
  );
  await act(async () => {
    await expect(ref.current!.capture()).resolves.toBeNull();
  });
  expect(capturePhotoToFile).not.toHaveBeenCalled();
  expect(onError).toHaveBeenCalledWith(expect.any(Error));
});

test.each([
  ['first', 'second'],
  ['same-device-id', 'same-device-id'],
])(
  'a late old configuration (%s → %s) cannot overwrite the current HDR receipt',
  async (firstId, secondId) => {
    const ref = createRef<CameraHandle>();
    const content = (id: string) => (
      <ThemeProvider forceScheme="dark">
        <Camera
          ref={ref}
          device={makeDeviceStub({ id, supportsPhotoHDR: true }) as never}
          currentMode={{ mode: 'single', hdr: true }}
          frame={frame}
          animatedFrame={makeAnimatedFrameStub(frame)}
        />
      </ThemeProvider>
    );
    const view = render(content(firstId));
    const oldSelected = view.UNSAFE_root.findByProps({
      nativeID: 'vision-camera',
    }).props.onSessionConfigSelected;
    view.rerender(content(secondId));
    const selected = view.UNSAFE_root.findByProps({ nativeID: 'vision-camera' })
      .props.onSessionConfigSelected;
    expect(selected).toEqual(expect.any(Function));
    act(() => {
      selected({ isPhotoHDREnabled: true });
      oldSelected({ isPhotoHDREnabled: false });
    });
    await act(async () => {
      await expect(ref.current!.capture()).resolves.toMatchObject({
        uri: 'file:///tmp/hdr.jpg',
        width: 1080,
        height: 1920,
      });
    });
    expect(capturePhotoToFile).toHaveBeenCalledTimes(1);
  }
);
