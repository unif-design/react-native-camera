import type { ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { PreviewOverlay } from './PreviewOverlay';
import { CameraDialogProvider } from '../ui/CameraDialogHost';
import type { CustomPhotoFile } from '../../utils';

// PreviewOverlay 现用 useCameraDialog()(本地 confirm/toast),渲染必须包
// CameraDialogProvider(+ design ThemeProvider 提供 useColors),否则 hook 抛错。
// forceScheme="dark" 对齐相机 Modal 运行时(强制深色)。
const renderPreview = (ui: ReactElement) =>
  render(
    <ThemeProvider forceScheme="dark">
      <CameraDialogProvider>{ui}</CameraDialogProvider>
    </ThemeProvider>
  );

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

const noop = {
  onRetake: () => {},
  onSave: () => {},
  onBack: () => {},
  onDelete: () => {},
  onComplete: () => {},
};

it('confirm 变体: 重拍/保存 在', () => {
  const { getByTestId } = renderPreview(
    <PreviewOverlay files={[f('single', 'a')]} variant="confirm" {...noop} />
  );
  expect(getByTestId('retake-btn')).toBeTruthy();
  expect(getByTestId('save-btn')).toBeTruthy();
});

it('gallery 变体: 返回/删除 在', () => {
  const { getByTestId } = renderPreview(
    <PreviewOverlay
      files={[f('single', 'a'), f('single', 'b')]}
      variant="gallery"
      {...noop}
    />
  );
  expect(getByTestId('back-btn')).toBeTruthy();
  expect(getByTestId('delete-btn')).toBeTruthy();
});

it('gallery 完成按钮触发 onComplete', () => {
  const onComplete = jest.fn();
  const { getByTestId } = renderPreview(
    <PreviewOverlay
      files={[f('single', 'a'), f('single', 'b')]}
      variant="gallery"
      {...noop}
      onComplete={onComplete}
    />
  );
  fireEvent.press(getByTestId('complete-btn'));
  expect(onComplete).toHaveBeenCalledTimes(1);
});
