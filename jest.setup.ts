// Mock vision-camera 主要 hooks 给 jest 环境
jest.mock('react-native-vision-camera', () => ({
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
  useVideoOutput: () => ({
    createRecorder: jest.fn().mockResolvedValue({
      startRecording: jest.fn(),
      stopRecording: jest.fn(),
      pauseRecording: jest.fn(),
      resumeRecording: jest.fn(),
      cancelRecording: jest.fn(),
      isRecording: false,
      isPaused: false,
      recordedDuration: 0,
      recordedFileSize: 0,
      filePath: '',
    }),
  }),
  useFrameOutput: () => ({}),
  Camera: ({ children }: any) => children ?? null,
}));

// Mock nitro modules（仅类型解析需要）
jest.mock('react-native-nitro-modules', () => ({}), { virtual: true });
jest.mock('react-native-nitro-image', () => ({ NitroImage: () => null }), {
  virtual: true,
});

// Mock reanimated（gesture handler 也需要）
jest.mock('react-native-reanimated', () => ({
  useSharedValue: (init: unknown) => ({ value: init }),
  useAnimatedStyle: (fn: () => unknown) => fn(),
  useAnimatedProps: (fn: () => unknown) => fn(),
  useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
  runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
  runOnUI: (fn: (...args: unknown[]) => unknown) => fn,
  withTiming: (v: unknown) => v,
  withSpring: (v: unknown) => v,
  default: {},
}));

// Mock gesture handler
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return {
    Gesture: {
      Pinch: () => ({
        onBegin: () => ({
          onUpdate: () => ({}),
        }),
        onUpdate: () => ({}),
      }),
      Tap: () => ({ onEnd: () => ({}) }),
      Simultaneous: () => ({}),
    },
    GestureDetector: ({ children }: any) => children,
    GestureHandlerRootView: View,
    PinchGestureHandler: View,
    TapGestureHandler: View,
  };
});

// Mock reanimated-carousel
jest.mock('react-native-reanimated-carousel', () => {
  const { View } = require('react-native');
  return { default: View };
});

// Worklets
jest.mock('react-native-worklets', () => ({}), { virtual: true });
