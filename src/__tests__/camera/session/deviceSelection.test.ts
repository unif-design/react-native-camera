import type { CameraDevice } from 'react-native-vision-camera';
import { makeDeviceStub } from '../../__helpers__/visionCameraMock';
import { selectCameraDevice } from '../../../camera/session/deviceSelection';

function device(position: 'back' | 'front'): CameraDevice {
  return makeDeviceStub({ position }) as unknown as CameraDevice;
}

describe('selectCameraDevice', () => {
  const back = device('back');
  const front = device('front');

  it.each([
    ['back', back],
    ['front', front],
  ] as const)('selects the requested %s device', (requested, expected) => {
    expect(selectCameraDevice(requested, back, front)).toEqual({
      device: expected,
      activePosition: requested,
      canFlip: true,
    });
  });

  it.each([
    ['back', undefined, front, 'front'],
    ['front', back, undefined, 'back'],
  ] as const)(
    'falls back from missing %s and normalizes the actual position',
    (requested, availableBack, availableFront, activePosition) => {
      expect(
        selectCameraDevice(requested, availableBack, availableFront)
      ).toEqual({
        device: availableBack ?? availableFront,
        activePosition,
        canFlip: false,
      });
    }
  );

  it('returns null when neither side exists', () => {
    expect(selectCameraDevice('back', undefined, undefined)).toBeNull();
  });

  it('only enables flip when the opposite target exists', () => {
    expect(selectCameraDevice('back', back, undefined)?.canFlip).toBe(false);
    expect(selectCameraDevice('back', back, front)?.canFlip).toBe(true);
  });
});
