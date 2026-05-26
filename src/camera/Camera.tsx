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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type {
  CameraMode,
  CustomPhotoFile,
  PhotoQuality,
  Point,
} from '../utils';
import { buildPhotoFile } from '../utils';
import { capturePhotoToFile } from './capturePhotoHelper';
import { FocusIndicator } from './FocusIndicator';

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
};

export const Camera = forwardRef<CameraHandle, Props>(function Camera(
  { device, currentMode, isActive = true },
  ref
) {
  const cameraRef = useRef<CameraRef>(null);

  const photoOutput = usePhotoOutput({
    qualityPrioritization: (currentMode.photoQuality ??
      'speed') as PhotoQuality,
    quality: currentMode.jpegQuality ?? 0.9,
  });

  const videoOutput = useVideoOutput();
  const { hasPermission: hasMic, requestPermission: requestMic } =
    useMicrophonePermission();

  const activeRecorderRef = useRef<Recorder | null>(null);
  const preparedRecorderRef = useRef<Recorder | null>(null);
  const finishResolverRef = useRef<
    ((file: CustomPhotoFile | null) => void) | null
  >(null);

  const zoom = useSharedValue(NEUTRAL_ZOOM);
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
            flashMode: 'off',
            enableShutterSound: true,
          });
          return buildPhotoFile(
            { path: raw.path, width: raw.width, height: raw.height },
            currentMode.mode
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
    [photoOutput, videoOutput, currentMode.mode, hasMic, requestMic]
  );

  const outputs = currentMode.mode === 'video' ? [videoOutput] : [photoOutput];

  return (
    <GestureDetector gesture={composed}>
      <View style={StyleSheet.absoluteFill}>
        <VisionCamera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isActive}
          outputs={outputs as CameraProps['outputs']}
          constraints={[{ photoHDR: false }]}
          zoom={zoom}
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
    </GestureDetector>
  );
});
