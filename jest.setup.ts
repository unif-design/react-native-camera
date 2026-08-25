// reanimated / worklets / RNGH / safe-area 四个 peer 的 jest 接线**不在本文件** ——
// 由 `@unif/react-native-design/jest-preset`(package.json#jest.preset)挂进
// setupFilesAfterEnv 的 `@unif/react-native-design/jest-setup` 统一提供:RNGH 官方
// jestSetup + Pressable/GestureDetector 壳、worklets 官方 mock、safe-area 官方 mock,
// reanimated 走**真实模块** + `setUpTests()`。这四段此前是本仓手写的,与 design 的接线
// 各写各的很容易分叉(本仓那份 reanimated 桩就缺 useReducedMotion / useComposedEventHandler)。
// 本文件只留 camera 自己的 native peer 桩(vision-camera / nitro / skia / fs / video / svg)
// 与本仓直接消费的 RNRC。
//
// design **整包不桩** —— 接线由上面那个入口提供后,桩就没有存在理由了:测试跑真实 design
// 组件,断言按真实 a11y 语义写。装饰件(Icon 等)整棵 a11y 子树隐藏,按 testID 查要带
// `{ includeHiddenElements: true }`;有 useTheme/useColors 的渲染树要补 ThemeProvider。
//
// 注意接线顺序:本文件在 `setupFiles`,design 入口在 `setupFilesAfterEnv` —— 同一模块两边
// 都 jest.mock 时后者胜出,所以不要在这里再覆盖上面那四个包。

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

// Mock reanimated-carousel。
// 这段**不是**为了让 design 的 barrel 能 import 才存在(那类接线已随四个 peer 一起交给 design
// 入口):本仓自己有 `src/components/Carousel/Carousel.tsx` 直接消费 RNRC v5,Carousel 与
// PreviewOverlay 两个 suite 用下面的 `__carouselRenderSpy` 断言传参、并显式驱动
// onSnapToItem / onScrollStart。迁移时实测删掉本段 → 这两个 suite 7 条红,故保留。
jest.mock('react-native-reanimated-carousel', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');

  // 保留 stable v5 的关键行为契约:
  // - named export + forwardRef
  // - defaultIndex 只在 mount 时消费
  // - onScrollStart / onSnapToItem 由测试显式驱动
  // 这样 PreviewOverlay 测试能覆盖 settled-index,而不是把 Carousel 降成永不回调的 View。
  const carouselRenderSpy = jest.fn(function CarouselMock(
    props: any,
    ref: any
  ) {
    const data = props.data ?? [];
    const initialIndex = Math.max(
      0,
      Math.min(props.defaultIndex ?? 0, Math.max(data.length - 1, 0))
    );
    const [currentIndex, setCurrentIndex] = React.useState(initialIndex);

    const snapTo = (nextIndex: number) => {
      const safeIndex = Math.max(
        0,
        Math.min(nextIndex, Math.max(data.length - 1, 0))
      );
      setCurrentIndex(safeIndex);
      props.onSnapToItem?.(safeIndex);
    };

    React.useImperativeHandle(ref, () => ({
      prev: () => snapTo(currentIndex - 1),
      next: () => snapTo(currentIndex + 1),
      getCurrentIndex: () => currentIndex,
      scrollTo: ({ index }: { index: number }) => snapTo(index),
    }));

    const currentItem = data[currentIndex];
    const renderedItem =
      currentItem === undefined
        ? null
        : props.renderItem({
            item: currentItem,
            index: currentIndex,
            relativeProgress: { value: 0 },
          });

    return React.createElement(
      View,
      {
        testID: props.testID ?? 'rnrc-carousel-mock',
        style: props.style,
      },
      renderedItem,
      React.createElement(Pressable, {
        testID: 'rnrc-scroll-start',
        onPress: props.onScrollStart,
      }),
      ...data.map((item: unknown, itemIndex: number) =>
        React.createElement(Pressable, {
          key: props.keyExtractor?.(item, itemIndex) ?? String(itemIndex),
          testID: `rnrc-snap-${itemIndex}`,
          onPress: () => snapTo(itemIndex),
        })
      )
    );
  });
  const Carousel = React.forwardRef(carouselRenderSpy);
  Carousel.displayName = 'CarouselMock';

  return {
    __esModule: true,
    Carousel,
    __carouselRenderSpy: carouselRenderSpy,
  };
});

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

