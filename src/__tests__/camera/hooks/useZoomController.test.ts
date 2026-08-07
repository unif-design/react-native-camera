import { renderHook, act } from '@testing-library/react-native';
import type { CameraDevice } from 'react-native-vision-camera';
import {
  useZoomController,
  type ZoomController,
} from '../../../camera/hooks/useZoomController';
import { makeDeviceStub } from '../../__helpers__/visionCameraMock';

type DeviceProps = { device: CameraDevice | undefined };

// useZoomController 只用 device 的 minZoom/maxZoom/zoomLensSwitchFactors,造最小桩即可。
// 这里不依赖 vision-camera mock(直接传 device 对象),故重点测 displayMul 数学 + 设备切换 clamp。
// zoomShared 是**真实** SharedValue(接线来自 `@unif/react-native-design/jest-setup`),不是
// 普通 `{ value }` 对象 —— 断言一律读 `.value`,不要对整个对象做 toEqual。
// 注:pinch 实时回写已不走 useAnimatedReaction→setZoom(性能根治,见 useZoomController),
// zoom state 仅手势结束/点击档/设备切换更新。
// 薄适配:把本测试的 switchFactors 映射到 makeDeviceStub 的 zoomLensSwitchFactors;
// stub 多出的字段 useZoomController 不读,行为不变。
function makeDevice(p: {
  minZoom: number;
  maxZoom: number;
  switchFactors: number[];
}): CameraDevice {
  return makeDeviceStub({
    minZoom: p.minZoom,
    maxZoom: p.maxZoom,
    zoomLensSwitchFactors: p.switchFactors,
  }) as unknown as CameraDevice;
}

describe('displayMul / min-maxDisplay 推导', () => {
  it('后置 dual(switchFactors=[2])→ displayMul=0.5,display 范围 [0.5, 3](软上限 3x)', () => {
    const dev = makeDevice({ minZoom: 1, maxZoom: 8, switchFactors: [2] });
    const { result } = renderHook(() => useZoomController(dev));
    expect(result.current.displayMul).toBe(0.5);
    // minDisplay = minZoom(1) × 0.5 = 0.5;maxDisplay = min(maxZoom(8)×0.5=4, 软上限 3) = 3
    expect(result.current.minDisplay).toBe(0.5);
    expect(result.current.maxDisplay).toBe(3);
  });

  it('无超广角(switchFactors=[])→ displayMul=1(fallback)', () => {
    const dev = makeDevice({ minZoom: 1, maxZoom: 8, switchFactors: [] });
    const { result } = renderHook(() => useZoomController(dev));
    expect(result.current.displayMul).toBe(1);
    expect(result.current.minDisplay).toBe(1);
    // maxDisplay = min(maxZoom(8)×1, 软上限 3) = 3
    expect(result.current.maxDisplay).toBe(3);
  });

  it('switch0 ≤ 1 视为无效 → displayMul=1', () => {
    // 防御:switchFactors[0]=1(或 <1)不应反推出 ≥1 的乘子。
    const dev = makeDevice({ minZoom: 1, maxZoom: 4, switchFactors: [1] });
    const { result } = renderHook(() => useZoomController(dev));
    expect(result.current.displayMul).toBe(1);
  });

  it('maxZoom×displayMul 超软上限 → maxDisplay 软钳到 SOFT_MAX_DISPLAY(3)', () => {
    // maxZoom=123、switchFactors=[]( displayMul=1)→ 123 被软钳到 3。
    const dev = makeDevice({ minZoom: 1, maxZoom: 123, switchFactors: [] });
    const { result } = renderHook(() => useZoomController(dev));
    expect(result.current.maxDisplay).toBe(3);
  });

  it('device 为 undefined → 全程可选链兜底(displayMul=1、min/max=1),默认档 effect 早返不动 zoom', () => {
    const { result } = renderHook(() => useZoomController(undefined));
    expect(result.current.displayMul).toBe(1);
    expect(result.current.minDisplay).toBe(1);
    expect(result.current.maxDisplay).toBe(1);
    // device==null → 设备 effect 早 return、不设默认档:zoom 维持占位初值 1。
    expect(result.current.zoom).toBe(1);
  });

  it('暴露 zoomShared SharedValue(UI 线程驱动倍数与高亮),不再暴露 pinching', () => {
    const dev = makeDevice({ minZoom: 1, maxZoom: 8, switchFactors: [2] });
    const { result } = renderHook(() => useZoomController(dev));
    // 默认档 = 用户 1x:dual(displayMul=0.5)→ device effect 设 vzf 2.0(=用户 1x),zoomShared=2。
    expect(result.current.zoomShared.value).toBe(2);
    // pinching 已从对外链路彻底移除(倍数挪进高亮档药丸文字,不再有外部「大号浮层」读它)。
    expect((result.current as { pinching?: unknown }).pinching).toBeUndefined();
  });
});

