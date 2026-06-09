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

/** vision-camera 的 jest mock 基底;传 overrides 覆盖需要定制的 hook(device/permission 等)。 */
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
    usePhotoOutput: () => ({
      capturePhoto: jest.fn(),
      capturePhotoToFile: jest.fn(),
    }),
    useVideoOutput: (_opts?: { enableAudio?: boolean }) => ({
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
    }),
    useFrameOutput: () => ({}),
    Camera: ({ children }: { children?: unknown }) => children ?? null,
    // 出图分辨率目标常量(Camera.tsx 用 CommonResolutions.UHD_*);此前各 mock 漏它导致 undefined。
    CommonResolutions: VC_COMMON_RESOLUTIONS,
    ...overrides,
  };
}
