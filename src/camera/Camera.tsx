import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import {
  Camera as VisionCamera,
  usePhotoOutput,
  type CameraRef,
  type CameraDevice,
  type CameraProps,
} from 'react-native-vision-camera';
import type { CameraMode, CustomPhotoFile, PhotoQuality } from '../utils';
import { buildPhotoFile } from '../utils';
import { capturePhotoToFile } from './capturePhotoHelper';

export type CameraHandle = {
  capture: () => Promise<CustomPhotoFile | null>;
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
    }),
    [photoOutput, currentMode.mode]
  );

  return (
    <VisionCamera
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={isActive}
      outputs={[photoOutput] as CameraProps['outputs']}
      constraints={[{ photoHDR: false }]}
      nativeID="vision-camera"
    />
  );
});
