import { render } from '@testing-library/react-native';
import { RecordingTimer, formatDuration } from './RecordingTimer';

it('formatDuration → MM:SS', () => {
  expect(formatDuration(0)).toBe('00:00');
  expect(formatDuration(65)).toBe('01:05');
  expect(formatDuration(3661)).toBe('61:01');
  expect(formatDuration(-5)).toBe('00:00');
});

it('renders timer pill', () => {
  const { getByTestId } = render(<RecordingTimer seconds={5} />);
  expect(getByTestId('recording-timer')).toBeTruthy();
});
