import type { ReactElement } from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import type { CameraResult } from '../../utils';
import { Container } from '../../camera/Container';
import { CameraDialogProvider } from '../../camera/ui/CameraDialogHost';
import { createContainerSessionProps } from '../__helpers__/containerSession';
import { renderDark } from '../__helpers__/renderDark';

// 结果码行为路径(与 Container.test.tsx 的 device-ready/zoom 守护互补,独立文件不相扰):
//   403 = 权限被拒 → NoPermission → 点取消 → onSettle(code 403)
//   404 = 已授权但无设备 → NoCamera → 点关闭 → onSettle(code 404)
//
// 两条路径要不同的 vision-camera 行为(403 拒权限 / 404 授权但 device=undefined),而
// jest.mock 工厂被 babel 提升、整文件只执行一次、不能闭包捕获顶层 import。故工厂内 require
// helper 造基底,再用一个挂在 globalThis 的可变状态切换本次用例要的权限/设备(hooks 在每次
// render 时读它,beforeEach 重置)—— 这样同一份 mock 服务两条码路径,无需拆两个文件。
type VcState = {
  hasPermission: boolean;
  requestResult: boolean;
  requestPermission?: () => Promise<boolean>;
  device: unknown;
};
declare global {
  // global 增强须用 var(let/const 不挂到 global);此处由 jest.mock 工厂 + beforeEach 跨用例读写。
  var __vcResultCodeState: VcState | undefined;
}

jest.mock('react-native-vision-camera', () => {
  const vc = require('../__helpers__/visionCameraMock');
  // 读取本次用例状态;缺省走「拒权限 + 无设备」(与全局 setup 一致的保守基底)。
  const read = (): VcState =>
    (globalThis as { __vcResultCodeState?: VcState }).__vcResultCodeState ?? {
      hasPermission: false,
      requestResult: false,
      device: undefined,
    };
  return vc.makeVisionCameraMock({
    ...vc.grantedPermissionOverrides(),
    // 覆盖 granted 基底:按本次用例状态返回权限(403 用例要 hasPermission=false + 拒绝)。
    useCameraPermission: () => {
      const s = read();
      return {
        hasPermission: s.hasPermission,
        requestPermission:
          s.requestPermission ?? (() => Promise.resolve(s.requestResult)),
      };
    },
    // 按本次用例状态返回设备(404 用例要 undefined → Container 走 NoCamera)。
    useCameraDevice: () => read().device,
  });
});

const baseConfig = {
  dataRetainedMode: 'retain' as const,
  cameraMode: [{ mode: 'single' as const, type: 'back' as const }],
};

function renderContainer(onSettle: (r: CameraResult) => void) {
  const ui: ReactElement = (
    <CameraDialogProvider>
      <Container
        {...createContainerSessionProps()}
        config={baseConfig}
        onSettle={onSettle}
      />
    </CameraDialogProvider>
  );
  return renderDark(ui);
}

let consoleErrorSpy: jest.SpyInstance;

beforeEach(() => {
  const originalConsoleError = console.error;
  consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation((...args: Parameters<typeof console.error>) => {
      originalConsoleError(...args);
      if (
        typeof args[0] === 'string' &&
        args[0].includes('not wrapped in act')
      ) {
        throw new Error(`Unexpected React act warning: ${args[0]}`);
      }
    });
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  delete (globalThis as { __vcResultCodeState?: VcState }).__vcResultCodeState;
});

it('403:权限被拒 → NoPermission → 点取消 → onSettle(code 403)', async () => {
  let resolvePermission: ((granted: boolean) => void) | undefined;
  // 保持权限请求挂起，直到 act 内结算；否则 Promise 自行结算的 state 更新会逃出测试边界。
  (globalThis as { __vcResultCodeState?: VcState }).__vcResultCodeState = {
    hasPermission: false,
    requestResult: false,
    requestPermission: () =>
      new Promise((resolve) => {
        resolvePermission = resolve;
      }),
    device: undefined,
  };
  const onSettle = jest.fn();
  const { findByTestId, getByTestId } = renderContainer(onSettle);

  await act(async () => {
    resolvePermission?.(false);
    await Promise.resolve();
  });
  // requestPermission 是异步 → NoPermission 在 promise 解析后出现。
  await findByTestId('no-permission');
  fireEvent.press(getByTestId('cancel-btn'));

  expect(onSettle).toHaveBeenCalledTimes(1);
  expect(onSettle).toHaveBeenCalledWith({
    code: 403,
    data: [],
    message: 'permission_denied',
  });
});

it('404:已授权但无设备 → NoCamera → 点关闭 → onSettle(code 404)', async () => {
  // hasPermission=true → state 同步 'granted';device=undefined → 落到 NoCamera 分支。
  (globalThis as { __vcResultCodeState?: VcState }).__vcResultCodeState = {
    hasPermission: true,
    requestResult: true,
    device: undefined,
  };
  const onSettle = jest.fn();
  const { getByTestId } = renderContainer(onSettle);

  // granted 同步 → NoCamera 首帧即在(device 仍为 undefined)。
  await waitFor(() => expect(getByTestId('no-camera')).toBeTruthy());
  fireEvent.press(getByTestId('close-btn'));

  expect(onSettle).toHaveBeenCalledTimes(1);
  expect(onSettle).toHaveBeenCalledWith({
    code: 404,
    data: [],
    message: 'no_device',
  });
});
