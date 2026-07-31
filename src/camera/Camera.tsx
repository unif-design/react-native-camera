import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
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
  withTiming,
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
import { pinchVzf } from './hooks/zoomMath';
import { captureToTempFile } from './capturePhotoHelper';
import { VIEWFINDER } from './colors/viewfinder';
import { FocusIndicator } from './FocusIndicator';
import { createRecorderController } from './recording/recorderController';
import type { AspectRatio, FlashMode } from './setup';

const NEUTRAL_ZOOM = 1;

export type VideoCallbacks = {
  onFinished: (
    file: CustomPhotoFile,
    reason: RecordingFinishedReason,
    duration: number
  ) => void;
  onError: (error: Error) => void;
  /** Camera 的 native output identity 被替换或 owner dispose；不是录像 native error。 */
  onCancelled?: () => void;
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
  isActive?: boolean;
  flash?: FlashMode;
  aspectRatio?: AspectRatio;
  // 烧水印「顺滑回看」:非空时在取景框内盖一张刚拍原图(定格帧),撤掉(转 undefined/null)瞬间
  // 与实时画面同框同位、无缝。放进取景框内 → 自动继承 frameStyle 尺寸/cover/裁切。
  frozenUri?: string | null;
  zoomShared?: SharedValue<number>;
  // 是否启用双指 pinch 变焦:前摄定焦(position==='front')传 false → 只剩点击对焦。
  enableZoom?: boolean;
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
  /** 录像被原生侧自发结束(maxDuration 到点/磁盘满/中断)时回调,把文件交还上层入 photos + 复位录制态。 */
  onSpontaneousVideoFinish?: (file: CustomPhotoFile) => void;
};

