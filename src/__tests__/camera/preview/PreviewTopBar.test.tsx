import { fireEvent } from '@testing-library/react-native';
import { PreviewTopBar } from '../../../camera/preview/PreviewTopBar';
import type { CustomPhotoFile } from '../../../utils';
import { renderDark } from '../../__helpers__/renderDark';
import { makePhotoFile } from '../../__helpers__/factories';

// 相机 Modal 强制 dark,PreviewTopBar 用 useThemedStyles —— renderDark 包 dark Provider 对齐运行时。

const f = (cameraMode: CustomPhotoFile['cameraMode'], id: string) =>
  makePhotoFile({
    id,
    mode: cameraMode,
    path: `/${id}`,
    uri: `file:///${id}`,
  });

it('confirm 变体不显示类型分类(未保留不分类)', () => {
  const { queryByText, queryByTestId } = renderDark(
    <PreviewTopBar
      variant="confirm"
      files={[f('single', 'a')]}
      activeType="single"
      onSelectType={() => {}}
    />
  );
  // 未保留(confirm)顶部不显示类型标签,也不显示任何类型 tab。
  expect(queryByText('单拍')).toBeNull();
  expect(queryByTestId('type-tab-single')).toBeNull();
});

it('gallery 单一类型也显示该类型 tab', () => {
  const { getByTestId } = renderDark(
    <PreviewTopBar
      variant="gallery"
      files={[f('single', 'a'), f('single', 'b')]}
      activeType="single"
      onSelectType={() => {}}
    />
  );
  // 保留(gallery)只要有类型就显示 tab —— 只拍单拍也显示「单拍」tab。
  expect(getByTestId('type-tab-single')).toBeTruthy();
});

it('gallery 多类型显示 tab,点 tab 回调', () => {
  const onSelectType = jest.fn();
  const files = [f('continuous', 'a'), f('continuous', 'b'), f('single', 'c')];
  const { getByTestId } = renderDark(
    <PreviewTopBar
      variant="gallery"
      files={files}
      activeType="continuous"
      onSelectType={onSelectType}
    />
  );
  fireEvent.press(getByTestId('type-tab-single'));
  expect(onSelectType).toHaveBeenCalledWith('single');
});
