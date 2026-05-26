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

// Mock @unif/react-native-design
jest.mock(
  '@unif/react-native-design',
  () => {
    const React = require('react');
    const {
      Text,
      TouchableOpacity,
      ActivityIndicator,
    } = require('react-native');
    const passthrough = ({ children }: any) => children ?? null;
    const noop = () => null;
    return {
      // theme
      ThemeProvider: passthrough,
      useTheme: () => ({ scheme: 'light', colors: {}, shadow: {} }),
      useColors: () => new Proxy({}, { get: () => 'transparent' }),
      useShadow: () => new Proxy({}, { get: () => ({}) }),
      useThemedStyles: (maker: any) => maker({}, {}),
      r: (n: number) => n,
      rf: (n: number) => n,
      fw: { regular: '400', medium: '500', semibold: '600', bold: '700' },
      type: new Proxy({}, { get: () => 14 }),
      fixed: { hitTarget: 44, navbarH: 56, tabbarH: 56, hairline: 1 },
      // icons
      Icon: passthrough,
      ICONS: {},
      // components
      Avatar: passthrough,
      BlurLayer: passthrough,
      BottomSheet: passthrough,
      Button: ({ children, ...props }: any) =>
        React.createElement(
          TouchableOpacity,
          props,
          React.createElement(Text, null, children)
        ),
      Card: passthrough,
      Carousel: passthrough,
      Cell: passthrough,
      Checkbox: passthrough,
      Chip: passthrough,
      Confirm: passthrough,
      confirm: () => Promise.resolve(false),
      ConfirmHost: noop,
      DrawerHeader: passthrough,
      Empty: passthrough,
      EntryCard: passthrough,
      Form: passthrough,
      FormGroup: passthrough,
      FormRow: passthrough,
      Grid: passthrough,
      IconButton: passthrough,
      Input: passthrough,
      List: passthrough,
      Logo: passthrough,
      NavBar: passthrough,
      PasswordInput: passthrough,
      Pulse: passthrough,
      PulseDot: passthrough,
      usePulse: () => ({ value: 0 }),
      Radio: passthrough,
      Search: passthrough,
      Segmented: passthrough,
      Skeleton: passthrough,
      Spinner: () => React.createElement(ActivityIndicator),
      StatusDot: passthrough,
      Stepper: passthrough,
      Switch: passthrough,
      TabBar: passthrough,
      Tabs: passthrough,
      Tag: passthrough,
      Textarea: passthrough,
      TextField: passthrough,
      Thumbnail: passthrough,
      Toast: passthrough,
      toast: () => null,
      ToastHost: noop,
      // utils
      createLogger: () => ({
        debug: noop,
        info: noop,
        warn: noop,
        error: noop,
      }),
      childTestID: (parent: string, id: string, override?: string) =>
        override ?? `${parent}-${id}`,
    };
  },
  { virtual: true }
);
