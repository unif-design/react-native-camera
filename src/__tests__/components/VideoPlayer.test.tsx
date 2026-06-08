import { render, fireEvent } from '@testing-library/react-native';
import { VideoPlayer } from '../../components/VideoPlayer';

it('renders and toggles play on tap without crashing', () => {
  const { getByTestId } = render(<VideoPlayer uri="file:///v.mp4" />);
  expect(getByTestId('video-player')).toBeTruthy();
  expect(() => fireEvent.press(getByTestId('video-player'))).not.toThrow();
});
