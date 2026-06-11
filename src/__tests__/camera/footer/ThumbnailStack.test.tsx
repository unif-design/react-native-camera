import { fireEvent } from '@testing-library/react-native';
import { renderDark } from '../../__helpers__/renderDark';
import { ThumbnailStack } from '../../../camera/footer/ThumbnailStack';

// 相机 Modal 强制 dark,ThumbnailStack 用 useThemedStyles —— renderDark 包 dark Provider 对齐运行时。

it('empty state, no badge, tappable', () => {
  const onPress = jest.fn();
  const { getByTestId, queryByTestId } = renderDark(
    <ThumbnailStack latestUri={undefined} count={0} onPress={onPress} />
  );
  fireEvent.press(getByTestId('thumbnail-stack'));
  expect(onPress).toHaveBeenCalled();
  expect(queryByTestId('thumb-badge')).toBeNull();
});

it('shows badge when count > 1', () => {
  const { getByTestId } = renderDark(
    <ThumbnailStack latestUri="file:///a.jpg" count={3} onPress={() => {}} />
  );
  expect(getByTestId('thumb-badge')).toBeTruthy();
});
