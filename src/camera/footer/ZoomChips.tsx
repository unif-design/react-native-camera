import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import {
  r,
  fw,
  type as t,
  useThemedStyles,
  useColors,
  type ColorTokens,
} from '@unif/react-native-design';
import { VIEWFINDER } from '../colors/viewfinder';
import { ZoomReadout } from './ZoomReadout';

// 仅 0.5x / 1x 两档(用户拍板去掉 2x):0.5 仅超广角机型有,1x 恒有。
const ALL_STOPS = [0.5, 1] as const;
// 当前档判定阈值(display 空间):display ≥ 1 → 1 档高亮,否则 0.5 档高亮(到最广=0.5x 时 0.5 档亮)。
const ACTIVE_THRESHOLD = 1;

type Props = {
  // UI 线程当前 zoom(vzf);高亮 + 大号倍数全程由它驱动,不走 setState。
  zoomShared: SharedValue<number>;
  // 1=pinch 中(浮大号倍数),0=idle;Camera 的 Pinch 写,ZoomReadout 读其 opacity。
  pinching: SharedValue<number>;
  // vzf → 用户倍数乘子(后置 0.5):display = vzf × displayMul,判档与点击跳档都在 display 空间。
  displayMul: number;
  // 是否渲染 0.5 档:设备最广 ≤ 0.5x(超广角)才显示;无超广角(前置/单广角)只剩 1 档。
  showHalf: boolean;
  // 点击跳档:传该档**用户倍数**(0.5 / 1),Container 反算 vzf = displayZ / displayMul。
  onSelect: (displayZ: number) => void;
};

export function ZoomChips({
  zoomShared,
  pinching,
  displayMul,
  showHalf,
  onSelect,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const stops = showHalf ? ALL_STOPS : ([1] as const);
  return (
    <View style={styles.container}>
      {/* pinch 中浮在档位药丸正上方的大号实时倍数(absolute,不占布局)。 */}
      <ZoomReadout
        zoomShared={zoomShared}
        pinching={pinching}
        displayMul={displayMul}
      />
      <View style={styles.row}>
        {stops.map((stop) => (
          <ZoomChip
            key={stop}
            stop={stop}
            zoomShared={zoomShared}
            displayMul={displayMul}
            onPress={() => onSelect(stop)}
          />
        ))}
      </View>
    </View>
  );
}

function ZoomChip({
  stop,
  zoomShared,
  displayMul,
  onPress,
}: {
  stop: number;
  zoomShared: SharedValue<number>;
  displayMul: number;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);

  // 当前档高亮:display = zoomShared × displayMul,≥ 阈值算 1 档当前,否则 0.5 档当前。
  // 全在 worklet 读 zoomShared → UI 线程驱动药丸底色/字色,pinch 全程 0 次 setState。
  const chipStyle = useAnimatedStyle(() => {
    const display = zoomShared.value * displayMul;
    const active = display >= ACTIVE_THRESHOLD ? 1 : 0.5;
    const isActive = active === stop;
    return { backgroundColor: isActive ? c.foreground : 'transparent' };
  });
  const txtStyle = useAnimatedStyle(() => {
    const display = zoomShared.value * displayMul;
    const active = display >= ACTIVE_THRESHOLD ? 1 : 0.5;
    const isActive = active === stop;
    return { color: isActive ? c.primary : c.foreground };
  });

  const label = stop === 0.5 ? '.5' : `${stop}`;
  return (
    <TouchableOpacity
      testID={`zoom-chip-${stop}`}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Animated.View style={[styles.chip, chipStyle]}>
        <Animated.Text style={[styles.txt, txtStyle]}>{label}</Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    // 居中放档位药丸;大号倍数 absolute 浮其上方(bottom 偏移),不占布局、药丸不跳。
    container: { alignItems: 'center', justifyContent: 'center' },
    row: {
      flexDirection: 'row',
      gap: r(8),
      padding: r(4),
      borderRadius: r(999),
      backgroundColor: VIEWFINDER.glassPillStrong,
    },
    chip: {
      width: r(36),
      height: r(36),
      borderRadius: r(18),
      alignItems: 'center',
      justifyContent: 'center',
    },
    txt: { color: c.foreground, fontSize: t.xs, fontWeight: fw.semi },
  });
