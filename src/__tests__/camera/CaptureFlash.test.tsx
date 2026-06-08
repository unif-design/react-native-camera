import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { CaptureFlash } from '../../camera/CaptureFlash';

// 相机 Modal 强制 dark,CaptureFlash 用 useColors() —— 测试包 dark Provider 对齐运行时。
const r = (ui: ReactElement) =>
  render(<ThemeProvider forceScheme="dark">{ui}</ThemeProvider>);

it('renders overlay', () => {
  const { getByTestId } = r(<CaptureFlash trigger={1} />);
  expect(getByTestId('capture-flash')).toBeTruthy();
});

it('does not crash when trigger is 0', () => {
  expect(() => r(<CaptureFlash trigger={0} />)).not.toThrow();
});
