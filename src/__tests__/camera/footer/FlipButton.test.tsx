import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { FlipButton } from '../../../camera/footer/FlipButton';

// 相机 Modal 强制 dark,FlipButton 用 useColors/useThemedStyles —— 包 dark Provider 对齐运行时。
it('fires onFlip', () => {
  const onFlip = jest.fn();
  const { getByTestId } = render(
    <ThemeProvider forceScheme="dark">
      <FlipButton onFlip={onFlip} />
    </ThemeProvider>
  );
  fireEvent.press(getByTestId('flip-btn'));
  expect(onFlip).toHaveBeenCalled();
});
