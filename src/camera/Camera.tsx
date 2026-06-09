import {
  forwardRef,
  useCallback,
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
  type CameraProps,
  type FocusOptions,
  type Recorder,
} from 'react-native-vision-camera';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { CameraMode, CustomPhotoFile, Point } from '../utils';
import { buildPhotoFile } from '../utils';
import { capturePhotoToFile } from './capturePhotoHelper';
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
    // 速度优先级对齐原版 4.x photoQualityBalance='speed'(写死);quality 用回原版字段
    qualityPrioritization: 'speed',
    quality: currentMode.quality ?? 0.9,
    targetResolution,
  });

  const videoOutput = useVideoOutput();
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
          const raw = await capturePhotoToFile(photoOutput, {
            flashMode: flash ?? 'off',
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
      cameraType,
      sound,
    ]
  );

  const outputs = currentMode.mode === 'video' ? [videoOutput] : [photoOutput];

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
            outputs={outputs as CameraProps['outputs']}
            constraints={[{ photoHDR: false }]}
            zoom={zoom}
            torchMode={
              currentMode.mode === 'video' && flash === 'on' ? 'on' : 'off'
            }
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
