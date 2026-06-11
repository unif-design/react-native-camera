import { fireEvent } from '@testing-library/react-native';
import { renderDark } from '../../__helpers__/renderDark';
import { FlipButton } from '../../../camera/footer/FlipButton';

// 相机 Modal 强制 dark,FlipButton 用 useColors/useThemedStyles —— renderDark 包 dark Provider 对齐运行时。
it('fires onFlip', () => {
  const onFlip = jest.fn();
  const { getByTestId } = renderDark(<FlipButton onFlip={onFlip} />);
  fireEvent.press(getByTestId('flip-btn'));
  expect(onFlip).toHaveBeenCalled();
});
