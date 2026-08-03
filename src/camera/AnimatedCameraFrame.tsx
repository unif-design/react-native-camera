import { useEffect, useMemo, type ReactNode } from 'react';
import {
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { CameraFrameRect } from './session/frameRect';

export type AnimatedCameraFrameRect = {
  x: SharedValue<number>;
  y: SharedValue<number>;
  width: SharedValue<number>;
  height: SharedValue<number>;
};

type Props = {
  frame: CameraFrameRect;
  children: (animatedFrame: AnimatedCameraFrameRect) => ReactNode;
};

/**
 * Camera 与取景水印共用这一组 SharedValue，确保 250ms 过渡的每一帧都处于同一 rect。
 * 初次挂载发生在 viewport 已有效之后，因此 SharedValue 直接以首个有效 frame 初始化，
 * 不会从 zero rect 放大进场。
 */
export function AnimatedCameraFrame({ frame, children }: Props) {
  const x = useSharedValue(frame.x);
  const y = useSharedValue(frame.y);
  const width = useSharedValue(frame.width);
  const height = useSharedValue(frame.height);
  const animatedFrame = useMemo(
    () => ({ x, y, width, height }),
    [height, width, x, y]
  );

  useEffect(() => {
    const options = { duration: 250 };
    x.value = withTiming(frame.x, options);
    y.value = withTiming(frame.y, options);
    width.value = withTiming(frame.width, options);
    height.value = withTiming(frame.height, options);
  }, [frame.height, frame.width, frame.x, frame.y, height, width, x, y]);

  return children(animatedFrame);
}
