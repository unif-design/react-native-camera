import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
} from 'react-native-reanimated';
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

// 仅 0.5x / 1x 两档(用户拍板去掉 2x):0.5 仅超广角机型有,1x 恒有。
const ALL_STOPS = [0.5, 1] as const;
// 当前档判定阈值(display 空间):display ≥ 1 → 1 档高亮,否则 0.5 档高亮(到最广=0.5x 时 0.5 档亮)。
const ACTIVE_THRESHOLD = 1;

// reanimated 不能动画 <Text> 的 children,故当前高亮档的实时倍数用
// createAnimatedComponent(TextInput) + useAnimatedProps 写其 `text`(官方「animate text」范式):
// 文字全程由 UI 线程 SharedValue 驱动,pinch 全程 0 次 setState。editable=false + pointerEvents=none
// → 纯只读展示,不抢手势 / 不弹键盘。
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type Props = {
  // UI 线程当前 zoom(vzf);高亮 + 高亮档的实时倍数全程由它驱动,不走 setState。
  zoomShared: SharedValue<number>;
  // vzf → 用户倍数乘子(后置 0.5):display = vzf × displayMul,判档与点击跳档都在 display 空间。
  displayMul: number;
  // 是否渲染 0.5 档:设备最广 ≤ 0.5x(超广角)才显示;无超广角(前置/单广角)只剩 1 档。
  showHalf: boolean;
  // 点击跳档:传该档**用户倍数**(0.5 / 1),Container 反算 vzf = displayZ / displayMul。
  onSelect: (displayZ: number) => void;
};

export function ZoomChips({
  zoomShared,
  displayMul,
  showHalf,
  onSelect,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const stops = showHalf ? ALL_STOPS : ([1] as const);
  return (
    <View style={styles.container}>
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

  // 本档文字:仅**当前高亮档**实时显示 display 值(0.5→0.6→…→1.0→1.5…),其余档静态 0.5 / 1.0。
  // 全程 worklet 读 zoomShared → 0 次 setState;worklet 内只 toFixed + 字符串(JS 内置),
  // 绝不调 design r()/rf()(会触发 worklets「同步调 Remote Function」fatal,2.15.1 踩过)。
  // 静态档也用一位小数 → 与实时值 toFixed(1) **等长(恒 3 字符)**,静态↔实时切换时 TextInput
  // 不因字符数变化重新测量布局,消除「先隐藏再显示」的闪(配合下方 txt 固定宽度)。
  const staticLabel = stop === 0.5 ? '0.5' : '1.0';
  const animatedProps = useAnimatedProps<TextInputProps & { text?: string }>(
    () => {
      'worklet';
      const display = zoomShared.value * displayMul;
      const activeStop = display >= ACTIVE_THRESHOLD ? 1 : 0.5;
      return { text: activeStop === stop ? display.toFixed(1) : staticLabel };
    }
  );
  // value 给首帧/无动画环境(jest)兜底初值;运行时由 animatedProps.text 接管(0 次 setState)。
  const initialDisplay = zoomShared.value * displayMul;
  const initialActiveStop = initialDisplay >= ACTIVE_THRESHOLD ? 1 : 0.5;
  const initialLabel =
    initialActiveStop === stop ? initialDisplay.toFixed(1) : staticLabel;

  return (
    <TouchableOpacity
      testID={`zoom-chip-${stop}`}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Animated.View style={[styles.chip, chipStyle]}>
        {/* text 是原生 TextInput 内部属性(非 RN 公开 TS 类型),reanimated 把 worklet 算出的
            字符串直接写进去(0 次 setState),故 animatedProps 泛型补 text 字段。 */}
        <AnimatedTextInput
          editable={false}
          pointerEvents="none"
          value={initialLabel}
          animatedProps={animatedProps}
          style={[styles.txt, txtStyle]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    // 居中放档位药丸。
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
    txt: {
      color: c.foreground,
      fontSize: t.xs,
      fontWeight: fw.semi,
      textAlign: 'center',
      // TextInput 自带 padding,清零避免文字在小药丸里被截/偏移。
      padding: 0,
      // 固定宽度(够 "3.0" 三字符):0.5/1.0 档实时变化时 TextInput 都不随字符数重新测量布局 →
      // 文字在固定宽度内居中变,丝滑、不闪、不抖(配合上方等长 staticLabel)。
      width: r(30),
    },
  });
