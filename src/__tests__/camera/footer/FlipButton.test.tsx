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

it('切换按钮使用不拦截触摸的暗色玻璃背景', () => {
  const { getByTestId } = renderDark(<FlipButton onFlip={() => {}} />);
  const glass = getByTestId('flip-glass', { includeHiddenElements: true });
  expect(glass.props.tintColor).toBe(VIEWFINDER.glassPill);
  expect(glass.props.pointerEvents).toBe('none');
  expect(glass).toHaveStyle({ backgroundColor: VIEWFINDER.glassPill });
});

it('icon-only 按钮有可访问标签', () => {
  const { getByTestId } = renderDark(<FlipButton onFlip={() => {}} />);
  expect(getByTestId('flip-btn').props.accessibilityLabel).toBe(
    '切换前后摄像头'
  );
});

it('disabled 时不会触发 onFlip', () => {
  const onFlip = jest.fn();
  const { getByRole, getByTestId } = renderDark(
    <FlipButton disabled onFlip={onFlip} />
  );
  expect(
    getByRole('button', {
      name: '切换前后摄像头',
      disabled: true,
    })
  ).toBeTruthy();
  fireEvent.press(getByTestId('flip-btn'));
  expect(onFlip).not.toHaveBeenCalled();
});
