import type { ReactElement } from 'react';
import { useState } from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { PreviewOverlay } from '../../../camera/preview/PreviewOverlay';
import { CameraDialogProvider } from '../../../camera/ui/CameraDialogHost';
import type { CustomPhotoFile } from '../../../utils';

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

it('gallery 无完成按钮(保存统一走相机界面)', () => {
  const { queryByTestId } = renderPreview(
    <PreviewOverlay
      files={[f('single', 'a'), f('single', 'b')]}
      variant="gallery"
      {...noop}
    />
  );
  expect(queryByTestId('complete-btn')).toBeNull();
});

// 多张预览删除后停留页计数正确(#3 黑图的数据层根因:删除后 index 与 total 不能错位)。
// 用受控父级复刻 Container 的 onDelete(files.filter),验证删当前张后 total 更新、index 不越界。
// 注:RNCarousel 在 jest 下 mock 成 View(不触发 onSnapToItem),index 维持 0,故此处覆盖
// 「删首张后 current 命中正确剩余项 + 计数 1/2」;index 越界 clamp 分支由 PreviewOverlay 的
// useEffect 兜底(见组件),真机滑到末张再删时生效。
it('gallery 删当前张:total 随之减少,onDelete 命中当前文件', async () => {
  const deleted: string[] = [];
  function Harness() {
    const [files, setFiles] = useState<CustomPhotoFile[]>([
      f('single', 'a'),
      f('single', 'b'),
      f('single', 'c'),
    ]);
    return (
      <PreviewOverlay
        files={files}
        variant="gallery"
        {...noop}
        onDelete={(file) => {
          deleted.push(file.id);
          // 复刻 Container.onDelete:filter 掉被删项(身份相等)。
          setFiles((prev) => prev.filter((x) => x !== file));
        }}
      />
    );
  }
  const { getByTestId } = renderPreview(<Harness />);

  // 初始 3 张,停在第 1 张(index 0)。
  expect(getByTestId('preview-counter')).toHaveTextContent('第 1/3 张');

  // 删当前张 → 弹确认 → 点确认 OK。confirm() 是 Promise(OK 后 resolve),
  // onDelete 在其 then 续体里跑,故需 await 结算后再断言。
  fireEvent.press(getByTestId('delete-btn'));
  fireEvent.press(getByTestId('camera-confirm-ok'));

  // onDelete 命中当前文件(index 0 → 'a');删后剩 2 张,计数变 1/2(非 1/3 残值,非越界)。
  await waitFor(() => expect(deleted).toEqual(['a']));
  expect(getByTestId('preview-counter')).toHaveTextContent('第 1/2 张');
});
