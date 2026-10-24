import { Animated, StyleSheet } from 'react-native';
import * as LiquidGlass from '@callstack/liquid-glass';
import { act, fireEvent } from '@testing-library/react-native';
import { renderDark } from '../../__helpers__/renderDark';
import { ModeSwitcherPill } from '../../../camera/footer/ModeSwitcherPill';

const items = [
  { key: 'continuous', label: '连拍' },
  { key: 'single', label: '单拍' },
  { key: 'video', label: '视频' },
];

// 相机 Modal 强制 dark,ModeSwitcherPill 用 useThemedStyles —— renderDark 包 dark Provider 对齐运行时。

it('renders one pill per item (multi-mode) and selects by tap', () => {
  const onSelect = jest.fn();
  const { getByTestId } = renderDark(
    <ModeSwitcherPill items={items} currentIndex={1} onSelect={onSelect} />
  );
  // 多模式 → 每项一个可点 pill(不退化为单 label):全部三档都在,非只渲染当前/被点档。
  expect(getByTestId('mode-pill-0')).toBeTruthy();
  expect(getByTestId('mode-pill-1')).toBeTruthy();
  expect(getByTestId('mode-pill-2')).toBeTruthy();
  fireEvent.press(getByTestId('mode-pill-2'));
  expect(onSelect).toHaveBeenCalledWith(2);
});

it('(重新)挂载后滑块直接落到当前档,不从 0 档滑入', () => {
  // 烧水印时 Container 卸载 ModeSwitcherPill、烧完重挂:滑块位置存在组件内部
  // Animated.Value(0)(=首档),重挂会重置回 0 再 timing 滑到当前档 → 视觉上"切到
  // 单拍又滑回连拍"。修复后:首次拿到布局宽度时直接 setValue 落位,不调 Animated.timing。
  const fakeAnim = {
    start: jest.fn(),
  } as unknown as Animated.CompositeAnimation;
  const timingSpy = jest.spyOn(Animated, 'timing').mockReturnValue(fakeAnim);
  try {
    const { getByTestId } = renderDark(
      <ModeSwitcherPill items={items} currentIndex={1} onSelect={jest.fn()} />
    );
    fireEvent(getByTestId('mode-switcher-wrap'), 'layout', {
      nativeEvent: { layout: { width: 300, height: 40 } },
    });
    expect(timingSpy).not.toHaveBeenCalled();
  } finally {
    timingSpy.mockRestore();
  }
});

it('真正切档(currentIndex 变化)仍走平滑滑动动画', () => {
  // 防过修:重挂落位用 setValue,但用户主动点档切换必须仍 timing 平滑滑动。
  const fakeAnim = {
    start: jest.fn(),
  } as unknown as Animated.CompositeAnimation;
  const timingSpy = jest.spyOn(Animated, 'timing').mockReturnValue(fakeAnim);
  try {
    const { getByTestId, rerender } = renderDark(
      <ModeSwitcherPill items={items} currentIndex={1} onSelect={jest.fn()} />
    );
    fireEvent(getByTestId('mode-switcher-wrap'), 'layout', {
      nativeEvent: { layout: { width: 300, height: 40 } },
    });
    timingSpy.mockClear();
    rerender(
      <ModeSwitcherPill items={items} currentIndex={2} onSelect={jest.fn()} />
    );
    expect(timingSpy).toHaveBeenCalledTimes(1);
  } finally {
    timingSpy.mockRestore();
  }
});

it('single item shows a plain static label (no switcher), 不可切换', () => {
  const onSelect = jest.fn();
  const { queryByTestId, getByText } = renderDark(
    <ModeSwitcherPill
      items={[{ key: 'single', label: '单拍' }]}
      currentIndex={0}
      onSelect={onSelect}
    />
  );
  // 单一模式不渲染可切换药丸(无 mode-pill-* testID),只读朴素静态标签(不强化)。
  expect(queryByTestId('mode-pill-0')).toBeNull();
  expect(getByText('单拍')).toBeTruthy();
});

it('disabled 时所有 mode pill 都不会触发 onSelect', () => {
  const onSelect = jest.fn();
  const { getByTestId } = renderDark(
    <ModeSwitcherPill
      items={items}
      currentIndex={0}
      disabled
      onSelect={onSelect}
    />
  );
  fireEvent.press(getByTestId('mode-pill-1'));
  expect(onSelect).not.toHaveBeenCalled();
});

it('每个可切换模式暴露 button role、中文 label 与 selected state', () => {
  const { getByRole } = renderDark(
    <ModeSwitcherPill items={items} currentIndex={1} onSelect={() => {}} />
  );
  expect(
    getByRole('button', {
      name: '连拍模式',
      selected: false,
      disabled: false,
    })
  ).toBeTruthy();
  expect(
    getByRole('button', {
      name: '单拍模式',
      selected: true,
      disabled: false,
    })
  ).toBeTruthy();
});

it('模式 capability 同时驱动 native disabled 与 accessibility disabled', () => {
  const { getByRole } = renderDark(
    <ModeSwitcherPill
      items={items}
      currentIndex={0}
      disabled
      onSelect={() => {}}
    />
  );
  expect(
    getByRole('button', {
      name: '视频模式',
      selected: false,
      disabled: true,
    })
  ).toBeTruthy();
});

it('an empty mode collection exposes no selectable action after layout', () => {
  const onSelect = jest.fn();
  const view = renderDark(
    <ModeSwitcherPill items={[]} currentIndex={0} onSelect={onSelect} />
  );
  fireEvent(view.getByTestId('mode-switcher-wrap'), 'layout', {
    nativeEvent: { layout: { width: 300, height: 40 } },
  });
  expect(view.queryAllByRole('button')).toHaveLength(0);
  expect(onSelect).not.toHaveBeenCalled();
});

it.each([
  { nativeGlass: false, currentIndex: 0, translateX: 0 },
  { nativeGlass: false, currentIndex: 1, translateX: 100 },
  { nativeGlass: true, currentIndex: 0, translateX: 0 },
  { nativeGlass: true, currentIndex: 1, translateX: 100 },
])(
  '模式 $currentIndex 的选中块在 nativeGlass=$nativeGlass 时保留对应边距',
  async ({ nativeGlass, currentIndex, translateX }) => {
    const supported = jest.replaceProperty(
      LiquidGlass as { isLiquidGlassSupported: boolean },
      'isLiquidGlassSupported',
      nativeGlass
    );
    try {
      const view = renderDark(
        <ModeSwitcherPill
          items={items.slice(0, 2)}
          currentIndex={currentIndex}
          onSelect={jest.fn()}
        />
      );
      await act(async () => {
        fireEvent(view.getByTestId('mode-switcher-wrap'), 'layout', {
          nativeEvent: { layout: { width: 200, height: 40 } },
        });
      });
      const sliderNode = view
        .UNSAFE_getAllByType(Animated.View)
        .find(
          (node) => StyleSheet.flatten(node.props.style).position === 'absolute'
        );
      const slider = StyleSheet.flatten(sliderNode!.props.style);
      const inset = nativeGlass ? 0 : slider.top;
      expect(slider.top).toBeGreaterThan(0);
      expect(slider.bottom).toBe(slider.top);
      expect(slider.left).toBe(inset);
      expect(slider.width + inset * 2).toBe(100);
      expect(slider.transform[0].translateX.__getValue()).toBe(translateX);
    } finally {
      supported.restore();
    }
  }
);
