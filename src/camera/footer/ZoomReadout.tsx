import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { r, rf, useColors } from '@unif/react-native-design';

// 大号实时倍数:pinch 过程连续显示用户倍数(= zoomShared × displayMul),格式 0.5x→0.6x→…→1.0x。
//
// 性能根治:文字全程由 UI 线程 SharedValue 驱动,**不走 setState**。reanimated 不能动画 <Text>
// 的 children,故用 createAnimatedComponent(TextInput)+ useAnimatedProps 写其 `text`(官方
// 「animate text」范式);editable=false + pointerEvents=none → 纯只读展示,不抢手势/不弹键盘。
// opacity 由 pinching(Camera 的 Pinch 写)驱动:idle=0 隐藏、pinch 中=1。
//
// ⚠️ worklet 内禁调用 design r()/rf()(会触发 worklets「同步调 Remote Function」fatal,2.15.1 踩过):
// 字号/留白在 worklet 外用 r()/rf() 预算成数字常量(见 styles),worklet 只做 toFixed+字符串拼接(JS 内置)。
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type Props = {
  zoomShared: SharedValue<number>;
  pinching: SharedValue<number>;
  displayMul: number;
};

export function ZoomReadout({ zoomShared, pinching, displayMul }: Props) {
  const c = useColors();

  // text 是原生 TextInput 的内部属性(非 RN 公开 TS 类型),reanimated 把 worklet 算出的字符串
  // 直接写进去(0 次 setState),故泛型补上 text 字段。这是官方「animate text」范式。
  const animatedProps = useAnimatedProps<TextInputProps & { text?: string }>(
    () => {
      'worklet';
      return { text: `${(zoomShared.value * displayMul).toFixed(1)}x` };
    }
  );

  // idle 完全透明(不占视觉),pinch 中浮现;opacity 跟随 pinching(松手 Camera 端 withTiming 淡回 0)。
  const wrapStyle = useAnimatedStyle(() => ({ opacity: pinching.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, wrapStyle]}
      testID="zoom-readout"
    >
      <AnimatedTextInput
        editable={false}
        pointerEvents="none"
        // value 给首帧/无动画环境(jest)兜底初值;运行时由 animatedProps.text 接管。
        value={`${(zoomShared.value * displayMul).toFixed(1)}x`}
        animatedProps={animatedProps}
        style={[styles.text, { color: c.foreground }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 浮在档位药丸正上方(absolute,不占布局,药丸位置不跳)。
  wrap: {
    position: 'absolute',
    bottom: r(44),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: rf(28),
    fontWeight: '600',
    textAlign: 'center',
    // TextInput 自带 padding,清零避免大号字被截。
    padding: 0,
    minWidth: r(80),
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
