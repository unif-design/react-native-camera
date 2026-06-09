import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { r, rf, useColors } from '@unif/react-native-design';
import { ZoomChips } from './ZoomChips';

// 软吸附档位(display 空间):松手时若落在某档 ±5% 内,withTiming 吸过去(手感对齐系统相机)。
const SNAP_STOPS = [0.5, 1, 2] as const;
const SNAP_TOLERANCE = 0.05;
// trackWidthPx 首帧 onLayout 未量到时的兜底宽度(防除以 0 / 首帧手势失灵)。
const TRACK_FALLBACK = r(220);

type Props = {
  // 受控 zoom(vzf);Pan 直接写它,Container 的 useAnimatedReaction 节流回写 state。
  zoomShared: SharedValue<number>;
  // 当前用户倍数(display = zoom×displayMul),用于拖动中大号文字显示(Container 已乘好)。
  displayZoom: number;
  // display↔vzf 换算因子(后置 dual=0.5);min/maxDisplay 是 display 空间的连续范围两端。
  displayMul: number;
  minDisplay: number;
  maxDisplay: number;
  // 设备 vzf 原始范围,clamp 落点用(软上限另在 maxDisplay 里已并入)。
  deviceMinZoom: number;
  deviceMaxZoom: number;
  // 透传给底层档位药丸:点击跳档仍走 onSelect(display→vzf 在 Container 反算)。
  minZoom: number;
  maxZoom: number;
  onSelect: (displayZ: number) => void;
};

export function ZoomSlider({
  zoomShared,
  displayZoom,
  displayMul,
  minDisplay,
  maxDisplay,
  deviceMinZoom,
  deviceMaxZoom,
  minZoom,
  maxZoom,
  onSelect,
}: Props) {
  const c = useColors();
  const [trackWidth, setTrackWidth] = useState(TRACK_FALLBACK);
  // 拖动起点的 vzf(onBegin 锁定),onUpdate 据其换算起点进度 t0。
  const startVzf = useSharedValue(0);
  // 1=拖动中(浮大号倍数 + 隐药丸),0=idle(显药丸)。松手 withTiming 淡回 0。
  const dragging = useSharedValue(0);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setTrackWidth(w);
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      startVzf.value = zoomShared.value;
      dragging.value = withTiming(1, { duration: 120 });
    })
    .onUpdate((e) => {
      'worklet';
      // 起点 display→进度 t0,叠加横向位移占轨宽的比例(向右=放大)→ 新进度 t。
      const startDisplay = startVzf.value * displayMul;
      const t0 =
        Math.log(startDisplay / minDisplay) / Math.log(maxDisplay / minDisplay);
      const t = t0 + e.translationX / trackWidth;
      // t→display(对数插值)→vzf,再 clamp 到设备范围 ∩ 软上限。
      const tc = Math.min(Math.max(t, 0), 1);
      const d = minDisplay * Math.pow(maxDisplay / minDisplay, tc);
      const vzf = d / displayMul;
      const vzfSoftMax = maxDisplay / displayMul;
      zoomShared.value = Math.min(
        Math.max(vzf, deviceMinZoom),
        Math.min(deviceMaxZoom, vzfSoftMax)
      );
    })
    .onEnd(() => {
      'worklet';
      // 软吸附:松手靠近 0.5/1/2 档(display ±5%)→ 吸过去。
      const d = zoomShared.value * displayMul;
      for (let i = 0; i < SNAP_STOPS.length; i++) {
        const s = SNAP_STOPS[i]!;
        if (
          s >= minDisplay &&
          s <= maxDisplay &&
          Math.abs(d - s) / s < SNAP_TOLERANCE
        ) {
          zoomShared.value = withTiming(s / displayMul, { duration: 120 });
          break;
        }
      }
    })
    .onFinalize(() => {
      'worklet';
      // 松手 / 取消都淡出大号倍数(~300ms 后回药丸,给读数留一眼)。
      dragging.value = withTiming(0, { duration: 300 });
    });

  // 大号倍数:拖动中 opacity→1,松手→0;药丸相反(拖动隐、idle 显)。
  const bigStyle = useAnimatedStyle(() => ({ opacity: dragging.value }));
  const chipsStyle = useAnimatedStyle(() => ({ opacity: 1 - dragging.value }));

  // 拖动中大号文字:<10 一位小数(1.5×),≥10 取整(12×)——纯数字裁切区不强调小数。
  const big =
    displayZoom >= 10
      ? `${Math.round(displayZoom)}×`
      : `${displayZoom.toFixed(1)}×`;

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.container} onLayout={onTrackLayout}>
        <Animated.View
          pointerEvents="none"
          style={[styles.bigWrap, bigStyle]}
          testID="zoom-big"
        >
          <Text style={[styles.bigText, { color: c.foreground }]}>{big}</Text>
        </Animated.View>
        <Animated.View style={chipsStyle}>
          <ZoomChips
            zoom={displayZoom}
            minZoom={minZoom}
            maxZoom={maxZoom}
            onSelect={onSelect}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  // 轨道容器:onLayout 量宽给 Pan 当 trackWidthPx;居中放药丸。
  container: { alignItems: 'center', justifyContent: 'center' },
  // 大号倍数浮在药丸正上方(absolute,不占布局,药丸位置不跳)。
  bigWrap: {
    position: 'absolute',
    bottom: r(44),
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigText: {
    fontSize: rf(28),
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
