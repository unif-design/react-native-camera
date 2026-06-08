import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Animated, StyleSheet, View } from 'react-native';
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
  flipNonce?: number;
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
    flipNonce,
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
  const zoomOffset = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      'worklet';
      zoomOffset.value = zoom.value;
    })
    .onUpdate((e) => {
      'worklet';
      const z = zoomOffset.value * e.scale;
      zoom.value = Math.min(Math.max(z, device.minZoom), device.maxZoom);
    });

  // 翻转动画:flipNonce 变化时播一次 rotateY 0→180→0(前后摄切换的 3D 翻转视觉)。
  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!flipNonce) return;
    Animated.sequence([
      Animated.timing(flipAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(flipAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [flipNonce, flipAnim]);

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

  const tapGesture = Gesture.Tap().onEnd(({ x, y }) => {
    'worklet';
    runOnJS(handleFocus)(x, y);
  });

  const composed = Gesture.Simultaneous(pinchGesture, tapGesture);

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
        <Animated.View
          style={{
            backfaceVisibility: 'hidden',
            transform: [
              { perspective: 1000 },
              {
                rotateY: flipAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '180deg'],
                }),
              },
            ],
          }}
        >
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
  // overflow:hidden 裁掉 cover 溢出部分,框内只显示输出比例的画面。
  frame: { width: '100%', overflow: 'hidden' },
});
