import { fireEvent } from '@testing-library/react-native';
import { renderDark } from '../../__helpers__/renderDark';
import { ThumbnailStack } from '../../../camera/footer/ThumbnailStack';

// 相机 Modal 强制 dark,ThumbnailStack 用 useThemedStyles —— renderDark 包 dark Provider。
// 拍照前的「无照片占位」由 ActionRow 负责(惰性 slot);ThumbnailStack 只在有照片时渲染。

it('有照片:渲染可点缩略图,带可访问标签', () => {
  const { getByTestId } = renderDark(
    <ThumbnailStack latestUri="file:///a.jpg" count={1} onPress={() => {}} />
  );
  expect(getByTestId('thumbnail-stack').props.accessibilityLabel).toBe(
    '查看已拍照片'
  );
});

it('点击触发 onPress(查看预览)', () => {
  const onPress = jest.fn();
  const { getByTestId } = renderDark(
    <ThumbnailStack latestUri="file:///a.jpg" count={1} onPress={onPress} />
  );
  fireEvent.press(getByTestId('thumbnail-stack'));
  expect(onPress).toHaveBeenCalled();
});

it('shows badge when count > 1', () => {
  const { getByTestId } = renderDark(
    <ThumbnailStack latestUri="file:///a.jpg" count={3} onPress={() => {}} />
  );
  expect(getByTestId('thumb-badge')).toBeTruthy();
});
