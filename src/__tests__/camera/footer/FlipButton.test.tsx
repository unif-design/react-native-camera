import { fireEvent } from '@testing-library/react-native';
import { renderDark } from '../../__helpers__/renderDark';
import { FlipButton } from '../../../camera/footer/FlipButton';
import { VIEWFINDER } from '../../../camera/colors/viewfinder';

// 相机 Modal 强制 dark,FlipButton 用 useColors —— renderDark 包 dark Provider 对齐运行时。
it('fires onFlip', () => {
  const onFlip = jest.fn();
  const { getByTestId } = renderDark(<FlipButton onFlip={onFlip} />);
  fireEvent.press(getByTestId('flip-btn'));
  expect(onFlip).toHaveBeenCalled();
});

it('背景用 VIEWFINDER.glassPill(半透明黑,浮在明亮取景画面上可见;非 design 主题白 glass)', () => {
  const { getByTestId } = renderDark(<FlipButton onFlip={() => {}} />);
  expect(getByTestId('flip-btn')).toHaveStyle({
    backgroundColor: VIEWFINDER.glassPill,
  });
});

it('icon-only 按钮有可访问标签', () => {
  const { getByTestId } = renderDark(<FlipButton onFlip={() => {}} />);
  expect(getByTestId('flip-btn').props.accessibilityLabel).toBe(
    '切换前后摄像头'
  );
});
