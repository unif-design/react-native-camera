import { renderDark } from '../../__helpers__/renderDark';
import {
  RecordingTimer,
  formatDuration,
} from '../../../camera/footer/RecordingTimer';

it('formatDuration → MM:SS', () => {
  expect(formatDuration(0)).toBe('00:00');
  expect(formatDuration(65)).toBe('01:05');
  expect(formatDuration(3661)).toBe('61:01');
  expect(formatDuration(-5)).toBe('00:00');
});

// 相机 Modal 强制 dark,RecordingTimer 用 useThemedStyles —— renderDark 包 dark Provider 对齐运行时。
it('renders timer pill', () => {
  const { getByTestId } = renderDark(<RecordingTimer seconds={5} />);
  expect(getByTestId('recording-timer')).toBeTruthy();
});
