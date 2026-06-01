import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { r } from '@unif/react-native-design';
import { DARK } from './colors/dark';
import type { Point } from '../utils';

type Props = { point: Point; onAnimationEnd: () => void };

// 聚焦指示器(取景态固定深色,品牌橙):四角括号 + 中心点 + 右侧曝光小太阳。
// 设计稿 viewBox 390×844 视口下盒子 110×88,transformOrigin 居中(44,44)。
// 多段动画:淡入放大 1.35 → 回弹 0.94 → 1 → 定格(opacity 0.72),约 1.3s 后 onAnimationEnd()。
const VB_W = 110;
const VB_H = 88;
const W = r(VB_W);
const H = r(VB_H);

// 曝光小太阳中心(右侧)与半径,8 道短射线绕一圈。
const SUN_CX = 97;
const SUN_CY = 44;
const SUN_R = 4.5;
const RAY_INNER = SUN_R + 2.5;
const RAY_OUTER = SUN_R + 6;
const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

export function FocusIndicator({ point, onAnimationEnd }: Props) {
  const scale = useRef(new Animated.Value(1.35)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 0.94,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.delay(800),
      Animated.timing(opacity, {
        toValue: 0.72,
        duration: 180,
        useNativeDriver: true,
      }),
    ]);
    anim.start(() => onAnimationEnd());
    return () => anim.stop();
  }, [scale, opacity, onAnimationEnd]);

  return (
    <Animated.View
      pointerEvents="none"
      testID="focus-indicator"
      style={[
        styles.box,
        {
          left: point.x - W / 2,
          top: point.y - H / 2,
          opacity,
          transform: [{ scale }],
        },
      ]}
    >
      <AnimatedSvg width={W} height={H} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        {/* 四角括号(约 64×64 居中,中心 55,44) */}
        <Path
          d="M23 31v-8h8 M79 23h8v8 M87 57v8h-8 M31 65h-8v-8"
          stroke={DARK.orange}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* 中心点 */}
        <Circle cx={55} cy={44} r={2.4} fill={DARK.orange} />
        {/* 曝光小太阳:圆 + 8 道短射线 + 上下引导线 */}
        <Circle
          cx={SUN_CX}
          cy={SUN_CY}
          r={SUN_R}
          stroke={DARK.orange}
          strokeWidth={1.6}
          fill="rgba(235,110,0,0.2)"
        />
        {RAY_ANGLES.map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          return (
            <Line
              key={deg}
              x1={SUN_CX + cos * RAY_INNER}
              y1={SUN_CY + sin * RAY_INNER}
              x2={SUN_CX + cos * RAY_OUTER}
              y2={SUN_CY + sin * RAY_OUTER}
              stroke={DARK.orange}
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          );
        })}
        {/* 拖动调曝光的引导线(上下各一条,半透明) */}
        <Line
          x1={SUN_CX}
          y1={20}
          x2={SUN_CX}
          y2={34}
          stroke={DARK.orange}
          strokeWidth={1.6}
          opacity={0.45}
          strokeLinecap="round"
        />
        <Line
          x1={SUN_CX}
          y1={54}
          x2={SUN_CX}
          y2={68}
          stroke={DARK.orange}
          strokeWidth={1.6}
          opacity={0.45}
          strokeLinecap="round"
        />
      </AnimatedSvg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    width: W,
    height: H,
  },
});
