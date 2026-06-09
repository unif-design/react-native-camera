import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Camera as VisionCamera,
  useMicrophonePermission,
  usePhotoOutput,
  useVideoOutput,
  type CameraRef,
  type CameraDevice,
  type CameraOutput,
  type FocusOptions,
  type Recorder,
} from 'react-native-vision-camera';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { CameraMode, CustomPhotoFile, Point } from '../utils';
import { buildPhotoFile } from '../utils';
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
  sound?: boolean;
};

export const Camera = forwardRef<CameraHandle, Props>(function Camera(
  {
    device,
    currentMode,
    isActive = true,
    flash,
    aspectRatio,
    zoomShared,
    sound,
  },
  ref
) {
  const cameraRef = useRef<CameraRef>(null);

  const cameraType = device.position === 'front' ? 'front' : 'back';

  // aspectRatio = 宽/高。4:3 竖屏取景 高>宽 → 3/4;16:9 → 9/16。
  const frameAspect = (aspectRatio ?? '4:3') === '4:3' ? 3 / 4 : 9 / 16;

  const targetResolution =
    (aspectRatio ?? '4:3') === '4:3'
      ? { width: 1080, height: 1440 }
      : { width: 1080, height: 1920 };

  const photoOutput = usePhotoOutput({
    // 速度优先级对齐原版 4.x photoQualityBalance='speed'(写死);quality 用回原版字段。
    // docs:device must support 'speed' otherwise capture throws —— 故按设备能力 guard,
    // 不支持的机型 fallback 'balanced'(见 device.supportsSpeedQualityPrioritization)。
    qualityPrioritization: device.supportsSpeedQualityPrioritization
      ? 'speed'
      : 'balanced',
    quality: currentMode.quality ?? 0.9,
    targetResolution,
  });

  // enableAudio:true —— 对齐官方 example,录像带声音(docs:启用 audio 需麦克风权限,
  // 已在 startVideo 前 requestMic())。缺它录的是无声视频。
  const videoOutput = useVideoOutput({ enableAudio: true });
  const { hasPermission: hasMic, requestPermission: requestMic } =
    useMicrophonePermission();

  const activeRecorderRef = useRef<Recorder | null>(null);
  const preparedRecorderRef = useRef<Recorder | null>(null);
  const finishResolverRef = useRef<
    ((file: CustomPhotoFile | null) => void) | null
  >(null);

  const internalZoom = useSharedValue(NEUTRAL_ZOOM);
  const zoom = zoomShared ?? internalZoom;

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

  // 仅保留点击对焦。双指缩放(pinch)已移除:变焦改由 footer 的连续滚条(ZoomSlider)
  // 驱动受控 zoomShared;vision-camera 的 enableNativeZoomGesture 与受控 zoom 互斥会 throw,
  // 故全程不开,自己用 Pan 写 zoomShared。
  const composed = Gesture.Tap().onEnd(({ x, y }) => {
    'worklet';
    runOnJS(handleFocus)(x, y);
  });

  useImperativeHandle(
    ref,
    () => ({
      capture: async () => {
        try {
          // 前摄常无物理闪光(device.hasFlash=false),此时 flashMode:'on' 会 throw,
          // 故据 hasFlash guard:无闪光设备一律 'off'(对齐 docs 的 hasFlash 约束)。
          const flashMode = flash === 'on' && device.hasFlash ? 'on' : 'off';
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
        try {
          let recorder = preparedRecorderRef.current;
          if (recorder == null) {
            recorder = await videoOutput.createRecorder({});
          }
          preparedRecorderRef.current = null;
          if (activeRecorderRef.current != null) return;
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
              finishResolverRef.current?.(file);
              finishResolverRef.current = null;
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

          preparedRecorderRef.current = await videoOutput.createRecorder({});
        } catch (e) {
          console.warn('startRecording failed', e);
          activeRecorderRef.current = null;
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
      hasMic,
      requestMic,
      flash,
      device.hasFlash,
      cameraType,
      sound,
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
        <View style={[styles.frame, { aspectRatio: frameAspect }]}>
          <VisionCamera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            device={device}
            isActive={isActive}
            outputs={outputs}
            constraints={[{ photoHDR: false }]}
            zoom={zoom}
            torchMode={
              currentMode.mode === 'video' && flash === 'on' ? 'on' : 'off'
            }
            onError={(error) => {
              // onError = "session 遇到任何错误" 的诊断回调:error 是普通 Error(无 code
              // 可判致命性),且含重开/激活时 session 重启这类**可恢复**瞬时错误 —— vision-camera
              // 会自行恢复。故仅 warn 诊断,绝不据此关相机:早期无条件 settle(500) 会把
              // 重开时的瞬时 session 错误误当致命 → 第二次打开即报错关闭(临时中断另走
              // onInterruptionStarted/Ended,不进这里)。
              console.warn('camera session error', error);
            }}
            onSubjectAreaChanged={() => cameraRef.current?.resetFocus()}
            onStarted={() => {
              // controller 在 onStarted 后才挂上(vision-camera 文档:set after onStarted)。
              const c = cameraRef.current?.controller;
              // TODO(临时): 真机确认 vzf/display 映射(0.5x 是否出现+缩放到超广角)后移除。
              console.log('[camera] zoom-debug', {
                position: device.position,
                deviceMinZoom: device.minZoom,
                deviceMaxZoom: device.maxZoom,
                switchFactors: device.zoomLensSwitchFactors, // iPhone dual 后置预期 [2]
                isVirtual: device.isVirtualDevice,
                physCount: device.physicalDevices.length,
                ctrlMinZoom: c?.minZoom,
                ctrlZoom: c?.zoom,
                displayableZoomFactor: c?.displayableZoomFactor, // iOS18+: 预期 ~0.5;iOS<18: = ctrlZoom
              });
            }}
            nativeID="vision-camera"
          />
          {focusPoint && (
            <FocusIndicator
              key={`${focusPoint.x}-${focusPoint.y}`}
              point={focusPoint}
              onAnimationEnd={() => setFocusPoint(null)}
            />
          )}
        </View>
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
  // overflow:hidden 裁掉 cover 溢出部分,框内只显示输出比例的画面。
  frame: { width: '100%', overflow: 'hidden' },
});
