import type { ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { Container } from '../../camera/Container';
import { CameraDialogProvider } from '../../camera/ui/CameraDialogHost';

// 已授权 + 有后置设备 → Container 走到 device-ready,渲染 <Camera>。
jest.mock('react-native-vision-camera', () => ({
  useCameraPermission: () => ({
    hasPermission: true,
    requestPermission: () => Promise.resolve(true),
  }),
  useMicrophonePermission: () => ({
    hasPermission: true,
    requestPermission: () => Promise.resolve(true),
  }),
  useCameraDevice: (position: 'back' | 'front') => ({
    id: `dev-${position}`,
    position,
    minZoom: 1,
    maxZoom: 8,
    supportsFocusMetering: true,
    hasFlash: position === 'back',
    supportsSpeedQualityPrioritization: true,
    isVirtualDevice: position === 'back',
    zoomLensSwitchFactors: position === 'back' ? [2] : [],
    physicalDevices:
      position === 'back' ? ['ultra-wide-angle', 'wide-angle'] : ['wide-angle'],
  }),
  useCameraDevices: () => [],
  usePhotoOutput: () => ({ capturePhoto: jest.fn() }),
  useVideoOutput: () => ({ createRecorder: jest.fn() }),
  useFrameOutput: () => ({}),
  Camera: ({ children }: { children?: unknown }) => children ?? null,
}));

// 把 <Camera> 替换成可手动触发 onCameraError 的桩:点 trigger-camera-error 即冒泡
// 一个普通 Error,验证 Container 把它接到 showError(顶部错误条),且不 settle。
jest.mock('../../camera/Camera', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Camera: ({ onCameraError }: { onCameraError?: (e: Error) => void }) => (
      <Pressable
        testID="trigger-camera-error"
        onPress={() => onCameraError?.(new Error('session boom'))}
      >
        <Text>cam</Text>
      </Pressable>
    ),
  };
});

const baseConfig = {
  dataRetainedMode: 'retain' as const,
  cameraMode: [{ mode: 'single' as const, type: 'back' as const }],
};

function renderContainer(onSettle: (r: unknown) => void) {
  const ui: ReactElement = (
    <ThemeProvider forceScheme="dark">
      <CameraDialogProvider>
        <Container config={baseConfig} onSettle={onSettle} />
      </CameraDialogProvider>
    </ThemeProvider>
  );
  return render(ui);
}

it('onCameraError 触发顶部错误条(showError)', () => {
  const onSettle = jest.fn();
  const { getByTestId, getByText, queryByTestId } = renderContainer(onSettle);
  expect(queryByTestId('camera-error-bar')).toBeNull();
  fireEvent.press(getByTestId('trigger-camera-error'));
  expect(getByTestId('camera-error-bar')).toBeTruthy();
  expect(getByText('相机异常:session boom')).toBeTruthy();
});

it('onCameraError 绝不 settle(不关相机、promise 不 resolve)', () => {
  const onSettle = jest.fn();
  const { getByTestId } = renderContainer(onSettle);
  fireEvent.press(getByTestId('trigger-camera-error'));
  // 关键:错误是非阻塞的,Container 不得调 onSettle(早期 settle(500) 是被修掉的 bug)。
  expect(onSettle).not.toHaveBeenCalled();
  // 相机仍在(device-ready 未卸载)。
  expect(getByTestId('device-ready')).toBeTruthy();
});