export const Camera = forwardRef<CameraHandle, Props>(function Camera(
  {
    device,
    currentMode,
    isActive = true,
    flash,
    aspectRatio,
    frozenUri,
    zoomShared,
    enableZoom = true,
    softMaxZoom,
    onZoomEnd,
    sound,
    photoQualityPrioritization,
    photoHDR,
    videoBitRate,
    onCameraError,
    onSpontaneousVideoFinish,
  },
  ref
) {
  const cameraRef = useRef<CameraRef>(null);

  const cameraType = device.position === 'front' ? 'front' : 'back';

  // aspectRatio = 宽/高。4:3 竖屏取景 高>宽 → 3/4;16:9 → 9/16。
  const frameAspect = (aspectRatio ?? '4:3') === '4:3' ? 3 / 4 : 9 / 16;

  // 取景框丝滑切换 = 「原生系统相机式」放大缩小的载体:画幅变化时取景框高度**动画过渡**
  // (withTiming 伸缩,非硬跳 aspectRatio)。配合下方 photo 流恒全幅 + resizeMode="cover",
  // 画面随框平滑缩放、session 不重配、无黑屏无闪断 —— 原生顺滑的来源(传感器固定全幅出流,
  // 切画幅只是 UI 缩放)。**不再盖黑色转场遮罩**(用户否决:黑过渡更糟,原生就是放大缩小)。
  //
  // 目标高在 **JS 侧**预算成数字(worklet 外算):frame 宽恒 100% 屏宽,高 = winW / frameAspect。
  // (4:3 → winW×4/3;16:9 → winW×16/9)。frameStyle worklet 只读 SharedValue 数字,绝不在
  // worklet 内调 design r()(2.15.1 fatal 教训:worklet 里 r() 切倍数崩,jest 测不到)。
  const { width: winW } = useWindowDimensions();
  const targetFrameH = winW / frameAspect;
  const frameH = useSharedValue(targetFrameH);
  // 时长 250ms 为初值,真机可再调。
  useEffect(() => {
    frameH.value = withTiming(targetFrameH, { duration: 250 });
  }, [frameH, targetFrameH]);
  const frameStyle = useAnimatedStyle(() => ({ height: frameH.value }));

  // photo 流**恒固定全幅 UHD_4_3**(不随 aspectRatio 变):4:3 是传感器原生全幅,16:9 视野 =
  // 4:3 竖屏裁左右。固定它 → usePhotoOutput 入参不随画幅变 → photo outputs 身份稳定 →
  // **photo 模式切画幅 session 完全不重配、取景流不闪断**(原生顺滑的关键)。出图 16:9 改由
  // 拍后 Skia 居中裁切实现(见 cropToRatio + useCaptureFlow),vision-camera 拍照本身无 crop 参数。
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
    // cropToRatio/burnWatermark 走 `if (!image) return file` 静默返原图(16:9 不裁、水印不烧)。
    // 指定 jpeg 让出图可被 Skia 解码,也与 buildPhotoFile 写死的 mime='image/jpeg' 一致。
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
  // 兼容 Task 4 期间的自动结束 prop：手动 stop 与自动上限同时竞争时，只能由一条路径入 photos。
  const manualStopRequestedRef = useRef(false);

  const internalZoom = useSharedValue(NEUTRAL_ZOOM);
  const zoom = zoomShared ?? internalZoom;
  // pinch 起点 vzf(onBegin 锁定),onUpdate 据其 × e.scale 算新 vzf。
  const pinchStartZoom = useSharedValue(NEUTRAL_ZOOM);

  // pinch 软上限(vzf):缺省回退到设备 maxZoom(无软钳),正常由 Container 传 maxDisplay/displayMul。
  const softMaxVzf = softMaxZoom ?? device.maxZoom;

  const [focusPoint, setFocusPoint] = useState<Point | null>(null);

  const handleFocus = useCallback(
    async (x: number, y: number) => {
      if (!device.supportsFocusMetering) return;
      setFocusPoint({ x, y });
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
    [device.supportsFocusMetering]
  );

  // 点击对焦。
  const tap = useTapGesture({
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
        manualStopRequestedRef.current = false;
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
              const stoppedByCaller = manualStopRequestedRef.current;
              manualStopRequestedRef.current = false;
              try {
                // Task 5 会在此 callback 的 operation-token 判断前注入 session registry 登记。
                callbacks.onFinished(file, reason, duration);
              } finally {
                // 尚无手动 stop waiter 的自动结束继续走既有 prop 入 photos；两条路径互斥。
                if (reason !== 'stopped' && !stoppedByCaller) {
                  onSpontaneousVideoFinish?.(file);
                }
              }
            },
            onError: (error) => {
              manualStopRequestedRef.current = false;
              callbacks.onError(error);
            },
            onCancelled: () => {
              manualStopRequestedRef.current = false;
              callbacks.onCancelled?.();
            },
          },
        });
      },

      stopVideo: async () => {
        manualStopRequestedRef.current = true;
        await recorderController.stop();
      },
      cancelVideo: async () => {
        manualStopRequestedRef.current = false;
        await recorderController.cancel();
      },
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
      onSpontaneousVideoFinish,
    ]
  );

  // Controller 变更(例如 video output identity 改变)或卸载时强制取消；pending permission/create
  // 也会被 attempt token 失效，晚到 Recorder 只清理、不再 start。
  useEffect(() => {
    return () => {
      manualStopRequestedRef.current = false;
      recorderController.dispose().catch((error) => {
        console.warn('recorder cancel failed', error);
      });
    };
  }, [recorderController]);

  const outputs: CameraOutput[] =
    currentMode.mode === 'video' ? [videoOutput] : [photoOutput];

  return (
    <View style={styles.root}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.frame, frameStyle]}>
          <VisionCamera
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
            nativeID="vision-camera"
          />
          {focusPoint && (
            <FocusIndicator
              key={`${focusPoint.x}-${focusPoint.y}`}
              point={focusPoint}
              onAnimationEnd={() => setFocusPoint(null)}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 高度由 frameStyle 动画驱动(不在此写死 aspectRatio,改画幅时高度 withTiming 平滑伸缩)。
  // overflow:hidden 裁掉溢出部分,框内只显示输出比例的画面。
  frame: { width: '100%', overflow: 'hidden' },
});
