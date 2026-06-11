import { fireEvent } from '@testing-library/react-native';
import { renderDark } from '../../__helpers__/renderDark';
import { ActionRow } from '../../../camera/footer/ActionRow';

const base = {
  mode: 'single' as const,
  recording: false,
  count: 0,
  onShutter: jest.fn(),
  onFlip: jest.fn(),
  onOpenPreview: jest.fn(),
};

// ActionRow 组合 Shutter/FlipButton/ThumbnailStack(均用 useThemedStyles)—— renderDark 包 dark Provider。

test('取景底部只有 缩略图|快门|翻转,无返回/保存', () => {
  const { getByTestId, queryByTestId } = renderDark(<ActionRow {...base} />);
  expect(getByTestId('thumbnail-stack')).toBeTruthy();
  expect(getByTestId('shutter-btn')).toBeTruthy();
  expect(getByTestId('flip-btn')).toBeTruthy();
  expect(queryByTestId('back-btn')).toBeNull();
  expect(queryByTestId('save-btn')).toBeNull();
});

test('点快门触发 onShutter', () => {
  const onShutter = jest.fn();
  const { getByTestId } = renderDark(
    <ActionRow {...base} onShutter={onShutter} />
  );
  fireEvent.press(getByTestId('shutter-btn'));
  expect(onShutter).toHaveBeenCalled();
});

test('录制中隐藏缩略图与翻转,仅留快门', () => {
  const { getByTestId, queryByTestId } = renderDark(
    <ActionRow {...base} mode="video" recording={true} />
  );
  expect(getByTestId('shutter-btn')).toBeTruthy();
  expect(queryByTestId('thumbnail-stack')).toBeNull();
  expect(queryByTestId('flip-btn')).toBeNull();
});
