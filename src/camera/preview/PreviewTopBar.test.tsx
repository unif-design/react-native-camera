import type { ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { PreviewTopBar } from './PreviewTopBar';
import type { CustomPhotoFile } from '../../utils';

// 相机 Modal 强制 dark,PreviewTopBar 用 useThemedStyles —— 包 dark Provider 对齐运行时。
const r = (ui: ReactElement) =>
  render(<ThemeProvider forceScheme="dark">{ui}</ThemeProvider>);

const f = (
  cameraMode: CustomPhotoFile['cameraMode'],
  id: string
): CustomPhotoFile => ({
  id,
  cameraType: 'back',
  cameraMode,
  path: `/${id}`,
  uri: `file:///${id}`,
  width: 1,
  height: 1,
  mime: cameraMode === 'video' ? 'video/mp4' : 'image/jpeg',
  mode: cameraMode,
});

it('confirm 变体显示类型 label', () => {
  const { getByText } = r(
    <PreviewTopBar
      variant="confirm"
      files={[f('single', 'a')]}
      activeType="single"
      onSelectType={() => {}}
    />
  );
  expect(getByText('单拍')).toBeTruthy();
});

it('gallery 多类型显示 tab,点 tab 回调', () => {
  const onSelectType = jest.fn();
  const files = [f('continuous', 'a'), f('continuous', 'b'), f('single', 'c')];
  const { getByTestId } = r(
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
