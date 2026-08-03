import { fireEvent } from '@testing-library/react-native';
import { renderDark } from '../../__helpers__/renderDark';
import { SideRail } from '../../../camera/setup/SideRail';

const base = {
  flash: 'off' as const,
  aspectRatio: '4:3' as const,
  sound: true,
  onChangeFlash: jest.fn(),
  onChangeAspectRatio: jest.fn(),
  onToggleSound: jest.fn(),
};

// 相机 Modal 强制 dark,SideRail 用 useColors/useThemedStyles —— renderDark 用 RTL wrapper 包 dark
// Provider,rerender 自动保持同一 wrapper,故下面 rerender 直接传组件即可(无需手动重包)。

it('toggles aspect / sound', () => {
  const p = {
    ...base,
    onChangeAspectRatio: jest.fn(),
    onToggleSound: jest.fn(),
  };
  const { getByTestId } = renderDark(<SideRail {...p} />);
  fireEvent.press(getByTestId('aspect-btn'));
  expect(p.onChangeAspectRatio).toHaveBeenCalledWith('16:9');
  fireEvent.press(getByTestId('sound-btn'));
  expect(p.onToggleSound).toHaveBeenCalled();
});

it('aspect button shows current ratio as text and toggles', () => {
  const p = { ...base, onChangeAspectRatio: jest.fn() };
  const { getByTestId, getByText, rerender } = renderDark(
    <SideRail {...p} aspectRatio="4:3" />
  );
  expect(getByText('4:3')).toBeTruthy();
  fireEvent.press(getByTestId('aspect-btn'));
  expect(p.onChangeAspectRatio).toHaveBeenCalledWith('16:9');

  rerender(<SideRail {...p} aspectRatio="16:9" />);
  expect(getByText('16:9')).toBeTruthy();
});

// 闪光改为原地三态轮换(auto → on → off → auto),无弹出层:点一下回传下一态。
it('flash button cycles auto → on → off → auto in place', () => {
  const onChangeFlash = jest.fn();
  const { getByTestId, rerender } = renderDark(
    <SideRail {...base} flash="off" onChangeFlash={onChangeFlash} />
  );
  fireEvent.press(getByTestId('flash-btn'));
  expect(onChangeFlash).toHaveBeenLastCalledWith('auto');

  rerender(<SideRail {...base} flash="auto" onChangeFlash={onChangeFlash} />);
  fireEvent.press(getByTestId('flash-btn'));
  expect(onChangeFlash).toHaveBeenLastCalledWith('on');

  rerender(<SideRail {...base} flash="on" onChangeFlash={onChangeFlash} />);
  fireEvent.press(getByTestId('flash-btn'));
  expect(onChangeFlash).toHaveBeenLastCalledWith('off');
});

it('闪光弹出层已移除(无 flash-opt / flash-tail)', () => {
  const { getByTestId, queryByTestId } = renderDark(
    <SideRail {...base} flash="auto" />
  );
  fireEvent.press(getByTestId('flash-btn'));
  expect(queryByTestId('flash-tail')).toBeNull();
  expect(queryByTestId('flash-opt-on')).toBeNull();
});

it('disabled 时 aspect / flash / sound 都不会触发 handler', () => {
  const onChangeAspectRatio = jest.fn();
  const onChangeFlash = jest.fn();
  const onToggleSound = jest.fn();
  const { getByTestId } = renderDark(
    <SideRail
      {...base}
      disabled
      onChangeAspectRatio={onChangeAspectRatio}
      onChangeFlash={onChangeFlash}
      onToggleSound={onToggleSound}
    />
  );

  fireEvent.press(getByTestId('aspect-btn'));
  fireEvent.press(getByTestId('flash-btn'));
  fireEvent.press(getByTestId('sound-btn'));

  expect(onChangeAspectRatio).not.toHaveBeenCalled();
  expect(onChangeFlash).not.toHaveBeenCalled();
  expect(onToggleSound).not.toHaveBeenCalled();
});

it('画幅、闪光与声音按钮暴露动态中文 label 和 button role', () => {
  const { getByRole } = renderDark(
    <SideRail {...base} flash="auto" aspectRatio="16:9" sound />
  );
  expect(
    getByRole('button', {
      name: '切换画幅比例，当前 16:9',
      disabled: false,
    })
  ).toBeTruthy();
  expect(
    getByRole('button', {
      name: '切换闪光灯，当前自动',
      disabled: false,
    })
  ).toBeTruthy();
  expect(
    getByRole('button', {
      name: '关闭快门声音',
      disabled: false,
    })
  ).toBeTruthy();
});

it('SideRail capability 同时驱动 native 与 accessibility disabled', () => {
  const { getByRole } = renderDark(<SideRail {...base} disabled />);
  expect(
    getByRole('button', {
      name: '切换画幅比例，当前 4:3',
      disabled: true,
    })
  ).toBeTruthy();
  expect(
    getByRole('button', {
      name: '切换闪光灯，当前关闭',
      disabled: true,
    })
  ).toBeTruthy();
  expect(
    getByRole('button', {
      name: '关闭快门声音',
      disabled: true,
    })
  ).toBeTruthy();
});
