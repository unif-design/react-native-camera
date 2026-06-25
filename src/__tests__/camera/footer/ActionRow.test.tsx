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

test('已拍照(有 latestUri):底部为 缩略图|快门|翻转,无返回/保存', () => {
  const { getByTestId, queryByTestId } = renderDark(
    <ActionRow {...base} latestUri="file:///a.jpg" count={1} />
  );
  expect(getByTestId('thumbnail-stack')).toBeTruthy();
  expect(getByTestId('shutter-btn')).toBeTruthy();
  expect(getByTestId('flip-btn')).toBeTruthy();
  expect(queryByTestId('back-btn')).toBeNull();
  expect(queryByTestId('save-btn')).toBeNull();
});

test('拍照前(无 latestUri):左下角为惰性占位、不渲染可点缩略图(消除空框 + 死按钮)', () => {
  const { queryByTestId, getByTestId } = renderDark(<ActionRow {...base} />);
  expect(queryByTestId('thumbnail-stack')).toBeNull();
  // 快门 / 翻转仍在
  expect(getByTestId('shutter-btn')).toBeTruthy();
  expect(getByTestId('flip-btn')).toBeTruthy();
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
