import { act } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { renderDark } from '../__helpers__/renderDark';
import { FocusIndicator } from '../../camera/FocusIndicator';

// 相机 Modal 强制 dark,FocusIndicator 用 useColors() —— renderDark 包 dark Provider 对齐运行时。

it('renders focus brackets without crashing', () => {
  expect(() =>
    renderDark(
      <FocusIndicator
        point={{ x: 100, y: 200 }}
        requestId={1}
        onAnimationEnd={() => {}}
      />
    )
  ).not.toThrow();
});

it('exposes the focus-indicator testID', () => {
  const { getByTestId } = renderDark(
    <FocusIndicator
      point={{ x: 100, y: 200 }}
      requestId={1}
      onAnimationEnd={() => {}}
    />
  );
  expect(getByTestId('focus-indicator')).toBeTruthy();
});

it('动画自然结束时回传所属 requestId', () => {
  type AnimationEndResult = { finished: boolean };
  let finish: ((result: AnimationEndResult) => void) | undefined;
  const animation = {
    start: jest.fn((callback?: (result: AnimationEndResult) => void) => {
      finish = callback;
    }),
    stop: jest.fn(),
    reset: jest.fn(),
  } as Animated.CompositeAnimation;
  const sequenceSpy = jest
    .spyOn(Animated, 'sequence')
    .mockReturnValue(animation);
  const onAnimationEnd = jest.fn();
  try {
    renderDark(
      <FocusIndicator
        point={{ x: 100, y: 200 }}
        requestId={7}
        onAnimationEnd={onAnimationEnd}
      />
    );
    act(() => finish?.({ finished: true }));
    expect(onAnimationEnd).toHaveBeenCalledWith(7);
  } finally {
    sequenceSpy.mockRestore();
  }
});
