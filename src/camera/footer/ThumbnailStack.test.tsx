import { render, fireEvent } from '@testing-library/react-native';
import { ThumbnailStack } from './ThumbnailStack';

it('empty state, no badge, tappable', () => {
  const onPress = jest.fn();
  const { getByTestId, queryByTestId } = render(
    <ThumbnailStack latestUri={undefined} count={0} onPress={onPress} />
  );
  fireEvent.press(getByTestId('thumbnail-stack'));
  expect(onPress).toHaveBeenCalled();
  expect(queryByTestId('thumb-badge')).toBeNull();
});

it('shows badge when count > 1', () => {
  const { getByTestId } = render(
    <ThumbnailStack latestUri="file:///a.jpg" count={3} onPress={() => {}} />
  );
  expect(getByTestId('thumb-badge')).toBeTruthy();
});
