import type { ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { SideRail } from '../../../camera/setup/SideRail';

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

// 闪光改为原地三态轮换(auto → on → off → auto),无弹出层:点一下回传下一态。
it('flash button cycles auto → on → off → auto in place', () => {
  const onChangeFlash = jest.fn();
  const { getByTestId, rerender } = r(
    <SideRail {...base} flash="off" onChangeFlash={onChangeFlash} />
  );
  fireEvent.press(getByTestId('flash-btn'));
  expect(onChangeFlash).toHaveBeenLastCalledWith('auto');

  rerender(
    <ThemeProvider forceScheme="dark">
      <SideRail {...base} flash="auto" onChangeFlash={onChangeFlash} />
    </ThemeProvider>
  );
  fireEvent.press(getByTestId('flash-btn'));
  expect(onChangeFlash).toHaveBeenLastCalledWith('on');

  rerender(
    <ThemeProvider forceScheme="dark">
      <SideRail {...base} flash="on" onChangeFlash={onChangeFlash} />
    </ThemeProvider>
  );
  fireEvent.press(getByTestId('flash-btn'));
  expect(onChangeFlash).toHaveBeenLastCalledWith('off');
});

it('闪光弹出层已移除(无 flash-opt / flash-tail)', () => {
  const { getByTestId, queryByTestId } = r(<SideRail {...base} flash="auto" />);
  fireEvent.press(getByTestId('flash-btn'));
  expect(queryByTestId('flash-tail')).toBeNull();
  expect(queryByTestId('flash-opt-on')).toBeNull();
});
