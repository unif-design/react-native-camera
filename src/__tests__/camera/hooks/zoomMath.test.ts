import { clamp, pinchVzf } from '../../../camera/hooks/zoomMath';

// pinchVzf 对具体上限不敏感(softMaxVzf 是入参),这里用一组「样本」参数验证 clamp 数学本身,
// 不绑应用实际软上限(实际为 SOFT_MAX_DISPLAY=3,由 useZoomController.test 覆盖)。
// 样本设定:超广角 displayMul=0.5,softMaxVzf=20 表示某个上限,只为测乘性/封顶/单调。
const DEV_MIN = 1; // vzf:超广角 minZoom=1 → display 0.5x
const DEV_MAX = 20; // vzf 上界样本
const SOFT_MAX_VZF = 20; // 软上限样本(vzf)

describe('clamp', () => {
  test('夹在 [lo,hi]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe('pinchVzf (双指 scale → 受控 vzf)', () => {
  test('scale=1 → 不变(起点 vzf 原样,落在范围内)', () => {
    expect(pinchVzf(2, 1, DEV_MIN, DEV_MAX, SOFT_MAX_VZF)).toBe(2);
  });

  test('乘性:起点 ×scale(2×2=4,仍在范围内)', () => {
    expect(pinchVzf(2, 2, DEV_MIN, DEV_MAX, SOFT_MAX_VZF)).toBe(4);
  });

  test('缩小:scale<1 反向(起点 4 ×0.5=2)', () => {
    expect(pinchVzf(4, 0.5, DEV_MIN, DEV_MAX, SOFT_MAX_VZF)).toBe(2);
  });

  test('下限 clamp:缩到比 deviceMinZoom 还小 → deviceMinZoom(用户 0.5x)', () => {
    // 起点 1(用户 0.5x)再缩 0.5 → 0.5 < deviceMinZoom(1) → clamp 到 1。
    expect(pinchVzf(1, 0.5, DEV_MIN, DEV_MAX, SOFT_MAX_VZF)).toBe(1);
  });

  test('上限 clamp:放到超软上限 vzf → 软上限(=20,用户 10x)', () => {
    // 起点 4 ×10=40 > softMaxVzf(20) → clamp 到 20。
    expect(pinchVzf(4, 10, DEV_MIN, DEV_MAX, SOFT_MAX_VZF)).toBe(20);
  });

  test('软上限优先于 deviceMaxZoom:设备 vzf 可达 246(123x),仍钳到软上限 20', () => {
    expect(pinchVzf(10, 100, DEV_MIN, 246, SOFT_MAX_VZF)).toBe(20);
  });

  test('单调:scale 增大 → vzf 不减', () => {
    let prev = -Infinity;
    for (const s of [0.5, 1, 1.5, 2, 4]) {
      const v = pinchVzf(2, s, DEV_MIN, DEV_MAX, SOFT_MAX_VZF);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  test('无超广角(displayMul=1,设备只有广角 vzf [1,8]):范围退化仍合法', () => {
    // 单广角:devMin=1, devMax=8, softMaxVzf=min(8,10)=8。
    expect(pinchVzf(1, 0.5, 1, 8, 8)).toBe(1); // 不能缩到 <1(无 0.5x)
    expect(pinchVzf(1, 100, 1, 8, 8)).toBe(8); // 放大封顶 8x
  });
});
