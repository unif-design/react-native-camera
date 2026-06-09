// Mock vision-camera 给 jest 环境(官方未提供 mock,见 visionCameraMock helper)。
// 全局默认:device=undefined、permission=false;需要 device/granted 的测试各自 jest.mock 覆盖。
jest.mock('react-native-vision-camera', () =>
  require('./src/__tests__/__helpers__/visionCameraMock').makeVisionCameraMock()
);

// Mock nitro modules（仅类型解析需要）
jest.mock('react-native-nitro-modules', () => ({}), { virtual: true });
jest.mock('react-native-nitro-image', () => ({ NitroImage: () => null }), {
  virtual: true,
});

// Mock reanimated（gesture handler 也需要）
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  // Animated.View / Animated.Text / createAnimatedComponent 桩:ZoomChips/ZoomReadout 用
  // Animated.View(opacity)、Animated.Text(档位高亮色)、createAnimatedComponent(TextInput)
  // (大号倍数);jest 下渲染成普通 RN 组件(动画不跑,挂载/逻辑可测)。
  const Animated = Object.assign(View, {
    View,
    Text,
    createAnimatedComponent: (Comp: unknown) => Comp,
  });
  return {
    __esModule: true,
    default: Animated,
    // useRef 持久化 SharedValue 对象:对齐真实 reanimated(跨重渲身份稳定),否则
    // `shared.value = x` 的写入会被下次重渲的新对象丢掉 —— 点击跳档后读 zoomShared 的断言要靠它。
    useSharedValue: (init: unknown) => {
      const ref = React.useRef(null) as { current: { value: unknown } | null };
      if (ref.current === null) ref.current = { value: init };
      return ref.current;
    },
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useAnimatedProps: (fn: () => unknown) => fn(),
    useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
    // jest 下无 SharedValue 更新,reaction 不触发回调 → no-op 即可。
    useAnimatedReaction: () => {},
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    runOnUI: (fn: (...args: unknown[]) => unknown) => fn,
    withTiming: (v: unknown) => v,
    withSpring: (v: unknown) => v,
  };
});

// Mock gesture handler
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  // 链式桩:每个 builder 方法返回自身,支持任意调用顺序(enabled/onBegin/onUpdate/onEnd…)。
  const chain: any = new Proxy(
    {},
    {
      get: () => () => chain,
    }
  );
  return {
    Gesture: {
      Pinch: () => chain,
      Tap: () => chain,
      Pan: () => chain,
      Simultaneous: () => chain,
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
  return { __esModule: true, default: View };
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
      toast: Object.assign(() => null, {
        info: () => null,
        success: () => null,
        error: () => null,
      }),
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

// react-native-svg:jest 渲染成占位,组件挂载测试用
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const p = (props: any) => require('react').createElement(View, props);
  return {
    __esModule: true,
    default: p,
    Svg: p,
    Path: p,
    Circle: p,
    Line: p,
    G: p,
    Rect: p,
  };
});

// safe-area:jest 下 insets 归零、Provider/View 直通,避免 Container 取景态崩
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: View,
  };
});

// react-native-video 7.x:native 模块,jest 渲染成占位 View
jest.mock('react-native-video', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    useVideoPlayer: () => ({
      play: () => {},
      pause: () => {},
      loop: false,
      muted: false,
      rate: 1,
      status: 'idle',
    }),
    VideoView: (props: any) => require('react').createElement(View, props),
  };
});

// @dr.pogodin/react-native-fs:native 模块,jest 下用内存桩(水印烧图读写)
jest.mock('@dr.pogodin/react-native-fs', () => ({
  TemporaryDirectoryPath: '/tmp',
  readFile: jest.fn().mockResolvedValue('BASE64DATA'),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

// @shopify/react-native-skia:native 模块,jest 下桩离屏合成(返 1080×1440)
jest.mock('@shopify/react-native-skia', () => {
  const noop = () => {};
  const mkImage = { width: () => 1080, height: () => 1440, dispose: noop };
  const mkCanvas = { drawImage: jest.fn(), drawText: jest.fn() };
  const mkSnapshot = {
    encodeToBase64: jest.fn(() => 'OUTBASE64'),
    dispose: noop,
  };
  const mkSurface = {
    getCanvas: () => mkCanvas,
    makeImageSnapshot: () => mkSnapshot,
    dispose: noop,
  };
  return {
    Skia: {
      Data: { fromBase64: jest.fn(() => ({ dispose: noop })) },
      Image: { MakeImageFromEncoded: jest.fn(() => mkImage) },
      Surface: { MakeOffscreen: jest.fn(() => mkSurface) },
      Font: jest.fn(() => ({
        getTextWidth: () => 100,
        measureText: () => ({ width: 100 }),
      })),
      Paint: jest.fn(() => ({ setColor: jest.fn() })),
      Color: jest.fn(() => 0),
    },
    ImageFormat: { JPEG: 3 },
  };
});
