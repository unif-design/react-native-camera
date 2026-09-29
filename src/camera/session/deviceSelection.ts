import type { CameraDevice } from 'react-native-vision-camera';
import type { CameraFacing } from '../../utils';

export type SelectedCameraDevice = {
  device: CameraDevice;
  activePosition: CameraFacing;
  canFlip: boolean;
};

export function selectCameraDevice(
  requested: CameraFacing,
  back: CameraDevice | undefined,
  front: CameraDevice | undefined
): SelectedCameraDevice | null {
  const preferred = requested === 'back' ? back : front;
  const fallback = requested === 'back' ? front : back;
  const device = preferred ?? fallback;
  if (
    device == null ||
    (device.position !== 'back' && device.position !== 'front')
  ) {
    return null;
  }

  const activePosition = device.position;
  const canFlip = activePosition === 'back' ? front != null : back != null;
  return { device, activePosition, canFlip };
}
