import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  r,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import { VIEWFINDER } from '../colors/viewfinder';

const ALL_STOPS = [0.5, 1, 2] as const;

export function ZoomChips({
  zoom,
  onSelect,
  minZoom = 1,
  maxZoom = Infinity,
}: {
  zoom: number;
  onSelect: (z: number) => void;
  minZoom?: number;
  maxZoom?: number;
}) {
  const styles = useThemedStyles(makeStyles);
  // 仅渲染设备支持的档位:0.5 需 minZoom≤0.5（超广角），2 需 maxZoom≥2。
  // ±1e-3 容差:device.minZoom/maxZoom 可能带浮点漂移,避免严格比较的边界漏判。
  const stops = ALL_STOPS.filter(
    (z) => z >= minZoom - 1e-3 && z <= maxZoom + 1e-3
  );
  return (
    <View style={styles.row}>
      {stops.map((z) => {
        const active = Math.abs(zoom - z) < 0.05;
        const base = z === 0.5 ? '.5' : `${z}`;
        return (
          <TouchableOpacity
            key={z}
            testID={`zoom-chip-${z}`}
            onPress={() => onSelect(z)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.txt, active && styles.txtActive]}>
              {active ? `${base}x` : base}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: r(8),
      padding: r(4),
      borderRadius: r(999),
      backgroundColor: VIEWFINDER.glassPillStrong,
    },
    chip: {
      width: r(32),
      height: r(32),
      borderRadius: r(16),
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipActive: { backgroundColor: c.foreground },
    txt: { color: c.foreground, fontSize: r(12), fontWeight: '500' },
    txtActive: { color: c.primary, fontSize: r(11), fontWeight: '700' },
  });
