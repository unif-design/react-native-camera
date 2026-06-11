import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, within } from '@testing-library/react-native';
import { Container } from '../../camera/Container';
import { CameraDialogProvider } from '../../camera/ui/CameraDialogHost';
import { renderDark } from '../__helpers__/renderDark';

// Container 走到 device-ready 需:已授权 + 有设备。全局 jest.setup mock 把权限设 false、
// device 设 undefined(短路到 Loading/NoCamera);这里覆盖 vision-camera 让 useCameraDevice
// 按请求方向返回超广角设备,验证"前置(front)不渲染变焦条、后置(back)渲染"的 JSX 守护(点1)。
// Container 的 position 由 config.cameraMode[0].type 决定,经 state 传入 useCameraDevice。
// makeDeviceStub({ position }) 派生:back=dual(switchFactors=[2]、有闪光、超广角),front=单广角(无闪光、switchFactors=[])。
// 注:jest.mock 被 babel 提升到 import 之上;helper 在工厂内 require(不能闭包捕获顶层 import)。
jest.mock('react-native-vision-camera', () => {
  const vc = require('../__helpers__/visionCameraMock');
  return vc.makeVisionCameraMock({
    ...vc.grantedPermissionOverrides(),
    useCameraDevice: (position: 'back' | 'front') =>
      vc.makeDeviceStub({ position }),
  });
});

const baseConfig = {
  dataRetainedMode: 'retain' as const,
};

const r = (position: 'back' | 'front') => {
  const ui: ReactElement = (
    <CameraDialogProvider>
      <Container
        config={{
          ...baseConfig,
          cameraMode: [{ mode: 'single', type: position }],
        }}
        onSettle={() => {}}
      />
    </CameraDialogProvider>
  );
  return renderDark(ui);
};

it('后置(back)渲染变焦档(0.5/1)', () => {
  const { getByTestId } = r('back');
  expect(getByTestId('device-ready')).toBeTruthy();
  // 0.5/1 档随超广角设备出现(2x 已去除)。
  expect(getByTestId('zoom-chip-1')).toBeTruthy();
});

it('后置 dual:displayMul=0.5 → 0.5 档出现,高亮 0.5 档文字初值 0.5', () => {
  // mock back: vzf minZoom=1、switchFactors=[2] → displayMul=0.5。
  // showHalf=true(minDisplay=0.5)→ 0.5 档出现;初始 zoom(vzf 1)×0.5=display 0.5 → 0.5 档高亮。
  // 倍数已挪进高亮档药丸文字本身(只读 AnimatedTextInput,value 兜底初值,getByDisplayValue 取)。
  const { getByTestId } = r('back');
  expect(getByTestId('zoom-chip-0.5')).toBeTruthy();
  expect(
    within(getByTestId('zoom-chip-0.5')).getByDisplayValue('0.5')
  ).toBeTruthy();
});

it('后置 dual:点 1x 档 → display 1 反算 vzf 2.0 → 高亮跳到 1 档、文字 1.0', () => {
  // 点 display 1x 档:onSelect(1) → vzf = 1/0.5 = 2.0 → setZoom(2.0) + zoomShared.value=2.0。
  // 重渲后 display = zoomShared(2.0)×displayMul(0.5) = 1.0 → 1 档高亮、文字实时 '1.0'
  // (印证 display→vzf 反算闭环、0.5x 命脉)。
  const { getByTestId } = r('back');
  fireEvent.press(getByTestId('zoom-chip-1'));
  expect(
    within(getByTestId('zoom-chip-1')).getByDisplayValue('1.0')
  ).toBeTruthy();
});

it('前置(front)不渲染变焦档', () => {
  const { getByTestId, queryByTestId } = r('front');
  expect(getByTestId('device-ready')).toBeTruthy();
  expect(queryByTestId('zoom-chip-0.5')).toBeNull();
  expect(queryByTestId('zoom-chip-1')).toBeNull();
  // 倍数已无独立浮层(并入档位药丸),前置整块变焦控件不渲染。
  expect(queryByTestId('zoom-readout')).toBeNull();
});

it('水印 wrapper 为全屏容器(absoluteFill),让 WatermarkStamp 自身按 position 定位', () => {
  // wrapper 必须 absoluteFill —— 否则唯一子节点 absolute → Yoga 下 wrapper 坍缩 0×0 锚屏幕右上,
  // 非 top-right 档(bottom/center)在 0 尺寸盒内定位参照错位(成片烧录走像素空间不受影响,
  // 但取景所见与成片不符)。这里断言 wrapper 是全屏,定位所有权单独交给 WatermarkStamp。
  const ui: ReactElement = (
    <CameraDialogProvider>
      <Container
        config={{
          ...baseConfig,
          cameraMode: [{ mode: 'single', type: 'back' }],
          watermark: { content: ['L1'], position: 'bottom-center' },
        }}
        onSettle={() => {}}
      />
    </CameraDialogProvider>
  );
  const { getByTestId } = renderDark(ui);
  const style = StyleSheet.flatten(
    getByTestId('watermark-wrapper').props.style
  );
  expect(style.position).toBe('absolute');
  expect(style.top).toBe(0);
  expect(style.left).toBe(0);
  expect(style.right).toBe(0);
  expect(style.bottom).toBe(0);
});
