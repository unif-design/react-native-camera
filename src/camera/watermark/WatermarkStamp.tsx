import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  r,
  fw,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import type { WatermarkType } from '../../utils';
import { VIEWFINDER } from '../colors/viewfinder';
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
    // 层级由外层 wrapper(Container 的 styles.watermark,zIndex: Z.overlay)统一提供 —— Stamp 自身
    // 不写死 zIndex(此前 7 与 Z.overlay 重复);Stamp 在 wrapper 内按 position 六选一 absolute 定位。
    root: { position: 'absolute' },
    line: {
      color: c.foreground,
      // 黑色描影:水印浮在任意照片上,白字 + 黑影保证可读(物理常量,非主题色)。
      textShadowColor: VIEWFINDER.watermarkShadow,
      textShadowRadius: r(3),
    },
    title: { fontWeight: fw.semi },
  });
