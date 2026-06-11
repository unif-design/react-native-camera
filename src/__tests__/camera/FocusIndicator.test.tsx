import { renderDark } from '../__helpers__/renderDark';
import { FocusIndicator } from '../../camera/FocusIndicator';

// 相机 Modal 强制 dark,FocusIndicator 用 useColors() —— renderDark 包 dark Provider 对齐运行时。

it('renders focus brackets without crashing', () => {
  expect(() =>
    renderDark(
      <FocusIndicator point={{ x: 100, y: 200 }} onAnimationEnd={() => {}} />
    )
  ).not.toThrow();
});

it('exposes the focus-indicator testID', () => {
  const { getByTestId } = renderDark(
    <FocusIndicator point={{ x: 100, y: 200 }} onAnimationEnd={() => {}} />
  );
  expect(getByTestId('focus-indicator')).toBeTruthy();
});
