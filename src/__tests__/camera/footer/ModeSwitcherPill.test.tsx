import { fireEvent } from '@testing-library/react-native';
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
