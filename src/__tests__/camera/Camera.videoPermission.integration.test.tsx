import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { Container } from '../../camera/Container';
import { CameraDialogProvider } from '../../camera/ui/CameraDialogHost';
import { renderDark } from '../__helpers__/renderDark';
import {
  createContainerSessionProps,
  layoutCameraViewport,
} from '../__helpers__/containerSession';
import { AppState } from 'react-native';
import type { ComponentProps } from 'react';

let mockMicGranted = false;
const mockRequestMic = jest.fn<Promise<boolean>, []>();

const mockConfigurations: boolean[] = [];
let mockDeferAudioConfiguration = false;
const mockPendingConfigurations: {
  complete: () => void;
  fail: (error: Error) => void;
}[] = [];
const originalAppState = Object.getOwnPropertyDescriptor(
  AppState,
  'currentState'
);
const mockStartRecording = jest.fn(async () => {});

jest.mock('react-native-vision-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  const vc = require('../__helpers__/visionCameraMock');
  const back = vc.makeDeviceStub();
  return vc.makeVisionCameraMock({
    useCameraDevice: (side: string) => (side === 'back' ? back : undefined),
    useCameraPermission: () => ({
      hasPermission: true,
      requestPermission: async () => true,
    }),
    useMicrophonePermission: () => {
      const [granted, setGranted] = React.useState(mockMicGranted);
      return {
        hasPermission: granted,
        requestPermission: async () => {
          const accepted = await mockRequestMic();
          if (accepted) {
            mockMicGranted = true;
            setGranted(true);
          }
          return accepted;
        },
      };
    },
    usePhotoOutput: () =>
      React.useMemo(() => ({ requiresAudioInput: false }), []),
    useVideoOutput: (options: {
      enableAudio: boolean;
      targetResolution: object;
    }) =>
      React.useMemo(
        () => ({
          requiresAudioInput: options.enableAudio,
          targetResolution: options.targetResolution,
          createRecorder: async () => {
            if (!options.enableAudio || !mockMicGranted)
              throw new Error('Recording requires authorized audio');
            return {
              startRecording: mockStartRecording,
              stopRecording: async () => {},
              cancelRecording: async () => {},
              dispose: () => {},
              recordedDuration: 0,
              filePath: '/mock-video.mp4',
            };
          },
        }),
        [options.enableAudio, options.targetResolution]
      ),
    Camera: ({
      outputs,
      onConfigured,
      onError,
    }: {
      outputs: { requiresAudioInput: boolean }[];
      onConfigured: () => void;
      onError: (error: Error) => void;
    }) => {
      const output = outputs[0]!;
      const callbacks = React.useRef({ onConfigured, onError });
      callbacks.current = { onConfigured, onError };
      React.useEffect(() => {
        // Exact prerequisite from installed VisionCamera 5.0.11:
        // HybridCameraSession.swift:262-269 rejects configure when audio is not authorized.
        const permitted = !output.requiresAudioInput || mockMicGranted;
        mockConfigurations.push(permitted);
        if (
          permitted &&
          output.requiresAudioInput &&
          mockDeferAudioConfiguration
        ) {
          mockPendingConfigurations.push({
            complete: callbacks.current.onConfigured,
            fail: callbacks.current.onError,
          });
        } else if (permitted) callbacks.current.onConfigured();
      }, [output]);
      return <View testID="vc-boundary" />;
    },
  });
});

async function mount(
  modes: ComponentProps<typeof Container>['config']['modes']
) {
  const view = renderDark(
    <CameraDialogProvider>
      <Container
        {...createContainerSessionProps()}
        config={{ modes, retention: 'retain' }}
        onSettle={jest.fn()}
      />
    </CameraDialogProvider>
  );
  layoutCameraViewport(view);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

beforeEach(() => {
  mockMicGranted = false;
  mockDeferAudioConfiguration = false;
  mockPendingConfigurations.length = 0;
  mockRequestMic.mockReset();
  mockRequestMic.mockResolvedValue(true);
  mockStartRecording.mockClear();
  mockConfigurations.length = 0;
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
  });
});

test('首次录像先显示无音频预览，明确开始后取得麦克风权限并配置有声录像', async () => {
  const view = await mount([{ mode: 'video' }]);
  expect(
    view.getByTestId('shutter-btn').props.accessibilityState.disabled
  ).toBe(false);
  expect(mockRequestMic).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.press(view.getByTestId('shutter-btn'));
  });
  await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(1));
  expect(mockRequestMic).toHaveBeenCalledTimes(1);
  expect(mockConfigurations).not.toContain(false);
  view.unmount();
});