describe('zoom state + 设备切换重置', () => {
  it('默认档 = 用户 1x:后置 dual(displayMul=0.5)→ device effect 设 vzf=2(用户 1x)', () => {
    // device ready 后 effect 把默认档设成用户 1x:dual displayMul=0.5 → vzf 2.0(=广角=用户 1x)。
    const dev = makeDevice({ minZoom: 1, maxZoom: 8, switchFactors: [2] });
    const { result } = renderHook(() => useZoomController(dev));
    expect(result.current.zoom).toBe(2);
    expect(result.current.zoomShared.value).toBe(2);
  });

  it('默认档 = 用户 1x:无超广角(displayMul=1)→ vzf=1(用户 1x)', () => {
    const dev = makeDevice({ minZoom: 1, maxZoom: 8, switchFactors: [] });
    const { result } = renderHook(() => useZoomController(dev));
    expect(result.current.zoom).toBe(1);
    expect(result.current.zoomShared.value).toBe(1);
  });

  it('setZoom 写入 zoom state', () => {
    const dev = makeDevice({ minZoom: 1, maxZoom: 8, switchFactors: [2] });
    const { result } = renderHook(() => useZoomController(dev));
    act(() => result.current.setZoom(3));
    expect(result.current.zoom).toBe(3);
  });

  it('翻转设备 → 重置到新设备默认档(用户 1x),不保留上一镜头变焦', () => {
    // 后置 dual 放大到 vzf 6,翻到前摄 → 不再 clamp 保留,而是重置最广 minZoom=1。
    // (前摄关 pinch、无档位药丸,继承变焦无法恢复 → 翻转必须回默认最广档,系统相机同款。)
    const wide = makeDevice({ minZoom: 1, maxZoom: 8, switchFactors: [2] });
    const front = makeDevice({ minZoom: 1, maxZoom: 3, switchFactors: [] });
    const { result, rerender } = renderHook<ZoomController, DeviceProps>(
      ({ device }) => useZoomController(device),
      { initialProps: { device: wide } }
    );
    act(() => result.current.setZoom(6));
    expect(result.current.zoom).toBe(6);
    rerender({ device: front });
    expect(result.current.zoom).toBe(1);
    expect(result.current.zoomShared.value).toBe(1);
  });

  it('翻转到 minZoom>1 的设备 → 默认档 clamp 兜底到该设备 minZoom', () => {
    // 默认档目标用户 1x(vzf 1),但长焦 minZoom=3 > 1 → defaultZoomVzf clamp 到 3。
    const ultra = makeDevice({ minZoom: 1, maxZoom: 8, switchFactors: [2] });
    const teleOnly = makeDevice({ minZoom: 3, maxZoom: 8, switchFactors: [] });
    const { result, rerender } = renderHook<ZoomController, DeviceProps>(
      ({ device }) => useZoomController(device),
      { initialProps: { device: ultra } }
    );
    act(() => result.current.setZoom(6));
    rerender({ device: teleOnly });
    expect(result.current.zoom).toBe(3);
    expect(result.current.zoomShared.value).toBe(3);
  });

  it('翻转设备即使原 zoom 在新设备范围内也重置默认档(回默认取景)', () => {
    const a = makeDevice({ minZoom: 1, maxZoom: 8, switchFactors: [2] });
    const b = makeDevice({ minZoom: 1, maxZoom: 8, switchFactors: [] });
    const { result, rerender } = renderHook<ZoomController, DeviceProps>(
      ({ device }) => useZoomController(device),
      { initialProps: { device: a } }
    );
    act(() => result.current.setZoom(3));
    rerender({ device: b }); // 3 仍在 [1,8] 内,但翻转仍回默认档 vzf=1
    expect(result.current.zoom).toBe(1);
  });
});
