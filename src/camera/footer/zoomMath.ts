// 变焦数学 —— 纯函数,既给单测,也是 Camera.tsx 里 Pinch worklet 的逻辑参照
// (worklet 内必须内联同样的式子,见 Camera 的 Gesture.Pinch)。
//
// 约定:display = 用户倍数(0.5x/1x/…),vzf = AVFoundation videoZoomFactor(设备内部值);
// display = vzf × displayMul(见 useZoomController 注释)。内部状态始终 vzf。
// 倍数显示 = vzf × displayMul;档位点击 vzf = displayZ / displayMul。

export function clamp(v: number, lo: number, hi: number): number {
  'worklet';
  return Math.min(Math.max(v, lo), hi);
}

// pinch:从手势起点 vzf 乘以双指 scale,再 clamp 到 [deviceMinZoom, min(deviceMaxZoom, 软上限 vzf)]。
// softMaxVzf = maxDisplay / displayMul(软上限 10x 对应的 vzf);见 useZoomController 的 maxDisplay。
// 系统相机式直觉:scale=2 → 倍数翻倍(乘性),无需对数曲线(pinch 手指间距比例天然是乘性)。
export function pinchVzf(
  startVzf: number,
  scale: number,
  deviceMinZoom: number,
  deviceMaxZoom: number,
  softMaxVzf: number
): number {
  'worklet';
  return clamp(
    startVzf * scale,
    deviceMinZoom,
    Math.min(deviceMaxZoom, softMaxVzf)
  );
}
