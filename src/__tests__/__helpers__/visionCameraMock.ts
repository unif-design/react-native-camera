// vision-camera 没有官方 jest mock(已确认:包内无 mock 文件、package.json 无 mock 入口),
// 故自建。多个测试需要不同的 device / permission 行为,这里给「共享基底 + overrides」,
// 避免每处重复整份 mock —— 尤其新增字段(如 CommonResolutions)时只改这一处,不会再漏。
//
// 用法(在测试/jest.setup 里):
//   jest.mock('react-native-vision-camera', () =>
//     require('<相对路径>/visionCameraMock').makeVisionCameraMock({ useCameraDevice: ... }));
// jest.mock 工厂被 babel 提升,不能引外部变量,但工厂内 require 是允许的(运行期执行)。

export const VC_COMMON_RESOLUTIONS = {
  UHD_4_3: { width: 3024, height: 4032 },
  UHD_16_9: { width: 2160, height: 3840 },
} as const;

type VcOverrides = Record<string, unknown>;

/**
 * vision-camera 的 jest mock 基底;传 overrides 覆盖需要定制的 hook(device/permission 等)。
 *
 * usePhotoOutput / useVideoOutput 用 **jest.fn 实现**(记录入参),让接线测试能断言被调用的 options
 * (如 `qualityPrioritization` 按需加键 / `targetBitRate` 缺省不加)——读 `mod.usePhotoOutput.mock.calls`。
 * 入参形态变更只改这一处,避免各处重复整份 mock。
 */
export function makeVisionCameraMock(overrides: VcOverrides = {}) {
  return {
    useCameraPermission: () => ({
      hasPermission: false,
      requestPermission: () => Promise.resolve(false),
    }),
    useMicrophonePermission: () => ({
      hasPermission: false,
      requestPermission: () => Promise.resolve(false),
    }),
    useCameraDevice: () => undefined,
    useCameraDevices: () => [],
    // jest.fn(实现):返回输出对象 + 记录入参(opts),供接线测试断言按需加键。
    usePhotoOutput: jest.fn((_opts?: Record<string, unknown>) => ({
      capturePhoto: jest.fn(),
      capturePhotoToFile: jest.fn(),
    })),
    useVideoOutput: jest.fn((_opts?: Record<string, unknown>) => ({
      createRecorder: jest.fn().mockResolvedValue({
        startRecording: jest.fn(),
        stopRecording: jest.fn(),
        pauseRecording: jest.fn(),
        resumeRecording: jest.fn(),
        cancelRecording: jest.fn().mockResolvedValue(undefined),
        dispose: jest.fn(),
        isRecording: false,
        isPaused: false,
        recordedDuration: 0,
        recordedFileSize: 0,
        filePath: '',
      }),
    })),
    useFrameOutput: () => ({}),
    Camera: ({ children }: { children?: unknown }) => children ?? null,
    // 出图分辨率目标常量(Camera.tsx 用 CommonResolutions.UHD_*);此前各 mock 漏它导致 undefined。
    CommonResolutions: VC_COMMON_RESOLUTIONS,
    ...overrides,
  };
}
