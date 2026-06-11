import type { ReactElement } from 'react';
import { Container } from '../../camera/Container';
import { CameraDialogProvider } from '../../camera/ui/CameraDialogHost';
import { renderDark } from '../__helpers__/renderDark';
import { useCaptureFlow } from '../../camera/hooks/useCaptureFlow';
import type { CaptureFlow } from '../../camera/hooks/useCaptureFlow';
import type { WatermarkType } from '../../utils';

// device-ready 需:已授权 + 有设备(覆盖全局 vision-camera mock)。
jest.mock('react-native-vision-camera', () => {
  const vc = require('../__helpers__/visionCameraMock');
  return vc.makeVisionCameraMock({
    ...vc.grantedPermissionOverrides(),
    useCameraDevice: (position: 'back' | 'front') =>
      vc.makeDeviceStub({ position }),
  });
});

// 触发真实 burning 需经快门→capture→挂起烧录(集成成本高且脆弱);改为 mock useCaptureFlow
// 注入受控 burning/freezeUri,精确验证 Container 渲染接线(footer 不替换 + 覆盖层 + 透传)。
jest.mock('../../camera/hooks/useCaptureFlow', () => ({
  useCaptureFlow: jest.fn(),
}));
const useCaptureFlowMock = jest.mocked(useCaptureFlow);

function makeFlow(overrides: Partial<CaptureFlow> = {}): CaptureFlow {
  return {
    photos: [],
    previewing: false,
    previewVariant: 'gallery',
    openGallery: jest.fn(),
    retake: jest.fn(),
    deletePhoto: jest.fn(),
    closePreview: jest.fn(),
    flashNonce: 0,
    burning: false,
    capturing: false,
    recording: false,
    recSeconds: 0,
    onShutter: jest.fn(),
    onVideoAutoFinished: jest.fn(),
    handleSave: jest.fn(),
    handleCancel: jest.fn(),
    onSelectMode: jest.fn(),
    freezeUri: null,
    ...overrides,
  };
}

function renderContainer(
  flow: CaptureFlow,
  opts: { watermark?: WatermarkType } = {}
) {
  useCaptureFlowMock.mockReturnValue(flow);
  // 多模式 config → 渲染可切换药丸(有 mode-switcher-wrap),便于断言「footer 没被替换」。
  const ui: ReactElement = (
    <CameraDialogProvider>
      <Container
        config={{
          dataRetainedMode: 'retain',
          cameraMode: [
            { mode: 'single', type: 'back' },
            { mode: 'continuous' },
          ],
          ...(opts.watermark ? { watermark: opts.watermark } : {}),
        }}
        onSettle={() => {}}
      />
    </CameraDialogProvider>
  );
  return renderDark(ui);
}

const WM: WatermarkType = { content: ['L1'], position: 'top-right' };

it('有水印烧录中:footer 仍渲染模式药丸 + 居中「生成中」覆盖层 + 定格帧透传进取景', () => {
  const { getByTestId } = renderContainer(
    makeFlow({ burning: true, freezeUri: 'file:///tmp/p1.jpg' }),
    { watermark: WM }
  );
  expect(getByTestId('mode-switcher-wrap')).toBeTruthy(); // footer 没被替换
  expect(getByTestId('burning')).toBeTruthy(); // 有水印 → 居中覆盖层
  expect(getByTestId('frozen-frame')).toBeTruthy(); // 透传进 Camera 取景框
});

it('无水印纯裁切(burning 但无 watermark):只定格帧、不弹「生成中」文字遮罩', () => {
  // 无水印 16:9 纯裁切:画面靠定格帧定一下,不显示文字遮罩(更接近系统相机回看,不突兀)。
  const { getByTestId, queryByTestId } = renderContainer(
    makeFlow({ burning: true, freezeUri: 'file:///tmp/p1.jpg' })
  );
  expect(getByTestId('mode-switcher-wrap')).toBeTruthy();
  expect(getByTestId('frozen-frame')).toBeTruthy(); // 定格帧仍盖住取景防黑屏
  expect(queryByTestId('burning')).toBeNull(); // 无水印 → 不弹文字遮罩
});

it('未烧水印:无覆盖层、无定格帧,footer 正常', () => {
  const { getByTestId, queryByTestId } = renderContainer(
    makeFlow({ burning: false, freezeUri: null })
  );
  expect(getByTestId('mode-switcher-wrap')).toBeTruthy();
  expect(queryByTestId('burning')).toBeNull();
  expect(queryByTestId('frozen-frame')).toBeNull();
});
