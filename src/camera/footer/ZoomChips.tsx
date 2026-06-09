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
  // 区间高亮:当前 zoom 落在哪个档区间,那一档(且仅那一档)高亮并显示"实际倍数"。
  // 当前档 = stops 中 ≤ zoom 的最大者(zoom 比所有档都小则取最小档);例如 0.5/1/2 三档时
  // zoom<1→0.5 档、1≤zoom<2→1 档、zoom≥2→2 档(无 2 档则归最大可用档)。
  const activeStop =
    [...stops].reverse().find((s) => zoom >= s - 1e-3) ?? stops[0];
  return (
    <View style={styles.row}>
      {stops.map((z) => {
        const isActive = z === activeStop;
        const base = z === 0.5 ? '.5' : `${z}`;
        // 当前档显示实际倍数(1 位小数,如 0.9x/1.5x);非当前档显示标称(.5/1/2)。
        const label = isActive ? `${zoom.toFixed(1)}x` : base;
        return (
          <TouchableOpacity
            key={z}
            testID={`zoom-chip-${z}`}
            onPress={() => onSelect(z)}
            style={[styles.chip, isActive && styles.chipActive]}
          >
            <Text style={[styles.txt, isActive && styles.txtActive]}>
              {label}
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