// react-native-video 7.x:native 模块,jest 渲染成占位 View。
// 事件状态仍由测试显式 emit，不在 mock 内复制播放器状态机；这样 VideoPlayer 测试验证的是
// 组件如何消费 native event，而不是 mock 自己是否会乐观切换。
jest.mock('react-native-video', () => {
  const React = require('react');
  const { View } = require('react-native');
  const listeners = new Map<object, Map<string, (...args: any[]) => void>>();
  const setupCallbacks: any[] = [];
  const listenerAdds: any[] = [];
  const listenerRemoves: any[] = [];
  const players: any[] = [];
  const createPlayer = jest.fn((source: unknown) => {
    const player = {
      source,
      play: jest.fn(),
      pause: jest.fn(),
      // 故意与产品要求相反：只有 VideoPlayer setup 显式关闭 loop，测试才会通过。
      loop: true,
      muted: false,
      rate: 1,
      status: 'idle',
    };
    players.push(player);
    return player;
  });
  const useVideoPlayer = jest.fn(
    (source: unknown, setup?: (player: any) => void) => {
      const sourceKey = JSON.stringify(source);
      setupCallbacks.push(setup);
      return React.useMemo(() => {
        const player = createPlayer(source);
        setup?.(player);
        return player;
        // sourceKey 对齐真实 useVideoPlayer 的 serialized source lifecycle。
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [sourceKey]);
    }
  );
  const useEvent = jest.fn(
    (player: object, event: string, callback: (...args: any[]) => void) => {
      React.useEffect(() => {
        listenerAdds.push({ player, event, callback });
        let playerListeners = listeners.get(player);
        if (playerListeners == null) {
          playerListeners = new Map();
          listeners.set(player, playerListeners);
        }
        playerListeners.set(event, callback);
        return () => {
          listenerRemoves.push({ player, event, callback });
          if (playerListeners?.get(event) === callback) {
            playerListeners.delete(event);
          }
        };
      }, [player, event, callback]);
    }
  );
  return {
    __esModule: true,
    useEvent,
    useVideoPlayer,
    VideoView: (props: any) => require('react').createElement(View, props),
    __videoMock: {
      players,
      setupCallbacks,
      listenerAdds,
      listenerRemoves,
      emit: (player: object, event: string, ...args: any[]) => {
        const callback = listeners.get(player)?.get(event);
        callback?.(...args);
        return callback != null;
      },
      reset: () => {
        listeners.clear();
        players.splice(0);
        setupCallbacks.splice(0);
        listenerAdds.splice(0);
        listenerRemoves.splice(0);
      },
    },
  };
});

// @dr.pogodin/react-native-fs:native 模块,jest 下用内存桩(水印烧图读写)
jest.mock('@dr.pogodin/react-native-fs', () => ({
  TemporaryDirectoryPath: '/tmp',
  readFile: jest.fn().mockResolvedValue('BASE64DATA'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

// @shopify/react-native-skia:native 模块,jest 下桩离屏合成(返 1080×1440)
jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const { View } = require('react-native');
  const noop = () => {};
  const mkImage = { width: () => 1080, height: () => 1440, dispose: noop };
  const mkCanvas = {
    drawImage: jest.fn(),
    drawImageRect: jest.fn(),
    drawText: jest.fn(),
  };
  const mkSnapshot = {
    encodeToBase64: jest.fn(() => 'OUTBASE64'),
    dispose: noop,
  };
  const mkSurface = {
    getCanvas: () => mkCanvas,
    makeImageSnapshot: () => mkSnapshot,
    width: () => 1080,
    height: () => 1440,
    dispose: noop,
  };
  return {
    Skia: {
      Data: {
        fromURI: jest.fn(async () => ({ dispose: noop })),
        fromBase64: jest.fn(() => ({ dispose: noop })),
      },
      Image: { MakeImageFromEncoded: jest.fn(() => mkImage) },
      Surface: {
        Make: jest.fn(() => mkSurface),
        MakeOffscreen: jest.fn(() => mkSurface),
      },
      Font: jest.fn(() => ({
        getTextWidth: () => 100,
        measureText: () => ({ width: 100 }),
        setSize: noop,
        dispose: noop,
      })),
      Paint: jest.fn(() => ({ setColor: jest.fn(), dispose: noop })),
      // Paragraph(命令式):桩链式 builder + build() → paragraph(layout/paint/getHeight…)。
      // burnWatermark 改用 Paragraph(系统字体 + 字形 fallback,能烧 CJK),故水印烧图测试走这里。
      ParagraphBuilder: {
        Make: jest.fn(() => {
          const paragraph = {
            layout: jest.fn(),
            paint: jest.fn(),
            getHeight: jest.fn(() => 120),
            getLongestLine: jest.fn(() => 200),
            getMaxWidth: jest.fn(() => 200),
            dispose: jest.fn(),
          };
          const builder: any = {
            pushStyle: jest.fn(() => builder),
            addText: jest.fn(() => builder),
            pop: jest.fn(() => builder),
            reset: jest.fn(() => builder),
            build: jest.fn(() => paragraph),
            dispose: jest.fn(),
          };
          return builder;
        }),
      },
      Color: jest.fn(() => 0),
      // 裁切(cropToRatio)用:返回带 x/y/width/height 的 rect 桩(drawImageRect 消费它)。
      XYWHRect: jest.fn((x: number, y: number, w: number, h: number) => ({
        x,
        y,
        width: w,
        height: h,
      })),
    },
    ImageFormat: { JPEG: 3 },
    // Paragraph 文字对齐 / 字重枚举(burnWatermark 用 TextAlign.Right / FontWeight.SemiBold)。
    TextAlign: { Left: 0, Right: 1, Center: 2, Justify: 3, Start: 4, End: 5 },
    FontWeight: {
      Invisible: 0,
      Thin: 100,
      ExtraLight: 200,
      Light: 300,
      Normal: 400,
      Medium: 500,
      SemiBold: 600,
      Bold: 700,
      ExtraBold: 800,
      Black: 900,
      ExtraBlack: 1000,
    },
    Canvas: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
    Paragraph: (props: any) =>
      React.createElement(View, {
        ...props,
        testID: 'watermark-paragraph',
      }),
  };
});
