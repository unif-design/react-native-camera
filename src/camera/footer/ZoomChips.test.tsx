import { render, fireEvent } from '@testing-library/react-native';
import { ZoomChips } from './ZoomChips';

it('renders 3 chips and selects', () => {
  const onSelect = jest.fn();
  const { getByTestId } = render(<ZoomChips zoom={1} onSelect={onSelect} />);
  fireEvent.press(getByTestId('zoom-chip-2'));
  expect(onSelect).toHaveBeenCalledWith(2);
});
