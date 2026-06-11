import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
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
  type Recorder,
} from 'react-native-vision-camera';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { CameraMode, CustomPhotoFile, Point } from '../utils';
import { buildPhotoFile } from '../utils';
import { pinchVzf } from './footer/zoomMath';
import { captureToTempFile } from './capturePhotoHelper';
import { VIEWFINDER } from './colors/viewfinder';
import { FocusIndicator } from './FocusIndicator';
import type { AspectRatio, FlashMode } from './setup';

const NEUTRAL_ZOOM = 1;

export type CameraHandle = {
  capture: () => Promise<CustomPhotoFile | null>;
  startVideo: () => Promise<void>;
  stopVideo: () => Promise<CustomPhotoFile | null>;
};

type Props = {
  device: CameraDevice;
  currentMode: CameraMode;
  isActive?: boolean;
  flash?: FlashMode;
  aspectRatio?: AspectRatio;
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
  // 安全降级:d.ts 明确 'speed' 在不支持的设备 capture 会 throw;'quality' 一般都支持,但稳妥起见
  // 同样在不支持 speed-prioritization 的老设备上保守降级。'balanced' 任何设备可传 → 直传。
  // → 不支持时降级 'balanced' 而非 throw;返回 undefined 表示「不传该键」(下方按需展开,避免传 undefined)。
  const resolvedQualityPrioritization =
    photoQualityPrioritization == null
      ? undefined
      : photoQualityPrioritization === 'balanced'
        ? 'balanced'
        : device.supportsSpeedQualityPrioritization
          ? photoQualityPrioritization
          : 'balanced';

  const photoOutput = usePhotoOutput({
    quality: currentMode.quality ?? 0.9,
    targetResolution,
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

  const activeRecorderRef = useRef<Recorder | null>(null);
  const preparedRecorderRef = useRef<Recorder | null>(null);
  const finishResolverRef = useRef<
    ((file: CustomPhotoFile | null) => void) | null
  >(null);

  const internalZoom = useSharedValue(NEUTRAL_ZOOM);
  const zoom = zoomShared ?? internalZoom;
  // pinch 进行态仅供手势内部用(onBegin 置 1、onFinalize 淡回 0):倍数已挪进高亮档药丸文字、
  // 不再有外部「大号浮层」读它,故不再作为 prop 暴露;留着是因 Pinch 回调照常写它(无副作用)。
  const pinchActive = useSharedValue(0);
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
  const tap = Gesture.Tap().onEnd(({ x, y }) => {
    'worklet';
    runOnJS(handleFocus)(x, y);
  });

  // 双指 pinch 变焦:从手势起点 zoom 乘以 e.scale,clamp 到设备 vzf 范围 ∩ 软上限。
  // 不开 vision-camera 的 enableNativeZoomGesture —— 它与受控 `zoom` 互斥会 throw,故自己在
  // 回调里写 zoomShared(UI 线程,vision-camera 直接消费 → pinch 全程不触发 JS setState)。
  // 倍数文字/档位高亮都由 zoomShared 驱动;onEnd 才回写一次 JS 侧 zoom(档位态/设备切换 clamp 用)。
  const deviceMinZoom = device.minZoom;
  const deviceMaxZoom = device.maxZoom;
  const pinch = Gesture.Pinch()
    .enabled(enableZoom)
    .onBegin(() => {
      'worklet';
      pinchStartZoom.value = zoom.value;
      pinchActive.value = 1;
    })
    .onUpdate((e) => {
      'worklet';
      zoom.value = pinchVzf(
        pinchStartZoom.value,
        e.scale,
        deviceMinZoom,
        deviceMaxZoom,
        softMaxVzf
      );
    })
    .onEnd(() => {
      'worklet';
      if (onZoomEnd) runOnJS(onZoomEnd)(zoom.value);
    })
    .onFinalize(() => {
      'worklet';
      pinchActive.value = withTiming(0, { duration: 300 });
    });

  // pinch + 点击对焦同时识别(Simultaneous):双指缩放与单击对焦互不阻断。
  const composed = Gesture.Simultaneous(tap, pinch);

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

      startVideo: async () => {
        if (!hasMic) {
          await requestMic().catch(() => {});
        }
        // recTime → maxDuration(同为秒,直传):到点原生自动停 → onRecordingFinished 回调
        // (无 stopVideo resolver 时走 onSpontaneousVideoFinish 入 photos)。缺省不设 → 不自动停。
        const settings =
          currentMode.recTime != null
            ? { maxDuration: currentMode.recTime }
            : {};
        let recorder = preparedRecorderRef.current;
        try {
          if (recorder == null) {
            recorder = await videoOutput.createRecorder(settings);
          }
          preparedRecorderRef.current = null;
          if (activeRecorderRef.current != null) {
            // 已在录:手头 recorder 没用上 → 放回 prepared 复用,避免泄漏原生 encoder/file handle。
            preparedRecorderRef.current = recorder;
            return;
          }
          activeRecorderRef.current = recorder;

          await recorder.startRecording(
            (filePath, _reason) => {
              const file = buildPhotoFile(
                { path: filePath, width: 0, height: 0 },
                'video',
                cameraType,
                true
              );
              activeRecorderRef.current = null;
              if (finishResolverRef.current) {
                // stopVideo 在等:兑现它的 Promise。
                finishResolverRef.current(file);
                finishResolverRef.current = null;
              } else {
                // 自发结束(maxDuration 到点/磁盘满/中断):无 resolver → 上报,别丢文件 + 复位录制态。
                onSpontaneousVideoFinish?.(file);
              }
            },
            (error) => {
              console.warn('recorder error', error);
              activeRecorderRef.current = null;
              finishResolverRef.current?.(null);
              finishResolverRef.current = null;
            },
            () => {},
            () => {}
          );

          preparedRecorderRef.current =
            await videoOutput.createRecorder(settings);
        } catch (e) {
          console.warn('startRecording failed', e);
          activeRecorderRef.current = null;
          // 释放手头未挂载成功的 recorder(原生 encoder/file handle),再上抛 → useVideoRecorder
          // 不进假录制态(不置 recording),Container 弹错误条而非 settle 关相机(P1#1b)。
          try {
            recorder?.dispose();
          } catch (err) {
            console.warn('recorder dispose failed', err);
          }
          throw e;
        }
      },

      stopVideo: async () => {
        const active = activeRecorderRef.current;
        if (active == null) return null;
        try {
          const durationSec = active.recordedDuration;
          const finishedPromise = new Promise<CustomPhotoFile | null>(
            (resolve) => {
              finishResolverRef.current = (file) => {
                if (file != null && durationSec != null) {
                  resolve({ ...file, duration: durationSec });
                } else {
                  resolve(file);
                }
              };
            }
          );
          await active.stopRecording();
          return await finishedPromise;
        } catch (e) {
          console.warn('stopRecording failed', e);
          activeRecorderRef.current = null;
          return null;
        }
      },
    }),
    [
      photoOutput,
      videoOutput,
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

  // 卸载/离开 video 时清理 recorder:Nitro 对象 GC 延迟,prepared 但未用的 recorder
  // 仍持有原生 encoder/file handle —— 不主动释放会泄漏。active 在录则 cancelRecording()
  // (异步,删临时文件);prepared 直接 dispose()(同步,HybridObject 释放原生资源)。
  useEffect(() => {
    return () => {
      const active = activeRecorderRef.current;
      if (active != null) {
        active.cancelRecording().catch(() => {});
        activeRecorderRef.current = null;
      }
      const prepared = preparedRecorderRef.current;
      if (prepared != null) {
        // dispose() 同步释放原生资源,对象已处异常状态时可能 throw —— unmount cleanup
        // 里 throw 会红屏,故吞掉(资源最终由 GC 兜底)。
        try {
          prepared.dispose();
        } catch (e) {
          console.warn('recorder dispose failed', e);
        }
        preparedRecorderRef.current = null;
      }
    };
  }, []);

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
