import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  r,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import type { WatermarkType } from '../../utils';
import { computeWatermarkLayout } from './layout';

export function WatermarkStamp({ watermark }: { watermark: WatermarkType }) {
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const L = computeWatermarkLayout(width, watermark);
  const horiz =
    L.align === 'right'
      ? { right: L.pad, alignItems: 'flex-end' as const }
      : L.align === 'center'
        ? { left: 0, right: 0, alignItems: 'center' as const }
        : { left: L.pad, alignItems: 'flex-start' as const };
  const vert = L.anchorY === 'top' ? { top: L.pad } : { bottom: L.pad };
  return (
    <View
      testID="watermark-stamp"
      pointerEvents="none"
      style={[styles.root, { maxWidth: L.maxWidth }, horiz, vert]}
    >
      {watermark.content.map((line, i) => (
        <Text
          key={`${i}-${line}`}
          style={[
            styles.line,
            { fontSize: L.fontSize, textAlign: L.align },
            i === 0 && styles.title,
          ]}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: { position: 'absolute', zIndex: 7 },
    line: {
      color: c.foreground,
      // 黑色描影:水印浮在任意照片上,白字 + 黑影保证可读(物理常量,非主题色)。
      textShadowColor: 'rgba(0,0,0,0.7)',
      textShadowRadius: r(3),
    },
    title: { fontWeight: '600' },
  });
