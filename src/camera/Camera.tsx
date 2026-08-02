import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { Image, StyleSheet, View } from 'react-native';
import {
  Camera as VisionCamera,
  useMicrophonePermission,
  usePhotoOutput,
  useVideoOutput,
  CommonResolutions,
  type CameraRef,
  type CameraDevice,
  type CameraOutput,
  type FocusOptions,
  type RecordingFinishedReason,
} from 'react-native-vision-camera';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import {
  GestureDetector,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import type { CameraMode, CustomPhotoFile, Point } from '../utils';
import { buildPhotoFile } from '../utils';
import type { AnimatedCameraFrameRect } from './AnimatedCameraFrame';
import { pinchVzf } from './hooks/zoomMath';
import { captureToTempFile } from './capturePhotoHelper';
import { VIEWFINDER } from './colors/viewfinder';
import { FocusIndicator } from './FocusIndicator';
import { createRecorderController } from './recording/recorderController';
import type { CameraFrameRect } from './session/frameRect';
import type { AspectRatio, FlashMode } from './setup';

const NEUTRAL_ZOOM = 1;

type FocusRequest = {
  point: Point;
  requestId: number;
};

export type VideoCallbacks = {
  onFinished: (
    file: CustomPhotoFile,
    reason: RecordingFinishedReason,
    duration: number
  ) => void;
  onError: (error: Error) => void;
  /** Camera 的 native output identity 被替换或 owner dispose；不是录像 native error。 */
  onCancelled?: () => void;
  /** 生产事务注入原 session registry；单独使用 Camera 时直接 best-effort 删除。 */
  onDiscardedFile?: (path: string) => void;
};

export type CameraHandle = {
  capture: () => Promise<CustomPhotoFile | null>;
  startVideo: (callbacks: VideoCallbacks) => Promise<'started' | 'denied'>;
  stopVideo: () => Promise<void>;
  cancelVideo: () => Promise<void>;
  getRecordedDuration: () => number;
};

type Props = {
  device: CameraDevice;
  currentMode: CameraMode;
  frame: CameraFrameRect;
  animatedFrame: AnimatedCameraFrameRect;
  isActive?: boolean;
  flash?: FlashMode;
  aspectRatio?: AspectRatio;
  // 烧水印「顺滑回看」:非空时在取景框内盖一张刚拍原图(定格帧),撤掉(转 undefined/null)瞬间
  // 与实时画面同框同位、无缝。放进取景框内 → 自动继承 frameStyle 尺寸/cover/裁切。
  frozenUri?: string | null;
  zoomShared?: SharedValue<number>;
  // 是否启用双指 pinch 变焦:前摄定焦(position==='front')传 false → 只剩点击对焦。
  enableZoom?: boolean;
  enableFocus?: boolean;
  // pinch 放大软上限(vzf)= maxDisplay / displayMul(见 useZoomController);clamp 落点用。
  softMaxZoom?: number;
  // pinch 结束回写一次 JS 侧 zoom(vzf):仅手势结束,不 pinch 全程回写(性能根治)。
  onZoomEnd?: (vzf: number) => void;
  sound?: boolean;
  // 拍摄质量参数(从 Container 透传自 OpenConfig)。三者**缺省 undefined = 走 SDK 默认**:
  // 缺省时一律不写入对应 option/constraint,让 vision-camera 用其默认值,不替消费者写死取舍。
  photoQualityPrioritization?: 'speed' | 'balanced' | 'quality';
  photoHDR?: boolean;
  videoBitRate?: number;
  onCameraError?: (error: Error) => void;
  /** 将 native completion 绑定到实际发起该配置的 VisionCamera 实例。 */
  configurationGeneration?: number;
  onConfigured?: () => void;
};

export const Camera = forwardRef<CameraHandle, Props>(function Camera(
  {
    device,
    currentMode,
    frame,
    animatedFrame,
    isActive = true,
    flash,
    aspectRatio,
    frozenUri,
    zoomShared,
    enableZoom = true,
    enableFocus = true,
    softMaxZoom,
    onZoomEnd,
    sound,
    photoQualityPrioritization,
    photoHDR,
    videoBitRate,
    onCameraError,
    configurationGeneration = 0,
    onConfigured,
  },
  ref
) {
  const cameraRef = useRef<CameraRef>(null);

  const cameraType = device.position === 'front' ? 'front' : 'back';

  // 动画值由 Container 的 AnimatedCameraFrame 单点驱动，并与 WatermarkStamp 共用；
  // worklet 只读 SharedValue 数字，绝不调用 design r()/rf() Remote Function。
  const frameStyle = useAnimatedStyle(() => ({
    left: animatedFrame.x.value,
    top: animatedFrame.y.value,
    width: animatedFrame.width.value,
    height: animatedFrame.height.value,
  }));

  // photo 流**恒固定全幅 UHD_4_3**(不随 aspectRatio 变):4:3 是传感器原生全幅,16:9 视野 =
  // 4:3 竖屏裁左右。固定它 → usePhotoOutput 入参不随画幅变 → photo outputs 身份稳定 →
  // **photo 模式切画幅 session 完全不重配、取景流不闪断**(原生顺滑的关键)。出图 16:9 改由
  // `usePhotoCaptureTransaction` 调用 `processPhoto` 拍后 Skia 居中裁切，
  // vision-camera 拍照本身无 crop 参数。
  // targetResolution 是「目标」,相机 negotiate 时**比例优先于像素数**(见 CameraPhotoOutput d.ts);
  // UHD_4_3 → 3024×4032(≈12MP),对齐官方 example。
  const targetResolution = CommonResolutions.UHD_4_3;

  // 照片质量优先级:**缺省(未传)= 不写入该 option,让 SDK 用默认 'balanced'**(不替消费者写死)。
  // 安全降级**仅对 'speed'**:d.ts 的 `supportsSpeedQualityPrioritization` 能力位**只关 'speed'**
  // (不支持的设备传 'speed' 会 throw);'quality' / 'balanced' 任何设备都可直传、不该降级 —— 此前把
  // 'quality' 也按该能力位降级 = 把消费者显式要的高质量无声劣化,与 SDK 语义不符。
  // → 仅 'speed' 在不支持设备降 'balanced';undefined 表示「不传该键」(下方按需展开,避免传 undefined)。
  const resolvedQualityPrioritization =
    photoQualityPrioritization == null
      ? undefined
      : photoQualityPrioritization === 'speed' &&
          !device.supportsSpeedQualityPrioritization
        ? 'balanced'
        : photoQualityPrioritization;

  const photoOutput = usePhotoOutput({
    quality: currentMode.quality ?? 0.9,
    targetResolution,
    // 强制 JPEG 容器:缺省 'native' 在 iOS 默认出 HEIC,而 Skia 的 MakeImageFromEncoded 解不了 HEIC →
    // 指定 jpeg 让 processPhoto 能由 Skia 解码并完成裁切/水印，也与
    // buildPhotoFile 写死的 mime='image/jpeg' 一致。
    containerFormat: 'jpeg',
    // 按需加键:仅在 config 显式传了优先级时写入,缺省不传 → SDK 默认。
    // 用对象展开按需加键(而非 `qualityPrioritization: undefined`):避免把 undefined 灌进 options。
    ...(resolvedQualityPrioritization
      ? { qualityPrioritization: resolvedQualityPrioritization }
      : {}),
  });

  // enableAudio:true —— 对齐官方 example,录像带声音(docs:启用 audio 需麦克风权限,
  // 已在 startVideo 前 requestMic())。缺它录的是无声视频。
  // 录像分辨率**仍随 aspectRatio 走 UHD**(与 photo 固定全幅不同):视频无法拍后裁,出流比例
  // 必须直接对 → video 模式切画幅 session 仍会重配(targetResolution 变),低频可接受;photo 模式
  // 已固定全幅故零重配。targetResolution 是目标值(比例优先 negotiate,低端机兜底不崩)。
  // targetBitRate:**缺省(未传)= 不写入,由编码器按分辨率自适应**(不写死,避免配错码率);
  // config 显式传了才按需加键(下方展开,不传 undefined 进 options)。
  const videoOutput = useVideoOutput({
    enableAudio: true,
    // fileType 显式 'mp4':iOS 录像默认容器是 .mov,不指定会产出 QuickTime 文件,而 buildPhotoFile
    // 把视频 mime 固定报 'video/mp4' → 失实(消费者按 mime 上传/转码会错)。Android 本就 mp4、忽略此项。
    fileType: 'mp4',
    targetResolution:
      (aspectRatio ?? '4:3') === '4:3'
        ? CommonResolutions.UHD_4_3
        : CommonResolutions.UHD_16_9,
    ...(typeof videoBitRate === 'number'
      ? { targetBitRate: videoBitRate }
      : {}),
  });
  const { hasPermission: hasMic, requestPermission: requestMic } =
    useMicrophonePermission();

  const recorderController = useMemo(
    () =>
      createRecorderController({
        createRecorder: (settings) => videoOutput.createRecorder(settings),
      }),
    [videoOutput]
  );
  const internalZoom = useSharedValue(NEUTRAL_ZOOM);
  const zoom = zoomShared ?? internalZoom;
  // pinch 起点 vzf(onBegin 锁定),onUpdate 据其 × e.scale 算新 vzf。
  const pinchStartZoom = useSharedValue(NEUTRAL_ZOOM);

  // pinch 软上限(vzf):缺省回退到设备 maxZoom(无软钳),正常由 Container 传 maxDisplay/displayMul。
  const softMaxVzf = softMaxZoom ?? device.maxZoom;

  const focusRequestIdRef = useRef(0);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);

  const handleFocus = useCallback(
    async (x: number, y: number) => {
      if (!enableFocus || !device.supportsFocusMetering) return;
      const requestId = ++focusRequestIdRef.current;
      setFocusRequest({ point: { x, y }, requestId });
      try {
        await cameraRef.current?.focusTo({ x, y }, {
          responsiveness: 'snappy',
          adaptiveness: 'continuous',
          autoResetAfter: 3,
        } satisfies FocusOptions);
      } catch (e) {
        console.warn('focusTo failed', e);
      }
    },
    [device.supportsFocusMetering, enableFocus]
  );
  const handleFocusAnimationEnd = useCallback((requestId: number) => {
    setFocusRequest((current) =>
      current?.requestId === requestId ? null : current
    );
  }, []);

  // 点击对焦。
  const tap = useTapGesture({
    enabled: enableFocus,
    onDeactivate: ({ x, y }) => {
      'worklet';
      runOnJS(handleFocus)(x, y);
    },
  });

  // 双指 pinch 变焦:从手势起点 zoom 乘以 e.scale,clamp 到设备 vzf 范围 ∩ 软上限。
  // 不开 vision-camera 的 enableNativeZoomGesture —— 它与受控 `zoom` 互斥会 throw,故自己在
  // 回调里写 zoomShared(UI 线程,vision-camera 直接消费 → pinch 全程不触发 JS setState)。
  // 倍数文字/档位高亮都由 zoomShared 驱动;onDeactivate 才回写一次 JS 侧 zoom(档位态/设备切换 clamp 用)。
  const deviceMinZoom = device.minZoom;
  const deviceMaxZoom = device.maxZoom;
  const pinch = usePinchGesture({
    enabled: enableZoom,
    onBegin: () => {
      'worklet';
      pinchStartZoom.value = zoom.value;
    },
    onUpdate: (e) => {
      'worklet';
      zoom.value = pinchVzf(
        pinchStartZoom.value,
        e.scale,
        deviceMinZoom,
        deviceMaxZoom,
        softMaxVzf
      );
    },
    onDeactivate: () => {
      'worklet';
      if (onZoomEnd) runOnJS(onZoomEnd)(zoom.value);
    },
  });

  // pinch + 点击对焦同时识别(Simultaneous):双指缩放与单击对焦互不阻断。
  const composed = useSimultaneousGestures(tap, pinch);

  useImperativeHandle(
    ref,
    () => ({
      capture: async () => {
        try {
          // flash('on'/'auto'/'off')直传给 capturePhoto —— 我们的 FlashMode 与 vision-camera 取值一致。
          // 仅做 hasFlash guard:前摄等无物理闪光设备给 'on'/'auto' 会 throw,故无闪光一律 'off'。
          // (旧实现只认 'on' → 把 'auto' 也吞成 'off',导致「自动」闪光失效;这里改为全模式直传。)
          const flashMode = device.hasFlash ? (flash ?? 'off') : 'off';
          const raw = await captureToTempFile(photoOutput, {
            flashMode,
            enableShutterSound: sound ?? true,
          });
          return buildPhotoFile(
            { path: raw.path, width: raw.width, height: raw.height },
            currentMode.mode,
            cameraType
          );
        } catch (e) {
          console.warn('capturePhoto failed', e);
          return null;
        }
      },

      startVideo: async (callbacks) => {
        // recTime → maxDuration(同为秒,直传):到点原生自动停 → onRecordingFinished 回调
        // 缺省不设 → 不自动停。每次 start 都现算并创建一次性 Recorder,不跨设置预热/复用。
        const settings =
          currentMode.recTime != null
            ? { maxDuration: currentMode.recTime }
            : {};
        return recorderController.start({
          hasMicrophonePermission: hasMic,
          requestMicrophonePermission: requestMic,
          settings,
          callbacks: {
            onFinished: (filePath, reason, duration) => {
              const file = buildPhotoFile(
                { path: filePath, width: 0, height: 0, duration },
                'video',
                cameraType,
                true
              );
              callbacks.onFinished(file, reason, duration);
            },
            onError: callbacks.onError,
            onCancelled: callbacks.onCancelled,
            // 事务路径会注入原 session FileRegistry：先登记、再按 operation token 决定
            // 交付或删除。Camera 单独使用时仍保留 RNFS best-effort 兜底，避免 cancel /
            // error 终态之后才落盘的视频静默留在临时目录。
            onDiscardedFile: (path) => {
              if (callbacks.onDiscardedFile != null) {
                callbacks.onDiscardedFile(path);
                return;
              }
              try {
                RNFS.unlink(path).catch((error) => {
                  console.warn('discarded video cleanup failed', error);
                });
              } catch (error) {
                console.warn('discarded video cleanup failed', error);
              }
            },
          },
        });
      },

      stopVideo: () => recorderController.stop(),
      cancelVideo: () => recorderController.cancel(),
      getRecordedDuration: () => recorderController.getRecordedDuration(),
    }),
    [
      photoOutput,
      recorderController,
      currentMode.mode,
      currentMode.recTime,
      hasMic,
      requestMic,
      flash,
      device.hasFlash,
      cameraType,
      sound,
    ]
  );

  // Controller 变更(例如 video output identity 改变)或卸载时强制取消；pending permission/create
  // 也会被 attempt token 失效，晚到 Recorder 只清理、不再 start。
  //
  // setup 里必须 activate()：React 19 StrictMode 会 setup→cleanup→setup **复用同一个 useMemo
  // 实例**，只有 cleanup 而没有重新激活，cleanup 里的 dispose() 会把 controllerDisposed 永久
  // 置 true，此后 startVideo 永远返回 'denied'(真机 dev 构建下相机可用但完全录不了像)。
  // 选 activate() 而不是「可替换 controller ref」：videoOutput identity 真变时 useMemo 会产出
  // **新** controller，旧实例没人再引用、activate 不到，因此「旧 controller 永久失效」仍然成立。
  useEffect(() => {
    recorderController.activate();
    return () => {
      recorderController.dispose().catch((error) => {
        console.warn('recorder cancel failed', error);
      });
    };
  }, [recorderController]);

  const outputs: CameraOutput[] =
    currentMode.mode === 'video' ? [videoOutput] : [photoOutput];

  // Container 已在 zero viewport 阶段挡住挂载；内部再守一次，避免未来调用方把
  // 无效目标 rect 送入 native Camera。
  if (frame.width <= 0 || frame.height <= 0) return null;

  return (
    <View style={styles.root}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.frame, frameStyle]}>
          <VisionCamera
            // VisionCamera 5.0.11 会用 latest-callback wrapper 包装 onConfigured。
            // generation 变化时隔离实例，旧 configure Promise 即使在 passive cleanup 前完成，
            // 也只能调用旧实例/旧 generation 的 callback，不能误把新配置提前标成 ready。
            key={configurationGeneration}
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            // resizeMode="cover":photo 流恒 4:3 全幅 → 4:3 frame 下 cover 与 contain 视觉完全相同
            // (比例匹配、无裁切);16:9 frame 下 cover 裁左右 = **正确呈现 16:9 视野**(与拍后裁切
            // 的出图一致)。且 frame 高度动画时 cover 让画面**跟随容器平滑放大/缩小** = 原生观感
            // (contain 会在动画中露黑边)。
            resizeMode="cover"
            device={device}
            isActive={isActive}
            outputs={outputs}
            // photoHDR:**缺省(未传)= 不下发 photoHDR 约束 → 由相机 negotiate 决定**(不强制开/关)。
            // config 传了 boolean 才作为 `{ photoHDR: <值> }` 约束;constraints? 可选,传 undefined 即完全省略。
            // (不加 resolutionBias:outputs 按 mode 单挂,photo/video 不共存,无被拖低问题。)
            constraints={
              typeof photoHDR === 'boolean' ? [{ photoHDR }] : undefined
            }
            zoom={zoom}
            torchMode={
              currentMode.mode === 'video' && flash === 'on' ? 'on' : 'off'
            }
            onError={(error) => {
              // onError = "session 遇到任何错误" 的诊断回调:error 是普通 Error(无 code
              // 可判致命性),且含重开/激活时 session 重启这类**可恢复**瞬时错误 —— vision-camera
              // 会自行恢复。故 warn 诊断 + 冒泡给 Container 弹**非阻塞**错误条(线上可见),
              // 绝不据此关相机:早期无条件 settle(500) 会把重开时的瞬时 session 错误误当致命
              // → 第二次打开即报错关闭(临时中断另走 onInterruptionStarted/Ended,不进这里)。
              console.warn('camera session error', error);
              onCameraError?.(error);
            }}
            onSubjectAreaChanged={() => cameraRef.current?.resetFocus()}
            onConfigured={onConfigured}
            nativeID="vision-camera"
          />
          {focusRequest && (
            <FocusIndicator
              key={focusRequest.requestId}
              point={focusRequest.point}
              requestId={focusRequest.requestId}
              onAnimationEnd={handleFocusAnimationEnd}
            />
          )}
          {frozenUri != null && (
            <Image
              source={{ uri: frozenUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              testID="frozen-frame"
            />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  // 全屏黑底,把取景框居中 → 框外区域是黑边(letterbox)。
  root: {
    flex: 1,
    backgroundColor: VIEWFINDER.black,
  },
  // 完整 rect 由 frameStyle 动画驱动；overflow:hidden 裁掉 cover 的溢出画面。
  frame: { position: 'absolute', overflow: 'hidden' },
});
