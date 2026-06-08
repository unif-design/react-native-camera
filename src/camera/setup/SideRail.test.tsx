import type { ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { SideRail } from './SideRail';

const base = {
  flash: 'off' as const,
  aspectRatio: '4:3' as const,
  sound: true,
  onChangeFlash: jest.fn(),
  onChangeAspectRatio: jest.fn(),
  onToggleSound: jest.fn(),
};

// 相机 Modal 强制 dark,SideRail 用 useColors/useThemedStyles —— 包 dark Provider 对齐运行时。
const r = (ui: ReactElement) =>
  render(<ThemeProvider forceScheme="dark">{ui}</ThemeProvider>);

it('toggles aspect / sound', () => {
  const p = {
    ...base,
    onChangeAspectRatio: jest.fn(),
    onToggleSound: jest.fn(),
  };
  const { getByTestId } = r(<SideRail {...p} />);
  fireEvent.press(getByTestId('aspect-btn'));
  expect(p.onChangeAspectRatio).toHaveBeenCalledWith('16:9');
  fireEvent.press(getByTestId('sound-btn'));
  expect(p.onToggleSound).toHaveBeenCalled();
});

it('aspect button shows current ratio as text and toggles', () => {
  const p = { ...base, onChangeAspectRatio: jest.fn() };
  const { getByTestId, getByText, rerender } = r(
    <SideRail {...p} aspectRatio="4:3" />
  );
  expect(getByText('4:3')).toBeTruthy();
  fireEvent.press(getByTestId('aspect-btn'));
  expect(p.onChangeAspectRatio).toHaveBeenCalledWith('16:9');

  rerender(
    <ThemeProvider forceScheme="dark">
      <SideRail {...p} aspectRatio="16:9" />
    </ThemeProvider>
  );
  expect(getByText('16:9')).toBeTruthy();
});

it('flash dropdown selects a mode', () => {
  const p = { ...base, onChangeFlash: jest.fn() };
  const { getByTestId } = r(<SideRail {...p} />);
  fireEvent.press(getByTestId('flash-btn'));
  fireEvent.press(getByTestId('flash-opt-on'));
  expect(p.onChangeFlash).toHaveBeenCalledWith('on');
});

it('展开闪光菜单后渲染尾巴三角', () => {
  const { getByTestId, queryByTestId } = r(<SideRail {...base} />);
  expect(queryByTestId('flash-tail')).toBeNull();
  fireEvent.press(getByTestId('flash-btn'));
  expect(getByTestId('flash-tail')).toBeTruthy();
});
