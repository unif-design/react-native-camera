import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { r } from '@unif/react-native-design';
import { DARK } from '../colors/dark';

const STOPS = [0.5, 1, 2] as const;

export function ZoomChips({
  zoom,
  onSelect,
}: {
  zoom: number;
  onSelect: (z: number) => void;
}) {
  return (
    <View style={styles.row}>
      {STOPS.map((z) => {
        const active = Math.abs(zoom - z) < 0.05;
        return (
          <TouchableOpacity
            key={z}
            testID={`zoom-chip-${z}`}
            onPress={() => onSelect(z)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.txt, active && styles.txtActive]}>
              {active ? `${z}x` : `${z}`}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: r(8),
    padding: r(4),
    borderRadius: r(999),
    backgroundColor: DARK.black45,
  },
  chip: {
    width: r(32),
    height: r(32),
    borderRadius: r(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: DARK.white95 },
  txt: { color: DARK.white, fontSize: r(12), fontWeight: '500' },
  txtActive: { color: DARK.orange, fontSize: r(11), fontWeight: '700' },
});
