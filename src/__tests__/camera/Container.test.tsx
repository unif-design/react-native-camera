import type { ReactElement } from 'react';
import { render, fireEvent, within } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { Container } from '../../camera/Container';
import { CameraDialogProvider } from '../../camera/ui/CameraDialogHost';

// Container 走到 device-ready 需:已授权 + 有设备。全局 jest.setup mock 把权限设 false、
// device 设 undefined(短路到 Loading/NoCamera);这里覆盖 vision-camera 让 useCameraDevice
// 按请求方向返回超广角设备,验证"前置(front)不渲染变焦条、后置(back)渲染"的 JSX 守护(点1)。
// Container 的 position 由 config.cameraMode[0].type 决定,经 state 传入 useCameraDevice。
// 注:jest.mock 被 babel 提升到 import 之上;工厂里内联建 device(不引外部变量,避免 mock 提升越界)。
// 覆盖基底:granted permission + back/front device(其余 hook / CommonResolutions 走 helper 基底)。
jest.mock('react-native-vision-camera', () =>
  require('../__helpers__/visionCameraMock').makeVisionCameraMock({
    useCameraPermission: () => ({
      hasPermission: true,
      requestPermission: () => Promise.resolve(true),
    }),
    useMicrophonePermission: () => ({
      hasPermission: true,
      requestPermission: () => Promise.resolve(true),
    }),
    // back: dual(wide+ultra)→ vzf 范围 [1,8]、switchFactors=[2]( displayMul=0.5 → display 范围 [0.5,4])。
    // front: 单广角无超广角 → vzf minZoom=1、switchFactors=[]( displayMul=1)。
    useCameraDevice: (position: 'back' | 'front') => ({
      id: `dev-${position}`,
      position,
      // vzf 空间:两端最广镜头都是 1.0(back 的 1.0 是超广角=用户 0.5x,见 displayMul)。
      minZoom: 1,
      maxZoom: 8,
      supportsFocusMetering: true,
      // back 有物理闪光+支持 speed 质量;front 无闪光(对齐真机:前摄常无 flash)。
      hasFlash: position === 'back',
      supportsSpeedQualityPrioritization: true,
      isVirtualDevice: position === 'back',
      zoomLensSwitchFactors: position === 'back' ? [2] : [],
      physicalDevices:
        position === 'back'
          ? ['ultra-wide-angle', 'wide-angle']
          : ['wide-angle'],
    }),
  })
);

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

it('后置(back)渲染变焦档(0.5/1)', () => {
  const { getByTestId } = r('back');
  expect(getByTestId('device-ready')).toBeTruthy();
  // 0.5/1 档随超广角设备出现(2x 已去除)。
  expect(getByTestId('zoom-chip-1')).toBeTruthy();
});

it('后置 dual:displayMul=0.5 → 0.5 档出现,大号倍数初值 0.5x', () => {
  // mock back: vzf minZoom=1、switchFactors=[2] → displayMul=0.5。
  // showHalf=true(minDisplay=0.5)→ 0.5 档出现;初始 zoom(vzf 1)×0.5=display 0.5 → readout=0.5x。
  // 档位标签现为静态(.5/1),实时倍数走大号 readout(SharedValue 直驱,见 ZoomReadout)。
  const { getByTestId } = r('back');
  expect(getByTestId('zoom-chip-0.5')).toBeTruthy();
  expect(
    within(getByTestId('zoom-readout')).getByDisplayValue('0.5x')
  ).toBeTruthy();
});

it('后置 dual:点 1x 档 → display 1 反算 vzf 2.0 → 大号倍数跳到 1.0x', () => {
  // 点 display 1x 档:onSelect(1) → vzf = 1/0.5 = 2.0 → setZoom(2.0) + zoomShared.value=2.0。
  // 重渲后 readout = zoomShared(2.0)×displayMul(0.5) = 1.0x(印证 display→vzf 反算闭环、0.5x 命脉)。
  const { getByTestId } = r('back');
  fireEvent.press(getByTestId('zoom-chip-1'));
  expect(
    within(getByTestId('zoom-readout')).getByDisplayValue('1.0x')
  ).toBeTruthy();
});

it('前置(front)不渲染变焦档', () => {
  const { getByTestId, queryByTestId } = r('front');
  expect(getByTestId('device-ready')).toBeTruthy();
  expect(queryByTestId('zoom-chip-0.5')).toBeNull();
  expect(queryByTestId('zoom-chip-1')).toBeNull();
  // 前置整块变焦控件不渲染 → readout 也不在。
  expect(queryByTestId('zoom-readout')).toBeNull();
});
