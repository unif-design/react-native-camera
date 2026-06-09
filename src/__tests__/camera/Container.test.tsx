import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { Container } from '../../camera/Container';
import { CameraDialogProvider } from '../../camera/ui/CameraDialogHost';

// Container 走到 device-ready 需:已授权 + 有设备。全局 jest.setup mock 把权限设 false、
// device 设 undefined(短路到 Loading/NoCamera);这里覆盖 vision-camera 让 useCameraDevice
// 按请求方向返回超广角设备,验证"前置(front)不渲染变焦条、后置(back)渲染"的 JSX 守护(点1)。
// Container 的 position 由 config.cameraMode[0].type 决定,经 state 传入 useCameraDevice。
// 注:jest.mock 被 babel 提升到 import 之上;工厂里内联建 device(不引外部变量,避免 mock 提升越界)。
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
    minZoom: 0.5,
    maxZoom: 8,
    supportsFocusMetering: true,
    physicalDevices: ['ultra-wide-angle', 'wide-angle'],
  }),
  useCameraDevices: () => [],
  usePhotoOutput: () => ({ capturePhoto: jest.fn() }),
  useVideoOutput: () => ({ createRecorder: jest.fn() }),
  useFrameOutput: () => ({}),
  Camera: ({ children }: { children?: unknown }) => children ?? null,
}));

const baseConfig = {
  dataRetainedMode: 'retain' as const,
};

const r = (position: 'back' | 'front') => {
  const ui: ReactElement = (
    <ThemeProvider forceScheme="dark">
      <CameraDialogProvider>
        <Container
          config={{
            ...baseConfig,
            cameraMode: [{ mode: 'single', type: position }],
          }}
          onSettle={() => {}}
        />
      </CameraDialogProvider>
    </ThemeProvider>
  );
  return render(ui);
};

it('后置(back)渲染变焦条', () => {
  const { getByTestId } = r('back');
  expect(getByTestId('device-ready')).toBeTruthy();
  // 0.5/1/2 档随超广角设备出现
  expect(getByTestId('zoom-chip-1')).toBeTruthy();
});

it('前置(front)不渲染变焦条', () => {
  const { getByTestId, queryByTestId } = r('front');
  expect(getByTestId('device-ready')).toBeTruthy();
  expect(queryByTestId('zoom-chip-0.5')).toBeNull();
  expect(queryByTestId('zoom-chip-1')).toBeNull();
  expect(queryByTestId('zoom-chip-2')).toBeNull();
});
