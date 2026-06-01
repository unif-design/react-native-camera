import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { r } from '@unif/react-native-design';
import type { WatermarkType } from '../../utils';
import { DARK } from '../colors/dark';
import { computeWatermarkLayout } from './layout';

export function WatermarkStamp({ watermark }: { watermark: WatermarkType }) {
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

const styles = StyleSheet.create({
  root: { position: 'absolute', zIndex: 7 },
  line: {
    color: DARK.white,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: r(3),
  },
  title: { fontWeight: '600' },
});
