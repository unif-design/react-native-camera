import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Canvas, Paragraph } from '@shopify/react-native-skia';
import type { WatermarkType } from '../../utils';
import type { CameraFrameRect } from '../session/frameRect';
import {
  createWatermarkParagraph,
  hasVisibleWatermark,
  type WatermarkParagraph,
} from './paragraph';

type Props = {
  watermark: WatermarkType;
  /**
   * Task 6 会让 Camera 与水印强制消费同一个 frame；当前兼容旧 Container，
   * 未传时只测量父取景框，不再读取 window 尺寸。
   */
  frame?: CameraFrameRect;
};

type PreparedState = {
  key: string;
  value: WatermarkParagraph;
};

export function WatermarkStamp({ watermark, frame }: Props) {
  const [measured, setMeasured] = useState({ width: 0, height: 0 });
  const width = frame?.width ?? measured.width;
  const height = frame?.height ?? measured.height;
  const contentKey = JSON.stringify(watermark.content);
  const paragraphKey = `${width}:${height}:${watermark.position ?? 'top-right'}:${contentKey}`;
  const [prepared, setPrepared] = useState<PreparedState | null>(null);

  useEffect(() => {
    if (width <= 0 || height <= 0 || !hasVisibleWatermark(watermark)) {
      setPrepared(null);
      return;
    }

    const value = createWatermarkParagraph(width, height, watermark);
    setPrepared({ key: paragraphKey, value });
    return () => value.dispose();
  }, [height, paragraphKey, watermark, width]);

  const onLayout =
    frame == null
      ? (event: LayoutChangeEvent) => {
          const { width: nextWidth, height: nextHeight } =
            event.nativeEvent.layout;
          setMeasured({ width: nextWidth, height: nextHeight });
        }
      : undefined;
  const visible = prepared?.key === paragraphKey ? prepared.value : null;
  const rootStyle =
    frame == null
      ? styles.fill
      : [
          styles.frame,
          {
            left: frame.x,
            top: frame.y,
            width: frame.width,
            height: frame.height,
          },
        ];

  return (
    <View
      testID="watermark-stamp"
      pointerEvents="none"
      onLayout={onLayout}
      style={rootStyle}
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
    </View>
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
