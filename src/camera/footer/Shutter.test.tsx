import { render, fireEvent } from '@testing-library/react-native';
import { Shutter } from './Shutter';

it('fires onPress and renders for each mode', () => {
  const onPress = jest.fn();
  const { getByTestId, rerender } = render(
    <Shutter mode="single" recording={false} onPress={onPress} />
  );
  fireEvent.press(getByTestId('shutter-btn'));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(() =>
    rerender(<Shutter mode="video" recording={false} onPress={onPress} />)
  ).not.toThrow();
  expect(() =>
    rerender(<Shutter mode="video" recording={true} onPress={onPress} />)
  ).not.toThrow();
});

it('disabled blocks press', () => {
  const onPress = jest.fn();
  const { getByTestId } = render(
    <Shutter mode="single" recording={false} disabled onPress={onPress} />
  );
  fireEvent.press(getByTestId('shutter-btn'));
  expect(onPress).not.toHaveBeenCalled();
});
