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

it('single item shows label only (no pill)', () => {
  const { queryByTestId, getByText } = r(
    <ModeSwitcherPill
      items={[{ key: 'single', label: '单拍' }]}
      currentIndex={0}
      onSelect={() => {}}
    />
  );
  expect(queryByTestId('mode-pill-0')).toBeNull();
  expect(getByText('单拍')).toBeTruthy();
});
