import { render } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { RecordingTimer, formatDuration } from './RecordingTimer';

it('formatDuration → MM:SS', () => {
  expect(formatDuration(0)).toBe('00:00');
  expect(formatDuration(65)).toBe('01:05');
  expect(formatDuration(3661)).toBe('61:01');
  expect(formatDuration(-5)).toBe('00:00');
});

// 相机 Modal 强制 dark,RecordingTimer 用 useThemedStyles —— 包 dark Provider 对齐运行时。
it('renders timer pill', () => {
  const { getByTestId } = render(
    <ThemeProvider forceScheme="dark">
      <RecordingTimer seconds={5} />
    </ThemeProvider>
  );
  expect(getByTestId('recording-timer')).toBeTruthy();
});
