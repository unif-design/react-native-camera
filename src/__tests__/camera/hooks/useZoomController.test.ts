import { renderHook, act } from '@testing-library/react-native';
import type { CameraDevice } from 'react-native-vision-camera';
import {
  useZoomController,
  type ZoomController,
} from '../../../camera/hooks/useZoomController';

type DeviceProps = { device: CameraDevice | undefined };

// useZoomController 只用 device 的 minZoom/maxZoom/zoomLensSwitchFactors,造最小桩即可。
// 这里不依赖 vision-camera mock(直接传 device 对象),只复用全局 reanimated 桩
// (useSharedValue→{value}):故重点测 displayMul 数学 + 设备切换 clamp。
// 注:pinch 实时回写已不走 useAnimatedReaction→setZoom(性能根治,见 useZoomController),
// zoom state 仅手势结束/点击档/设备切换更新。
function makeDevice(p: {
  minZoom: number;
  maxZoom: number;
  switchFactors: number[];
}): CameraDevice {
  return {
    minZoom: p.minZoom,
    maxZoom: p.maxZoom,
    zoomLensSwitchFactors: p.switchFactors,
  } as unknown as CameraDevice;
}

describe('displayMul / min-maxDisplay 推导', () => {
  it('后置 dual(switchFactors=[2])→ displayMul=0.5,display 范围 [0.5, 4]', () => {
    const dev = makeDevice({ minZoom: 1, maxZoom: 8, switchFactors: [2] });
    const { result } = renderHook(() => useZoomController(dev));
    expect(result.current.displayMul).toBe(0.5);
    // minDisplay = minZoom(1) × 0.5 = 0.5;maxDisplay = min(maxZoom(8)×0.5, 10) = 4
    expect(result.current.minDisplay).toBe(0.5);
    expect(result.current.maxDisplay).toBe(4);
  });

  it('无超广角(switchFactors=[])→ displayMul=1(fallback)', () => {
    const dev = makeDevice({ minZoom: 1, maxZoom: 8, switchFactors: [] });
    const { result } = renderHook(() => useZoomController(dev));
    expect(result.current.displayMul).toBe(1);
    expect(result.current.minDisplay).toBe(1);
    expect(result.current.maxDisplay).toBe(8);
  });

  it('switch0 ≤ 1 视为无效 → displayMul=1', () => {
    // 防御:switchFactors[0]=1(或 <1)不应反推出 ≥1 的乘子。
    const dev = makeDevice({ minZoom: 1, maxZoom: 4, switchFactors: [1] });
    const { result } = renderHook(() => useZoomController(dev));
    expect(result.current.displayMul).toBe(1);
  });

  it('maxZoom×displayMul 超 10x → maxDisplay 软钳到 SOFT_MAX_DISPLAY(10)', () => {
    // maxZoom=123、switchFactors=[]( displayMul=1)→ 123 被软钳到 10。
    const dev = makeDevice({ minZoom: 1, maxZoom: 123, switchFactors: [] });
    const { result } = renderHook(() => useZoomController(dev));
    expect(result.current.maxDisplay).toBe(10);
  });

  it('device 为 undefined → 全程可选链兜底(displayMul=1、min/max=1)', () => {
    const { result } = renderHook(() => useZoomController(undefined));
    expect(result.current.displayMul).toBe(1);
    expect(result.current.minDisplay).toBe(1);
    expect(result.current.maxDisplay).toBe(1);
    expect(result.current.zoom).toBe(1);
  });

  it('暴露 zoomShared / pinching 两个 SharedValue(UI 线程驱动倍数与高亮)', () => {
    const dev = makeDevice({ minZoom: 1, maxZoom: 8, switchFactors: [2] });
    const { result } = renderHook(() => useZoomController(dev));
    // jest 桩:useSharedValue(init) → { value: init }。pinching 初值 0(idle)、zoomShared 初值 1。
    expect(result.current.zoomShared).toEqual({ value: 1 });
    expect(result.current.pinching).toEqual({ value: 0 });
  });
});

describe('zoom state + 设备切换 clamp', () => {
  it('初始 zoom=1', () => {
    const dev = makeDevice({ minZoom: 1, maxZoom: 8, switchFactors: [2] });
    const { result } = renderHook(() => useZoomController(dev));
    expect(result.current.zoom).toBe(1);
  });

  it('setZoom 写入 zoom state', () => {
    const dev = makeDevice({ minZoom: 1, maxZoom: 8, switchFactors: [2] });
    const { result } = renderHook(() => useZoomController(dev));
    act(() => result.current.setZoom(3));
    expect(result.current.zoom).toBe(3);
  });

  it('切到新设备:当前 zoom 超新设备 maxZoom → clamp 回 maxZoom', () => {
    // 起始后置 dual(vzf 范围 [1,8]),setZoom(6);切到 vzf 范围仅 [1,3] 的设备 → clamp 到 3。
    const wide = makeDevice({ minZoom: 1, maxZoom: 8, switchFactors: [2] });
    const tele = makeDevice({ minZoom: 1, maxZoom: 3, switchFactors: [] });
    const { result, rerender } = renderHook<ZoomController, DeviceProps>(
      ({ device }) => useZoomController(device),
      { initialProps: { device: wide } }
    );
    act(() => result.current.setZoom(6));
    expect(result.current.zoom).toBe(6);
    // 设备切换触发 clamp effect(只依赖 device):6 > maxZoom(3) → 3。
    rerender({ device: tele });
    expect(result.current.zoom).toBe(3);
  });

  it('切到新设备:当前 zoom 低于新设备 minZoom → clamp 回 minZoom', () => {
    const ultra = makeDevice({ minZoom: 1, maxZoom: 8, switchFactors: [2] });
    const teleOnly = makeDevice({ minZoom: 2, maxZoom: 8, switchFactors: [] });
    const { result, rerender } = renderHook<ZoomController, DeviceProps>(
      ({ device }) => useZoomController(device),
      { initialProps: { device: ultra } }
    );
    // 初始 zoom=1 < teleOnly.minZoom(2) → 切换后 clamp 到 2。
    rerender({ device: teleOnly });
    expect(result.current.zoom).toBe(2);
  });

  it('切到新设备但 zoom 已在范围内 → 不变(无多余 setState)', () => {
    const a = makeDevice({ minZoom: 1, maxZoom: 8, switchFactors: [2] });
    const b = makeDevice({ minZoom: 1, maxZoom: 8, switchFactors: [] });
    const { result, rerender } = renderHook<ZoomController, DeviceProps>(
      ({ device }) => useZoomController(device),
      { initialProps: { device: a } }
    );
    act(() => result.current.setZoom(3));
    rerender({ device: b }); // 3 仍在 [1,8] 内
    expect(result.current.zoom).toBe(3);
  });
});
