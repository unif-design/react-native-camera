import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Paragraph } from '@shopify/react-native-skia';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { WatermarkType } from '../../utils';
import type { AnimatedCameraFrameRect } from '../AnimatedCameraFrame';
import type { CameraFrameRect } from '../session/frameRect';
import {
  createWatermarkParagraph,
  hasVisibleWatermark,
  type WatermarkParagraph,
} from './paragraph';

type Props = {
  watermark: WatermarkType;
  frame: CameraFrameRect;
  animatedFrame: AnimatedCameraFrameRect;
};

type PreparedState = {
  key: string;
  value: WatermarkParagraph;
};

export function WatermarkStamp({ watermark, frame, animatedFrame }: Props) {
  const { width, height } = frame;
  const watermarkKey = JSON.stringify({
    content: watermark.content,
    position: watermark.position ?? 'top-right',
  });
  // props 的 object identity 不代表语义变化；先按稳定 key 深拷贝，effect 才不会错误释放/重建 JSI 对象。
  const watermarkSnapshot = useMemo(
    () => JSON.parse(watermarkKey) as WatermarkType,
    [watermarkKey]
  );
  const paragraphKey = `${width}:${height}:${watermarkKey}`;
  const [prepared, setPrepared] = useState<PreparedState | null>(null);

  useEffect(() => {
    if (width <= 0 || height <= 0 || !hasVisibleWatermark(watermarkSnapshot)) {
      setPrepared(null);
      return;
    }

    const value = createWatermarkParagraph(width, height, watermarkSnapshot);
    setPrepared({ key: paragraphKey, value });
    return () => value.dispose();
  }, [height, paragraphKey, watermarkSnapshot, width]);

  const visible = prepared?.key === paragraphKey ? prepared.value : null;
  const frameStyle = useAnimatedStyle(() => ({
    left: animatedFrame.x.value,
    top: animatedFrame.y.value,
    width: animatedFrame.width.value,
    height: animatedFrame.height.value,
  }));

  return (
    <Animated.View
      testID="watermark-stamp"
      pointerEvents="none"
      style={[styles.frame, frameStyle]}
    >
      <Canvas
        testID="watermark-canvas"
        pointerEvents="none"
        opaque={false}
        style={styles.fill}
      >
        {visible != null && (
          <Paragraph
            paragraph={visible.paragraph}
            x={visible.placement.x}
            y={visible.placement.y}
            width={visible.placement.width}
          />
        )}
      </Canvas>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  frame: { position: 'absolute', overflow: 'hidden' },
});
