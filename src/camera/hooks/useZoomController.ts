import { useEffect, useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { CameraDevice } from 'react-native-vision-camera';

// 变焦软上限(用户倍数 display 空间)。device.maxZoom 在多镜头机型可达 ~123x,
// 但 >3x 已是纯数字裁切(画质崩、不实用),故 pinch 放大 + 档位上限统一软钳到 3x
// (下限仍是设备 minZoom×displayMul,后置 0.5x)。pinch / 档位都读这个值派生的 maxDisplay,
// 改这一处即全局生效;Camera 的 Pinch worklet 用 softMaxVzf = maxDisplay/displayMul = 3/displayMul。
// 纯 JS 常量(非 worklet 内,不触发「worklet 内禁 design r()」红屏),改上限只动此处。
const SOFT_MAX_DISPLAY = 3;

export type ZoomController = {
  /** 当前 zoom(vzf 空间,= 用户倍数 / displayMul)。仅手势结束/点击档/设备切换时更新,pinch 全程不刷。 */
  zoom: number;
  setZoom: (z: number) => void;
  /** UI 线程 zoom(vzf):pinch 实时写、vision-camera 直接消费、档位高亮 + 高亮档实时倍数都由它驱动(0 次 setState)。 */
  zoomShared: SharedValue<number>;
  /** vzf → 用户倍数的乘子(后置超广角 0.5,其余 1)。 */
  displayMul: number;
  /** display 空间下限(设备最广,后置 0.5x)。 */
  minDisplay: number;
  /** display 空间上限(软钳到 SOFT_MAX_DISPLAY)。 */
  maxDisplay: number;
};

/**
 * 变焦控制器:vzf↔display 推导 + zoom state/shared + 设备切换 clamp。
 * device 可选:device==null guard 之前就要算 displayMul/min/maxDisplay,故全程可选链兜底。
 *
 * 性能:zoom 显示全部走 UI 线程 SharedValue(zoomShared)——
 * vision-camera `zoom={zoomShared}`、高亮档实时倍数(useAnimatedProps)、档位高亮(useAnimatedStyle)
 * 都直接读 zoomShared,pinch 期间**不触发任何 JS setState**(早期 useAnimatedReaction→runOnJS(setZoom)
 * 每帧回写 state、整树重渲染 → 放大缩小卡。已删除)。JS 侧 `zoom` 只在手势结束/点击档/设备切换
 * 各回写一次,供档位点击态与设备切换 clamp 用。
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

  // display 空间范围:下限 = 设备最广(后置 0.5x),上限软钳到 SOFT_MAX_DISPLAY。
  // 在 device==null guard 之前用,故全程可选链兜底(guard 后 device 必非空,值会重算正确)。
  const minDisplay = (device?.minZoom ?? 1) * displayMul;
  const maxDisplay = Math.min(
    (device?.maxZoom ?? 1) * displayMul,
    SOFT_MAX_DISPLAY
  );

  // 初值 1(vzf)= 设备最广镜头 = 默认档:后置超广角机型 displayMul=0.5 → 用户 0.5x;
  // 前置/无超广角 displayMul=1 → 用户 1x。不在首帧改默认档(device 异步、首帧 displayMul 未 ready,
  // 强设「用户 1.0x 的 vzf」会落空仍停在 0.5x);默认就用最广,用户要更近自行 pinch/点档。
  const [zoom, setZoom] = useState(1);
  const zoomShared = useSharedValue(1);

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

  return {
    zoom,
    setZoom,
    zoomShared,
    displayMul,
    minDisplay,
    maxDisplay,
  };
}
