import type { ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { ModeSwitcherPill } from '../../../camera/footer/ModeSwitcherPill';

const items = [
  { key: 'continuous', label: '连拍' },
  { key: 'single', label: '单拍' },
  { key: 'video', label: '视频' },
];

// 相机 Modal 强制 dark,ModeSwitcherPill 用 useThemedStyles —— 包 dark Provider 对齐运行时。
const r = (ui: ReactElement) =>
  render(<ThemeProvider forceScheme="dark">{ui}</ThemeProvider>);

it('selects by tap', () => {
  const onSelect = jest.fn();
  const { getByTestId } = r(
    <ModeSwitcherPill items={items} currentIndex={1} onSelect={onSelect} />
  );
  fireEvent.press(getByTestId('mode-pill-2'));
  expect(onSelect).toHaveBeenCalledWith(2);
});

it('single item shows a strengthened static label (no switcher), 不可切换', () => {
  const onSelect = jest.fn();
  const { queryByTestId, getByText } = r(
    <ModeSwitcherPill
      items={[{ key: 'single', label: '单拍' }]}
      currentIndex={0}
      onSelect={onSelect}
    />
  );
  // 单一模式不渲染可切换药丸(无 mode-pill-* testID),只读静态标签(强化为选中态样式)。
  expect(queryByTestId('mode-pill-0')).toBeNull();
  // 标签文字仍是该模式名(强化是纯样式:橙 tint 胶囊底 + 主色字 + t.body,见 ModeSwitcherPill)。
  expect(getByText('单拍')).toBeTruthy();
});
