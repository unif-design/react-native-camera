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
// softMaxVzf = maxDisplay / displayMul(软上限对应 vzf;见 useZoomController.SOFT_MAX_DISPLAY=3)。
// 本函数对 cap 值不敏感(softMaxVzf 是入参)—— 单测用任意样本值验证 clamp 行为即可,不绑具体上限。
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

// 当前高亮档(display 空间):display ≥ 1 → 1 档,否则 0.5 档(到最广 = 0.5x 时高亮 0.5 档)。
// 'worklet' —— ZoomChips 在 useAnimatedStyle/useAnimatedProps 里读它驱动药丸高亮/实时倍数(0 次 setState),
// 故须可在 UI 线程跑;只做数值比较(JS 内置),不调 design r()(worklet 内禁,见 useZoomController 注释)。
export function activeStop(display: number): number {
  'worklet';
  return display >= 1 ? 1 : 0.5;
}