test('照片切录像不提前申请麦克风，快门操作可以开始有声录像', async () => {
  const view = await mount([{ mode: 'single' }, { mode: 'video' }]);
  fireEvent.press(view.getByTestId('mode-pill-1'));
  expect(
    view.getByTestId('shutter-btn').props.accessibilityState.disabled
  ).toBe(false);
  expect(mockRequestMic).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.press(view.getByTestId('shutter-btn'));
  });
  await waitFor(() => expect(mockStartRecording).toHaveBeenCalledTimes(1));
  expect(mockConfigurations).not.toContain(false);
  view.unmount();
});

test('拒绝麦克风后可恢复操作且不会录制无声视频', async () => {
  mockRequestMic.mockResolvedValue(false);
  const view = await mount([{ mode: 'video' }]);
  await act(async () => {
    fireEvent.press(view.getByTestId('shutter-btn'));
  });
  expect(mockRequestMic).toHaveBeenCalledTimes(1);
  expect(mockStartRecording).not.toHaveBeenCalled();
  expect(
    view.getByTestId('shutter-btn').props.accessibilityState.disabled
  ).toBe(false);
  view.unmount();
});

test('权限等待期间卸载，迟到授权不能开始录像', async () => {
  let grant!: (accepted: boolean) => void;
  mockRequestMic.mockImplementation(
    () =>
      new Promise((resolve) => {
        grant = resolve;
      })
  );
  const view = await mount([{ mode: 'video' }]);
  fireEvent.press(view.getByTestId('shutter-btn'));
  expect(mockRequestMic).toHaveBeenCalledTimes(1);
  view.unmount();
  await act(async () => {
    grant(true);
  });
  expect(mockStartRecording).not.toHaveBeenCalled();
});

test('预授权麦克风可以直接开始有声录像', async () => {
  mockMicGranted = true;
  const view = await mount([{ mode: 'video' }]);
  await act(async () => {
    fireEvent.press(view.getByTestId('shutter-btn'));
  });
  expect(mockStartRecording).toHaveBeenCalledTimes(1);
  view.unmount();
});

afterAll(() => {
  if (originalAppState)
    Object.defineProperty(AppState, 'currentState', originalAppState);
});

test('授权后必须等有声输出配置回执，不能提前开录', async () => {
  mockDeferAudioConfiguration = true;
  const view = await mount([{ mode: 'video' }]);
  await act(async () => {
    fireEvent.press(view.getByTestId('shutter-btn'));
  });
  expect(mockPendingConfigurations).toHaveLength(1);
  expect(mockStartRecording).not.toHaveBeenCalled();
  await act(async () => {
    mockPendingConfigurations[0]!.complete();
  });
  expect(mockStartRecording).toHaveBeenCalledTimes(1);
  view.unmount();
});

test('有声输出配置等待时卸载，迟到回执不能开始录像', async () => {
  mockDeferAudioConfiguration = true;
  const view = await mount([{ mode: 'video' }]);
  await act(async () => {
    fireEvent.press(view.getByTestId('shutter-btn'));
  });
  expect(mockPendingConfigurations).toHaveLength(1);
  view.unmount();
  await act(async () => {
    mockPendingConfigurations[0]!.complete();
  });
  expect(mockStartRecording).not.toHaveBeenCalled();
});

test('有声输出配置失败恢复快门，下一次操作重新配置并可录像', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockDeferAudioConfiguration = true;
  const view = await mount([{ mode: 'video' }]);
  await act(async () => {
    fireEvent.press(view.getByTestId('shutter-btn'));
  });
  await act(async () => {
    mockPendingConfigurations[0]!.fail(new Error('Audio configuration failed'));
  });
  expect(mockStartRecording).not.toHaveBeenCalled();
  expect(
    view.getByTestId('shutter-btn').props.accessibilityState.disabled
  ).toBe(false);
  await act(async () => {
    fireEvent.press(view.getByTestId('shutter-btn'));
  });
  expect(mockPendingConfigurations).toHaveLength(2);
  await act(async () => {
    mockPendingConfigurations[0]!.complete();
  });
  expect(mockStartRecording).not.toHaveBeenCalled();
  await act(async () => {
    mockPendingConfigurations[1]!.complete();
  });
  expect(mockStartRecording).toHaveBeenCalledTimes(1);
  view.unmount();
  warn.mockRestore();
});

test('配置回执丢失有界超时，恢复快门并允许重新配置', async () => {
  jest.useFakeTimers();
  try {
    mockDeferAudioConfiguration = true;
    const view = await mount([{ mode: 'video' }]);
    await act(async () => {
      fireEvent.press(view.getByTestId('shutter-btn'));
    });
    expect(mockStartRecording).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });
    expect(
      view.getByTestId('shutter-btn').props.accessibilityState.disabled
    ).toBe(false);
    await act(async () => {
      fireEvent.press(view.getByTestId('shutter-btn'));
    });
    expect(mockPendingConfigurations).toHaveLength(2);
    await act(async () => {
      mockPendingConfigurations[1]!.complete();
    });
    expect(mockStartRecording).toHaveBeenCalledTimes(1);
    view.unmount();
  } finally {
    jest.useRealTimers();
  }
});
