import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { FocusIndicator } from './FocusIndicator';

// 相机 Modal 强制 dark,FocusIndicator 用 useColors() —— 测试包 dark Provider 对齐运行时。
const r = (ui: ReactElement) =>
  render(<ThemeProvider forceScheme="dark">{ui}</ThemeProvider>);

it('renders focus brackets without crashing', () => {
  expect(() =>
    r(<FocusIndicator point={{ x: 100, y: 200 }} onAnimationEnd={() => {}} />)
  ).not.toThrow();
});

it('exposes the focus-indicator testID', () => {
  const { getByTestId } = r(
    <FocusIndicator point={{ x: 100, y: 200 }} onAnimationEnd={() => {}} />
  );
  expect(getByTestId('focus-indicator')).toBeTruthy();
});
