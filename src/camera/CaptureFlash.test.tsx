import { render } from '@testing-library/react-native';
import { CaptureFlash } from './CaptureFlash';

it('renders overlay', () => {
  const { getByTestId } = render(<CaptureFlash trigger={1} />);
  expect(getByTestId('capture-flash')).toBeTruthy();
});

it('does not crash when trigger is 0', () => {
  expect(() => render(<CaptureFlash trigger={0} />)).not.toThrow();
});
