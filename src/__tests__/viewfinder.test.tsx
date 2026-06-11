import { fireEvent } from '@testing-library/react-native';
import { renderDark } from './__helpers__/renderDark';
import { ModeSwitcherPill } from '../camera/footer/ModeSwitcherPill';
import { ActionRow } from '../camera/footer/ActionRow';

// 取景态库侧渲染守护(替代旧 footer.test.tsx 的 Footer 多模式锁)。
// ModeSwitcherPill / ActionRow 的交互按钮是自有 TouchableOpacity/Pressable
// (testID 非 design 组件),passthrough mock 不经过它们,一定渲染 ——
// 这也是本仓既有的降级断言模式。
// 二者用 useThemedStyles,相机 Modal 强制 dark —— renderDark 包 dark Provider 对齐运行时。

const items = [
  { key: 'continuous-0', label: '连拍' },
  { key: 'single-1', label: '单拍' },
  { key: 'video-2', label: '视频' },
];

it('ModeSwitcherPill renders a switcher for multi-mode and selects by tap', () => {
  const onSelect = jest.fn();
  const { getByTestId } = renderDark(
    <ModeSwitcherPill items={items} currentIndex={1} onSelect={onSelect} />
  );
  // 多模式 → 每项一个可点 pill(length>1,不退化为单 label)
  expect(getByTestId('mode-pill-0')).toBeTruthy();
  expect(getByTestId('mode-pill-2')).toBeTruthy();
  fireEvent.press(getByTestId('mode-pill-2'));
  expect(onSelect).toHaveBeenCalledWith(2);
});

it('ModeSwitcherPill collapses to a single label for single mode', () => {
  const { queryByTestId, getByText } = renderDark(
    <ModeSwitcherPill
      items={[{ key: 'single-0', label: '单拍' }]}
      currentIndex={0}
      onSelect={() => {}}
    />
  );
  expect(queryByTestId('mode-pill-0')).toBeNull();
  expect(getByText('单拍')).toBeTruthy();
});

const actionBase = {
  mode: 'single' as const,
  recording: false,
  latestUri: undefined,
  count: 0,
  onShutter: jest.fn(),
  onFlip: jest.fn(),
  onOpenPreview: jest.fn(),
};

it('ActionRow shows thumb/shutter/flip when idle (no back/save)', () => {
  const { getByTestId, queryByTestId } = renderDark(
    <ActionRow {...actionBase} count={2} />
  );
  expect(getByTestId('thumbnail-stack')).toBeTruthy();
  expect(getByTestId('shutter-btn')).toBeTruthy();
  expect(getByTestId('flip-btn')).toBeTruthy();
  expect(queryByTestId('back-btn')).toBeNull();
  expect(queryByTestId('save-btn')).toBeNull();
});

it('ActionRow hides thumb/flip while recording, keeps shutter', () => {
  const { queryByTestId, getByTestId } = renderDark(
    <ActionRow {...actionBase} recording />
  );
  expect(getByTestId('shutter-btn')).toBeTruthy();
  expect(queryByTestId('flip-btn')).toBeNull();
  expect(queryByTestId('thumbnail-stack')).toBeNull();
});
