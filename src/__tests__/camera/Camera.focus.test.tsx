import { act } from '@testing-library/react-native';
import type { CameraDevice } from 'react-native-vision-camera';
import { Camera } from '../../camera/Camera';
import { makeAnimatedFrameStub } from '../__helpers__/cameraFrame';
import { makeDeviceStub } from '../__helpers__/visionCameraMock';
import { renderDark } from '../__helpers__/renderDark';

jest.mock('../../camera/FocusIndicator', () => {
  const React = require('react');
  const { View } = require('react-native');
  const state = {
    mounts: [] as number[],
    unmounts: [] as number[],
    props: [] as any[],
  };
  function FocusIndicatorMock(props: any) {
    state.props.push(props);
    React.useEffect(() => {
      state.mounts.push(props.requestId);
      return () => state.unmounts.push(props.requestId);
      // requestId 是实例 identity，mount 后不会变化。
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return React.createElement(View, { testID: 'focus-indicator' });
  }
  return {
    FocusIndicator: FocusIndicatorMock,
    __focusMock: {
      state,
      reset: () => {
        state.mounts.splice(0);
        state.unmounts.splice(0);
        state.props.splice(0);
      },
    },
  };
});

// 点击对焦是唯一需要在测试里**驱动**手势的用例。`@unif/react-native-design/jest-setup`
// 给的是真实 RNGH(只把 Pressable / GestureDetector 换成不依赖手势的壳),而真实 gesture 在
// jest 下没有触摸事件源可驱动 —— 故只在本文件把 `useTapGesture` 包一层:仍调真实 hook
// (useSimultaneousGestures 的组合保持真实),额外记下 config 供测试回放 onDeactivate。
// 其余导出与入口同形(spread 真实模块 + 两个壳),不要在这里改动入口负责的接线。
jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler');
  let latestTapConfig: any;
  return {
    ...actual,
    Pressable: require('react-native').Pressable,
    GestureDetector: ({ children }: any) => children,
    useTapGesture: (config: any) => {
      latestTapConfig = config;
      return actual.useTapGesture(config);
    },
    __gestureMock: {
      deactivateTap: (event: { x: number; y: number }) =>
        latestTapConfig?.onDeactivate?.(event),
      reset: () => {
        latestTapConfig = undefined;
      },
    },
  };
});

type FocusProps = {
  requestId: number;
  onAnimationEnd: (requestId: number) => void;
};

const focusMock = (
  jest.requireMock('../../camera/FocusIndicator') as {
    __focusMock: {
      state: {
        mounts: number[];
        unmounts: number[];
        props: FocusProps[];
      };
      reset: () => void;
    };
  }
).__focusMock;

const gestureMock = (
  jest.requireMock('react-native-gesture-handler') as {
    __gestureMock: {
      deactivateTap: (event: { x: number; y: number }) => void;
      reset: () => void;
    };
  }
).__gestureMock;

const device = makeDeviceStub() as unknown as CameraDevice;
const frame = { x: 0, y: 0, width: 390, height: 520 };
const animatedFrame = makeAnimatedFrameStub(frame);

function renderCamera(frozenUri?: string) {
  return renderDark(
    <Camera
      device={device}
      currentMode={{ mode: 'single' }}
      frame={frame}
      animatedFrame={animatedFrame}
      frozenUri={frozenUri}
    />
  );
}

beforeEach(() => {
  focusMock.reset();
  gestureMock.reset();
  jest.clearAllMocks();
});

// tap 回放要 await:`onDeactivate` 是 worklet,里面 `runOnJS(handleFocus)` 走 worklets 官方
// mock 的 `queueMicrotask` 异步派发(对齐真实实现「UI runtime → JS runtime」是一次跨线程跳转,
// 不是同步调用)。同步 act 返回时 microtask 还没跑,断言会读到空的 focus 状态。
const tapAt = (point: { x: number; y: number }) =>
  act(async () => {
    gestureMock.deactivateTap(point);
  });

it('同一点连续 tap 分配递增 requestId 并 remount indicator', async () => {
  renderCamera();

  await tapAt({ x: 100, y: 200 });
  const first = focusMock.state.props.at(-1)!;
  await tapAt({ x: 100, y: 200 });
  const second = focusMock.state.props.at(-1)!;

  expect([first.requestId, second.requestId]).toEqual([1, 2]);
  expect(focusMock.state.mounts).toEqual([1, 2]);
  expect(focusMock.state.unmounts).toEqual([1]);
});

it('旧 request 的动画结束不能清除新 request', async () => {
  const { queryByTestId } = renderCamera();

  await tapAt({ x: 100, y: 200 });
  const first = focusMock.state.props.at(-1)!;
  await tapAt({ x: 100, y: 200 });
  const second = focusMock.state.props.at(-1)!;

  act(() => first.onAnimationEnd(first.requestId));
  expect(queryByTestId('focus-indicator')).toBeTruthy();

  act(() => second.onAnimationEnd(second.requestId));
  expect(queryByTestId('focus-indicator')).toBeNull();
});

it('无关 render 不改变 onAnimationEnd callback identity', async () => {
  const { rerender } = renderCamera();
  await tapAt({ x: 100, y: 200 });
  const callback = focusMock.state.props.at(-1)!.onAnimationEnd;

  rerender(
    <Camera
      device={device}
      currentMode={{ mode: 'single' }}
      frame={frame}
      animatedFrame={animatedFrame}
      frozenUri="file:///frozen.jpg"
    />
  );

  expect(focusMock.state.props.at(-1)!.onAnimationEnd).toBe(callback);
  expect(focusMock.state.mounts).toHaveLength(1);
});
