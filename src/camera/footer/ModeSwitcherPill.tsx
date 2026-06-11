import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import {
  r,
  fw,
  type as t,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';

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
  const styles = useThemedStyles(makeStyles);
  const [w, setW] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;
  const itemW = items.length ? w / items.length : 0;
  // 上次已定位的档位:区分「(重)挂载/relayout 直接落位」与「用户切档平滑滑动」。
  // 烧水印时 Container 卸载本组件、烧完重挂(录像 start/stop 同理切走计时器再切回)——
  // slide 是组件内部 Animated.Value(0),重挂会重置回 0(首档),若仍 timing 滑到当前档,
  // 视觉上就是"切到首档又滑回当前档"(连拍误显为先跳单拍再弹回)。故首次测量(prev==null)
  // 与同档 relayout 直接 setValue 落位,只有 currentIndex 真正变化才动画。
  const positionedIndex = useRef<number | null>(null);

  useEffect(() => {
    if (itemW <= 0) return; // 尚未拿到布局宽度,无法定位
    const target = currentIndex * itemW;
    const prev = positionedIndex.current;
    positionedIndex.current = currentIndex;
    if (prev == null || prev === currentIndex) {
      slide.setValue(target); // (重)挂载首次落位 / 同档 relayout:直接定位,不从 0 滑入
      return;
    }
    Animated.timing(slide, {
      toValue: target,
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
      testID="mode-switcher-wrap"
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

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    wrap: { flexDirection: 'row', alignSelf: 'center', position: 'relative' },
    slider: {
      position: 'absolute',
      top: r(4),
      bottom: r(4),
      left: 0,
      borderRadius: r(999),
      // 选中段底:品牌橙浅 tint(design dark brandTint10 = 橙 16% alpha,与原值一致)。
      backgroundColor: c.brandTint10,
    },
    item: {
      paddingVertical: r(8),
      paddingHorizontal: r(22),
      alignItems: 'center',
    },
    txt: {
      color: c.foregroundMuted,
      fontSize: t.body,
      fontWeight: fw.medium,
      letterSpacing: 1,
    },
    txtSel: { color: c.primary, fontWeight: fw.semi },
    singleLabel: {
      color: c.foregroundMuted,
      fontSize: t.sm,
      letterSpacing: 2,
      alignSelf: 'center',
    },
  });
