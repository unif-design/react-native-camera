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

it('同一点连续 tap 分配递增 requestId 并 remount indicator', () => {
  renderCamera();

  act(() => gestureMock.deactivateTap({ x: 100, y: 200 }));
  const first = focusMock.state.props.at(-1)!;
  act(() => gestureMock.deactivateTap({ x: 100, y: 200 }));
  const second = focusMock.state.props.at(-1)!;

  expect([first.requestId, second.requestId]).toEqual([1, 2]);
  expect(focusMock.state.mounts).toEqual([1, 2]);
  expect(focusMock.state.unmounts).toEqual([1]);
});

it('旧 request 的动画结束不能清除新 request', () => {
  const { queryByTestId } = renderCamera();

  act(() => gestureMock.deactivateTap({ x: 100, y: 200 }));
  const first = focusMock.state.props.at(-1)!;
  act(() => gestureMock.deactivateTap({ x: 100, y: 200 }));
  const second = focusMock.state.props.at(-1)!;

  act(() => first.onAnimationEnd(first.requestId));
  expect(queryByTestId('focus-indicator')).toBeTruthy();

  act(() => second.onAnimationEnd(second.requestId));
  expect(queryByTestId('focus-indicator')).toBeNull();
});

it('无关 render 不改变 onAnimationEnd callback identity', () => {
  const { rerender } = renderCamera();
  act(() => gestureMock.deactivateTap({ x: 100, y: 200 }));
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
