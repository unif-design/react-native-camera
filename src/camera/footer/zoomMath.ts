// 连续变焦的对数(log-lerp)曲线数学 —— 纯函数,既给单测,也是 ZoomSlider 里 Pan worklet
// 的逻辑参照(worklet 内必须内联同样的式子,见 ZoomSlider)。
//
// 为什么对数而非线性:系统相机里「等距拖动 = 等倍率比」(0.5→1 和 1→2 拖动距离相同),
// 线性插值会让低倍区间过于灵敏、高倍区间太迟钝。对数插值 display = min·(max/min)^t 满足
// 「进度 t 等差 ⇒ 倍率等比」,手感与原生一致。
//
// 约定:display = 用户倍数(0.5x/1x/…),vzf = AVFoundation videoZoomFactor(设备内部值);
// display = vzf × displayMul(见 Container 注释)。内部状态始终 vzf,只在此层 ×/÷ displayMul。

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

// 进度 t∈[0,1] → 用户倍数(display)。t=0 落 minDisplay,t=1 落 maxDisplay,中间对数插值。
export function progressToDisplay(
  t: number,
  minDisplay: number,
  maxDisplay: number
): number {
  return minDisplay * Math.pow(maxDisplay / minDisplay, clamp(t, 0, 1));
}

// 用户倍数(display) → 进度 t(progressToDisplay 的逆)。供 onBegin 把当前 zoom 换成起点 t0。
export function displayToProgress(
  d: number,
  minDisplay: number,
  maxDisplay: number
): number {
  return Math.log(d / minDisplay) / Math.log(maxDisplay / minDisplay);
}

// 进度 t → vzf(受控 zoom 的实际值):先对数插值出 display,÷displayMul 回 vzf,
// 再 clamp 到 [deviceMinZoom, min(deviceMaxZoom, 软上限对应 vzf)]。
// 软上限:maxDisplay 已是 min(device.maxZoom×mul, SOFT_MAX_DISPLAY),其对应 vzf = maxDisplay/displayMul。
export function progressToVzf(
  t: number,
  minDisplay: number,
  maxDisplay: number,
  displayMul: number,
  deviceMinZoom: number,
  deviceMaxZoom: number
): number {
  const d = progressToDisplay(t, minDisplay, maxDisplay);
  const vzf = d / displayMul;
  const vzfSoftMax = maxDisplay / displayMul;
  return clamp(vzf, deviceMinZoom, Math.min(deviceMaxZoom, vzfSoftMax));
}
