import { renderDark } from '../__helpers__/renderDark';
import { CaptureFlash } from '../../camera/CaptureFlash';

// 相机 Modal 强制 dark,CaptureFlash 用 useColors() —— renderDark 包 dark Provider 对齐运行时。

it('renders overlay', () => {
  const { getByTestId } = renderDark(<CaptureFlash trigger={1} />);
  expect(getByTestId('capture-flash')).toBeTruthy();
});

it('does not crash when trigger is 0', () => {
  expect(() => renderDark(<CaptureFlash trigger={0} />)).not.toThrow();
});
