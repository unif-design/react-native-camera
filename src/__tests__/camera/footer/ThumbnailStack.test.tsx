import type { ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { ThumbnailStack } from '../../../camera/footer/ThumbnailStack';

// 相机 Modal 强制 dark,ThumbnailStack 用 useThemedStyles —— 包 dark Provider 对齐运行时。
const r = (ui: ReactElement) =>
  render(<ThemeProvider forceScheme="dark">{ui}</ThemeProvider>);

it('empty state, no badge, tappable', () => {
  const onPress = jest.fn();
  const { getByTestId, queryByTestId } = r(
    <ThumbnailStack latestUri={undefined} count={0} onPress={onPress} />
  );
  fireEvent.press(getByTestId('thumbnail-stack'));
  expect(onPress).toHaveBeenCalled();
  expect(queryByTestId('thumb-badge')).toBeNull();
});

it('shows badge when count > 1', () => {
  const { getByTestId } = r(
    <ThumbnailStack latestUri="file:///a.jpg" count={3} onPress={() => {}} />
  );
  expect(getByTestId('thumb-badge')).toBeTruthy();
});
