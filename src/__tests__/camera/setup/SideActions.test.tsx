import type { ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { SideActions } from '../../../camera/setup/SideActions';

// 相机 Modal 强制 dark,SideActions 用 useColors/useThemedStyles —— 包 dark Provider 对齐运行时。
const r = (ui: ReactElement) =>
  render(<ThemeProvider forceScheme="dark">{ui}</ThemeProvider>);

it('返回按钮触发 onBack', () => {
  const onBack = jest.fn();
  const { getByTestId } = r(
    <SideActions canSave={false} onBack={onBack} onSave={() => {}} />
  );
  fireEvent.press(getByTestId('side-back-btn'));
  expect(onBack).toHaveBeenCalled();
});

it('canSave=false 不渲染保存按钮', () => {
  const { queryByTestId } = r(
    <SideActions canSave={false} onBack={() => {}} onSave={() => {}} />
  );
  expect(queryByTestId('side-save-btn')).toBeNull();
});

it('canSave=true 渲染保存按钮并触发 onSave', () => {
  const onSave = jest.fn();
  const { getByTestId } = r(
    <SideActions canSave onBack={() => {}} onSave={onSave} />
  );
  fireEvent.press(getByTestId('side-save-btn'));
  expect(onSave).toHaveBeenCalled();
});
