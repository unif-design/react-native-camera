import { render } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import * as VisionCamera from 'react-native-vision-camera';
import { Camera } from '../../camera/Camera';
import type { CameraMode } from '../../utils';

// 拍摄质量参数(photoQualityPrioritization / photoHDR / videoBitRate)接线测试:
// 直接渲染 <Camera>(绕过 Container 的权限/设备分支),精确控制 currentMode / 设备能力 / 新 props,
// 断言 usePhotoOutput / useVideoOutput **被调用的 options**(按需加键:传了才加、缺省不加 undefined)。
//
// vision-camera mock 来自共享 helper(jest.setup 全局已 mock);该 helper 把 usePhotoOutput /
// useVideoOutput 实现为 jest.fn(记录入参),故这里读 `VisionCamera.usePhotoOutput.mock.calls` 断言。
// 用 jest.mocked 取得带类型的 mock 句柄。
const usePhotoOutputMock = jest.mocked(VisionCamera.usePhotoOutput);
const useVideoOutputMock = jest.mocked(VisionCamera.useVideoOutput);

type DeviceOverrides = { supportsSpeedQualityPrioritization?: boolean };

// 最小可用 device 桩:Camera 取景路径只读这些字段(zoom/focus/flash/质量能力)。
function makeDevice(over: DeviceOverrides = {}) {
  return {
    id: 'dev-back',
    position: 'back' as const,
    minZoom: 1,
    maxZoom: 8,
    supportsFocusMetering: true,
    hasFlash: true,
    supportsSpeedQualityPrioritization:
      over.supportsSpeedQualityPrioritization ?? true,
    zoomLensSwitchFactors: [2],
  };
}

const singleMode: CameraMode = { mode: 'single' };
const videoMode: CameraMode = { mode: 'video' };

type RenderProps = Partial<{
  currentMode: CameraMode;
  photoQualityPrioritization: 'speed' | 'balanced' | 'quality';
  photoHDR: boolean;
  videoBitRate: number;
  supportsSpeed: boolean;
}>;

function renderCamera(p: RenderProps = {}) {
  return render(
    <ThemeProvider forceScheme="dark">
      <Camera
        // 类型对齐 CameraDevice;桩只含 Camera 实际读取的字段。
        device={
          makeDevice({
            supportsSpeedQualityPrioritization: p.supportsSpeed,
          }) as never
        }
        currentMode={p.currentMode ?? singleMode}
        isActive={false}
        photoQualityPrioritization={p.photoQualityPrioritization}
        photoHDR={p.photoHDR}
        videoBitRate={p.videoBitRate}
      />
    </ThemeProvider>
  );
}

/** 取某 jest.fn 最近一次调用的首个实参(options 对象)。 */
function lastOpts(mock: jest.Mock): Record<string, unknown> {
  const calls = mock.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return (calls[calls.length - 1]?.[0] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  usePhotoOutputMock.mockClear();
  useVideoOutputMock.mockClear();
});

describe('photoQualityPrioritization 接线', () => {
  it('缺省(未传)→ usePhotoOutput 不含 qualityPrioritization 键(走 SDK 默认)', () => {
    renderCamera();
    expect(lastOpts(usePhotoOutputMock)).not.toHaveProperty(
      'qualityPrioritization'
    );
  });

  it("传 'quality' 且设备支持 → 透传 qualityPrioritization='quality'", () => {
    renderCamera({
      photoQualityPrioritization: 'quality',
      supportsSpeed: true,
    });
    expect(lastOpts(usePhotoOutputMock).qualityPrioritization).toBe('quality');
  });

  it("传 'balanced' → 任何设备直传(不依赖 supportsSpeed)", () => {
    renderCamera({
      photoQualityPrioritization: 'balanced',
      supportsSpeed: false,
    });
    expect(lastOpts(usePhotoOutputMock).qualityPrioritization).toBe('balanced');
  });

  it("安全降级:传 'speed' 但设备不支持 → 降级 'balanced'(不 throw、不传 speed)", () => {
    expect(() =>
      renderCamera({
        photoQualityPrioritization: 'speed',
        supportsSpeed: false,
      })
    ).not.toThrow();
    expect(lastOpts(usePhotoOutputMock).qualityPrioritization).toBe('balanced');
  });
});

describe('photoHDR 接线(constraints)', () => {
  // constraints 是 VisionCamera 视图 prop;mock 的 Camera 仅透传 children,故经渲染树读取 prop。
  // 直接断言 Camera 内部对 constraints 的计算更稳:用 photoHDR 三态映射验证(undefined / true / false)。
  it('缺省(未传)→ 不下发 photoHDR 约束(constraints=undefined)', () => {
    const { UNSAFE_root } = renderCamera();
    const vc = UNSAFE_root.findByProps({ nativeID: 'vision-camera' });
    expect(vc.props.constraints).toBeUndefined();
  });

  it('传 true → constraints=[{ photoHDR: true }]', () => {
    const { UNSAFE_root } = renderCamera({ photoHDR: true });
    const vc = UNSAFE_root.findByProps({ nativeID: 'vision-camera' });
    expect(vc.props.constraints).toEqual([{ photoHDR: true }]);
  });

  it('传 false → constraints=[{ photoHDR: false }](显式关也下发)', () => {
    const { UNSAFE_root } = renderCamera({ photoHDR: false });
    const vc = UNSAFE_root.findByProps({ nativeID: 'vision-camera' });
    expect(vc.props.constraints).toEqual([{ photoHDR: false }]);
  });
});

describe('videoBitRate 接线', () => {
  it('缺省(未传)→ useVideoOutput 不含 targetBitRate 键(编码器自适应)', () => {
    renderCamera({ currentMode: videoMode });
    expect(lastOpts(useVideoOutputMock)).not.toHaveProperty('targetBitRate');
  });

  it('传 25_000_000 → 透传 targetBitRate', () => {
    renderCamera({ currentMode: videoMode, videoBitRate: 25_000_000 });
    expect(lastOpts(useVideoOutputMock).targetBitRate).toBe(25_000_000);
  });

  it('targetResolution(UHD)始终保留(不参数化)', () => {
    renderCamera({ currentMode: videoMode });
    // helper 的 UHD_4_3 桩 = { width: 3024, height: 4032 }(4:3 缺省 aspectRatio)。
    expect(lastOpts(useVideoOutputMock).targetResolution).toEqual({
      width: 3024,
      height: 4032,
    });
  });

  it("fileType 恒为 'mp4'(iOS 默认 mov,不显式指定会让 buildPhotoFile 的 video/mp4 mime 失实)", () => {
    renderCamera({ currentMode: videoMode });
    expect(lastOpts(useVideoOutputMock).fileType).toBe('mp4');
  });
});
