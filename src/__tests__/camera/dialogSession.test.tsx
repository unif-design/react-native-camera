import { StrictMode, type ComponentProps } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { useCamera } from '@unif/react-native-camera';
import type { CameraController, CameraOutcome } from '../../types';
import type { Container } from '../../camera/Container';
import type { useCameraDialog } from '../../camera/ui/CameraDialogHost';

const mockDialogs = new Map<number, ReturnType<typeof useCameraDialog>>();
const mockConfirmResults = jest.fn<void, [number, boolean]>();

jest.mock('../../camera/Container', () => {
  const React = require('react') as typeof import('react');
  const { Pressable, Text } = require('react-native');
  const {
    useCameraDialog: useDialog,
  } = require('../../camera/ui/CameraDialogHost');
  return {
    Container: ({
      sessionId,
      registerContainer,
    }: ComponentProps<typeof Container>) => {
      const dialog = useDialog() as ReturnType<typeof useCameraDialog>;
      mockDialogs.set(sessionId, dialog);
      React.useEffect(
        () => registerContainer(sessionId),
        [registerContainer, sessionId]
      );
      return (
        <>
          <Text>{`session ${sessionId}`}</Text>
          <Pressable
            testID="ask-confirm"
            onPress={() => {
              dialog
                .confirm({ title: `discard session ${sessionId}` })
                .then((result) => mockConfirmResults(sessionId, result));
            }}
          >
            <Text>ask</Text>
          </Pressable>
          <Pressable
            testID="show-hints"
            onPress={() => {
              dialog.toast(`saved session ${sessionId}`);
              dialog.showError(`error session ${sessionId}`);
            }}
          >
            <Text>hints</Text>
          </Pressable>
        </>
      );
    },
  };
});

let controller: CameraController;
function Host() {
  const [api, host] = useCamera();
  controller = api;
  return <ThemeProvider forceScheme="dark">{host}</ThemeProvider>;
}
const input = { modes: [{ mode: 'single' }], retention: 'clear' } as const;

beforeEach(() => {
  mockDialogs.clear();
  mockConfirmResults.mockClear();
});

test('a replacement clears the old confirmation and hints without replacing the camera window', async () => {
  render(<Host />);
  let first!: Promise<CameraOutcome>;
  act(() => {
    first = controller.open(input);
  });
  const cameraWindow = screen.getByTestId('camera-modal');
  fireEvent.press(screen.getByTestId('show-hints'));
  fireEvent.press(screen.getByTestId('ask-confirm'));
  expect(screen.getByText('discard session 1')).toBeTruthy();
  expect(screen.getByText('saved session 1')).toBeTruthy();
  act(() => {
    controller.open(input);
  });
  await expect(first).resolves.toEqual({ status: 'cancelled' });
  expect(screen.getByText('session 2')).toBeTruthy();
  expect(screen.queryByText('discard session 1')).toBeNull();
  expect(screen.queryByText('saved session 1')).toBeNull();
  expect(screen.queryByText('相机异常:error session 1')).toBeNull();
  expect(mockConfirmResults).toHaveBeenCalledTimes(1);
  expect(mockConfirmResults).toHaveBeenCalledWith(1, false);
  expect(screen.getByTestId('camera-modal')).toBe(cameraWindow);
});

test('late prompts from an ended interaction cannot enter the next interaction', async () => {
  render(<Host />);
  act(() => {
    controller.open(input);
  });
  const previousDialog = mockDialogs.get(1)!;
  act(() => {
    controller.open(input);
  });
  await expect(
    Promise.race([
      previousDialog.confirm({ title: 'late confirmation' }),
      Promise.resolve('pending'),
    ])
  ).resolves.toBe(false);
  act(() => {
    previousDialog.toast('late toast');
    previousDialog.showError('late error');
  });
  expect(screen.queryByText('late confirmation')).toBeNull();
  expect(screen.queryByText('late toast')).toBeNull();
  expect(screen.queryByText('相机异常:late error')).toBeNull();
  expect(screen.getByText('session 2')).toBeTruthy();
});

test('unmount settles the original confirmation once as false', async () => {
  const page = render(<Host />);
  let outcome!: Promise<CameraOutcome>;
  act(() => {
    outcome = controller.open(input);
  });
  fireEvent.press(screen.getByTestId('ask-confirm'));
  page.unmount();
  await act(async () => {});
  await expect(outcome).resolves.toEqual({ status: 'cancelled' });
  expect(mockConfirmResults).toHaveBeenCalledTimes(1);
  expect(mockConfirmResults).toHaveBeenCalledWith(1, false);
});

test('StrictMode retains the active interaction and allows its confirmation to complete', async () => {
  render(
    <StrictMode>
      <Host />
    </StrictMode>
  );
  let outcome!: Promise<CameraOutcome>;
  act(() => {
    outcome = controller.open(input);
  });
  fireEvent.press(screen.getByTestId('ask-confirm'));
  await act(async () => {});
  expect(mockConfirmResults).not.toHaveBeenCalled();
  expect(await Promise.race([outcome, Promise.resolve('pending')])).toBe(
    'pending'
  );
  fireEvent.press(screen.getByRole('button', { name: '确认' }));
  await act(async () => {});
  expect(mockConfirmResults).toHaveBeenCalledTimes(1);
  expect(mockConfirmResults).toHaveBeenCalledWith(1, true);
});
