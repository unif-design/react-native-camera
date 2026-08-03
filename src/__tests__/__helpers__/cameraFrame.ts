import type { AnimatedCameraFrameRect } from '../../camera/AnimatedCameraFrame';
import type { CameraFrameRect } from '../../camera/session/frameRect';
import type { SharedValue } from 'react-native-reanimated';

const value = (initial: number): SharedValue<number> =>
  ({ value: initial }) as SharedValue<number>;

export function makeAnimatedFrameStub(
  frame: CameraFrameRect
): AnimatedCameraFrameRect {
  return {
    x: value(frame.x),
    y: value(frame.y),
    width: value(frame.width),
    height: value(frame.height),
  };
}
