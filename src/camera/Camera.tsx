import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import {
  Camera as VisionCamera,
  useMicrophonePermission,
  usePhotoOutput,
  useVideoOutput,
  type CameraRef,
  type CameraDevice,
  type CameraProps,
  type Recorder,
} from 'react-native-vision-camera';
import type { CameraMode, CustomPhotoFile, PhotoQuality } from '../utils';
import { buildPhotoFile } from '../utils';
import { capturePhotoToFile } from './capturePhotoHelper';

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
    <VisionCamera
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={isActive}
      outputs={outputs as CameraProps['outputs']}
      constraints={[{ photoHDR: false }]}
      nativeID="vision-camera"
    />
  );
});
