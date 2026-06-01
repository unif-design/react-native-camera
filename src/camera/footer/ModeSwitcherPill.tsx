import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { r } from '@unif/react-native-design';
import { DARK } from '../colors/dark';

export type ModeItem = { key: string; label: string };

export function ModeSwitcherPill({
  items,
  currentIndex,
  onSelect,
}: {
  items: ModeItem[];
  currentIndex: number;
  onSelect: (i: number) => void;
}) {
  const [w, setW] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;
  const itemW = items.length ? w / items.length : 0;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: currentIndex * itemW,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [currentIndex, itemW, slide]);

  if (items.length === 1) {
    return <Text style={styles.singleLabel}>{items[0]!.label}</Text>;
  }
  return (
    <View
      style={styles.wrap}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
    >
      {itemW > 0 && (
        <Animated.View
          style={[
            styles.slider,
            { width: itemW, transform: [{ translateX: slide }] },
          ]}
        />
      )}
      {items.map((it, i) => {
        const sel = i === currentIndex;
        return (
          <TouchableOpacity
            key={it.key}
            testID={`mode-pill-${i}`}
            style={styles.item}
            onPress={() => onSelect(i)}
          >
            <Text style={[styles.txt, sel && styles.txtSel]}>{it.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignSelf: 'center', position: 'relative' },
  slider: {
    position: 'absolute',
    top: r(4),
    bottom: r(4),
    left: 0,
    borderRadius: r(999),
    backgroundColor: DARK.orange16,
  },
  item: {
    paddingVertical: r(8),
    paddingHorizontal: r(22),
    alignItems: 'center',
  },
  txt: {
    color: DARK.white65,
    fontSize: r(15),
    fontWeight: '500',
    letterSpacing: 1,
  },
  txtSel: { color: DARK.orange, fontWeight: '600' },
  singleLabel: {
    color: DARK.white65,
    fontSize: r(14),
    letterSpacing: 2,
    alignSelf: 'center',
  },
});
