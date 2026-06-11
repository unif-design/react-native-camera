import { Camera } from '../../camera/Camera';
import type { CameraMode } from '../../utils';
import { renderDark } from '../__helpers__/renderDark';
import { makeDeviceStub } from '../__helpers__/visionCameraMock';

// 定格帧:烧水印期间 Container 透传 frozenUri,Camera 在取景框内盖刚拍原图防黑屏。
// 直接渲染 <Camera>(绕过 Container),isActive=false 对齐烧水印时停取景。
const singleMode: CameraMode = { mode: 'single' };

function renderCamera(frozenUri?: string) {
  return renderDark(
    <Camera
      device={makeDeviceStub() as never}
      currentMode={singleMode}
      isActive={false}
      frozenUri={frozenUri}
    />
  );
}

it('frozenUri 非空 → 取景框内渲染定格 Image(cover)', () => {
  const { getByTestId } = renderCamera('file:///tmp/p1.jpg');
  const img = getByTestId('frozen-frame');
  expect(img.props.source).toEqual({ uri: 'file:///tmp/p1.jpg' });
  expect(img.props.resizeMode).toBe('cover');
});

it('frozenUri 为空 → 不渲染定格 Image', () => {
  const { queryByTestId } = renderCamera(undefined);
  expect(queryByTestId('frozen-frame')).toBeNull();
});
