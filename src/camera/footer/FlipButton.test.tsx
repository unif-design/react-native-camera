import { render, fireEvent } from '@testing-library/react-native';
import { FlipButton } from './FlipButton';

it('fires onFlip', () => {
  const onFlip = jest.fn();
  const { getByTestId } = render(<FlipButton onFlip={onFlip} />);
  fireEvent.press(getByTestId('flip-btn'));
  expect(onFlip).toHaveBeenCalled();
});
