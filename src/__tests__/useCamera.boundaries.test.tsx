import { act, renderHook } from '@testing-library/react-native';
import { useCamera } from '../hooks/useCamera';
import { useCameraSessionController } from '../camera/hooks/useCameraSessionController';
import { Container } from '../camera/Container';
import { ModalView } from '../camera/ModalView';
import { renderDark } from './__helpers__/renderDark';
import type { CameraController, CameraOutcome } from '../utils';

jest.mock('react-native-vision-camera', () => {
  const vc = require('./__helpers__/visionCameraMock');
  return vc.makeVisionCameraMock({
    ...vc.grantedPermissionOverrides(),
    useCameraDevice: () => undefined,
  });
});
const config = {
  modes: [{ mode: 'single' as const }],
  retention: 'retain' as const,
};
function mount() {
  let api!: CameraController;
  function Harness() {
    const [current, holder] = useCamera();
    api = current;
    return holder;
  }
  const view = renderDark(<Harness />);
  return {
    ...view,
    open: (signal?: AbortSignal) => {
      let promise!: Promise<CameraOutcome>;
      act(() => {
        promise = api.open(config, { signal });
      });
      return promise;
    },
    api,
  };
}
function replacementController(props: React.ComponentProps<typeof Container>) {
  return renderHook(() =>
    useCameraSessionController({
      sessionId: props.sessionId,
      initialState: {
        files: [],
        modeIndex: 0,
        aspectRatio: '4:3',
        activePosition: 'back',
        canFlip: false,
        flash: 'off',
        sound: false,
        nativeConfigurationKey: 'none',
      },
      registerController: props.registerController,
      confirm: async () => true,
      cancelRecording: () => {},
      onSettle: props.onSettle,
    })
  );
}
afterEach(() => jest.restoreAllMocks());
it('abort during listener registration settles once even when the listener is already queued again', async () => {
  const h = mount();
  const abort = new AbortController();
  const add = abort.signal.addEventListener.bind(abort.signal);
  jest.spyOn(abort.signal, 'addEventListener').mockImplementation((...args) => {
    add(...args);
    abort.abort();
  });
  await expect(h.open(abort.signal)).resolves.toEqual({ status: 'cancelled' });
  expect(h.queryByTestId('no-camera')).toBeNull();
});
it('unregistering a controller with its container retained clears the bridge and native close still settles', async () => {
  const h = mount();
  const outcome = h.open();
  const props = h.UNSAFE_getByType(Container).props as React.ComponentProps<
    typeof Container
  >;
  const other = replacementController(props);
  await act(async () => other.unmount());
  act(() => h.UNSAFE_getByType(ModalView).props.onClose());
  await expect(outcome).resolves.toEqual({ status: 'cancelled' });
  const disposeStale = props.registerContainer(props.sessionId);
  expect(disposeStale()).toBeUndefined();
});
it('controller detach queued before hook unmount cannot clear a replacement container generation', async () => {
  const h = mount();
  const outcome = h.open();
  const props = h.UNSAFE_getByType(Container).props as React.ComponentProps<
    typeof Container
  >;
  const other = replacementController(props);
  const detachReplacement = props.registerContainer(props.sessionId);
  act(() => {
    other.unmount();
    h.unmount();
  });
  await act(async () => {});
  await expect(outcome).resolves.toEqual({ status: 'cancelled' });
  detachReplacement();
});
it('a native close callback before any open is harmless', () => {
  const h = mount();
  act(() => h.UNSAFE_getByType(ModalView).props.onClose());
  expect(h.queryByTestId('no-camera')).toBeNull();
});
