import { useEffect, useState } from 'react';
import {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import type { CameraDevice } from 'react-native-vision-camera';

// 变焦滚条软上限(用户倍数 display 空间):官方 4.x example 用 MAX_ZOOM_FACTOR=10。
// device.maxZoom 在多镜头机型可达 ~123x,但 >10x 是纯数字裁切(画质崩、不实用),
// 故连续滚条上限软钳到 10x(下限仍是设备 minZoom×displayMul,后置 0.5x)。
const SOFT_MAX_DISPLAY = 10;

export type ZoomController = {
  /** 当前 zoom(vzf 空间,= 用户倍数 / displayMul)。 */
  zoom: number;
  setZoom: (z: number) => void;
  /** UI 线程 zoom(vzf),pinch/拖动实时写、节流回写 zoom state。 */
  zoomShared: SharedValue<number>;
  /** vzf → 用户倍数的乘子(后置超广角 0.5,其余 1)。 */
  displayMul: number;
  /** display 空间下限(设备最广,后置 0.5x)。 */
  minDisplay: number;
  /** display 空间上限(软钳到 SOFT_MAX_DISPLAY)。 */
  maxDisplay: number;
};

/**
 * 变焦控制器:vzf↔display 推导 + zoom state/shared + 节流回写 + 设备切换 clamp。
 * device 可选:device==null guard 之前就要算 displayMul/min/maxDisplay,故全程可选链兜底。
 */
export function useZoomController(
  device: CameraDevice | undefined
): ZoomController {
  // vision-camera 5.x:device.zoom/minZoom/maxZoom 是 AVFoundation videoZoomFactor(vzf,
  // 相对设备最广镜头),不是用户倍数。用户倍数 = vzf × displayMul。
  // displayMul 从 zoomLensSwitchFactors[0]( = virtualDeviceSwitchOverVideoZoomFactors[0],
  // 即切到下一颗物理镜头/用户 1x 对应的 vzf)反推:iPhone 后置 dual(wide+ultra)switchFactors=[2.0]
  // → displayMul=0.5(vzf 1.0=minZoom=超广角=用户 0.5x、vzf 2.0=广角=用户 1x)。
  // 无超广角(前置/单广角机型)switchFactors 为空 → switch0=0 → displayMul=1(无 0.5x,fallback)。
  const switch0 = device?.zoomLensSwitchFactors?.[0] ?? 0;
  const displayMul = switch0 > 1 ? 1 / switch0 : 1;

  // 连续滚条的 display 空间范围:下限 = 设备最广(后置 0.5x),上限软钳到 SOFT_MAX_DISPLAY。
  // 在 device==null guard 之前用,故全程可选链兜底(guard 后 device 必非空,值会重算正确)。
  const minDisplay = (device?.minZoom ?? 1) * displayMul;
  const maxDisplay = Math.min(
    (device?.maxZoom ?? 1) * displayMul,
    SOFT_MAX_DISPLAY
  );

  const [zoom, setZoom] = useState(1);
  const zoomShared = useSharedValue(1);

  // pinch 实时更新 zoomShared(UI 线程),这里节流回写 zoom state 让变焦条近实时跟手。
  // 只读 zoomShared、只 setZoom(不回写 zoomShared)→ 不成环:pinch→zoomShared→reaction→
  // setZoom 到此为止;点击 chip 是另一路(setZoom + zoomShared.value= 一起,见 onSelect)。
  useAnimatedReaction(
    () => zoomShared.value,
    (cur, prev) => {
      // 节流:变化够大才回写 state,避免每帧 setState。
      if (prev == null || Math.abs(cur - prev) > 0.02) runOnJS(setZoom)(cur);
    }
  );

  // 设备切换(翻转前/后摄)后,把当前 zoom clamp 回新设备的 min/max 范围。
  // 有意只依赖 device:仅在设备切换时 clamp,不随 zoom 变化重跑。
  useEffect(() => {
    if (device == null) return;
    const z = Math.min(Math.max(zoom, device.minZoom), device.maxZoom);
    if (z !== zoom) {
      setZoom(z);
      zoomShared.value = z;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device]);

  return { zoom, setZoom, zoomShared, displayMul, minDisplay, maxDisplay };
}
