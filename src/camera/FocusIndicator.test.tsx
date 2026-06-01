import { render } from '@testing-library/react-native';
import { FocusIndicator } from './FocusIndicator';

it('renders focus brackets without crashing', () => {
  expect(() =>
    render(
      <FocusIndicator point={{ x: 100, y: 200 }} onAnimationEnd={() => {}} />
    )
  ).not.toThrow();
});

it('exposes the focus-indicator testID', () => {
  const { getByTestId } = render(
    <FocusIndicator point={{ x: 100, y: 200 }} onAnimationEnd={() => {}} />
  );
  expect(getByTestId('focus-indicator')).toBeTruthy();
});
